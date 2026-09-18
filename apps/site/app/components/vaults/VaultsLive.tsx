import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useReadContracts, useSwitchChain } from "wagmi";

import { Badge, Button, Input, Tabs } from "@ouro/ds";
import { KVRow, MicroLabel, body14, mono } from "~/components/site";
import { CARD_INDEX, VaultBar, VaultCard, VaultList, VaultsStatic } from "~/components/vaults/VaultFrame";
import { WalletButton } from "~/components/wallet/WalletButton";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { externalLinkProps, site } from "~/content/site";
import { LIVE_VAULTS, TOKEN_DECIMALS, type LiveVault } from "~/content/vaults";
import { usePrices, type Prices } from "~/hooks/usePrices";
import { publishPooled } from "~/hooks/useVaultsPooled";
import { gainIn, useVaultEarnings, type Gain, type VaultEarnings } from "~/hooks/useVaultEarnings";
import { useVaultActions, useVaultView, type TxState, type VaultActions, type VaultView } from "~/hooks/useVault";
import { ago, fmtAge, fmtNum, fmtTokens, fmtUsd } from "@ouro/monitor-client";
import { fmtAmount, parseAmount, vaultAbi } from "~/lib/vaultChain";
import { YIELD_DISPLAY_CAP_PCT, fmtYieldPct, projectedYieldPct, realisedYield, toNumber, usdValue } from "~/lib/vaultYield";
import { hasWalletConnect, robinhoodChain } from "~/lib/wagmi";

/* ────────────────────────────────────────────────────────────────────────────
   The live vaults section. Loaded on the client only (routes/vaults.tsx imports it lazily once
   mounted), so this module and everything it pulls in, wagmi, RainbowKit and viem, never reach the
   server bundle or the prerender. Reading the chain needs no wallet; acting does.
   ──────────────────────────────────────────────────────────────────────────── */

const OURO_DECIMALS = TOKEN_DECIMALS.ouro;

export default function VaultsLive() {
  return (
    <WalletProvider fallback={<VaultsStatic />}>
      <LiveSection />
    </WalletProvider>
  );
}

function LiveSection() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const ready = isConnected && chainId === robinhoodChain.id;
  const prices = usePrices();
  const pooled = useCombinedPooled();
  const pooledTokens = toNumber(pooled, OURO_DECIMALS);
  // Up to the page header, which states the same total as a share of the floating supply and has no
  // way to read the chain itself. See hooks/useVaultsPooled.
  useEffect(() => publishPooled(pooledTokens), [pooledTokens]);

  const earnings = useVaultEarnings(address);
  const { behind, onConfirmed } = useIndexSync(earnings.indexedBlock, address);

  return (
    <>
      <VaultBar
        pooled={pooled === undefined ? "—" : fmtAmount(pooled, OURO_DECIMALS, 0)}
        earned={isConnected && earnings.configured ? (behind ? "Working out what you have earned" : `You have earned ${fmtUsd(earnings.lifetimeUsd)}`) : undefined}
        right={<WalletButton />}
      />
      <VaultList>
        {LIVE_VAULTS.map((v, i) => (
          <VaultPanel
            key={v.entry.address}
            n={CARD_INDEX[i] ?? String(i + 1)}
            vault={v}
            prices={prices}
            ready={ready}
            earnings={earnings}
            earningsBehind={behind}
            onConfirmed={onConfirmed}
          />
        ))}
      </VaultList>
      <div style={{ ...body14, fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
        Dollar figures use the OURO and ETH prices from ouro-monitor{prices.fallback ? ", with DexScreener filling in what it could not give" : ""}, and USDG
        counts as one dollar. Each rate says where its own figure comes from. Neither is a promise of returns.
      </div>
    </>
  );
}

/**
 * Whether ouro-monitor's deposit and withdrawal index has caught up with this wallet's own latest
 * vault transaction.
 *
 * It matters for one figure: the gain on the compounding vault is the balance less the cost basis,
 * and the balance is read live while the basis comes from the index. In the seconds between a deposit
 * being mined and the index reaching that block, the deposit is in the balance and not in the basis,
 * and the whole deposit would read as gain. So the panels hold the figure back until the index has
 * passed the block their transaction landed in. Latched, not read off the transaction state, so
 * dismissing the status line does not drop the guard.
 */
function useIndexSync(indexedBlock: number | null, address: `0x${string}` | undefined) {
  const [confirmedAt, setConfirmedAt] = useState(0);
  // A change of wallet makes the previous wallet's block meaningless.
  useEffect(() => setConfirmedAt(0), [address]);
  const onConfirmed = useCallback((block: bigint) => setConfirmedAt((b) => Math.max(b, Number(block))), []);
  // A monitor that has not answered at all leaves `indexedBlock` null, and that is a dash rather
  // than a wait: there is nothing to catch up to.
  return { behind: confirmedAt > 0 && indexedBlock !== null && indexedBlock < confirmedAt, onConfirmed };
}

/** Deposits across every live vault, one multicall. */
function useCombinedPooled(): bigint | undefined {
  const { data } = useReadContracts({
    contracts: LIVE_VAULTS.map((v) => ({ address: v.entry.address, abi: vaultAbi, functionName: "totalAssets" as const })),
    query: { refetchInterval: 15_000 },
  });
  if (!data || data.some((d) => d.status !== "success")) return undefined;
  return data.reduce((acc, d) => acc + (d.result as bigint), 0n);
}

/* ── one vault ─────────────────────────────────────────────────────────────── */

/** "1,234 OURO ($5.20)" or just the token amount while the price is unknown. */
function withUsd(value: bigint | undefined, decimals: number, symbol: string, priceUsd: number | null, maxFrac = 4): string {
  const amount = `${fmtAmount(value, decimals, maxFrac)} ${symbol}`;
  const usd = usdValue(value, decimals, priceUsd);
  return usd === null || value === undefined ? amount : `${amount} (${fmtUsd(usd)})`;
}


/** Dollars per unit of what the vault pays out: OURO, USDG at a dollar, or ETH. */
function payoutUsdFor(vault: LiveVault, prices: Prices): number | null {
  if (vault.kind === "compounding") return prices.ouroUsd;
  return vault.payoutSymbol === "USDG" ? 1 : prices.ethUsd;
}

type Tab = "deposit" | "withdraw";

function VaultPanel({
  n,
  vault,
  prices,
  ready,
  earnings,
  earningsBehind,
  onConfirmed,
}: {
  n: string;
  vault: LiveVault;
  prices: Prices;
  ready: boolean;
  earnings: VaultEarnings;
  earningsBehind: boolean;
  onConfirmed: (block: bigint) => void;
}) {
  const { address, isConnected } = useAccount();
  const view = useVaultView(vault, address);
  const actions = useVaultActions(vault);
  const nowSec = Date.now() / 1000;
  // Up to the section, which holds every earned figure back until the monitor's index has passed it.
  const confirmedBlock = actions.tx.block;
  useEffect(() => {
    if (confirmedBlock !== undefined) onConfirmed(confirmedBlock);
  }, [confirmedBlock, onConfirmed]);
  const payoutUsd = payoutUsdFor(vault, prices);
  const tvlUsd = usdValue(view.totalAssets, OURO_DECIMALS, prices.ouroUsd);
  const yields = yieldFigure(vault, view, prices, tvlUsd, payoutUsd, nowSec);

  // Which tab the panel is open on, or null while it is closed. Pressing the button of the open tab
  // closes it again.
  const [openTab, setOpenTab] = useState<Tab | null>(null);
  const [tab, setTab] = useState<Tab>("deposit");
  const press = (t: Tab) => {
    if (openTab === t) {
      setOpenTab(null);
      return;
    }
    setTab(t);
    setOpenTab(t);
  };
  const pickTab = (t: Tab) => {
    setTab(t);
    setOpenTab(t);
  };

  const claiming = actions.busy && actions.tx.phase === "claiming";
  const canClaim = ready && view.earned !== undefined && view.earned > 0n && !actions.busy;
  const earnedUsd = usdValue(view.earned, vault.payoutDecimals, payoutUsd);
  const collectLabel = claiming
    ? "Claiming…"
    : isConnected && view.earned !== undefined && view.earned > 0n
      ? `Collect ${earnedUsd === null ? `${fmtAmount(view.earned, vault.payoutDecimals, 4)} ${vault.payoutSymbol}` : fmtUsd(earnedUsd)}`
      : "Collect";

  return (
    <VaultCard
      n={n}
      vault={vault}
      pooled={tvlUsd === null ? "—" : fmtUsd(tvlUsd, { compact: true })}
      pooledNote={
        view.totalAssets === undefined
          ? "Reading the chain"
          : `${fmtAmount(view.totalAssets, OURO_DECIMALS, 0)} OURO${tvlUsd === null ? ", awaiting a price" : ""}`
      }
      yieldLabel={yields.label}
      yieldValue={yields.value}
      yieldNote={yields.note}
      paused={view.paused === true}
      rows={
        <LiveRows
          vault={vault}
          view={view}
          prices={prices}
          payoutUsd={payoutUsd}
          connected={isConnected}
          gain={gainIn(earnings, vault.entry.address)}
          gainBehind={earningsBehind}
        />
      }
      open={openTab !== null}
      actions={
        <>
          <Button size="sm" variant={openTab === "deposit" ? "secondary" : "primary"} aria-expanded={openTab === "deposit"} onClick={() => press("deposit")}>
            Deposit
          </Button>
          <Button size="sm" variant="secondary" aria-expanded={openTab === "withdraw"} onClick={() => press("withdraw")}>
            Withdraw
          </Button>
          {vault.kind === "payout" && (
            <Button size="sm" variant={canClaim ? "primary" : "secondary"} disabled={!canClaim} onClick={() => void actions.claim()}>
              {collectLabel}
            </Button>
          )}
        </>
      }
      panel={<Actions vault={vault} view={view} actions={actions} ready={ready} payoutUsd={payoutUsd} tab={tab} onTab={pickTab} onClose={() => setOpenTab(null)} />}
    />
  );
}

/**
 * The vault's rate: its own latest harvest annualised once it holds the airdrop line, and until then
 * the airdrop rate projected through the vault's fees. The note says which of the two the figure is.
 */
function yieldFigure(vault: LiveVault, view: VaultView, prices: Prices, tvlUsd: number | null, payoutUsd: number | null, nowSec: number): { label: "APY" | "APR"; value: string; note: string } {
  const compounding = vault.kind === "compounding";
  const label = compounding ? "APY" : "APR";
  const dep = vault.token.symbol;

  if (view.totalAssets === undefined) {
    return { label, value: "—", note: "Reading the vault from the chain" };
  }

  const realised = realisedYield({
    kind: vault.kind,
    profitUnlockPeriod: view.profitUnlockPeriod,
    rewardRate: view.rewardRate,
    periodFinish: view.periodFinish,
    lockedProfitAtHarvest: view.lockedProfitAtHarvest,
    lastHarvest: view.lastHarvest,
    totalAssets: view.totalAssets,
    assetDecimals: OURO_DECIMALS,
    payoutDecimals: vault.payoutDecimals,
    payoutUsd,
    tvlUsd,
  });
  // The airdrop pays the vault only once it holds the line. Under it, whatever the vault has harvested
  // came from tokens sent to it directly, and annualising that would mislead.
  const line = BigInt(vault.token.thresholdTokens) * 10n ** BigInt(OURO_DECIMALS);
  const lineLabel = `${vault.token.thresholdTokens.toLocaleString("en-US")} ${dep}`;
  const aboveLine = view.totalAssets >= line;

  if (realised && aboveLine) {
    const capped = realised.pct > YIELD_DISPLAY_CAP_PCT;
    return {
      label,
      value: fmtYieldPct(realised.pct),
      note: `From the harvest ${ago(nowSec - realised.harvestAt)} ago, annualised${compounding ? " with daily compounding" : ""}${capped ? ", capped: that harvest was out of proportion to the vault" : ""}`,
    };
  }
  const harvested = (view.periodFinish ?? 0n) > 0n;
  if (!compounding && !realised && harvested && aboveLine && (tvlUsd === null || payoutUsd === null)) {
    return { label, value: "—", note: "Waiting for the prices this figure rests on" };
  }

  if (prices.airdrop) {
    const projected = fmtYieldPct(projectedYieldPct(vault.kind, prices.airdrop.aprPct));
    const basis = `Projected from the airdrop rate, ${fmtNum(prices.airdrop.aprPct, 0)}% over ${fmtAge(prices.airdrop.basisDays)}, less the 10% fee${compounding ? " and the pool tax on rebuys" : ""}`;
    return {
      label,
      value: projected.startsWith(">") ? projected : `~${projected}`,
      note: aboveLine
        ? `${basis}. The vault's own figure takes over after its first harvest`
        : `${basis}. The vault's own figure takes over once it holds ${lineLabel} and has harvested`,
    };
  }
  if (view.loading || prices.loading) return { label, value: "—", note: "Reading the chain and the monitor" };
  return { label, value: "—", note: "No harvest yet, and no airdrop rate to project from" };
}

/** The card's three rows. Pooled and the rate are the figures above, so neither is repeated here. */
function LiveRows({
  vault,
  view,
  prices,
  payoutUsd,
  connected,
  gain,
  gainBehind,
}: {
  vault: LiveVault;
  view: VaultView;
  prices: Prices;
  payoutUsd: number | null;
  connected: boolean;
  gain: Gain;
  gainBehind: boolean;
}) {
  const dep = vault.token.symbol;
  const compounding = vault.kind === "compounding";
  return (
    <>
      {compounding ? (
        <KVRow label={`1 ${dep} deposited is now worth`} value={`${fmtAmount(view.pricePerShare, OURO_DECIMALS, 6)} ${dep}`} />
      ) : (
        <KVRow label={`${vault.payoutSymbol} earned`} value={withUsd(view.accountedPayout, vault.payoutDecimals, vault.payoutSymbol, payoutUsd)} />
      )}
      <KVRow label="Your deposit" value={connected ? withUsd(view.deposited, OURO_DECIMALS, dep, prices.ouroUsd) : "—"} />
      {/* What the wallet has earned here. The compounding vault pays by lifting the share price, so
          its figure is the gain on the cost basis and ouro-monitor is the only thing that knows it
          (hooks/useVaultEarnings); a payout vault holds the wallet's own balance of what it owes,
          which the chain answers exactly. */}
      {compounding ? (
        <KVRow
          label="You have earned"
          value={!connected ? "—" : gainBehind ? "Updating" : gainValue(gain, dep)}
          border="none"
          valueStyle={gain.kind === "known" && gain.tokens > 0 && connected && !gainBehind ? { fontWeight: 600, color: "var(--text-accent)" } : undefined}
        />
      ) : (
        <KVRow
          label="Yours to collect"
          value={connected ? withUsd(view.earned, vault.payoutDecimals, vault.payoutSymbol, payoutUsd) : "—"}
          border="none"
          valueStyle={connected && view.earned !== undefined && view.earned > 0n ? { fontWeight: 600, color: "var(--text-accent)" } : undefined}
        />
      )}
    </>
  );
}

/** "0.471 OURO (< $0.01)", "Nothing yet" for a wallet that has deposited nothing, or a dash. */
function gainValue(gain: Gain, symbol: string): string {
  if (gain.kind === "unknown") return "—";
  if (gain.kind === "none" || gain.tokens <= 0) return "Nothing yet";
  const amount = `${fmtTokens(gain.tokens)} ${symbol}`;
  return gain.usd === null ? amount : `${amount} (${fmtUsd(gain.usd)})`;
}

/* ── deposit and withdraw ──────────────────────────────────────────────────── */

const TABS = [
  { id: "deposit", label: "Deposit" },
  { id: "withdraw", label: "Withdraw" },
];

/** Shares of the balance, beside the amount label. Max is the fourth and lives in the field. */
const PCTS = [25, 50, 75];

function busyLabel(tx: TxState): string {
  const what = tx.phase === "approving" ? "approval" : tx.phase === "depositing" ? "deposit" : tx.phase === "withdrawing" ? "withdrawal" : "claim";
  return tx.hash ? `Confirming the ${what}…` : `Sign the ${what} in your wallet…`;
}

function Actions({
  vault,
  view,
  actions,
  ready,
  payoutUsd,
  tab,
  onTab,
  onClose,
}: {
  vault: LiveVault;
  view: VaultView;
  actions: VaultActions;
  ready: boolean;
  payoutUsd: number | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { tx, busy, deposit, withdraw, reset } = actions;
  const [raw, setRaw] = useState("");
  /** Set by Max on the withdraw tab: leave by redeeming every share, so no rounding dust stays behind. */
  const [everything, setEverything] = useState(false);

  const dep = vault.token.symbol;
  const amount = parseAmount(raw, OURO_DECIMALS);
  const max = tab === "deposit" ? view.walletBalance : view.deposited;
  const tooMuch = amount !== null && max !== undefined && amount > max;

  const pick = (id: string) => {
    onTab(id as Tab);
    setRaw("");
    setEverything(false);
    reset();
  };
  const setMax = () => {
    if (max === undefined) return;
    setRaw(formatUnits(max, OURO_DECIMALS));
    setEverything(tab === "withdraw");
  };
  const setPct = (pct: number) => {
    if (max === undefined) return;
    setRaw(formatUnits((max * BigInt(pct)) / 100n, OURO_DECIMALS));
    setEverything(false);
  };

  let cta: ReactNode;
  if (!isConnected) {
    cta = (
      <Button size="lg" onClick={() => openConnectModal?.()}>
        Connect wallet
      </Button>
    );
  } else if (!ready) {
    cta = (
      <Button size="lg" variant="secondary" disabled={switching} onClick={() => switchChain({ chainId: robinhoodChain.id })}>
        Switch to {site.chain.name}
      </Button>
    );
  } else if (tab === "deposit") {
    const needsApproval = amount !== null && view.allowance !== undefined && view.allowance < amount;
    const label = busy ? busyLabel(tx) : view.paused ? "Deposits are paused" : needsApproval ? `Approve and deposit ${dep}` : `Deposit ${dep}`;
    cta = (
      <Button size="lg" disabled={busy || amount === null || tooMuch || view.paused === true} onClick={() => amount !== null && void deposit(amount, view.allowance ?? 0n)}>
        {label}
      </Button>
    );
  } else {
    cta = (
      <Button
        size="lg"
        disabled={busy || amount === null || tooMuch}
        onClick={() => {
          if (amount === null) return;
          if (everything && view.shares) void withdraw({ allShares: view.shares });
          else void withdraw({ assets: amount });
        }}
      >
        {busy ? busyLabel(tx) : `Withdraw ${dep}`}
      </Button>
    );
  }

  const hint = !isConnected
    ? hasWalletConnect
      ? "Connect a wallet to deposit or withdraw."
      : "Connect a browser extension wallet, or open this page in your wallet's browser."
    : !ready
      ? `Switch your wallet to ${site.chain.name}.`
      : tab === "deposit"
        ? `In your wallet: ${fmtAmount(view.walletBalance, OURO_DECIMALS)} ${dep}`
        : `Deposited: ${fmtAmount(view.deposited, OURO_DECIMALS)} ${dep}${vault.kind === "payout" ? ". Withdrawing everything also claims your earnings" : ""}`;

  return (
    <>
      <div className="vpanel__head">
        <Tabs items={TABS} active={tab} onChange={pick} style={{ borderBottom: "none", flex: 1 }} />
        <button type="button" className="text-button" onClick={onClose} style={{ fontSize: 13, textDecoration: "none", color: "var(--text-muted)" }}>
          Close
        </button>
      </div>
      {view.paused && (
        <div style={{ margin: "12px 0 0" }}>
          <Badge tone="caution">Paused: deposits closed, withdrawals open</Badge>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <Input
          label={
            <span className="vault-amount">
              <span>{tab === "deposit" ? "Amount to deposit" : "Amount to withdraw"}</span>
              <span className="vault-pcts">
                {PCTS.map((pct) => (
                  <button key={pct} type="button" className="vault-pct" disabled={!ready || busy || max === undefined} onClick={() => setPct(pct)}>
                    {pct}%
                  </button>
                ))}
              </span>
            </span>
          }
          mono
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="0.0"
          value={raw}
          disabled={!ready || busy}
          onChange={(e) => {
            setRaw(e.target.value);
            setEverything(false);
          }}
          suffix={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={setMax}
                disabled={!ready || busy || max === undefined}
                style={{
                  ...mono,
                  appearance: "none",
                  background: "none",
                  border: "none",
                  padding: "8px 6px",
                  margin: "-8px -6px",
                  cursor: ready ? "pointer" : "default",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-accent)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Max
              </button>
              <span>{dep}</span>
            </span>
          }
          hint={hint}
          error={tooMuch ? (tab === "deposit" ? `More ${dep} than the wallet holds` : "More than you have deposited") : undefined}
        />
      </div>
      <div className="vault-cta" style={{ marginTop: 14 }}>
        {cta}
      </div>
      <TxLine tx={tx} onDismiss={reset} />
      {vault.kind === "payout" && <ClaimPanel vault={vault} view={view} actions={actions} ready={ready} payoutUsd={payoutUsd} />}
    </>
  );
}

/** The claim, at the foot of the panel: the amount at figure size and the button that names the token it pays. */
function ClaimPanel({ vault, view, actions, ready, payoutUsd }: { vault: LiveVault; view: VaultView; actions: VaultActions; ready: boolean; payoutUsd: number | null }) {
  const { isConnected } = useAccount();
  const claiming = actions.busy && actions.tx.phase === "claiming";
  const nothing = view.earned === 0n;
  const armed = !nothing && view.earned !== undefined && ready;
  const label = !isConnected ? "Connect to claim" : claiming ? "Claiming…" : nothing ? `No ${vault.payoutSymbol} yet` : `Claim ${vault.payoutSymbol}`;
  return (
    <div className="vault-claim">
      <MicroLabel tone={armed ? "accent" : "faint"}>Yours to collect</MicroLabel>
      <div className="vault-claim__row">
        <span className="vault-claim__amount">{isConnected ? withUsd(view.earned, vault.payoutDecimals, vault.payoutSymbol, payoutUsd) : `— ${vault.payoutSymbol}`}</span>
        <Button size="md" variant={armed ? "primary" : "secondary"} disabled={!armed || actions.busy} onClick={() => void actions.claim()}>
          {label}
        </Button>
      </div>
    </div>
  );
}

function TxLine({ tx, onDismiss }: { tx: TxState; onDismiss: () => void }) {
  if (tx.phase === "idle") return null;
  const href = tx.hash ? `${site.links.explorer}/tx/${tx.hash}` : null;
  const color = tx.phase === "error" ? "var(--red-700)" : tx.phase === "done" ? "var(--green-700)" : "var(--text-muted)";
  return (
    <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", fontSize: 13, color }}>
      <span>
        {tx.phase === "error" || tx.phase === "done" ? tx.message : busyLabel(tx)}
        {href && (
          <>
            {" "}
            <a href={href} {...externalLinkProps(href)} className="mono-link">
              transaction ↗
            </a>
          </>
        )}
      </span>
      {(tx.phase === "done" || tx.phase === "error") && (
        <button type="button" onClick={onDismiss} className="text-button" style={{ fontSize: 12, textDecoration: "none", color: "var(--text-muted)" }}>
          Dismiss
        </button>
      )}
    </div>
  );
}

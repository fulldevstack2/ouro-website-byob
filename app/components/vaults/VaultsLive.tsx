import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useReadContracts, useSwitchChain } from "wagmi";

import { Badge, Button, Input, Tabs } from "~/components/ds";
import { KVRow, MicroLabel, body14, mono } from "~/components/site";
import { ConnectBar, Frame, STATIC_BAND, StatBand, VaultList, VaultsStatic, useOpenVault, type VaultSummary } from "~/components/vaults/VaultFrame";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { externalLinkProps, site } from "~/content/site";
import { LIVE_VAULTS, TOKEN_DECIMALS, type LiveVault } from "~/content/vaults";
import { usePrices, type Prices } from "~/hooks/usePrices";
import { useVaultActions, useVaultView, type TxState, type VaultActions, type VaultView } from "~/hooks/useVault";
import { ago, fmtAge, fmtNum, fmtUsd } from "~/lib/monitorApi";
import { fmtAmount, parseAmount, streamPerDay, timeLeft, vaultAbi } from "~/lib/vaultChain";
import { YIELD_DISPLAY_CAP_PCT, fmtYieldPct, projectedYieldPct, realisedYield, usdValue } from "~/lib/vaultYield";
import { hasWalletConnect, robinhoodChain } from "~/lib/wagmi";

/* ────────────────────────────────────────────────────────────────────────────
   The live vaults section. Loaded on the client only (routes/vaults.tsx imports it lazily once
   mounted), so this module and everything it pulls in, wagmi, RainbowKit and viem, never reach the
   server bundle or the prerender. Reading the chain needs no wallet; acting does.

   Each vault is one accordion row (see VaultFrame): the header carries TVL and the yield, the body
   the rest. A closed row still reads the chain, because its header figures are live.
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
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const ready = isConnected && chainId === robinhoodChain.id;
  const prices = usePrices();
  const pooled = useCombinedPooled();
  const tvlUsd = usdValue(pooled, OURO_DECIMALS, prices.ouroUsd);
  const { isOpen, toggle } = useOpenVault();

  return (
    <>
      <StatBand
        tvl={fmtUsd(tvlUsd, { compact: true })}
        // `exact` on the unit price: OURO trades at a fraction of a cent, so "< $0.01 each" would
        // withhold the one figure this note exists to give.
        tvlNote={pooled === undefined ? STATIC_BAND.tvlNote : `${fmtAmount(pooled, OURO_DECIMALS, 0)} OURO across the three vaults${prices.ouroUsd === null ? ", awaiting a price" : ` at ${fmtUsd(prices.ouroUsd, { exact: true })} each`}`}
        airdropRate={prices.airdrop ? `${fmtNum(prices.airdrop.aprPct, 0)}%` : "—"}
        airdropNote={prices.airdrop ? `${prices.airdrop.caveat ?? "From payouts actually made, at the rate of the last seven days."} What a wallet above the line earns, before any vault fee.` : STATIC_BAND.airdropNote}
      />
      <ConnectBar right={<ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />} />
      <VaultList>
        {LIVE_VAULTS.map((v) => (
          <VaultPanel key={v.entry.address} vault={v} prices={prices} ready={ready} open={isOpen(v.entry.address)} onToggle={() => toggle(v.entry.address)} />
        ))}
      </VaultList>
      {/* The provenance of each yield figure is said precisely inside the vault it belongs to (see
          yieldFigure's note), so this line says only what is true of all three. */}
      <div style={{ ...body14, fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
        Tap a vault for its figures, the deposit and withdraw panel and what it pays. Dollar figures use the OURO and ETH prices from ouro-monitor
        {prices.fallback ? ", with DexScreener filling in what it could not give" : ""}, and USDG counts as one dollar. Each vault's yield line says where its own
        figure comes from. Neither is a promise of returns.
      </div>
    </>
  );
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

function VaultPanel({ vault, prices, ready, open, onToggle }: { vault: LiveVault; prices: Prices; ready: boolean; open: boolean; onToggle: () => void }) {
  const { address, isConnected } = useAccount();
  const view = useVaultView(vault, address);
  const actions = useVaultActions(vault);
  const nowSec = Date.now() / 1000;
  const payoutUsd = payoutUsdFor(vault, prices);
  const tvlUsd = usdValue(view.totalAssets, OURO_DECIMALS, prices.ouroUsd);
  const yields = yieldFigure(vault, view, prices, tvlUsd, payoutUsd, nowSec);
  const summary: VaultSummary = {
    tvl: tvlUsd === null ? `${fmtAmount(view.totalAssets, OURO_DECIMALS, 0)} ${vault.token.symbol}` : fmtUsd(tvlUsd, { compact: true }),
    yieldLabel: yields.label,
    yieldValue: yields.value,
  };
  return (
    <Frame
      vault={vault}
      open={open}
      onToggle={onToggle}
      summary={summary}
      note={yields.note}
      paused={view.paused === true}
      rows={<LiveStats vault={vault} view={view} prices={prices} payoutUsd={payoutUsd} nowSec={nowSec} connected={isConnected} />}
    >
      <Actions vault={vault} view={view} actions={actions} ready={ready} payoutUsd={payoutUsd} />
    </Frame>
  );
}

/**
 * The vault's yield: its own latest harvest annualised once it holds the airdrop line, and until then
 * the airdrop rate projected through the vault's fees. The note says which of the two the figure is.
 */
function yieldFigure(vault: LiveVault, view: VaultView, prices: Prices, tvlUsd: number | null, payoutUsd: number | null, nowSec: number): { label: "APY" | "APR"; value: string; note: string } {
  const compounding = vault.kind === "compounding";
  const label = compounding ? "APY" : "APR";
  const dep = vault.token.symbol;

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
  // The airdrop pays the vault only once it holds the line. Under it, whatever the vault has harvested came from
  // tokens sent to it directly, and annualising that would mislead, so the projection stands in until it crosses.
  const line = BigInt(vault.token.thresholdTokens) * 10n ** BigInt(OURO_DECIMALS);
  const lineLabel = `${vault.token.thresholdTokens.toLocaleString("en-US")} ${dep}`;
  const aboveLine = view.totalAssets !== undefined && view.totalAssets >= line;

  if (realised && aboveLine) {
    const capped = realised.pct > YIELD_DISPLAY_CAP_PCT;
    return {
      label,
      value: fmtYieldPct(realised.pct),
      note: `From the harvest ${ago(nowSec - realised.harvestAt)} ago, annualised${compounding ? " with daily compounding" : ""}${capped ? ", shown capped: that harvest was out of proportion to the vault's size" : ""}.`,
    };
  }
  if (prices.airdrop) {
    const projected = fmtYieldPct(projectedYieldPct(vault.kind, prices.airdrop.aprPct));
    const basis = `Projected: the airdrop rate (${fmtNum(prices.airdrop.aprPct, 1)}% over ${fmtAge(prices.airdrop.basisDays)}) less the 10% fee${compounding ? " and the 5% pool tax on rebuys" : ""}.`;
    return {
      label,
      value: projected.startsWith(">") ? projected : `~${projected}`,
      note: aboveLine
        ? `${basis} The vault's own figure takes over after its first harvest.`
        : realised
          ? `${basis} Under the ${lineLabel} airdrop line the vault is not paid the airdrop yet, so its own harvests are not annualised here.`
          : `${basis} The vault's own figure takes over once it holds ${lineLabel} and has harvested.`,
    };
  }
  if (view.loading || prices.loading) return { label, value: "—", note: "Reading the chain and the monitor." };
  return {
    label,
    value: "—",
    note: realised
      ? `No airdrop rate to project from, and under the ${lineLabel} airdrop line the vault's own harvests are not a guide.`
      : "No harvest yet, and no airdrop rate to project from.",
  };
}

/** The body's figures. TVL and the yield are in the header instead, so neither is repeated here. */
function LiveStats({
  vault,
  view,
  prices,
  payoutUsd,
  nowSec,
  connected,
}: {
  vault: LiveVault;
  view: VaultView;
  prices: Prices;
  payoutUsd: number | null;
  nowSec: number;
  connected: boolean;
}) {
  const dep = vault.token.symbol;
  const compounding = vault.kind === "compounding";
  const perDay = view.rewardRate !== undefined && view.periodFinish !== undefined ? streamPerDay(view.rewardRate, view.periodFinish, nowSec) : undefined;
  const ends = view.periodFinish !== undefined ? timeLeft(view.periodFinish, nowSec) : null;

  return (
    <>
      <KVRow label="Pooled" value={`${fmtAmount(view.totalAssets, OURO_DECIMALS, 0)} ${dep}`} />
      {compounding ? (
        <KVRow label="Share price" value={`${fmtAmount(view.pricePerShare, OURO_DECIMALS, 6)} ${dep}`} />
      ) : (
        <KVRow label="Owed to depositors" value={withUsd(view.accountedPayout, vault.payoutDecimals, vault.payoutSymbol, payoutUsd)} />
      )}
      {compounding ? (
        <KVRow label="Vesting to depositors" value={view.lockedProfit === undefined ? "—" : view.lockedProfit === 0n ? "Nothing yet" : withUsd(view.lockedProfit, OURO_DECIMALS, dep, prices.ouroUsd)} />
      ) : (
        <KVRow
          label="Streaming"
          value={perDay === undefined ? "—" : perDay === 0n || !ends ? "No stream running" : `${withUsd(perDay, vault.payoutDecimals, vault.payoutSymbol, payoutUsd)} a day, ${ends} left`}
        />
      )}
      {/* No "yours to claim" row on a payout vault: the figure and its button are the ClaimPanel in
          the action card above, where a reader looks for something to press. */}
      <KVRow label="Your deposit" value={connected ? withUsd(view.deposited, OURO_DECIMALS, dep, prices.ouroUsd) : "—"} border={compounding ? "bottom" : "none"} />
      {compounding && <KVRow label="Yours to claim" value="Compounded into shares" border="none" />}
    </>
  );
}

/**
 * The claim, given its own block at the foot of the action card rather than a small secondary button
 * squeezed into a figures row, where it read as a footnote to an amount instead of the second thing
 * this vault is for. A white sub-card inside the tinted panel, the amount at figure size, and a
 * primary button that names the token it pays.
 *
 * Shown whether or not a wallet is connected, so a reader can see the vault has something to claim at
 * all; the button carries the reason it is not pressable yet.
 */
function ClaimPanel({ vault, view, actions, ready, payoutUsd }: { vault: LiveVault; view: VaultView; actions: VaultActions; ready: boolean; payoutUsd: number | null }) {
  const { isConnected } = useAccount();
  const claiming = actions.busy && actions.tx.phase === "claiming";
  const nothing = view.earned === 0n;
  const armed = !nothing && view.earned !== undefined && ready;
  const label = !isConnected ? "Connect to claim" : claiming ? "Claiming..." : nothing ? `No ${vault.payoutSymbol} yet` : `Claim ${vault.payoutSymbol}`;
  return (
    <div className="vault-claim">
      {/* Bronze once there is something to take: with the box gone this is what makes the row catch
          the eye on the way past. */}
      <MicroLabel tone={armed ? "accent" : "faint"}>Yours to claim</MicroLabel>
      <div className="vault-claim__row">
        <span className="vault-claim__amount">{isConnected ? withUsd(view.earned, vault.payoutDecimals, vault.payoutSymbol, payoutUsd) : `— ${vault.payoutSymbol}`}</span>
        {/* Ink only when it can actually be pressed: a disabled primary is a heavy grey slab, and
            three of them down the page shout without offering anything. */}
        <Button size="md" variant={armed ? "primary" : "secondary"} disabled={!armed || actions.busy} onClick={() => void actions.claim()}>
          {label}
        </Button>
      </div>
    </div>
  );
}

/* ── deposit and withdraw ──────────────────────────────────────────────────── */

type Tab = "deposit" | "withdraw";
const TABS = [
  { id: "deposit", label: "Deposit" },
  { id: "withdraw", label: "Withdraw" },
];

function busyLabel(tx: TxState): string {
  const what = tx.phase === "approving" ? "approval" : tx.phase === "depositing" ? "deposit" : tx.phase === "withdrawing" ? "withdrawal" : "claim";
  return tx.hash ? `Confirming the ${what}...` : `Sign the ${what} in your wallet...`;
}

function Actions({ vault, view, actions, ready, payoutUsd }: { vault: LiveVault; view: VaultView; actions: VaultActions; ready: boolean; payoutUsd: number | null }) {
  const { isConnected } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { tx, busy, deposit, withdraw, reset } = actions;
  const [tab, setTab] = useState<Tab>("deposit");
  const [raw, setRaw] = useState("");
  /** Set by Max on the withdraw tab: leave by redeeming every share, so no rounding dust stays behind. */
  const [everything, setEverything] = useState(false);

  const dep = vault.token.symbol;
  const amount = parseAmount(raw, OURO_DECIMALS);
  const max = tab === "deposit" ? view.walletBalance : view.deposited;
  const tooMuch = amount !== null && max !== undefined && amount > max;

  const pick = (id: string) => {
    setTab(id as Tab);
    setRaw("");
    setEverything(false);
    reset();
  };
  const setMax = () => {
    if (max === undefined) return;
    setRaw(formatUnits(max, OURO_DECIMALS));
    setEverything(tab === "withdraw");
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

  // Always one line, so the block keeps its height whatever the wallet state.
  const hint = !isConnected
    ? // Without a WalletConnect project id there is no QR path, so the only way in is an injected
      // provider: an extension, or a wallet's own in-app browser. Said here, on the line that was
      // already telling a disconnected reader to connect, rather than as its own paragraph.
      hasWalletConnect
      ? "Connect a wallet to deposit or withdraw."
      : "Connect a browser extension wallet, or open this page in your wallet's browser."
    : !ready
      ? `Switch your wallet to ${site.chain.name}.`
      : tab === "deposit"
        ? `In your wallet: ${fmtAmount(view.walletBalance, OURO_DECIMALS)} ${dep}`
        : `Deposited: ${fmtAmount(view.deposited, OURO_DECIMALS)} ${dep}${vault.kind === "payout" ? ". Withdrawing everything also claims your earnings" : ""}`;

  return (
    <>
      {view.paused && (
        <div style={{ marginBottom: 12 }}>
          <Badge tone="caution">Paused: deposits closed, withdrawals open</Badge>
        </div>
      )}
      <Tabs items={TABS} active={tab} onChange={pick} />
      <div style={{ marginTop: 16 }}>
        <Input
          label={tab === "deposit" ? `Amount to deposit` : `Amount to withdraw`}
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
                /* Padded out and pulled back in, so a finger has something to hit without the row growing. */
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
                  color: "var(--bronze-700)",
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
            <a href={href} {...externalLinkProps(href)} style={{ ...mono, fontSize: 12 }}>
              transaction ↗
            </a>
          </>
        )}
      </span>
      {(tx.phase === "done" || tx.phase === "error") && (
        <button type="button" onClick={onDismiss} style={{ appearance: "none", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
          Dismiss
        </button>
      )}
    </div>
  );
}

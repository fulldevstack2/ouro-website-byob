import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useAccount, useSignMessage } from "wagmi";

import { Button } from "@ouro/ds";
import {
  byobCancelPending,
  byobChallenge,
  byobSaveWeights,
  byobVerify,
  fetchByobBasket,
  fetchByobStatus,
  fmtTokens,
  type ByobStatus,
} from "@ouro/monitor-client";
import { WalletButton } from "~/components/wallet/WalletButton";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { LINE_TOKENS } from "~/content/protocol";
import { site } from "~/content/site";
import { usePortfolioSummary } from "~/hooks/usePortfolio";
import {
  bpsFromPct,
  clearByobJwt,
  nudgePct,
  pctFromBps,
  readByobJwt,
  setBoundary,
  writeByobJwt,
  type PctMap,
} from "~/lib/byob";
import {
  BYOB_ADDRESSES,
  BYOB_TOKENS,
  ByobChrome,
  ByobStack,
  ByobStatic,
  ByobTokenRow,
  DEFAULT_PCT,
} from "~/components/byob/ByobFrame";

/** Airdrop cycles run every 2 hours — used only for plain-language timing copy. */
const CYCLE_HOURS = 2;

/**
 * Live BYOB page — wallet SIWE → JWT → weight prefs on ouro-monitor.
 * Loaded client-only (see routes/byob.tsx) so wagmi never hits the prerender.
 */
export default function ByobLive() {
  return (
    <WalletProvider fallback={<ByobStatic />}>
      <LivePanel />
    </WalletProvider>
  );
}

function LivePanel() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const portfolio = usePortfolioSummary((address as Address | undefined) ?? null, 30_000);

  const [pct, setPct] = useState<PctMap>(DEFAULT_PCT);
  const [baseline, setBaseline] = useState<PctMap>(DEFAULT_PCT);
  const [status, setStatus] = useState<ByobStatus | null>(null);
  const [allocateEnabled, setAllocateEnabled] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sign" | "save" | "cancel" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(() => (typeof window !== "undefined" ? readByobJwt() : null));

  const addresses = useMemo(() => {
    if (status?.basket?.length) return status.basket.map((t) => t.address.toLowerCase());
    return BYOB_ADDRESSES;
  }, [status]);

  const tokens = useMemo(() => {
    if (!status?.basket?.length) return BYOB_TOKENS;
    return status.basket.map((b) => {
      const known = BYOB_TOKENS.find((t) => t.address.toLowerCase() === b.address.toLowerCase());
      return {
        symbol: b.symbol,
        address: b.address,
        icon: known?.icon,
      };
    });
  }, [status]);

  const total = useMemo(() => Object.values(pct).reduce((a, b) => a + b, 0), [pct]);
  const dirty = useMemo(() => addresses.some((a) => (pct[a] ?? 0) !== (baseline[a] ?? 0)), [pct, baseline, addresses]);

  const lineTokens = status?.lineTokens ?? LINE_TOKENS;
  const delayCycles = status?.delayCycles ?? 2;
  const delayHours = delayCycles * CYCLE_HOURS;
  const balanceTokens = portfolio.data?.balanceTokens;
  const atLine =
    balanceTokens !== undefined
      ? balanceTokens >= lineTokens
      : portfolio.data
        ? portfolio.data.eligible && !portfolio.data.excluded
        : null;

  const refresh = useCallback(async (addr: string) => {
    setLoadErr(null);
    try {
      const [s, basket] = await Promise.all([fetchByobStatus(addr), fetchByobBasket()]);
      setStatus(s);
      setAllocateEnabled(Boolean(basket.allocateEnabled));
      const source = s.pending?.weights ?? s.active?.weights ?? s.defaultWeights;
      const next = pctFromBps(source, s.basket.map((t) => t.address));
      setPct(next);
      setBaseline(next);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load BYOB status");
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setStatus(null);
      setPct(DEFAULT_PCT);
      setBaseline(DEFAULT_PCT);
      return;
    }
    void refresh(address);
  }, [address, refresh]);

  // Drop JWT when wallet changes.
  useEffect(() => {
    if (!address) {
      clearByobJwt();
      setJwt(null);
      return;
    }
    const stored = readByobJwt();
    setJwt(stored);
  }, [address]);

  const ensureJwt = async (): Promise<string> => {
    if (!address) throw new Error("Connect a wallet first");
    if (jwt) return jwt;
    setBusy("sign");
    const challenge = await byobChallenge(address, chainId ?? site.chain.id);
    const signature = await signMessageAsync({ message: challenge.message });
    const verified = await byobVerify({
      challengeId: challenge.challengeId,
      signature,
      address,
      chainId: chainId ?? site.chain.id,
    });
    writeByobJwt(verified.accessToken);
    setJwt(verified.accessToken);
    setBusy(null);
    return verified.accessToken;
  };

  const onNudge = (addr: string, delta: number) => {
    setPct((prev) => nudgePct(prev, addr, delta, addresses));
    setMsg(null);
    setErr(null);
  };

  const onBoundary = (left: string, right: string, leftPct: number) => {
    setPct((prev) => setBoundary(prev, left, right, leftPct, addresses));
    setMsg(null);
    setErr(null);
  };

  const onReset = () => {
    const defaults = status?.defaultWeights
      ? pctFromBps(status.defaultWeights, addresses)
      : DEFAULT_PCT;
    setPct(defaults);
    setMsg(null);
    setErr(null);
  };

  const onSave = async () => {
    if (!address || total !== 100) return;
    setErr(null);
    setMsg(null);
    try {
      const token = await ensureJwt();
      setBusy("save");
      const result = await byobSaveWeights(token, bpsFromPct(pct));
      setBaseline({ ...pct });
      const hours = result.delayCycles * CYCLE_HOURS;
      setMsg(
        `Saved as pending. It becomes your active mix at cycle ${result.effectiveFromCycle} (about ${result.delayCycles} cycles / ~${hours}h). Saving again restarts that wait.`,
      );
      await refresh(address);
    } catch (e) {
      const text = e instanceof Error ? e.message : "Save failed";
      if (/unauthorized|jwt|expired|401/i.test(text)) {
        clearByobJwt();
        setJwt(null);
      }
      setErr(text);
    } finally {
      setBusy(null);
    }
  };

  const onCancelPending = async () => {
    if (!address || !status?.pending) return;
    setErr(null);
    setMsg(null);
    try {
      const token = await ensureJwt();
      setBusy("cancel");
      await byobCancelPending(token);
      setMsg("Pending mix cancelled. Your last active mix (or classic equal) stays in force.");
      await refresh(address);
    } catch (e) {
      const text = e instanceof Error ? e.message : "Cancel failed";
      if (/unauthorized|jwt|expired|401/i.test(text)) {
        clearByobJwt();
        setJwt(null);
      }
      setErr(text);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ByobChrome
      totalOk={total === 100}
      onReset={isConnected ? onReset : undefined}
      locked={!isConnected}
      hint="Drag the seams — only neighbours move. Or tap − / +."
      gate={!isConnected ? <WalletButton size="md" disconnectVariant="secondary" /> : undefined}
      footer={
        <div className="byob-actions">
          <div className="byob-status">
            {!isConnected && (
              <span className="byob-status__line">
                Connect your wallet to set your airdrop mix. Until then, every eligible wallet stays on the classic equal basket.
              </span>
            )}
            {isConnected && loadErr && <span className="byob-status--err">{loadErr}</span>}
            {msg && <span className="byob-status__ok">{msg}</span>}
            {err && <span className="byob-status--err">{err}</span>}
          </div>

          {isConnected && (
            <div className="byob-actions__btns">
              <WalletButton disconnectVariant="secondary" />
              {status?.pending && (
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void onCancelPending()}>
                  {busy === "cancel" ? "Cancelling…" : "Cancel pending"}
                </Button>
              )}
              <Button size="sm" disabled={!dirty || total !== 100 || busy !== null} onClick={() => void onSave()}>
                {busy === "sign" ? "Sign in wallet…" : busy === "save" ? "Saving…" : "Save mix"}
              </Button>
            </div>
          )}
        </div>
      }
    >
      {isConnected ? (
        <ByobRules
          balanceTokens={balanceTokens}
          balanceLoading={portfolio.loading && !portfolio.data}
          lineTokens={lineTokens}
          atLine={atLine}
          shortfallTokens={portfolio.data?.shortfallTokens}
          cycle={status?.cycle ?? null}
          delayCycles={delayCycles}
          delayHours={delayHours}
          pendingFrom={status?.pending?.effectiveFromCycle ?? null}
          hasActive={Boolean(status?.active)}
          allocateEnabled={allocateEnabled}
        />
      ) : null}
      <ByobStack
        tokens={tokens}
        pct={pct}
        disabled={!isConnected || busy !== null}
        onBoundary={isConnected ? onBoundary : undefined}
      />
      {tokens.map((t, i) => (
        <ByobTokenRow
          key={t.address}
          symbol={t.symbol}
          icon={t.icon}
          value={pct[t.address.toLowerCase()] ?? 0}
          toneIndex={i}
          disabled={!isConnected || busy !== null}
          onNudge={isConnected ? (d) => onNudge(t.address, d) : undefined}
        />
      ))}
    </ByobChrome>
  );
}

function ByobRules({
  balanceTokens,
  balanceLoading,
  lineTokens,
  atLine,
  shortfallTokens,
  cycle,
  delayCycles,
  delayHours,
  pendingFrom,
  hasActive,
  allocateEnabled,
}: {
  balanceTokens: number | undefined;
  balanceLoading: boolean;
  lineTokens: number;
  atLine: boolean | null;
  shortfallTokens: number | undefined;
  cycle: number | null;
  delayCycles: number;
  delayHours: number;
  pendingFrom: number | null;
  hasActive: boolean;
  allocateEnabled: boolean;
}) {
  const balLabel = balanceLoading
    ? "…"
    : balanceTokens === undefined
      ? "—"
      : `${fmtTokens(balanceTokens)} OURO`;

  return (
    <div className="byob-rules">
      <div className="byob-rules__balance" data-ok={atLine === true ? "true" : atLine === false ? "false" : undefined}>
        <div className="byob-rules__balance-row">
          <span className="byob-rules__k">Your OURO</span>
          <span className="byob-rules__v">{balLabel}</span>
        </div>
        <div className="byob-rules__balance-row">
          <span className="byob-rules__k">Airdrop line</span>
          <span className="byob-rules__v">≥ {fmtTokens(lineTokens)} OURO</span>
        </div>
        {atLine === false && (
          <p className="byob-rules__warn">
            Below the line — this wallet is not paid in airdrop cycles. You can still save a mix; it
            only affects payouts once you hold ≥ {fmtTokens(lineTokens)} OURO
            {shortfallTokens !== undefined && shortfallTokens > 0
              ? ` (about ${fmtTokens(shortfallTokens)} more)`
              : ""}{" "}
            when a cycle runs.
          </p>
        )}
        {atLine === true && (
          <p className="byob-rules__ok">
            At or above the line — when your mix is active and allocation is on, cycles pay this wallet
            with your custom split.
          </p>
        )}
      </div>

      <ol className="byob-rules__steps">
        <li>
          <strong>Save</strong> stores your mix right away. Nothing changes on the next payout yet.
        </li>
        <li>
          After <strong>{delayCycles} airdrop cycles</strong> (~{delayHours}h; cycles are every {CYCLE_HOURS}h)
          the pending mix becomes <strong>active</strong>
          {pendingFrom !== null ? (
            <>
              {" "}
              (yours: cycle <strong>{pendingFrom}</strong>
              {cycle !== null ? <> · now {cycle}</> : null}).
            </>
          ) : (
            "."
          )}{" "}
          Saving again restarts that wait.
        </li>
        <li>
          On a cycle where you hold ≥ {fmtTokens(lineTokens)} OURO, the active mix is what you receive
          {hasActive && pendingFrom === null ? " (you already have an active custom mix)" : ""}
          {!hasActive && pendingFrom === null ? " — until then you stay on the classic equal basket" : ""}
          .
        </li>
      </ol>

      {!allocateEnabled && (
        <p className="byob-rules__note">
          Custom allocation is not switched on in production yet. Your save is stored and will follow
          the timing above once it is enabled; until then payouts stay on the classic equal basket.
        </p>
      )}
    </div>
  );
}

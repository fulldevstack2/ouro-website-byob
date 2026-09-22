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
        `Saved. Pending until cycle ${result.effectiveFromCycle} (about ${result.delayCycles} cycles, ~${hours}h). Save again and the wait starts over.`,
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
      setMsg("Pending cancel done. You keep whatever was already active, or the equal basket if you never had one.");
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
      hint="Drag the dividers (only the two sides move), or use - / +."
      gate={!isConnected ? <WalletButton size="md" disconnectVariant="secondary" /> : undefined}
      footer={
        <div className="byob-actions">
          <div className="byob-status">
            {!isConnected && (
              <span className="byob-status__line">
                Connect a wallet to set your mix. Without that, everyone stays on the equal basket.
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
                  {busy === "cancel" ? "Cancelling..." : "Cancel pending"}
                </Button>
              )}
              <Button size="sm" disabled={!dirty || total !== 100 || busy !== null} onClick={() => void onSave()}>
                {busy === "sign" ? "Sign in wallet..." : busy === "save" ? "Saving..." : "Save mix"}
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
    ? "..."
    : balanceTokens === undefined
      ? "-"
      : `${fmtTokens(balanceTokens)} OURO`;

  return (
    <div className="byob-rules">
      <div className="byob-rules__balance" data-ok={atLine === true ? "true" : atLine === false ? "false" : undefined}>
        <div className="byob-rules__balance-row">
          <span className="byob-rules__k">Your OURO</span>
          <span className="byob-rules__v">{balLabel}</span>
        </div>
        <div className="byob-rules__balance-row">
          <span className="byob-rules__k">Need for airdrops</span>
          <span className="byob-rules__v">{`>= ${fmtTokens(lineTokens)} OURO`}</span>
        </div>
        {atLine === false && (
          <p className="byob-rules__warn">
            You are under {fmtTokens(lineTokens)} OURO, so this wallet does not get airdrops yet. You can
            still save a mix. It only starts mattering once you are at the line when a cycle pays
            {shortfallTokens !== undefined && shortfallTokens > 0
              ? ` (about ${fmtTokens(shortfallTokens)} more OURO).`
              : "."}
          </p>
        )}
        {atLine === true && (
          <p className="byob-rules__ok">
            You clear the line. After your mix goes active (and allocation is on), cycles use your split.
          </p>
        )}
      </div>

      <ol className="byob-rules__steps">
        <li>
          <strong>Save</strong> locks in the mix. The next payout does not change yet.
        </li>
        <li>
          Wait <strong>{delayCycles} cycles</strong> (about {delayHours}h; a cycle is every {CYCLE_HOURS}h).
          Then it goes <strong>active</strong>
          {pendingFrom !== null ? (
            <>
              {" "}
              (yours kicks in at cycle <strong>{pendingFrom}</strong>
              {cycle !== null ? <>, now on {cycle}</> : null}).
            </>
          ) : (
            "."
          )}{" "}
          Save again and the wait resets.
        </li>
        <li>
          {hasActive && pendingFrom === null
            ? `You already have an active custom mix. Cycles where you hold >= ${fmtTokens(lineTokens)} OURO use that split.`
            : !hasActive && pendingFrom === null
              ? `Until a mix is active, you get the equal basket. Once active, cycles where you hold >= ${fmtTokens(lineTokens)} OURO use your split.`
              : `Once active, cycles where you hold >= ${fmtTokens(lineTokens)} OURO use your split.`}
        </li>
      </ol>

      {!allocateEnabled && (
        <p className="byob-rules__note">
          Custom allocation is still off live. Your save is kept and will use the timing above when it
          turns on. For now, payouts stay on the equal basket.
        </p>
      )}
    </div>
  );
}

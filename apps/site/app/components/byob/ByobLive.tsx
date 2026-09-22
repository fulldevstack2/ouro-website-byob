import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

import { Button } from "@ouro/ds";
import {
  byobCancelPending,
  byobChallenge,
  byobSaveWeights,
  byobVerify,
  fetchByobStatus,
  type ByobStatus,
} from "@ouro/monitor-client";
import { WalletButton } from "~/components/wallet/WalletButton";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { site } from "~/content/site";
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

  const [pct, setPct] = useState<PctMap>(DEFAULT_PCT);
  const [baseline, setBaseline] = useState<PctMap>(DEFAULT_PCT);
  const [status, setStatus] = useState<ByobStatus | null>(null);
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

  const refresh = useCallback(async (addr: string) => {
    setLoadErr(null);
    try {
      const s = await fetchByobStatus(addr);
      setStatus(s);
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
      setMsg(
        `Saved. Active from cycle ${result.effectiveFromCycle} (about ${result.delayCycles} cycles from now).`,
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
      setMsg("Pending weights cancelled. Classic equal basket until you save again.");
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
            {isConnected && !loadErr && status && (
              <span className="byob-status__line">
                Cycle <strong>{status.cycle}</strong>
                {status.pending ? (
                  <>
                    {" "}
                    · pending from cycle <strong>{status.pending.effectiveFromCycle}</strong>
                  </>
                ) : status.active ? (
                  <> · custom mix active</>
                ) : (
                  <> · classic equal basket</>
                )}
                {status.lineTokens > 0 && (
                  <>
                    {" "}
                    · needs ≥ <strong>{status.lineTokens.toLocaleString()}</strong> OURO
                  </>
                )}
              </span>
            )}
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

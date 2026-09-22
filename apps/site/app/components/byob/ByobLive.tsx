import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { useAccount, useSignMessage } from "wagmi";

import { Button } from "@ouro/ds";
import {
  byobChallenge,
  byobRevertClassic,
  byobSaveWeights,
  byobVerify,
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
  equalPct,
  pctFromBps,
  readByobJwt,
  setBoundary,
  writeByobJwt,
  type PctMap,
} from "~/lib/byob";
import { ByobConfirm } from "~/components/byob/ByobConfirm";
import {
  BYOB_ADDRESSES,
  BYOB_TOKENS,
  ByobChrome,
  ByobStack,
  ByobStatic,
  ByobTokenRow,
  DEFAULT_PCT,
} from "~/components/byob/ByobFrame";

const CYCLE_HOURS = 2;

type ConfirmKind = "enter" | "save" | "discard" | "revert" | null;

/**
 * Live BYOB page - classic home vs BYOB editor, SIWE only when saving/reverting.
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
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sign" | "save" | "revert" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(() => (typeof window !== "undefined" ? readByobJwt() : null));
  /** Local opt-in to the editor before the first Save. */
  const [wantsEditor, setWantsEditor] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

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

  const wholePct = useMemo(() => {
    const out: PctMap = {};
    for (const a of addresses) out[a] = Math.round(pct[a] ?? 0);
    return out;
  }, [pct, addresses]);

  const total = useMemo(() => Object.values(wholePct).reduce((a, b) => a + b, 0), [wholePct]);
  const dirty = useMemo(
    () => addresses.some((a) => (wholePct[a] ?? 0) !== Math.round(baseline[a] ?? 0)),
    [wholePct, baseline, addresses],
  );
  const equal = useMemo(() => equalPct(addresses), [addresses]);

  const hasCustomServerMix = Boolean(status?.active || (status?.pending && !status.pending.classic));
  const pendingClassic = Boolean(status?.pending?.classic);
  const showEditor = isConnected && !pendingClassic && (wantsEditor || hasCustomServerMix);
  const showClassicHome = isConnected && !showEditor && !pendingClassic;
  const showClassicPending = isConnected && pendingClassic;

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
      const s = await fetchByobStatus(addr);
      setStatus(s);
      const source = s.pending?.classic
        ? s.defaultWeights
        : (s.pending?.weights ?? s.active?.weights ?? s.defaultWeights);
      const next = pctFromBps(source ?? s.defaultWeights, s.basket.map((t) => t.address));
      setPct(next);
      setBaseline(next);
      if (s.active || (s.pending && !s.pending.classic)) setWantsEditor(true);
      if (s.pending?.classic) setWantsEditor(false);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load BYOB status");
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setStatus(null);
      setPct(DEFAULT_PCT);
      setBaseline(DEFAULT_PCT);
      setWantsEditor(false);
      setMsg(null);
      setErr(null);
      setConfirm(null);
      return;
    }
    void refresh(address);
  }, [address, refresh]);

  useEffect(() => {
    if (!address) {
      clearByobJwt();
      setJwt(null);
      return;
    }
    setJwt(readByobJwt());
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

  const onBoundary = (left: string, right: string, leftPct: number) => {
    setPct((prev) => setBoundary(prev, left, right, leftPct, addresses));
    setMsg(null);
    setErr(null);
  };

  const enterByob = () => {
    setPct(equal);
    setBaseline(equal);
    setWantsEditor(true);
    setMsg(null);
    setErr(null);
    setConfirm(null);
  };

  const doSave = async () => {
    if (!address) return;
    if (Object.values(wholePct).some((v) => !Number.isInteger(v)) || total !== 100) {
      setErr("Weights must be whole percents that add to 100%.");
      setConfirm(null);
      return;
    }
    setErr(null);
    setMsg(null);
    try {
      const token = await ensureJwt();
      setBusy("save");
      const result = await byobSaveWeights(token, bpsFromPct(wholePct));
      setBaseline({ ...wholePct });
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
      setConfirm(null);
    }
  };

  const doDiscard = () => {
    setPct({ ...baseline });
    setMsg("Unsaved changes discarded.");
    setErr(null);
    setConfirm(null);
  };

  const doRevertClassic = async () => {
    if (!address) return;
    setErr(null);
    setMsg(null);
    try {
      const token = await ensureJwt();
      setBusy("revert");
      const result = await byobRevertClassic(token);
      setWantsEditor(false);
      const hours = result.delayCycles * CYCLE_HOURS;
      setMsg(
        `Revert to classic scheduled for cycle ${result.effectiveFromCycle} (about ${result.delayCycles} cycles, ~${hours}h). Until then your last mix still applies.`,
      );
      await refresh(address);
    } catch (e) {
      const text = e instanceof Error ? e.message : "Revert failed";
      if (/unauthorized|jwt|expired|401/i.test(text)) {
        clearByobJwt();
        setJwt(null);
      }
      setErr(text);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const leaveEditorToClassic = () => {
    // Never saved: leaving editor is just UI, already classic on server.
    setWantsEditor(false);
    setPct(equal);
    setBaseline(equal);
    setMsg(null);
    setErr(null);
    setConfirm(null);
  };

  const confirmCopy = (): { title: string; body: ReactNode; label: string; danger?: boolean } | null => {
    if (confirm === "enter") {
      return {
        title: "Switch to BYOB?",
        body: (
          <p>
            You will set a custom split of the airdrop basket. Nothing changes on payouts until you{" "}
            <strong>Save mix</strong>, and then only after about {delayHours}h ({delayCycles} cycles).
          </p>
        ),
        label: "Continue",
      };
    }
    if (confirm === "save") {
      return {
        title: "Save this mix?",
        body: (
          <p>
            This locks in your split for payouts starting at cycle{" "}
            <strong>{(status?.cycle ?? 0) + delayCycles}</strong> (about {delayHours}h). Saving again restarts
            that wait.
          </p>
        ),
        label: "Save mix",
      };
    }
    if (confirm === "discard") {
      return {
        title: "Discard unsaved changes?",
        body: <p>The bar goes back to your last saved mix (or the starting split if you have not saved yet).</p>,
        label: "Discard",
        danger: true,
      };
    }
    if (confirm === "revert") {
      if (!hasCustomServerMix) {
        return {
          title: "Back to classic view?",
          body: <p>You have not saved a BYOB mix. This only closes the editor. Payouts stay classic.</p>,
          label: "Back to classic",
        };
      }
      return {
        title: "Revert to classic airdrops?",
        body: (
          <p>
            Your custom mix stops after about {delayHours}h ({delayCycles} cycles). Until then the last mix
            still applies. Classic means your OURO share of each token as the treasury releases it - not a
            forced equal split.
          </p>
        ),
        label: "Revert to classic",
        danger: true,
      };
    }
    return null;
  };

  const onConfirmAction = () => {
    if (confirm === "enter") enterByob();
    else if (confirm === "save") void doSave();
    else if (confirm === "discard") doDiscard();
    else if (confirm === "revert") {
      if (!hasCustomServerMix) leaveEditorToClassic();
      else void doRevertClassic();
    }
  };

  const copy = confirmCopy();
  const editorLocked = busy !== null;

  const balanceBlock = (
    <BalanceStrip
      balanceTokens={balanceTokens}
      balanceLoading={portfolio.loading && !portfolio.data}
      lineTokens={lineTokens}
      atLine={atLine}
      shortfallTokens={portfolio.data?.shortfallTokens}
    />
  );

  // ── not connected ──
  if (!isConnected) {
    return (
      <ByobChrome
        locked
        showTotal={false}
        modeLabel="Connect"
        gate={<WalletButton size="md" disconnectVariant="secondary" />}
        footer={
          <div className="byob-actions">
            <div className="byob-status">
              <span className="byob-status__line">Connect a wallet to see classic vs BYOB for this account.</span>
            </div>
          </div>
        }
      >
        <ClassicExplainer delayHours={delayHours} delayCycles={delayCycles} lineTokens={lineTokens} />
        <ByobStack tokens={tokens} pct={equal} disabled />
        {tokens.map((t, i) => (
          <ByobTokenRow
            key={t.address}
            symbol={t.symbol}
            icon={t.icon}
            value={equal[t.address.toLowerCase()] ?? 0}
            toneIndex={i}
            disabled
          />
        ))}
      </ByobChrome>
    );
  }

  // ── waiting for classic revert ──
  if (showClassicPending) {
    return (
      <ByobChrome
        locked={false}
        showTotal={false}
        modeLabel="Reverting to classic"
        footer={
          <div className="byob-actions">
            <div className="byob-status">
              {loadErr && <span className="byob-status--err">{loadErr}</span>}
              {msg && <span className="byob-status__ok">{msg}</span>}
              <span className="byob-status__line">
                Classic again at cycle <strong>{status?.pending?.effectiveFromCycle}</strong>
                {status?.cycle != null ? <> (now on {status.cycle})</> : null}. Until then your previous mix
                still pays.
              </span>
            </div>
            <div className="byob-actions__btns">
              <WalletButton disconnectVariant="secondary" />
            </div>
          </div>
        }
      >
        {balanceBlock}
        <ClassicExplainer delayHours={delayHours} delayCycles={delayCycles} lineTokens={lineTokens} pending />
      </ByobChrome>
    );
  }

  // ── classic home ──
  if (showClassicHome) {
    return (
      <>
        <ByobChrome
          locked={false}
          showTotal={false}
          modeLabel="Classic mode"
          footer={
            <div className="byob-actions">
              <div className="byob-status">
                {loadErr && <span className="byob-status--err">{loadErr}</span>}
                {msg && <span className="byob-status__ok">{msg}</span>}
                {err && <span className="byob-status--err">{err}</span>}
              </div>
              <div className="byob-actions__btns">
                <WalletButton disconnectVariant="secondary" />
                <Button size="sm" onClick={() => setConfirm("enter")}>
                  Customize with BYOB
                </Button>
              </div>
            </div>
          }
        >
          {balanceBlock}
          <ClassicExplainer delayHours={delayHours} delayCycles={delayCycles} lineTokens={lineTokens} />
        </ByobChrome>
        {copy && (
          <ByobConfirm
            open={confirm === "enter"}
            title={copy.title}
            body={copy.body}
            confirmLabel={copy.label}
            busy={busy !== null}
            onCancel={() => setConfirm(null)}
            onConfirm={onConfirmAction}
          />
        )}
      </>
    );
  }

  // ── BYOB editor ──
  return (
    <>
      <ByobChrome
        totalOk={total === 100}
        showTotal
        modeLabel={hasCustomServerMix ? "BYOB mode" : "BYOB mode · not saved yet"}
        hint="Drag the dividers. Only the two sides of a handle move. Whole percents only."
        locked={false}
        footer={
          <div className="byob-actions">
            <div className="byob-status">
              {loadErr && <span className="byob-status--err">{loadErr}</span>}
              {msg && <span className="byob-status__ok">{msg}</span>}
              {err && <span className="byob-status--err">{err}</span>}
              {status?.pending && !status.pending.classic && (
                <span className="byob-status__line">
                  Pending mix activates at cycle <strong>{status.pending.effectiveFromCycle}</strong>
                  {status.cycle != null ? <> (now on {status.cycle})</> : null}.
                </span>
              )}
            </div>
            <div className="byob-actions__btns">
              <WalletButton disconnectVariant="secondary" />
              <Button
                size="sm"
                variant="secondary"
                disabled={editorLocked}
                onClick={() => setConfirm("revert")}
              >
                {busy === "revert" ? "Reverting..." : "Revert to classic"}
              </Button>
              <Button size="sm" variant="secondary" disabled={!dirty || editorLocked} onClick={() => setConfirm("discard")}>
                Discard
              </Button>
              <Button
                size="sm"
                disabled={!dirty || total !== 100 || editorLocked}
                onClick={() => setConfirm("save")}
              >
                {busy === "sign" ? "Sign in wallet..." : busy === "save" ? "Saving..." : "Save mix"}
              </Button>
            </div>
          </div>
        }
      >
        {balanceBlock}
        <ol className="byob-rules__steps">
          <li>
            <strong>Save mix</strong> stores your split. Payouts change only after about {delayHours}h (
            {delayCycles} cycles).
          </li>
          <li>
            <strong>Discard</strong> throws away unsaved bar edits.
          </li>
          <li>
            <strong>Revert to classic</strong> turns off BYOB for this wallet (same delay if you already
            saved).
          </li>
        </ol>
        <ByobStack
          tokens={tokens}
          pct={wholePct}
          disabled={editorLocked}
          onBoundary={onBoundary}
        />
        {tokens.map((t, i) => (
          <ByobTokenRow
            key={t.address}
            symbol={t.symbol}
            icon={t.icon}
            value={wholePct[t.address.toLowerCase()] ?? 0}
            toneIndex={i}
            disabled={editorLocked}
          />
        ))}
      </ByobChrome>
      {copy && confirm && (
        <ByobConfirm
          open={Boolean(confirm)}
          title={copy.title}
          body={copy.body}
          confirmLabel={copy.label}
          danger={copy.danger}
          busy={busy !== null}
          onCancel={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={onConfirmAction}
        />
      )}
    </>
  );
}

function ClassicExplainer({
  delayHours,
  delayCycles,
  lineTokens,
  pending = false,
}: {
  delayHours: number;
  delayCycles: number;
  lineTokens: number;
  pending?: boolean;
}) {
  return (
    <div className="byob-classic">
      <h2 className="byob-classic__title">{pending ? "Classic airdrops returning" : "You are on classic airdrops"}</h2>
      <p className="byob-classic__lede">
        Classic means each cycle you get your OURO share of <strong>each</strong> basket token as the
        treasury releases it. It is not a forced equal percent split. If one token pays more that cycle,
        you get more of that token.
      </p>
      <ul className="byob-classic__list">
        <li>No custom mix is stored for this wallet{pending ? " once the revert completes" : ""}.</li>
        <li>
          BYOB lets you pick a custom split. After you save, it waits about {delayHours}h ({delayCycles}{" "}
          cycles) before payouts use it.
        </li>
        <li>You need at least {fmtTokens(lineTokens)} OURO for airdrops to include you.</li>
      </ul>
    </div>
  );
}

function BalanceStrip({
  balanceTokens,
  balanceLoading,
  lineTokens,
  atLine,
  shortfallTokens,
}: {
  balanceTokens: number | undefined;
  balanceLoading: boolean;
  lineTokens: number;
  atLine: boolean | null;
  shortfallTokens: number | undefined;
}) {
  const balLabel = balanceLoading
    ? "..."
    : balanceTokens === undefined
      ? "-"
      : `${fmtTokens(balanceTokens)} OURO`;

  return (
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
          Under the line - this wallet does not get airdrops yet. You can still set a mix; it only matters
          once you clear {fmtTokens(lineTokens)} OURO
          {shortfallTokens !== undefined && shortfallTokens > 0
            ? ` (about ${fmtTokens(shortfallTokens)} more).`
            : "."}
        </p>
      )}
      {atLine === true && (
        <p className="byob-rules__ok">You clear the line for airdrops this cycle.</p>
      )}
    </div>
  );
}

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { Button } from "@ouro/ds";
import { BASKET_TOKENS } from "~/content/protocol";
import { equalPct, type PctMap } from "~/lib/byob";

/** The three airdrop-basket tokens BYOB can weight (matches ouro-monitor basket). */
export const BYOB_TOKENS = BASKET_TOKENS.filter((t) => ["CASHCAT", "PONS", "AI"].includes(t.symbol));

export const BYOB_ADDRESSES = BYOB_TOKENS.map((t) => t.address.toLowerCase());

export const DEFAULT_PCT: PctMap = equalPct(BYOB_ADDRESSES);

const SEG_TONES = ["var(--byob-seg-a)", "var(--byob-seg-b)", "var(--byob-seg-c)"];

export function ByobChrome({
  children,
  footer,
  gate,
  totalOk = true,
  onReset,
  locked = false,
  hint,
}: {
  children: ReactNode;
  footer?: ReactNode;
  gate?: ReactNode;
  totalOk?: boolean;
  onReset?: () => void;
  locked?: boolean;
  hint?: string;
}) {
  return (
    <div className="byob-page">
      <div className="byob-page__glow" aria-hidden />
      <div className="byob-page__inner">
        <header className="byob-kicker">
          <span className="byob-kicker__label">Airdrop basket · BYOB</span>
        </header>

        <div className="byob-card" data-locked={locked ? "true" : "false"}>
          <div className="byob-card__top">
            {onReset && !locked ? (
              <button type="button" className="byob-card__reset" onClick={onReset}>
                Reset
              </button>
            ) : (
              <span className="byob-card__top-spacer" />
            )}
            <span className="byob-card__total" data-ok={totalOk ? "true" : "false"}>
              Total <em>100%</em>
            </span>
          </div>

          {hint && !locked ? <p className="byob-card__hint">{hint}</p> : null}

          <div className="byob-card__body">
            {children}
            {locked && gate ? (
              <div className="byob-card__gate">
                <div className="byob-card__gate-panel">{gate}</div>
              </div>
            ) : null}
          </div>

          {footer}
        </div>

        <div className="byob-foot">
          <span>Build your ouro basket</span>
          <a href="https://ourolayer.com">ourolayer.com</a>
        </div>
      </div>
    </div>
  );
}

/**
 * One stacked bar — drag the seams between tokens. Only the two neighbours change;
 * the third stays put. Much easier than three linked range inputs.
 */
export function ByobStack({
  tokens,
  pct,
  disabled,
  onBoundary,
}: {
  tokens: { symbol: string; address: string; icon?: string }[];
  pct: PctMap;
  disabled?: boolean;
  onBoundary?: (leftAddr: string, rightAddr: string, leftPct: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; pair: number; left0: number } | null>(null);

  const values = tokens.map((t) => pct[t.address.toLowerCase()] ?? 0);
  const edges: number[] = [0];
  for (const v of values) edges.push(edges[edges.length - 1]! + v);

  const clientToPct = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return Math.round(((clientX - r.left) / r.width) * 100);
  }, []);

  const onPointerDown = (i: number, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || !onBoundary) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const left = values[i] ?? 0;
    const right = values[i + 1] ?? 0;
    drag.current = { i, pair: left + right, left0: edges[i]! };
    e.currentTarget.classList.add("is-dragging");
    trackRef.current?.classList.add("is-dragging");
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !onBoundary) return;
    const { i, pair, left0 } = drag.current;
    const x = clientToPct(e.clientX);
    const leftPct = Math.max(0, Math.min(pair, x - left0));
    const leftTok = tokens[i];
    const rightTok = tokens[i + 1];
    if (!leftTok || !rightTok) return;
    onBoundary(leftTok.address, rightTok.address, leftPct);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    e.currentTarget.classList.remove("is-dragging");
    trackRef.current?.classList.remove("is-dragging");
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div className="byob-stack" data-disabled={disabled ? "true" : "false"}>
      <div className="byob-stack__pcts" aria-hidden>
        {tokens.map((t, i) => {
          const v = values[i] ?? 0;
          const center = (edges[i] ?? 0) + v / 2;
          if (v <= 0) return null;
          return (
            <span key={`p-${t.address}`} className="byob-stack__pct" style={{ left: `${center}%` }}>
              {Math.round(v)}%
            </span>
          );
        })}
      </div>
      <div className="byob-stack__track" ref={trackRef} role="group" aria-label="Airdrop mix">
        <div className="byob-stack__fill">
          {tokens.map((t, i) => {
            const v = values[i] ?? 0;
            return (
              <div
                key={t.address}
                className="byob-stack__seg"
                style={{ width: `${v}%`, ["--seg" as string]: SEG_TONES[i % SEG_TONES.length] }}
                title={`$${t.symbol} ${v}%`}
              >
                {v > 0 && (t.icon || t.symbol) ? (
                  <span className="byob-stack__seg-meta">
                    {t.icon ? <img className="byob-stack__seg-icon" src={t.icon} alt="" /> : null}
                    <span className="byob-stack__seg-label">${t.symbol}</span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {!disabled &&
          tokens.slice(0, -1).map((t, i) => {
            const at = edges[i + 1] ?? 0;
            return (
              <button
                key={`h-${t.address}`}
                type="button"
                className="byob-stack__handle"
                data-edge={at <= 0 ? "start" : at >= 100 ? "end" : undefined}
                style={{ left: `clamp(10px, ${at}%, calc(100% - 10px))` }}
                aria-label={`Adjust boundary after $${t.symbol}`}
                onPointerDown={(e) => onPointerDown(i, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <span />
                <span />
              </button>
            );
          })}
      </div>
      <div className="byob-stack__scale" aria-hidden>
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}

export function ByobTokenRow({
  symbol,
  icon,
  value,
  toneIndex = 0,
  disabled,
  onNudge,
}: {
  symbol: string;
  icon?: string;
  value: number;
  toneIndex?: number;
  disabled?: boolean;
  onNudge?: (delta: number) => void;
}) {
  const interactive = Boolean(onNudge) && !disabled;
  return (
    <div className="byob-row" data-disabled={disabled || !interactive ? "true" : "false"}>
      <div className="byob-token">
        <span className="byob-token__swatch" style={{ background: SEG_TONES[toneIndex % SEG_TONES.length] }} aria-hidden />
        {icon ? <img className="byob-token__icon" src={icon} alt="" width={40} height={40} /> : <span className="byob-token__icon" />}
        <span className="byob-token__sym">${symbol}</span>
      </div>
      {interactive ? (
        <div className="byob-nudge" role="group" aria-label={`${symbol} weight`}>
          <button type="button" className="byob-nudge__btn byob-nudge__btn--icon" aria-label={`Decrease ${symbol}`} onClick={() => onNudge?.(-1)} disabled={value <= 0}>
            −
          </button>
          <button type="button" className="byob-nudge__btn byob-nudge__btn--icon" aria-label={`Increase ${symbol}`} onClick={() => onNudge?.(1)} disabled={value >= 100}>
            +
          </button>
        </div>
      ) : (
        <div className="byob-nudge byob-nudge--empty" aria-hidden />
      )}
      <div className="byob-pct" style={{ color: SEG_TONES[toneIndex % SEG_TONES.length] }}>
        {Math.round(value)}
        <span className="byob-pct__unit">%</span>
      </div>
    </div>
  );
}

/** Prerender / no-JS shell — equal thirds, locked until wallet. */
export function ByobStatic() {
  const pct = DEFAULT_PCT;
  const tokens = BYOB_TOKENS.map((t) => ({ symbol: t.symbol, address: t.address, icon: t.icon }));
  return (
    <ByobChrome
      locked
      gate={
        <Button size="md" disabled>
          Connect wallet
        </Button>
      }
      footer={
        <div className="byob-actions">
          <div className="byob-status">
            <span className="byob-status__line">Connect a wallet to set your mix.</span>
          </div>
        </div>
      }
    >
      <ByobStack tokens={tokens} pct={pct} disabled />
      {BYOB_TOKENS.map((t, i) => (
        <ByobTokenRow
          key={t.address}
          symbol={t.symbol}
          icon={t.icon}
          value={pct[t.address.toLowerCase()] ?? 0}
          toneIndex={i}
          disabled
        />
      ))}
    </ByobChrome>
  );
}

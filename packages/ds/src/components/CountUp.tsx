import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * A figure that counts up from zero the first time it is published.
 *
 * Every number on this site arrives late: the page is prerendered with a dash and the real figure
 * lands a second or so later, when the monitor answers or a chain read settles. Swapping a dash for
 * "$95,982" in one frame gives the reader nothing to notice; running the digits up to it does, and
 * it also says, without a word of copy, that the figure was fetched rather than typed.
 *
 * It works on the FORMATTED string rather than on the number behind it, which is the whole trick: a
 * caller passes `fmtUsd(nav)` exactly as before and the animation infers the grammar from the result
 * (the "$", the sign, the thousands separators, how many decimals, a "k"/"M"/"%" tail) and repaints
 * intermediate frames in the same shape. One component covers every formatter the site has, and the
 * figure that comes to rest is the caller's own string, byte for byte, so nothing the animation does
 * can change what the page finally states.
 *
 * Anything that is not a plain figure is left alone: a dash, "< $0.01", "2.1 h ago", "Epoch 12", or a
 * React element such as a ticking countdown. The regex is the guard, and it is deliberately strict.
 */

/** `−$1,234.50`, `$0`, `877.0M`, `+0.41%`, `12,345`, `0.0031`. Nothing with a letter, space or colon. */
const FIGURE = /^([+\-\u2212]?\$?|\$[+\-\u2212]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([kMB%]?)$/;

const DURATION_MS = 900;

/**
 * Before paint on the client, and nothing at all on the server. The run has to be armed in the same
 * frame the figure is committed: an ordinary effect lets the browser paint the finished number once
 * and only then rewinds it to zero, which reads as a glitch rather than as a count.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Figure {
  prefix: string;
  suffix: string;
  value: number;
  decimals: number;
  /** Whether the published figure groups its thousands, so intermediate frames group the same way. */
  grouped: boolean;
}

function parse(text: string): Figure | null {
  const m = FIGURE.exec(text);
  if (!m) return null;
  const [, prefix = "", int = "", frac = "", suffix = ""] = m;
  const value = Number(`${int.replace(/,/g, "")}.${frac || "0"}`);
  if (!Number.isFinite(value)) return null;
  return { prefix, suffix, value, decimals: frac.length, grouped: int.includes(",") };
}

function paint(f: Figure, n: number): string {
  const body = f.grouped
    ? n.toLocaleString("en-US", { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals })
    : n.toFixed(f.decimals);
  return `${f.prefix}${body}${f.suffix}`;
}

export interface CountUpProps {
  /** A formatted figure. Anything else renders untouched. */
  children: ReactNode;
  /** Milliseconds for the run up to the figure. */
  duration?: number;
}

export function CountUp({ children, duration = DURATION_MS }: CountUpProps) {
  const text = typeof children === "string" ? children : null;
  const figure = text === null ? null : parse(text);
  const [frame, setFrame] = useState<string | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  // Once per figure, not once per change: a refresh that nudges the NAV by a dollar, or a slider the
  // reader is dragging, has to land instantly. Only the first publication is worth animating.
  const ran = useRef(false);

  useBeforePaint(() => {
    if (figure === null) return;
    if (ran.current) {
      setFrame(null);
      setWidth(null);
      return;
    }
    ran.current = true;
    if (figure.value === 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // The finished figure is in the DOM at this instant and not yet on screen, so its box can be
    // measured rather than guessed. `${text.length}ch` was the guess, and it overshot by eight pixels
    // at hero size, which put a snap into the delta sitting beside it on the last frame.
    setWidth(box.current?.getBoundingClientRect().width ?? null);
    // Zero on screen before the first frame of movement, and an ease that starts at rest. An ease-OUT
    // would have covered seven percent of the distance by the first frame, so a six figure NAV would
    // appear at several thousand dollars and never show the zero it was asked to start from.
    setFrame(paint(figure, 0));

    let raf = 0;
    let done = false;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      if (t >= 1) {
        done = true;
        setFrame(null);
        setWidth(null);
        return;
      }
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setFrame(paint(figure, figure.value * eased));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setFrame(null);
      setWidth(null);
      // Torn down mid-run (a second read landing inside the same second, or a dev double-mount): let
      // the next figure have its run rather than stranding this one half way up.
      if (!done) ran.current = false;
    };
    // `text` stands in for the parsed figure, which is derived from it and nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, duration]);

  if (figure === null) return <>{children}</>;
  return (
    <span ref={box} style={{ display: "inline-block", minWidth: width ?? undefined, maxWidth: "100%" }}>
      {frame ?? children}
    </span>
  );
}

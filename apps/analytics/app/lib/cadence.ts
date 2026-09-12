/**
 * How often a project ACTUALLY pays, measured from its own payout history.
 *
 * ── Why not just use the configured cadence ──
 * Every project here declares an interval — INDEX's contract publishes `nextDistribution()`, HOOD10
 * and $OURO have a nominal period — and for all three, the declared figure describes the schedule
 * rather than the behaviour. Measured over 199 INDEX cycles:
 *
 *     p50 1.01h   p75 1.03h   p90 5.81h   p95 8.50h   p99 32.28h   max 58.89h
 *
 * Half of them land on the hour and the tail runs to two and a half days. "Every 1 h" is true of the
 * median and useless as a description, so this reports the median AND the spread and lets the reader
 * judge. HOOD10 is the same shape: a nominal 3h period, and 2 periods observed in 72 hours.
 *
 * ── Why no status badge ──
 * The obvious thing is to classify — ok / late / stalled — and the monitor does exactly that, at
 * >0.5x cadence and >2x cadence. Against INDEX's real distribution that fires "stalled" on 14% of
 * its cycles, as normal operation. On a page that ranks projects this site does not run, a red badge
 * appearing one cycle in seven is a claim about someone else's product that the data does not
 * support.
 *
 * So: quantify, do not classify. "Last paid 9.9h ago · typically 1.0h, 90% within 5.8h" says
 * everything the badge would have, carries its own context, and cannot cry wolf.
 */

export interface CadenceStats {
  /** Gaps measured, i.e. cycles minus one. Zero means there is nothing to report. */
  samples: number;
  /** The typical gap, in hours. The honest headline. */
  medianH: number | null;
  /** 90th percentile gap — where "unusual" starts for this project. */
  p90H: number | null;
  /** Longest gap observed in the window. The reason a median alone misleads. */
  maxH: number | null;
  /** When it last paid (unix seconds), or null if unknown. */
  lastPaidTs: number | null;
  /** Hours since that payout, at `now`. */
  sinceLastH: number | null;
  /**
   * True when the current silence already exceeds this project's own p90 — measured against its
   * behaviour, not against a schedule it has never kept. Null when there is no basis to say.
   */
  quieterThanUsual: boolean | null;
}

const EMPTY: CadenceStats = {
  samples: 0,
  medianH: null,
  p90H: null,
  maxH: null,
  lastPaidTs: null,
  sinceLastH: null,
  quieterThanUsual: null,
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0] as number;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  if (lo === hi) return a;
  return a + (pos - lo) * ((sorted[hi] as number) - a);
}

/**
 * Gap statistics from payout timestamps.
 *
 * `timestamps` may be in any order and may contain nulls (an epoch the indexer could not time);
 * those are dropped rather than treated as zero. Gaps of exactly zero are dropped too: a cycle that
 * re-broadcast in the same second is one payout recorded twice, not a zero-second cadence.
 */
export function cadenceStats(timestamps: (number | null | undefined)[], nowSec: number): CadenceStats {
  const ts = timestamps.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t > 0);
  if (ts.length === 0) return EMPTY;

  const sorted = [...ts].sort((a, b) => a - b);
  const lastPaidTs = sorted[sorted.length - 1] as number;
  const sinceLastH = Math.max(0, (nowSec - lastPaidTs) / 3600);

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = ((sorted[i] as number) - (sorted[i - 1] as number)) / 3600;
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) {
    return { ...EMPTY, samples: 0, lastPaidTs, sinceLastH, quieterThanUsual: null };
  }

  gaps.sort((a, b) => a - b);
  const p90H = quantile(gaps, 0.9);
  return {
    samples: gaps.length,
    medianH: quantile(gaps, 0.5),
    p90H,
    maxH: gaps[gaps.length - 1] as number,
    lastPaidTs,
    sinceLastH,
    // Needs enough history to mean anything; under ~10 gaps a p90 is noise.
    quieterThanUsual: gaps.length >= 10 ? sinceLastH > p90H : null,
  };
}

/** "1.0 h" / "45 min" / "2.1 d" — a duration in hours, rendered at a sensible unit. */
export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

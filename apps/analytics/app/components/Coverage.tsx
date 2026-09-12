/**
 * What a figure rests on, rendered the same way for every project.
 *
 * One component, used for all of them, is the whole point: it is what stops the page flattering
 * whoever happens to be best-instrumented. Ouro is the project this indexer was built for, so Ouro
 * has the most complete data — and a page that showed completeness without explaining it would be
 * making a claim about the others.
 *
 * Three rules it enforces:
 *
 *  1. A `measured` figure gets NO mark. The number is the statement; only a qualification needs a
 *     label, and marking everything would make the marks invisible.
 *  2. A missing figure is a dash with a reason, never a zero. Zero is a claim about the project;
 *     a dash with "not indexed yet" is a statement about us.
 *  3. Status is carried by shape and text, never hue alone — the brand's green/amber/red fail
 *     colour-vision separation against one another (deutan ΔE 3.0 for red↔amber), so a traffic
 *     light here would be unreadable for some readers and meaningless in greyscale or print.
 */
import type { CoverageRecord } from "~/registry";

/** The em-dash a withheld figure renders as. Never "0", never "—" without a reason beside it. */
export const DASH = "—";

export function CoverageMark({ coverage, hasValue = true }: { coverage: CoverageRecord; hasValue?: boolean }) {
  if (coverage.state === "measured") {
    // No mark. A note still shows where it says something non-obvious about THIS figure — but only
    // once there is a figure: beside a dash that is merely still loading, a provenance note reads
    // as an explanation for absence, which is not what it says.
    return coverage.note && hasValue ? <span className="mark-note">{coverage.note}</span> : null;
  }

  const label = coverage.state === "estimated" ? "Estimated" : "Not indexed";
  const className = coverage.state === "estimated" ? "mark estimated" : "mark not-indexed";

  return (
    <>
      <span className={className}>{label}</span>
      {coverage.note ? (
        <span className="mark-note">
          {coverage.note}
          {coverage.eta ? ` · expected ${coverage.eta}` : null}
        </span>
      ) : null}
    </>
  );
}

/**
 * The window a rate rests on, rendered under the rate.
 *
 * Deliberately not a tooltip. The monitor publishes `basisDays` and `historyDays` with every rate it
 * serves because the same payouts annualise to wildly different numbers depending on the divisor —
 * the basis is not a footnote, it is half the figure. On a page that sets one project's rate beside
 * another's, hiding it behind a hover would be the single easiest way to mislead.
 */
export function Basis({ basisDays, historyDays }: { basisDays: number | null; historyDays: number | null }) {
  if (basisDays === null && historyDays === null) return null;
  const parts: string[] = [];
  if (basisDays !== null) parts.push(`${basisDays}-day basis`);
  if (historyDays !== null) parts.push(`${historyDays.toFixed(1)} days of history`);
  return <span className="basis">{parts.join(" · ")}</span>;
}

/** A figure, or a dash. `null` means unknown — it is never rendered as zero. */
export function Figure({ value, coverage }: { value: string | null; coverage: CoverageRecord }) {
  const missing = value === null || coverage.state === "not_indexed";
  return (
    <>
      <span className={missing ? "cell dash" : "cell"}>{missing ? DASH : value}</span>
      <CoverageMark coverage={coverage} hasValue={!missing} />
    </>
  );
}

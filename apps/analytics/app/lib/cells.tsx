/**
 * One cell, rendered the same way wherever it appears.
 *
 * Lifted out of the route when the leaderboard cards arrived, because a card and a table cell
 * showing the same metric have to agree to the character: the card's headline figure IS the cell
 * for whichever row the reader ranked by. Two formatters would have drifted within a week.
 */
import type { ReactNode } from "react";

import { fmtAge, fmtNum, fmtUsd } from "@ouro/monitor-client";

import { Basis } from "~/components/Coverage";
import { fmtHours } from "~/lib/cadence";
import type { ProjectRow } from "~/lib/projects";
import type { Metric } from "~/registry";

export interface Cell {
  /** `null` means "we do not have this". Never "0" — see below. */
  value: string | null;
  /** What the figure rests on, when that differs from project to project. */
  extra?: ReactNode;
}

/**
 * Returns `null` for "we do not have this", which `Figure` renders as a dash with the coverage note
 * attached. It must never return "0" for an absent figure: zero is a claim about the project, a dash
 * is a statement about our coverage, and on a page about other people's projects that difference is
 * the whole editorial position.
 */
export function cell(metric: Metric, row: ProjectRow): Cell {
  const p = row.project;
  switch (metric) {
    case "price":
      return { value: row.priceUsd === null ? null : fmtUsd(row.priceUsd, { exact: true }) };

    case "marketCap":
      return {
        value: row.marketCapUsd === null ? null : fmtUsd(row.marketCapUsd, { compact: true }),
      };

    case "volume24h": {
      const v = row.volume;
      if (v.totalUsd === null) return { value: null };
      return {
        value: fmtUsd(v.totalUsd, { compact: true }),
        extra: (
          <span className="basis">
            {v.taxedShare === null
              ? // No canonical pool in the response: the share is unknown, not zero.
                `across ${v.pools ?? "?"} pools · taxed share unavailable`
              : `${(v.taxedShare * 100).toFixed(1)}% taxed across ${v.pools} pools · ${fmtUsd(
                  v.totalUsd - (v.canonicalUsd ?? 0),
                  { compact: true },
                )} untaxed`}
          </span>
        ),
      };
    }

    case "paidAllTime": {
      const { pricedPeriods: pr, closedPeriods: cl } = row;
      const partial = pr !== null && cl !== null && pr < cl;
      if (row.paidAllTimeUsd === null) return { value: null };
      return {
        // "at least", because the unpriced cycles are real payouts contributing nothing to the sum.
        value: `${partial || row.paidAllTimeTruncated ? "≥ " : ""}${fmtUsd(row.paidAllTimeUsd, { compact: true })}`,
        extra: partial ? (
          <span className="basis">
            only {pr} of {cl} payout cycles could be priced, so the rest paid wallets this figure does not count
          </span>
        ) : row.paidAllTimeTruncated ? (
          <span className="basis">at least: older cycles beyond the page were not summed</span>
        ) : undefined,
      };
    }

    case "paid24h":
      return { value: row.paid24hUsd === null ? null : fmtUsd(row.paid24hUsd, { compact: true }) };

    case "assets": {
      const syms = (row.assets?.map((a) => a.symbol).filter(Boolean) ?? []) as string[];
      if (!syms.length) return { value: null };
      // INDEX pays eighteen stocks in a cycle. The full list is a paragraph, not a cell — it forces
      // the column wide enough to push every other project off the screen. Name a few, count the
      // rest; the project page is where the whole basket belongs.
      const SHOWN = 4;
      const rest = syms.length - SHOWN;
      return {
        value: syms.slice(0, SHOWN).join(" · "),
        extra: rest > 0 ? <span className="basis">+{rest} more</span> : undefined,
      };
    }

    case "holders":
      return {
        value: row.holdersAboveLine === null ? null : fmtNum(row.holdersAboveLine),
        extra: (
          <span className="basis">
            line: {fmtNum(p.dividendLineTokens)} {p.symbol}
          </span>
        ),
      };

    case "recipients":
      return { value: row.recipientsLast === null ? null : fmtNum(row.recipientsLast) };

    case "ratePerLine":
      return {
        value:
          row.ratePerLineUsdPerDay === null ? null : `${fmtUsd(row.ratePerLineUsdPerDay, { exact: true })}/day`,
        extra: (
          <span className="basis">
            per {fmtNum(p.dividendLineTokens)} {p.symbol}
          </span>
        ),
      };

    case "apr": {
      const { aprWindowPriced: wp, aprWindowTotal: wt } = row;
      // A rate divided by a window in which some cycles carry no value is understated by exactly the
      // share it could not see. Understating a competitor is as unfair as overstating ourselves.
      const partial = wp !== null && wt !== null && wt > 0 && wp < wt;
      return {
        value: row.aprPct === null ? null : `${partial ? "≥ " : ""}${row.aprPct.toFixed(1)}%`,
        extra: (
          <>
            <Basis basisDays={row.aprBasisDays} historyDays={row.aprHistoryDays} />
            {partial ? (
              <span className="basis">
                understated: {wp} of {wt} cycles in the window could be priced
              </span>
            ) : null}
          </>
        ),
      };
    }

    /**
     * What the project's payout rhythm ACTUALLY is.
     *
     * This replaced "every 1 h", which came from the configured interval and described a schedule
     * none of these projects keeps — INDEX's real gaps run p50 1.0h to a 58.9h max. The median alone
     * would be equally misleading, so the spread rides with it.
     */
    case "payoutRhythm": {
      const c = row.cadence;
      if (c.medianH === null) return { value: null };
      return {
        value: `~${fmtHours(c.medianH)}`,
        extra: (
          <span className="basis">
            typical · 90% within {fmtHours(c.p90H)} · longest {fmtHours(c.maxH)} ({c.samples} cycles)
          </span>
        ),
      };
    }

    /**
     * Elapsed since the last payout, and whether that is unusual FOR THIS PROJECT.
     *
     * Replaces a "next in ~N" countdown that was computed from the contract's declared due time and
     * clamped negatives to zero — so INDEX, 10.4h past due, rendered "next in ~0 s". Elapsed time is
     * a fact; a predicted next payout, for a keeper-driven crank with no permissionless fallback,
     * is not.
     */
    case "lastPaid": {
      const c = row.cadence;
      if (c.sinceLastH === null) return { value: null };
      return {
        value: `${fmtHours(c.sinceLastH)} ago`,
        extra:
          c.quieterThanUsual === null ? undefined : (
            <span className="basis">
              {c.quieterThanUsual
                ? `longer than 90% of its recent gaps (${fmtHours(c.p90H)})`
                : `within its usual range (90% under ${fmtHours(c.p90H)})`}
            </span>
          ),
      };
    }

    case "tax":
      return { value: `${(p.taxBps / 100).toFixed(p.taxBps % 100 === 0 ? 0 : 1)}%` };

    /**
     * Liquidity the protocol itself owns, marked to market.
     *
     * A blank here would be the project's design, not our coverage: INDEX and HOOD10 spend the whole
     * tax on the basket they pay out, so there is nothing to own. The registry says that in the cell
     * (`state: "none"`) rather than leaving a bare dash to be read as a gap.
     *
     * The figure is the Reserve's NAV alone. `Treasury` also carries the position count and what the
     * NAV excludes, the way the Ledger's own footnote does; this cell deliberately prints neither.
     */
    case "treasury": {
      // "none", not a dash. Every other blank on this page means we did not measure something, and
      // spending the dash on a project that genuinely keeps no liquidity is the one blank that
      // would not be about our coverage. The reason rides underneath it either way.
      if (p.coverage.treasury.state === "none") return { value: "none" };
      const t = row.treasury;
      if (t.navUsd === null) return { value: null };
      return {
        value: fmtUsd(t.navUsd, { compact: true }),
      };
    }
  }
}

/**
 * The shortest honest qualifier for a figure shown OUTSIDE the table.
 *
 * The cards carry the same figures the table does, and several of them are meaningless without the
 * thing they are measured against: an APR without its window, a per-line rate without the size of a
 * line, a holder count without where the line is. The table prints those under the figure; a card
 * has no room for a sentence, so this is the same statement at its shortest. It is not optional and
 * it is not a tooltip — a rate that will not fit next to its basis does not go on the card.
 */
export function compactBasis(metric: Metric, row: ProjectRow): string | null {
  const p = row.project;
  switch (metric) {
    case "apr": {
      if (row.aprPct === null) return null;
      const parts: string[] = [];
      if (row.aprBasisDays !== null) parts.push(`${row.aprBasisDays}-day basis`);
      if (row.aprHistoryDays !== null) parts.push(`${fmtAge(row.aprHistoryDays)} of history`);
      return parts.length ? parts.join(" · ") : null;
    }
    case "ratePerLine":
      return row.ratePerLineUsdPerDay === null ? null : `per ${fmtNum(p.dividendLineTokens)} ${p.symbol}`;
    case "holders":
      return row.holdersAboveLine === null ? null : `line: ${fmtNum(p.dividendLineTokens)} ${p.symbol}`;
    case "payoutRhythm":
      return row.cadence.p90H === null ? null : `90% within ${fmtHours(row.cadence.p90H)}`;
    case "volume24h":
      return row.volume.taxedShare === null ? null : `${(row.volume.taxedShare * 100).toFixed(1)}% of it taxed`;
    default:
      return null;
  }
}

/**
 * The provenance note a whole row shares, if it shares one.
 *
 * "Summed across every pool the token trades in" was printed under all three volume cells, and
 * "measured from its own cycles" under all three rhythm cells. The sentence is true and worth
 * saying, but saying it three times is how a reader learns to stop reading these notes — which is
 * expensive, because the notes that DIFFER between projects are the entire point of the table. So an
 * identical note is hoisted to the row label, said once, still beside the figures.
 *
 * Only when EVERY cell carrying a figure carries the same note. One project qualified differently is
 * exactly the asymmetry that must stay visible per cell.
 */
export function sharedNote(metric: Metric, rows: ProjectRow[]): string | null {
  const notes: (string | undefined)[] = [];
  for (const row of rows) {
    const coverage = row.project.coverage[metric];
    if (coverage.state !== "measured") continue;
    if (cell(metric, row).value === null) continue;
    notes.push(coverage.note);
  }
  if (notes.length < 2) return null;
  const first = notes[0];
  if (!first) return null;
  return notes.every((n) => n === first) ? first : null;
}

import { useState, type ReactNode } from "react";

import type { Route } from "./+types/home";
import { ago, fmtNum, fmtUsd } from "@ouro/monitor-client";
import { Basis, DASH, Figure } from "~/components/Coverage";
import { sortRows, useProjects, type ProjectRow } from "~/lib/projects";
import { DEFAULT_SORT, METRICS, SORT_LABELS, type Metric, type SortKey } from "~/registry";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Airdrop Meta · Robinhood Chain" },
    {
      name: "description",
      content:
        "Every tax-index token on Robinhood Chain that pays its holders, on one page: what each has airdropped, to how many wallets, at what rate, read from the chain — with what each figure rests on stated beside it.",
    },
  ];
}

const LEDE =
  "Every tax-index token on Robinhood Chain that pays its holders, side by side. What each has paid, to how many wallets, in which tokens, and at what rate — read from the chain, none of it reported by hand. Where a figure is estimated or not yet indexed, the cell says so.";

/**
 * One cell.
 *
 * Returns `null` for "we do not have this", which `Figure` renders as a dash with the coverage note
 * attached. It must never return "0" for an absent figure: zero is a claim about the project, a dash
 * is a statement about our coverage, and on a page about other people's projects that difference is
 * the whole editorial position.
 */
function cell(metric: Metric, row: ProjectRow): { value: string | null; extra?: ReactNode } {
  const p = row.project;
  switch (metric) {
    case "price":
      return { value: row.priceUsd === null ? null : fmtUsd(row.priceUsd, { exact: true }) };

    case "marketCap":
      return {
        value: row.marketCapUsd === null ? null : fmtUsd(row.marketCapUsd, { compact: true }),
        // $OURO's figure is the eligible supply at spot, not a fully diluted value: it is what the
        // yield is a yield ON. Labelling it in the cell keeps the column honest rather than making
        // three different quantities look like one.
        extra: p.key === "ouro" ? <span className="basis">eligible supply at spot</span> : undefined,
      };

    case "volume24h":
      return {
        value: row.volume24hUsd === null ? null : fmtUsd(row.volume24hUsd, { compact: true }),
        extra:
          row.taxedShare === null ? undefined : (
            <span className="basis">{(row.taxedShare * 100).toFixed(1)}% of it taxed</span>
          ),
      };

    case "paidAllTime":
      return { value: row.paidAllTimeUsd === null ? null : fmtUsd(row.paidAllTimeUsd, { compact: true }) };

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
        extra: <span className="basis">line: {fmtNum(p.dividendLineTokens)} {p.symbol}</span>,
      };

    case "recipients":
      return { value: row.recipientsLast === null ? null : fmtNum(row.recipientsLast) };

    case "ratePerLine":
      return {
        value:
          row.ratePerLineUsdPerDay === null ? null : `${fmtUsd(row.ratePerLineUsdPerDay, { exact: true })}/day`,
        extra: <span className="basis">per {fmtNum(p.dividendLineTokens)} {p.symbol}</span>,
      };

    case "apr":
      return {
        value: row.aprPct === null ? null : `${row.aprPct.toFixed(1)}%`,
        // Never bare. See components/Coverage.tsx → Basis.
        extra: <Basis basisDays={row.aprBasisDays} historyDays={row.aprHistoryDays} />,
      };

    case "nextPayout": {
      const every =
        p.cadenceSec % 3600 === 0 ? `every ${p.cadenceSec / 3600} h` : `every ${Math.round(p.cadenceSec / 60)} min`;
      const due =
        row.nextPayoutTs === null ? null : ago(row.nextPayoutTs - Math.floor(Date.now() / 1000));
      return {
        value: every,
        extra: due ? <span className="basis">next in ~{due}</span> : undefined,
      };
    }

    case "tax":
      return { value: `${(p.taxBps / 100).toFixed(p.taxBps % 100 === 0 ? 0 : 1)}%` };

    case "wallet":
      return { value: p.coverage.wallet.state === "measured" ? "available" : null };
  }
}

export default function Home() {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const { rows, loading, error, generatedAt, configured } = useProjects();
  const ordered = sortRows(rows, sort);

  const status = !configured
    ? "Monitor not configured"
    : error
      ? "Monitor unreachable — showing what was last read"
      : loading
        ? "Reading…"
        : "Live";

  return (
    <>
      <div className="container page-head">
        <p className="eyebrow">Robinhood Chain · 4663</p>
        <h1>The airdrop meta, read from the chain</h1>
        <p className="lede">{LEDE}</p>
      </div>

      <div className="container">
        <div className="strip">
          <span>
            <b>{status}</b>
          </span>
          <span>
            Projects tracked <b>{rows.length}</b>
          </span>
          {generatedAt ? (
            <span>
              As of <b>{ago(Math.floor(Date.now() / 1000) - generatedAt)}</b> ago
            </span>
          ) : null}
          <span>
            Source <b>ouro-monitor</b>
          </span>
        </div>
      </div>

      <section className="container section">
        <div className="section-head">
          <div>
            <h2>Side by side</h2>
            <p className="sub">
              Sorted by {SORT_LABELS[sort].toLowerCase()}, descending. Every column sorts; the order is never
              fixed to put any one project first.
            </p>
          </div>
          <div className="sortbar">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col" className="metric-name">
                  <span className="phead">
                    <span className="sym" style={{ fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Metric
                    </span>
                  </span>
                </th>
                {ordered.map((row) => (
                  <th scope="col" key={row.project.key}>
                    <span className="phead">
                      <span className="sym">{row.project.symbol}</span>
                      <span className="who">
                        {row.project.name}
                        {row.project.operator === "ouro" ? " · ours" : ""}
                      </span>
                      {/* Said once here rather than in each of this column's empty cells. */}
                      {row.project.notIndexedReason ? (
                        <span className="mark not-indexed">Not indexed</span>
                      ) : null}
                      {row.project.notIndexedReason ? (
                        <span className="mark-note">{row.project.notIndexedReason}</span>
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(({ key, label, hint }) => (
                <tr key={key}>
                  <td className="metric-name">
                    {label}
                    {hint ? <span className="hint">{hint}</span> : null}
                  </td>
                  {ordered.map((row) => {
                    const { value, extra } = cell(key, row);
                    const coverage = row.project.coverage[key];
                    return (
                      <td key={row.project.key}>
                        <Figure value={value} coverage={coverage} />
                        {/* The qualifier only belongs beside a figure that exists. */}
                        {value !== null && coverage.state !== "not_indexed" ? extra : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="note">
          <strong>The rates are not comparing like with like, and the row says so.</strong> Every APR here is
          real and measured, but they rest on very different things — a rate from nine days of payouts over a
          million dollars of eligible supply is not the same kind of number as one from thousands of epochs
          over twenty-eight times the base. That is why the window sits under the figure rather than behind a
          tooltip: the basis is not a footnote, it is half the rate.
        </p>

        <p className="note">
          <strong>A dash is about our coverage, not about the project.</strong> Where a cell is blank it says
          why underneath — estimated, or not yet indexed. Nothing here is rendered as a zero because we have
          not read it.
        </p>
      </section>

      <footer className="container foot">
        <span>Read from Robinhood Chain · nothing reported by hand</span>
        <span>Operated by Ouro · unaffiliated with the other projects listed</span>
        <span>{DASH} means not measured, not zero</span>
        <span>Price, value and volume: GeckoTerminal, polled every 5 min</span>
      </footer>
    </>
  );
}

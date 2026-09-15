/**
 * The full comparison, one metric per row, one project per column.
 *
 * Three things changed when this came out of the route.
 *
 * ── The row label is the sort control ──
 * The page's copy already claimed "every column sorts", and the only way to do it was a dropdown of
 * five keys. Now every rankable row is a button, which is both the honest version of that claim and
 * the cheapest interaction on the page: the reader re-ranks by pressing the thing they are reading.
 *
 * ── The rows are banded ──
 * Fourteen undifferentiated rows opened on Price, which is the one figure here anybody can get
 * somewhere else. Airdrops first, then rhythm, then market. The band heads also give the eye
 * somewhere to rest on a table this tall.
 *
 * ── A column can be traced ──
 * Fourteen rows down the page, a figure has lost its column. Hovering any cell lights its column and
 * its row; selecting a project on a card above pins that column until it is unpinned. Neither
 * changes what is on the page, only what is easy to follow across it.
 */
import { useState } from "react";

import { Figure } from "~/components/Coverage";
import { cell, sharedNote } from "~/lib/cells";
import type { ProjectRow } from "~/lib/projects";
import { GROUPS, isSortable, METRICS, SORT_ORDER, type SortKey } from "~/registry";

export function Matrix({
  rows,
  sort,
  onSort,
  focus,
  onFocus,
}: {
  /** Already sorted. */
  rows: ProjectRow[];
  sort: SortKey;
  onSort: (key: SortKey) => void;
  focus: string | null;
  onFocus: (key: string | null) => void;
}) {
  const [hot, setHot] = useState<string | null>(null);

  const colClass = (key: string) => {
    const classes = [];
    if (focus === key) classes.push("col-pin");
    if (hot === key) classes.push("col-hot");
    return classes.join(" ");
  };

  return (
    <div className="table-scroll" onPointerLeave={() => setHot(null)}>
      <table className="matrix">
        <thead>
          <tr>
            <th scope="col" className="metric-name">
              <span className="col-metric-head">Metric</span>
            </th>
            {rows.map((row) => {
              const p = row.project;
              const on = focus === p.key;
              return (
                <th scope="col" key={p.key} className={colClass(p.key)} onPointerEnter={() => setHot(p.key)}>
                  <button
                    type="button"
                    className="phead"
                    aria-pressed={on}
                    onClick={() => onFocus(on ? null : p.key)}
                    title={on ? `Stop tracing ${p.symbol}` : `Trace ${p.symbol} down the table`}
                  >
                    <span className="sym">
                      {p.symbol}
                      {p.operator === "ouro" ? <span className="chip">ours</span> : null}
                    </span>
                    <span className="who">{p.name}</span>
                  </button>
                  {/* Said once here rather than in each of this column's empty cells. */}
                  {p.notIndexedReason ? <span className="mark not-indexed">Not indexed</span> : null}
                  {p.notIndexedReason ? <span className="mark-note">{p.notIndexedReason}</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>

        {GROUPS.map((group) => {
          const metrics = METRICS.filter((m) => m.group === group.key);
          if (!metrics.length) return null;
          return (
            <tbody key={group.key}>
              <tr className="group-row">
                <th scope="colgroup" colSpan={rows.length + 1}>
                  {group.label}
                </th>
              </tr>
              {metrics.map(({ key, label, hint }) => {
                const shared = sharedNote(key, rows);
                const active = sort === key;
                return (
                  <tr key={key} className={active ? "sorted" : undefined}>
                    <td className="metric-name">
                      {isSortable(key) ? (
                        <button
                          type="button"
                          className="row-sort"
                          aria-pressed={active}
                          onClick={() => onSort(key)}
                          title={`Rank the projects by ${label.toLowerCase()}, ${SORT_ORDER[key]}`}
                        >
                          {label}
                          <span className="sort-mark" aria-hidden="true">
                            {active ? "▾" : "↕"}
                          </span>
                        </button>
                      ) : (
                        <span className="row-static">{label}</span>
                      )}
                      {hint ? <span className="hint">{hint}</span> : null}
                      {/* Identical across every cell in this row, so it is said once. */}
                      {shared ? <span className="hint shared">{shared}</span> : null}
                    </td>
                    {rows.map((row) => {
                      const { value, extra } = cell(key, row);
                      const coverage = row.project.coverage[key];
                      return (
                        <td
                          key={row.project.key}
                          className={colClass(row.project.key)}
                          onPointerEnter={() => setHot(row.project.key)}
                        >
                          <Figure value={value} coverage={coverage} hideNote={shared !== null} />
                          {/* The qualifier only belongs beside a figure that exists. */}
                          {value !== null && coverage.state !== "not_indexed" ? extra : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

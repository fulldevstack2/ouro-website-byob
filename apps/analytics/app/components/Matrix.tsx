/**
 * The full comparison, one metric per row, one project per column.
 *
 * Three things changed when this came out of the route.
 *
 * ── The row label is the sort control ──
 * The page's copy already claimed "every column sorts", and the only way to do it was a dropdown of
 * five keys. Now every rankable row is a button, which is both the honest version of that claim and
 * the cheapest interaction on the page: the reader re-ranks by pressing the thing they are reading.
 * It ranks THIS table and nothing else. It used to write the order the whole page was in, which put
 * the visible half of a press somewhere the reader was not: the cards it also re-ranked are a screen
 * and a half above them. The cards carry their own control, in their own section head.
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
import { useColumnFlip } from "~/lib/motion";
import type { ProjectRow } from "~/lib/projects";
import { GROUPS, isSortable, METRICS, SORT_ORDER, SORT_RANK, type SortKey } from "~/registry";

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
  // Re-ranking moves the columns. Sliding them says so; see `useColumnFlip`.
  const sheet = useColumnFlip<HTMLDivElement>();

  const colClass = (key: string) => {
    const classes = [];
    if (focus === key) classes.push("col-pin");
    if (hot === key) classes.push("col-hot");
    return classes.join(" ");
  };

  return (
    <div className="table-scroll sheet" ref={sheet} onPointerLeave={() => setHot(null)}>
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
                <th
                  scope="col"
                  key={p.key}
                  className={colClass(p.key)}
                  data-col={p.key}
                  onPointerEnter={() => setHot(p.key)}
                >
                  <button
                    type="button"
                    className="phead"
                    aria-pressed={on}
                    onClick={() => onFocus(on ? null : p.key)}
                    title={on ? `Stop tracing ${p.symbol}` : `Trace ${p.symbol} down the table`}
                  >
                    {/* Ours is said in gold on the name itself rather than by a badge beside it.
                        The badge was a second object in a head that already has two lines, and the
                        disclosure is the same either way: the operator is named in the footer. */}
                    <span className={p.operator === "ouro" ? "sym ours" : "sym"}>{p.symbol}</span>
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
                // The ranked row is said by the ▾ on its own label, and by nothing else. It used to
                // carry a band across the whole table, which was on from the first paint and so read
                // as a selection the reader had not made.
                const active = sort === key;
                /**
                 * The whole cell, not just the label.
                 *
                 * The hint under a row's name and the note it shares across the row used to sit
                 * outside the button, as siblings of it. So the cell lit up on hover from edge to
                 * edge and then a press on "in the most recent cycle", or on the empty band beside a
                 * tall row, did nothing. Everything in the cell goes inside the control, and the
                 * control fills the cell, so the thing that answers the pointer is the thing that
                 * looked like it would.
                 */
                const body = (
                  <>
                    <span className="row-name">
                      {label}
                      {isSortable(key) ? (
                        <span className="sort-mark" aria-hidden="true">
                          {active ? "▾" : "↕"}
                        </span>
                      ) : null}
                    </span>
                    {hint ? <span className="hint">{hint}</span> : null}
                    {/* Identical across every cell in this row, so it is said once. */}
                    {shared ? <span className="hint shared">{shared}</span> : null}
                  </>
                );
                // `data-metric` names the row's metric so a stylesheet can single one out: the assets
                // row is the one figure that is a list of words and may wrap where a number may not.
                return (
                  <tr key={key} data-metric={key}>
                    <td className="metric-name">
                      {isSortable(key) ? (
                        <button
                          type="button"
                          className="row-sort"
                          aria-pressed={active}
                          onClick={() => onSort(key)}
                          title={`Rank the table by ${SORT_RANK[key]}, ${SORT_ORDER[key]}`}
                        >
                          {body}
                        </button>
                      ) : (
                        <span className="row-static">{body}</span>
                      )}
                    </td>
                    {rows.map((row) => {
                      const { value, extra } = cell(key, row);
                      const coverage = row.project.coverage[key];
                      return (
                        <td
                          key={row.project.key}
                          className={colClass(row.project.key)}
                          data-col={row.project.key}
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

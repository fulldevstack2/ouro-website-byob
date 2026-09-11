import { Button } from "~/components/ds";
import { fmtNum } from "~/lib/monitorApi";
import { mono } from "./text";

/**
 * Pages a table the page has already fetched in full.
 *
 * Client-side, over rows already in hand: the figures above such a table are computed from the whole
 * history anyway, so paging the request would cost a round trip and buy nothing. The caller owns the
 * page number, so it can clamp it when the list grows under a reader and scroll the table back into
 * view when a turn leaves the new rows above the fold.
 *
 * Labelled NEWER and OLDER rather than previous and next. The tables this pages are
 * reverse-chronological, so "next" would walk backwards in time, the one direction a reader of a
 * ledger has to be sure of.
 */
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  noun,
  label,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** What a row is, plural: "payouts", "payments". Read out in the count and the button labels. */
  noun: string;
  /** The nav landmark's name, e.g. "Airdrop history pages". */
  label: string;
  onPage: (n: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav aria-label={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 20 }}>
      <span aria-live="polite" style={{ ...mono, fontSize: 12, color: "var(--text-muted)" }}>
        {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)} {noun}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={`Newer ${noun}`}>
          <span aria-hidden="true">←</span> Newer
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} aria-label={`Older ${noun}`} arrow>
          Older
        </Button>
      </span>
    </nav>
  );
}

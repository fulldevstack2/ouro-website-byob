/**
 * What the whole meta adds up to, stated once, at the top.
 *
 * The page used to open on a headline, four lines of prose and a status strip, and the first number
 * on it arrived 600 pixels down. Its most striking fact — that three tokens on this chain have paid
 * their holders close to two million dollars, in three thousand separate payout cycles, entirely
 * from trading taxes — was nowhere on it at all, because it was only ever available as a sum the
 * reader had to do themselves.
 *
 * Every figure here obeys the same rule as every cell below: a project whose figure is withheld is
 * left OUT of the total rather than counted as zero, the band says how many it covers when that is
 * not all of them, and it prints "≥" when any contributing figure is itself a floor.
 */
import { fmtNum, fmtUsd } from "@ouro/monitor-client";

import { Spark } from "~/components/Spark";
import { useChanged, useEnter } from "~/lib/motion";
import type { Totals } from "~/lib/projects";
import type { Point } from "~/lib/series";

const fmtUsdAxis = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;

/** A figure, or a resting skeleton while the first read is still in flight. Never a premature dash. */
function Big({ children, loading }: { children: string | null; loading: boolean }) {
  const ticked = useChanged(children);
  if (children === null) return <span className={loading ? "skel skel-big" : "band-figure dash"}>{loading ? "" : "—"}</span>;
  return (
    <span className="band-figure" data-tick={ticked ? "on" : undefined}>
      {children}
    </span>
  );
}

function Small({ label, value, note, loading }: { label: string; value: string | null; note?: string; loading: boolean }) {
  const ticked = useChanged(value);
  return (
    <div className="band-stat">
      <span className="band-label">{label}</span>
      {value === null ? (
        <span className={loading ? "skel skel-small" : "band-value dash"}>{loading ? "" : "—"}</span>
      ) : (
        <span className="band-value" data-tick={ticked ? "on" : undefined}>
          {value}
        </span>
      )}
      {note ? <span className="band-note">{note}</span> : null}
    </div>
  );
}

export function HeroBand({
  totals: t,
  paidPerDay,
  loading,
  windowDays,
}: {
  totals: Totals;
  /** Every project's dollars airdropped per day, already summed. */
  paidPerDay: Point[];
  loading: boolean;
  /** The page-wide window. `null` is everything indexed. */
  windowDays: number | null;
}) {
  const floor = t.paidAllTimeFloor ? "≥ " : "";
  /**
   * Only once there is a total to qualify.
   *
   * While the first read is in flight the count is legitimately zero, and saying "counted across 0 of
   * 3 tracked tokens, the rest are not indexed" would be a false statement about all three of them
   * for as long as the request takes.
   */
  const covered = t.paidAllTimeUsd !== null && t.paidAllTimeCounted < t.projects;
  const entering = useEnter();

  return (
    <div className={entering ? "band enter" : "band"}>
      <div className="band-head">
        <span className="band-label">Airdropped to holders, all time</span>
        <Big loading={loading}>{t.paidAllTimeUsd === null ? null : `${floor}${fmtUsd(t.paidAllTimeUsd, { compact: true })}`}</Big>
        <p className="band-sub">
          {covered
            ? `counted across ${t.paidAllTimeCounted} of ${t.projects} tracked tokens. The rest are not indexed, so they are left out rather than counted as nothing.`
            : `paid out by ${t.projects} tax-index tokens on Robinhood Chain, out of trading taxes on their own volume.`}
        </p>
      </div>

      <div className="band-spark">
        {loading && paidPerDay.length < 2 ? (
          <div className="skel skel-spark" />
        ) : (
          <Spark
            points={paidPerDay}
            format={fmtUsdAxis}
            tone="inverse"
            label="Dollars airdropped per day, all projects"
            caption={`airdropped per day · ${windowDays === null ? "everything indexed" : `last ${windowDays} days`} · all tokens`}
          />
        )}
      </div>

      <div className="band-stats">
        <Small
          loading={loading}
          label="Airdropped, last 24 h"
          value={t.paid24hUsd === null ? null : fmtUsd(t.paid24hUsd, { compact: true })}
        />
        <Small
          loading={loading}
          label="Wallets paid, last cycle"
          value={t.recipientsLast === null ? null : fmtNum(t.recipientsLast)}
          note="each token's own most recent cycle"
        />
        <Small
          loading={loading}
          label="Payout cycles, all time"
          value={t.cycles === null ? null : `${t.cyclesFloor ? "≥ " : ""}${fmtNum(t.cycles)}`}
        />
      </div>
    </div>
  );
}

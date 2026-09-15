/**
 * The historical series this page can chart honestly, for every project.
 *
 * Chosen by auditing what the indexer actually holds rather than what it nominally exposes.
 * `/v1/{token}/daily?days=400` returns 400 rows for every project, but most are zero-filled — the
 * real coverage is much narrower and differs per project and per field:
 *
 *                         INDEX   OURO   HOOD10
 *     paid_usd / day        63 d   11 d     17 d   ← charted
 *     tax_usd / day         71 d   12 d     21 d   ← charted
 *     epochs.recipients      200     94       43   ← charted
 *     hours between cycles   199     93       42   ← charted (a gap needs two cycles, hence one fewer)
 *     epochs.holders         200      0       43   $OURO records none
 *     price / taxed share   10 d    0 d     10 d   market snapshots only, nothing for $OURO
 *
 * Airdropped-per-day joined the list on 2026-09-13. It had been two days for HOOD10, because one of
 * its ten basket constituents had no price and a period is valued all-or-nothing, so 39 of its 43
 * periods carried no dollars; fixing the indexer's pool choice for that one token took it to
 * seventeen.
 *
 * What is still out: holders over time, which $OURO's source computes and never stores, and price
 * and volume history, which runs to ten days and none of it $OURO's. On a page whose claim is
 * even-handedness a two-of-three chart is worse than no chart.
 */
import { useEffect, useState } from "react";

export interface Point {
  /** Unix seconds. */
  t: number;
  v: number;
}

export interface Series {
  key: string;
  symbol: string;
  points: Point[];
}

const API = typeof __MONITOR_API__ === "string" ? __MONITOR_API__ : "";

async function getJson<T>(path: string): Promise<T | null> {
  if (!API) return null;
  try {
    const r = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

interface DailyRow {
  day: number;
  tax_usd: number | null;
  paid_usd: number | null;
}
interface EpochRow {
  epoch: number;
  status: string;
  endTs: number | null;
  startTs: number | null;
  recipients: number | null;
}

/**
 * Tax collected per day, per project.
 *
 * Zero days are dropped rather than plotted. The indexer pads its response to the requested window,
 * so a project that launched three weeks ago otherwise draws fifty days of a flat zero line running
 * into its first real value — which reads as "this project collected nothing for months" rather than
 * "this project did not exist".
 */
export async function fetchTaxPerDay(keys: { key: string; symbol: string }[], days = 90): Promise<Series[]> {
  const out = await Promise.all(
    keys.map(async ({ key, symbol }) => {
      const d = await getJson<{ days: DailyRow[] }>(`/v1/${key}/daily?days=${days}`);
      const points = (d?.days ?? [])
        .filter((r) => typeof r.tax_usd === "number" && r.tax_usd > 0)
        .map((r) => ({ t: r.day, v: r.tax_usd as number }));
      return { key, symbol, points };
    }),
  );
  return out;
}

/**
 * Wallets paid per cycle, and the hours between one payout and the next.
 *
 * Per cycle rather than per day on purpose: a day holds a variable number of cycles for every one of
 * these projects (INDEX's gaps run from four minutes to two and a half days), so a daily total mixes
 * "more wallets" with "more cycles" into one line and neither can be read out of it.
 *
 * Both series come off the same epoch page, which for INDEX is 790 KB. Fetching it twice to derive
 * two series from one response would double the largest download on the page for nothing.
 *
 * The gaps are NOT derived from the recipients series. A cycle whose wallet count the indexer could
 * not resolve is dropped from that one, and a dropped cycle silently merges two gaps into a single
 * one twice as long, which reads as a slowdown that never happened. Timing comes from every closed
 * cycle carrying a timestamp, whether or not its wallet count survived.
 */
export async function fetchCycleSeries(
  keys: { key: string; symbol: string }[],
  limit = 200,
): Promise<{ recipients: Series[]; gaps: Series[] }> {
  const out = await Promise.all(
    keys.map(async ({ key, symbol }) => {
      const d = await getJson<{ epochs: EpochRow[] }>(`/v1/${key}/epochs?limit=${limit}`);
      const closed = (d?.epochs ?? []).filter((e) => e.status === "closed" && (e.endTs ?? e.startTs));

      const recipients = closed
        .filter((e) => typeof e.recipients === "number")
        .map((e) => ({ t: (e.endTs ?? e.startTs) as number, v: e.recipients as number }))
        .sort((a, b) => a.t - b.t);

      const ts = closed.map((e) => (e.endTs ?? e.startTs) as number).sort((a, b) => a - b);
      const gaps: Point[] = [];
      for (let i = 1; i < ts.length; i++) {
        const hours = ((ts[i] as number) - (ts[i - 1] as number)) / 3600;
        // A gap of zero is one payout recorded twice, not a cadence of no time at all.
        if (hours > 0) gaps.push({ t: ts[i] as number, v: hours });
      }

      return { recipients: { key, symbol, points: recipients }, gaps: { key, symbol, points: gaps } };
    }),
  );
  return { recipients: out.map((o) => o.recipients), gaps: out.map((o) => o.gaps) };
}

/**
 * Dollars airdropped per day.
 *
 * Only chartable for all three since 2026-09-13. HOOD10 had two usable days before its indexer's
 * price loader was fixed — a single basket constituent without a price nulled 39 of its 43 periods,
 * and a period is valued all-or-nothing. It has seventeen now.
 */
export async function fetchPaidPerDay(keys: { key: string; symbol: string }[], days = 90): Promise<Series[]> {
  return Promise.all(
    keys.map(async ({ key, symbol }) => {
      const d = await getJson<{ days: DailyRow[] }>(`/v1/${key}/daily?days=${days}`);
      const points = (d?.days ?? [])
        .filter((r) => typeof r.paid_usd === "number" && r.paid_usd > 0)
        .map((r) => ({ t: r.day, v: r.paid_usd as number }));
      return { key, symbol, points };
    }),
  );
}

/**
 * The last `days` of a series, or all of it when `days` is null.
 *
 * The window control exists because the three projects have wildly different histories: INDEX has
 * 63 charted days against $OURO's 12, so "all" draws $OURO as a burst at the right-hand edge of a
 * panel that is mostly empty. Being able to pull the window in to 14 days is what makes the three
 * panels comparable at all.
 */
export function withinDays(points: Point[], days: number | null): Point[] {
  if (days === null) return points;
  const cut = Date.now() / 1000 - days * 86_400;
  return points.filter((p) => p.t >= cut);
}

export interface SeriesState {
  paid: Series[];
  tax: Series[];
  recipients: Series[];
  /** Hours between one payout and the next, timed at the later of the two. */
  gaps: Series[];
  loading: boolean;
}

/** Every series, fetched once on mount. History moves slowly; there is nothing to poll for. */
export function useSeries(keys: { key: string; symbol: string }[]): SeriesState {
  const [state, setState] = useState<SeriesState>({ paid: [], tax: [], recipients: [], gaps: [], loading: true });
  const signature = keys.map((k) => k.key).join(",");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [paid, tax, cycles] = await Promise.all([
        fetchPaidPerDay(keys),
        fetchTaxPerDay(keys),
        fetchCycleSeries(keys),
      ]);
      if (alive) setState({ paid, tax, recipients: cycles.recipients, gaps: cycles.gaps, loading: false });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return state;
}

/**
 * The two historical series this page can chart honestly.
 *
 * Both were chosen by auditing what the indexer actually holds rather than what it nominally
 * exposes. `/v1/{token}/daily?days=400` returns 400 rows for every project, but most are zero-filled
 * — the real coverage is much narrower, and differs per project and per field:
 *
 *                         INDEX   OURO   HOOD10
 *     tax_usd / day         71 d   12 d     21 d   ← charted
 *     epochs.recipients      200     94       43   ← charted
 *     paid_usd / day        63 d   11 d      2 d   HOOD10 unusable (one unpriced basket leg)
 *     epochs.holders         200      0       43   $OURO records none
 *     price / taxed share   10 d    0 d     10 d   market snapshots only, nothing for $OURO
 *
 * So: tax collected and wallets paid. Everything else is a two-of-three chart, which on a page whose
 * whole claim is even-handedness is worse than no chart.
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
 * Wallets paid, per payout cycle.
 *
 * Per cycle rather than per day on purpose: a day holds a variable number of cycles for every one of
 * these projects (INDEX's gaps run from four minutes to two and a half days), so a daily total mixes
 * "more wallets" with "more cycles" into one line and neither can be read out of it.
 */
export async function fetchRecipientsPerCycle(keys: { key: string; symbol: string }[], limit = 200): Promise<Series[]> {
  const out = await Promise.all(
    keys.map(async ({ key, symbol }) => {
      const d = await getJson<{ epochs: EpochRow[] }>(`/v1/${key}/epochs?limit=${limit}`);
      const points = (d?.epochs ?? [])
        .filter((e) => e.status === "closed" && typeof e.recipients === "number" && (e.endTs ?? e.startTs))
        .map((e) => ({ t: (e.endTs ?? e.startTs) as number, v: e.recipients as number }))
        .sort((a, b) => a.t - b.t);
      return { key, symbol, points };
    }),
  );
  return out;
}

export interface SeriesState {
  tax: Series[];
  recipients: Series[];
  loading: boolean;
}

/** Both series, fetched once on mount. History moves slowly; there is nothing to poll for. */
export function useSeries(keys: { key: string; symbol: string }[]): SeriesState {
  const [state, setState] = useState<SeriesState>({ tax: [], recipients: [], loading: true });
  const signature = keys.map((k) => k.key).join(",");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [tax, recipients] = await Promise.all([fetchTaxPerDay(keys), fetchRecipientsPerCycle(keys)]);
      if (alive) setState({ tax, recipients, loading: false });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return state;
}

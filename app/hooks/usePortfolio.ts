import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";

import { MONITOR_API, type Poll, type PortfolioAirdrops, type PortfolioPayment, type PortfolioSummary } from "~/lib/monitorApi";

/* ────────────────────────────────────────────────────────────────────────────
   One wallet's portfolio, from ouro-monitor.

   `GET /v1/portfolio/{address}` is the whole page in one payload: the balance and the standing from
   the holder snapshot, the projection, the next-payment estimate, and the wallet's holdings and vault
   positions, read live from the chain as the request is served. `/airdrops` under it pages the
   payments. Until 2026-09-11 this page read the chain itself, one multicall for the balances and one
   eth_getLogs over six million blocks for the history, matched to the monitor's cycle data for prices;
   the monitor now does all of that once, for every reader, and the page asks it.

   Not `useMonitor`, for one reason: that hook keeps its last payload across a change of path, which is
   right for a chart that switches tokens and wrong here, where a change of path is a change of wallet
   and a page headed "Your portfolio" must not show the previous wallet's figures for even one poll.
   Both hooks below start over the moment the address changes and drop any answer that arrives for the
   wallet before it.
   ──────────────────────────────────────────────────────────────────────────── */

/** An HTTP or network error in one line, for the callout beside a stale figure. */
function describe(e: unknown): string {
  const m = ((e as Error)?.message ?? "The monitor did not answer.").split("\n")[0];
  return m.length > 160 ? `${m.slice(0, 157)}...` : m;
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(`${MONITOR_API}${path}`, { signal, headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Four times as slowly while the tab is hidden, as every poll on the site does. */
const delay = (intervalMs: number) => (document.visibilityState === "visible" ? intervalMs : intervalMs * 4);

/* ── the summary ──────────────────────────────────────────────────────────── */

/**
 * The wallet's summary, polled every `intervalMs`. Null until the first answer for THIS wallet lands;
 * a failed poll keeps the last good payload and reports the error beside it; no address is the resting
 * state. The monitor reads the holdings and the vault positions from the chain on every request, so
 * this is also how fresh those figures are.
 */
export function usePortfolioSummary(address: Address | null, intervalMs = 30_000): Poll<PortfolioSummary> {
  const [state, setState] = useState<SummaryState>(() => ({ ...pendingSummary(address), for: address }));

  useEffect(() => {
    if (!address || !MONITOR_API) {
      setState({ data: null, error: MONITOR_API ? null : "not-configured", updatedAt: null, loading: false, for: address });
      return;
    }
    setState({ ...pendingSummary(address), for: address });
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const run = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const data = await getJson<PortfolioSummary>(`/v1/portfolio/${address}`, ctrl.signal);
        if (alive) setState({ data, error: null, updatedAt: Date.now(), loading: false, for: address });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (alive) setState((s) => ({ ...s, error: describe(e), loading: false }));
      }
      if (alive) timer = setTimeout(run, delay(intervalMs));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [address, intervalMs]);

  // Between a change of wallet and the effect that starts over for it, the state is still the wallet before's.
  const { for: owner, ...poll } = state;
  return owner === address ? poll : pendingSummary(address);
}

interface SummaryState extends Poll<PortfolioSummary> {
  /** The address the payload belongs to, so a render for a new wallet never prints the old one's figures. */
  for: Address | null;
}

const pendingSummary = (address: Address | null): Poll<PortfolioSummary> => ({ data: null, error: null, updatedAt: null, loading: address !== null });

/* ── the payments ─────────────────────────────────────────────────────────── */

/** Payments per request: five pages of the table, so a reader turns four pages before the next fetch. */
const FETCH_SIZE = 60;

export interface PaymentsFeed {
  /** Every payment fetched so far, newest first. Null until the first page for this wallet has landed. */
  payments: PortfolioPayment[] | null;
  /** True once the oldest payment there is has been fetched. */
  complete: boolean;
  /** Fetch the next older page. Does nothing before the first page, while one is in flight, or once `complete`. */
  loadMore: () => void;
  loadingMore: boolean;
  /** The last error, from the newest page's poll or an older page's fetch. */
  error: string | null;
}

interface FeedState {
  /** Lowercase address the state belongs to; an answer for any other wallet is dropped. */
  wallet: string | null;
  /** By transaction hash, so a payment fetched twice (a re-poll, two pages that overlap) is one row. */
  byTx: Map<string, PortfolioPayment>;
  firstLoaded: boolean;
  /** Where the next older page starts: undefined until the first page lands, null once the end is reached. */
  cursor: number | null | undefined;
  loadingMore: boolean;
  error: string | null;
}

const resting = (wallet: string | null): FeedState => ({ wallet, byTx: new Map(), firstLoaded: false, cursor: undefined, loadingMore: false, error: null });

function merged(into: Map<string, PortfolioPayment>, rows: readonly PortfolioPayment[]): Map<string, PortfolioPayment> {
  const out = new Map(into);
  for (const r of rows) out.set(r.tx.toLowerCase(), r);
  return out;
}

/** Newest first: by time, then block, then hash, so the order is total and two renders agree on it. */
function newestFirst(rows: PortfolioPayment[]): PortfolioPayment[] {
  return rows.sort((a, b) => b.ts - a.ts || b.block - a.block || (a.tx < b.tx ? 1 : a.tx > b.tx ? -1 : 0));
}

/**
 * The newest page, folded into what is kept.
 *
 * Everything ever fetched stays, keyed by hash: a re-poll can only add rows or refresh their values,
 * and a payment that slid off the newest page as newer ones landed stays where it was. One gap that
 * cannot be closed that way: if a whole page of payments has landed since the last poll (a laptop
 * asleep for days, at twelve payments a day), the rows between it and what was kept were never seen.
 * That shows as a full newest page that overlaps nothing kept, and the list starts over from it.
 */
function absorbNewest(s: FeedState, page: PortfolioAirdrops): FeedState {
  const fresh = page.payments;
  const overlaps = fresh.some((p) => s.byTx.has(p.tx.toLowerCase()));
  const gap = s.firstLoaded && s.byTx.size > 0 && fresh.length > 0 && !overlaps && page.nextBefore !== null;
  if (gap) return { ...s, byTx: merged(new Map(), fresh), firstLoaded: true, cursor: page.nextBefore, loadingMore: false, error: null };
  return { ...s, byTx: merged(s.byTx, fresh), firstLoaded: true, cursor: s.cursor === undefined ? page.nextBefore : s.cursor, error: null };
}

/**
 * The wallet's payments, newest first, in pages.
 *
 * The newest FETCH_SIZE payments are polled every `intervalMs`, so a payout that lands while the page
 * is open appears at the top and a leg the monitor prices later gets its value. Older pages are
 * fetched on demand through `loadMore`, each from the cursor the page before it returned, and the
 * table asks for them one page ahead of the reader (see HistoryCard). Nothing fetched is dropped
 * while the wallet stays the same; see `absorbNewest` for why that is enough.
 */
export function useAirdropPayments(address: Address | null, intervalMs = 60_000): PaymentsFeed {
  const wallet = address ? address.toLowerCase() : null;
  const [state, setState] = useState<FeedState>(() => resting(wallet));
  // `loadMore` is called from an effect in the table and must see the cursor as it is now, not the one it closed over.
  const latest = useRef(state);
  latest.current = state;
  const busy = useRef(false);
  const olderCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    setState(resting(wallet));
    busy.current = false;
    if (!wallet || !MONITOR_API) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const run = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const page = await getJson<PortfolioAirdrops>(`/v1/portfolio/${wallet}/airdrops?limit=${FETCH_SIZE}`, ctrl.signal);
        if (alive) setState((s) => (s.wallet === wallet ? absorbNewest(s, page) : s));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (alive) setState((s) => (s.wallet === wallet ? { ...s, error: describe(e) } : s));
      }
      if (alive) timer = setTimeout(run, delay(intervalMs));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
      ctrl?.abort();
      olderCtrl.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [wallet, intervalMs]);

  const loadMore = useCallback(() => {
    const s = latest.current;
    if (!wallet || !MONITOR_API || busy.current || s.wallet !== wallet || !s.firstLoaded || s.cursor === null || s.cursor === undefined) return;
    const before = s.cursor;
    const ctrl = new AbortController();
    olderCtrl.current = ctrl;
    busy.current = true;
    setState((t) => (t.wallet === wallet ? { ...t, loadingMore: true } : t));
    getJson<PortfolioAirdrops>(`/v1/portfolio/${wallet}/airdrops?limit=${FETCH_SIZE}&before=${before}`, ctrl.signal)
      .then((page) => {
        busy.current = false;
        setState((t) => (t.wallet === wallet ? { ...t, byTx: merged(t.byTx, page.payments), cursor: page.nextBefore, loadingMore: false, error: null } : t));
      })
      .catch((e: unknown) => {
        busy.current = false;
        if ((e as Error).name === "AbortError") return;
        setState((t) => (t.wallet === wallet ? { ...t, loadingMore: false, error: describe(e) } : t));
      });
  }, [wallet]);

  // Between a change of wallet and the effect that resets for it, the state still belongs to the wallet before.
  const current = state.wallet === wallet ? state : null;
  const byTx = current?.byTx;
  const firstLoaded = current?.firstLoaded ?? false;
  const payments = useMemo(() => (firstLoaded && byTx ? newestFirst([...byTx.values()]) : null), [byTx, firstLoaded]);

  return { payments, complete: current?.cursor === null, loadMore, loadingMore: current?.loadingMore ?? false, error: current?.error ?? null };
}

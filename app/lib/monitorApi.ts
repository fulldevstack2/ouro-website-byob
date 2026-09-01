/**
 * Client for ouro-monitor (../ouro-monitor), the small indexer that watches INDEX and HOOD10 on
 * Robinhood Chain and serves JSON. The base URL is inlined at build time (`MONITOR_API_URL`);
 * without it the page renders its "monitor not configured" state — dashes, never made-up numbers.
 */
import { useEffect, useRef, useState } from "react";

export const MONITOR_API: string = (typeof __MONITOR_API__ === "string" && __MONITOR_API__) || (import.meta.env.DEV ? "http://localhost:8787" : "");

export type TokenKey = "index" | "hood10";
export type Liveness = "ok" | "late" | "stalled" | "unknown";

export interface AssetOut {
  address: string;
  symbol: string | null;
  decimals: number | null;
  amount: string;
  amountF: number;
  usd: number | null;
  recipients: number | null;
}
export interface EpochOut {
  epoch: number;
  status: string;
  startTs: number | null;
  endTs: number | null;
  startBlock: number | null;
  endBlock: number | null;
  paidUsd: number | null;
  costUsd: number | null;
  recipients: number | null;
  holders: number | null;
  eligibleTokens: number | null;
  txs: number;
  assets: AssetOut[];
  meta: Record<string, unknown>;
}
export interface TaxSum {
  swaps: number;
  volume_eth: number;
  tax_eth: number;
}
export interface PaidSum {
  epochs: number;
  paid_usd: number;
  cost_usd: number;
}
export interface MarketRow {
  ts: number;
  price_usd: number | null;
  fdv_usd: number | null;
  vol24_all_usd: number | null;
  vol24_taxed_usd: number | null;
  taxed_share: number | null;
  pools: number | null;
  reserve_taxed_usd: number | null;
}
export interface TokenSummary {
  key: TokenKey;
  symbol: string;
  name: string;
  address: string;
  hook: string;
  hookPoolId: string;
  taxBps: number;
  dividendLineTokens: number;
  cadenceSec: number;
  indexedTo: number | null;
  epochsIndexed: number;
  market: MarketRow | null;
  tax: { h24: TaxSum; d7: TaxSum; all: TaxSum; exact: boolean; ethPriceUsd: number | null };
  paid: { h24: PaidSum; d7: PaidSum; all: PaidSum };
  lastEpoch: EpochOut | null;
  liveness: { status: Liveness; dueTs: number | null; overdueSec: number | null; lastTs: number | null; cadenceSec: number; source: string };
  holders: { aboveLine: number | null; total: number | null; recipientsLast: number | null };
  eligibleTokens: number | null;
  yield: { perLineUsdPerDay: number | null; aprPct: number | null; basisDays: number; paidUsdPerDay: number | null };
  flows: Record<string, { amount: number; count: number }>;
}
export interface Summary {
  generatedAt: number;
  chain: { id: number; name: string; explorer: string };
  head: number;
  tokens: Record<TokenKey, TokenSummary>;
}
export interface DailyRow {
  day: number;
  epochs: number;
  paid_usd: number | null;
  cost_usd: number | null;
  recipients: number | null;
  swaps: number;
  volume_eth: number;
  tax_eth: number;
  tax_usd: number | null;
  price_usd: number | null;
  taxed_share: number | null;
}
export interface AdminEvent {
  id: string;
  ts: number;
  block: number;
  contract: string;
  kind: string;
  severity: "info" | "warn" | "alert";
  summary: string;
  tx: string;
}

export interface Poll<T> {
  data: T | null;
  error: string | null;
  /** Wall-clock ms of the last successful fetch. */
  updatedAt: number | null;
  loading: boolean;
}

/**
 * Poll a monitor endpoint. Starts empty so the pre-rendered HTML equals the first client render,
 * refreshes every `intervalMs` while the tab is visible, and keeps the last good payload on errors.
 */
export function useMonitor<T>(path: string | null, intervalMs = 30_000): Poll<T> {
  const [state, setState] = useState<Poll<T>>({ data: null, error: null, updatedAt: null, loading: Boolean(path) });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!path || !MONITOR_API) {
      setState({ data: null, error: MONITOR_API ? null : "not-configured", updatedAt: null, loading: false });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const run = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const r = await fetch(`${MONITOR_API}${path}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as T;
        if (alive.current) setState({ data, error: null, updatedAt: Date.now(), loading: false });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (alive.current) setState((s) => ({ ...s, error: (e as Error).message, loading: false }));
      }
      if (alive.current) timer = setTimeout(run, document.visibilityState === "visible" ? intervalMs : intervalMs * 4);
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
      alive.current = false;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, intervalMs]);
  return state;
}

// ── formatting ──
export function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (opts.compact && abs >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (abs >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs === 0) return "$0";
  return `$${n.toPrecision(3)}`;
}
export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
export function fmtEth(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}
export function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}
export function ago(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, sec);
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 172_800) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86_400).toFixed(1)} d`;
}
export function fmtWhen(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(5, 16) + " UTC";
}
export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

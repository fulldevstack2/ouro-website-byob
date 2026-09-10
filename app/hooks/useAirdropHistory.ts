import { useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, parseAbiItem, type Address, type Hex } from "viem";

import { AIRDROPS_FROM_BLOCK, BASKET_TOKENS } from "~/content/protocol";
import type { OuroCycle } from "~/lib/monitorApi";
import { logsTransport } from "~/lib/rpc";

/* ────────────────────────────────────────────────────────────────────────────
   A wallet's airdrop history, read from the chain.

   Every payout is one transaction from the airdrop wallet through the distributor, and inside it one
   ERC20 `Transfer(airdropWallet, recipient, amount)` per basket token per recipient: 380 wallets and
   two tokens make 760 logs in a typical cycle. ouro-monitor indexes those per cycle, not per wallet,
   and exposes nothing per address; the block explorer's API sits behind a browser challenge. But
   "every transfer from this sender to this recipient on these tokens" is exactly the question
   `eth_getLogs` with all three topics pinned answers, and the chain's own endpoint answers it over
   the whole history in about half a second (see site.chain.logRpcUrls). So the page asks the chain,
   and nothing about the reader is stored anywhere.

   The list grows with the history: a wallet paid every cycle collects 24 transfers a day. That is
   fine for a year or two of cycles; if it ever is not, the window to scan is the one knob to turn.
   ──────────────────────────────────────────────────────────────────────────── */

const client = createPublicClient({ transport: logsTransport() });
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** One `Transfer` from the airdrop wallet to the wallet being read. */
export interface AirdropReceipt {
  tx: Hex;
  block: bigint;
  logIndex: number;
  token: Address;
  amount: bigint;
}

export interface ReceiptsPoll {
  /** Null until the first read lands; an empty list is a wallet that has never been paid. */
  receipts: AirdropReceipt[] | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
}

const EMPTY: ReceiptsPoll = { receipts: null, error: null, loading: false, updatedAt: null };

/**
 * Every airdrop transfer `to` has received from `from` on `tokens`, refreshed every `intervalMs`
 * while the tab is visible. A failed refresh keeps the last good list and reports the error beside it.
 */
export function useAirdropReceipts(to: Address | null, from: Address, tokens: readonly Address[], intervalMs = 60_000): ReceiptsPoll {
  // The list is rebuilt on every render; its contents, not its identity, are what should restart the read.
  const tokenKey = tokens
    .map((t) => t.toLowerCase())
    .sort()
    .join(",");
  const [state, setState] = useState<ReceiptsPoll>(to ? { ...EMPTY, loading: true } : EMPTY);
  const shown = useRef<Address | null>(null);

  useEffect(() => {
    if (!to || tokens.length === 0) {
      shown.current = null;
      setState(EMPTY);
      return;
    }
    // A new wallet starts from nothing. A re-read of the same wallet (the token list grew, say) keeps
    // its rows on screen while the request runs, so the table does not blink.
    if (shown.current?.toLowerCase() !== to.toLowerCase()) {
      shown.current = to;
      setState({ ...EMPTY, loading: true });
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const logs = await client.getLogs({ address: [...tokens], event: TRANSFER, args: { from, to }, fromBlock: AIRDROPS_FROM_BLOCK, toBlock: "latest" });
        const receipts: AirdropReceipt[] = [];
        for (const l of logs) {
          if (l.args.value === undefined || l.blockNumber === null || l.transactionHash === null || l.logIndex === null) continue;
          receipts.push({ tx: l.transactionHash, block: l.blockNumber, logIndex: l.logIndex, token: l.address, amount: l.args.value });
        }
        if (alive) setState({ receipts, error: null, loading: false, updatedAt: Date.now() });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: describe(e), loading: false }));
      }
      if (alive) timer = setTimeout(run, document.visibilityState === "visible" ? intervalMs : intervalMs * 4);
    };
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `tokenKey` stands in for `tokens`, see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, from, tokenKey, intervalMs]);

  return state;
}

/** A chain error in one line: viem's messages run to a screenful, and the first line is the part that says what happened. */
function describe(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  const m = (err?.shortMessage ?? err?.message ?? "The chain did not answer.").split("\n")[0];
  return m.length > 160 ? `${m.slice(0, 157)}...` : m;
}

/* ── block times ──────────────────────────────────────────────────────────── */

/** Unix seconds by block number, kept for the session: a payout's block never changes. */
const blockTimes = new Map<string, number>();

/**
 * Timestamps for payments the monitor has not indexed yet, or never will if a payout bypassed the
 * distributor. A cycle's own `ts` covers everything else, so this is usually a handful of blocks or
 * none. Capped per run because the list grows with the history, and one wallet's page should not
 * turn into a block-by-block crawl of the chain.
 */
const BLOCK_TIME_CAP = 24;

export function useBlockTimes(blocks: readonly bigint[]): Record<string, number> {
  const key = blocks.map(String).sort().join(",");
  const [times, setTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    const wanted = [...new Set(blocks.map(String))];
    const publish = () => {
      if (!alive) return;
      const out: Record<string, number> = {};
      for (const b of wanted) {
        const t = blockTimes.get(b);
        if (t !== undefined) out[b] = t;
      }
      setTimes(out);
    };
    const missing = wanted.filter((b) => !blockTimes.has(b)).slice(0, BLOCK_TIME_CAP);
    if (missing.length === 0) {
      publish();
    } else {
      void Promise.all(
        missing.map((b) =>
          client
            .getBlock({ blockNumber: BigInt(b) })
            .then((blk) => blockTimes.set(b, Number(blk.timestamp)))
            .catch(() => undefined),
        ),
      ).then(publish);
    }
    return () => {
      alive = false;
    };
    // `key` stands in for `blocks`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return times;
}

/* ── what the receipts mean ───────────────────────────────────────────────── */

export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

/**
 * What the page knows about each token the airdrop pays in: the static list, plus anything a cycle
 * has actually paid (from the monitor's epoch data), so a new basket constituent shows up in a
 * wallet's history before anyone adds it to content/protocol.ts.
 */
export function tokenMetaFrom(cycles: readonly OuroCycle[]): Map<string, TokenMeta> {
  const meta = new Map<string, TokenMeta>();
  for (const t of BASKET_TOKENS) meta.set(t.address.toLowerCase(), { symbol: t.symbol, name: t.name, decimals: t.decimals, icon: t.icon });
  for (const c of cycles) {
    for (const a of c.assets) {
      const k = a.address.toLowerCase();
      if (!meta.has(k)) meta.set(k, { symbol: a.symbol ?? `${a.address.slice(0, 6)}…`, name: a.symbol ?? a.address, decimals: a.decimals ?? 18 });
    }
  }
  return meta;
}

export interface HistoryLeg {
  token: Address;
  symbol: string;
  amountF: number;
  /** At the price its cycle paid the token out at; null when the monitor could not price that leg. */
  usd: number | null;
}

/** One payment: one transaction, one leg per token it carried. */
export interface HistoryRow {
  tx: Hex;
  block: bigint;
  logIndex: number;
  /** From the payout the monitor indexed, else from the block itself, else unknown. */
  ts: number | null;
  /** The cycle number, when the monitor has indexed this transaction. */
  cycle: number | null;
  legs: HistoryLeg[];
  /** All-or-nothing, like a cycle's own value: null if any leg is unpriced. */
  usd: number | null;
}

export interface HistorySummary {
  payments: number;
  /** Distinct cycles among the payments the monitor has indexed. */
  cycles: number;
  /** Every payment valued when sent, or null if any one of them could not be. Zero for no payments. */
  usd: number | null;
  unpriced: number;
}

/** A token's dollar price at the moment of one payout: what the cycle valued the whole leg at, per token. */
function legPrices(assets: OuroCycle["assets"]): Map<string, number | null> {
  const price = new Map<string, number | null>();
  for (const a of assets) price.set(a.address.toLowerCase(), a.usd !== null && a.amountF > 0 ? a.usd / a.amountF : null);
  return price;
}

/**
 * Receipts into payments, newest first, each matched to the cycle that paid it and valued at what
 * that cycle paid the token out at. Payments the monitor has not indexed keep their amounts and get
 * their time from the block; their value is a dash rather than today's price, which is what the
 * "valued when sent" column promises.
 */
export function buildHistory(
  receipts: readonly AirdropReceipt[],
  cycles: readonly OuroCycle[],
  meta: Map<string, TokenMeta>,
  blockTimes: Record<string, number>,
): { rows: HistoryRow[]; summary: HistorySummary } {
  const payouts = new Map<string, { cycle: number; ts: number | null; price: Map<string, number | null> }>();
  for (const c of cycles) {
    for (const p of c.payouts ?? []) payouts.set(p.tx.toLowerCase(), { cycle: c.epoch, ts: p.ts, price: legPrices(p.assets) });
    // A monitor build older than per-payment records lists the cycle's transactions in `meta.txs`
    // with the cycle's own leg values, which then stand in for each payment's.
    const txs = (c.meta as { txs?: unknown }).txs;
    if (Array.isArray(txs)) {
      for (const tx of txs) {
        if (typeof tx !== "string" || payouts.has(tx.toLowerCase())) continue;
        payouts.set(tx.toLowerCase(), { cycle: c.epoch, ts: c.endTs ?? c.startTs, price: legPrices(c.assets) });
      }
    }
  }

  const byTx = new Map<string, AirdropReceipt[]>();
  for (const r of receipts) {
    const k = r.tx.toLowerCase();
    const list = byTx.get(k);
    if (list) list.push(r);
    else byTx.set(k, [r]);
  }

  const rows: HistoryRow[] = [];
  const seenCycles = new Set<number>();
  let unpriced = 0;
  let total = 0;
  for (const [k, list] of byTx) {
    list.sort((a, b) => a.logIndex - b.logIndex);
    const p = payouts.get(k);
    const legs: HistoryLeg[] = list.map((r) => {
      const m = meta.get(r.token.toLowerCase());
      const amountF = Number(formatUnits(r.amount, m?.decimals ?? 18));
      const px = p?.price.get(r.token.toLowerCase()) ?? null;
      return { token: r.token, symbol: m?.symbol ?? `${r.token.slice(0, 6)}…`, amountF, usd: px === null ? null : amountF * px };
    });
    const usd = legs.every((l) => l.usd !== null) ? legs.reduce((s, l) => s + (l.usd ?? 0), 0) : null;
    if (usd === null) unpriced += 1;
    else total += usd;
    if (p) seenCycles.add(p.cycle);
    const first = list[0];
    rows.push({ tx: first.tx, block: first.block, logIndex: first.logIndex, ts: p?.ts ?? blockTimes[String(first.block)] ?? null, cycle: p?.cycle ?? null, legs, usd });
  }
  rows.sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : a.block > b.block ? -1 : 1));

  return {
    rows,
    summary: { payments: rows.length, cycles: seenCycles.size, usd: rows.length === 0 ? 0 : unpriced === 0 ? total : null, unpriced },
  };
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { Address, Hex } from "viem";

import { Badge, Button, Card, LedgerTable, Stat, type BadgeTone, type LedgerColumn } from "~/components/ds";
import { AddressCell, ConnectBar, Grid, KVRow, Pager, TokenIcon, body14, hairline, mono } from "~/components/site";
import { BASKET_TOKENS } from "~/content/protocol";
import { externalLinkProps, site } from "~/content/site";
import { LIVE_VAULTS, TOKENS } from "~/content/vaults";
import { useCountdown, type Countdown } from "~/hooks/useCountdown";
import { fmtNum } from "~/lib/monitorApi";

/* ────────────────────────────────────────────────────────────────────────────
   The portfolio page's layout, with no wallet code in it.

   The same split as the vaults. `PortfolioStatic` (below) is what the prerender writes and what the
   first client frame shows: every figure a dash and the wallet button disabled, so a crawler and a
   shared link get the real page rather than a spinner. `PortfolioLive` (its own module, loaded on the
   client only) mounts the wallet tree, asks ouro-monitor for the wallet (hooks/usePortfolio.ts) and
   hands this file a filled-in `PortfolioView`. Keeping wagmi and RainbowKit out of here keeps them
   out of the server bundle.

   SHAPE. It follows theindex.finance's portfolio page, which readers of this chain already know: the
   connect bar, a band of metric cards, then the payment history beside a stack of smaller cards (the
   next payment, holdings, the vaults, the line). The page is always the connected wallet's. It can
   also show another wallet, `?address=0x…`, but that is deliberately not offered anywhere on the
   page: no lookup field, no link to it. The only trace is `ViewingNote`, which says whose figures are
   on screen when they are not the connected wallet's, because a page headed "Your portfolio" must
   not print someone else's numbers without saying so.
   ──────────────────────────────────────────────────────────────────────────── */

export const OURO = TOKENS.find((t) => t.key === "ouro")!;
const DASH = "—";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** One of the four figures across the top. */
export interface MetricView {
  value: ReactNode;
  unit?: ReactNode;
  footnote?: ReactNode;
  badge?: { tone: BadgeTone; label: string };
  /** A sentence under the figure saying what it is. */
  note: ReactNode;
}

export interface HistoryRowView {
  key: string;
  when: ReactNode;
  cycle: ReactNode;
  tokens: ReactNode;
  value: ReactNode;
  tx: Hex | null;
}

export interface HoldingRowView {
  key: string;
  symbol: string;
  name: string;
  icon?: string;
  amount: ReactNode;
  value: ReactNode;
}

export interface VaultRowView {
  key: string;
  title: string;
  deposit: ReactNode;
  /** Payout vaults: what is waiting to be claimed, in bronze under the deposit. */
  collect?: ReactNode;
}

/** The card that counts down to the wallet's next payment. */
export interface NextView {
  /** Unix seconds of the estimated payment, counted down to on screen. Null when there is nothing to count to. */
  payAt: number | null;
  /** What stands in for the countdown when there is none; a dash if unset. */
  value?: ReactNode;
  footnote: ReactNode;
  badge?: { tone: BadgeTone; label: string };
  rows: { label: ReactNode; value: ReactNode }[];
  text: ReactNode;
}

/** Everything the layout prints, display-ready. The live module builds one; the prerender uses STATIC_VIEW. */
export interface PortfolioView {
  metrics: { balance: MetricView; share: MetricView; received: MetricView; rate: MetricView };
  history: {
    /** The payments fetched so far, newest first. Pages the reader has not turned to may not be here yet. */
    rows: HistoryRowView[];
    /** Every payment there is, fetched or not; the pager counts its pages from this. */
    total: number;
    /** Fetch the next older page. Absent once every payment is in `rows`. */
    loadMore?: () => void;
    loadingMore: boolean;
    /** Why the last fetch failed, if it did. */
    problem: string | null;
    /** Shown in place of the table while there are no rows: why there are none. */
    empty: ReactNode;
    /** Top right of the card: the count, or what the read is doing. */
    status: ReactNode;
  };
  next: NextView;
  holdings: { rows: HoldingRowView[]; total: ReactNode; note: ReactNode };
  vaults: { rows: VaultRowView[]; total: ReactNode };
  line: { tokens: ReactNode; text: ReactNode };
}

/** The bar's title. Same shape as the vaults' "Ouro Vaults": the app's name, fixed. */
export const BAR_TITLE = "Ouro Portfolio";

/** Under the bar's title when the wallet on screen is not the connected one. See the note at the top. */
export function ViewingNote({ address }: { address: Address }) {
  return (
    <span>
      Viewing <AddressCell address={address} />, the wallet named in the link.
    </span>
  );
}

/* ── the four figures ─────────────────────────────────────────────────────── */

function Metric({ n, label, m }: { n: string; label: string; m: MetricView }) {
  return (
    <Card label={`${n} · ${label}`}>
      <Stat value={m.value} unit={m.unit} footnote={m.footnote} />
      {m.badge && (
        <div style={{ marginTop: 12, minWidth: 0, maxWidth: "100%" }}>
          <Badge tone={m.badge.tone} dot style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.badge.label}
          </Badge>
        </div>
      )}
      <div style={{ ...body14, marginTop: 12 }}>{m.note}</div>
    </Card>
  );
}

export function MetricCards({ m }: { m: PortfolioView["metrics"] }) {
  return (
    <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md">
      <Metric n="01" label="Balance" m={m.balance} />
      <Metric n="02" label="Share of every cycle" m={m.share} />
      <Metric n="03" label="Airdrops received" m={m.received} />
      <Metric n="04" label="At the current rate" m={m.rate} />
    </Grid>
  );
}

/* ── the history ──────────────────────────────────────────────────────────── */

const HISTORY_COLS: LedgerColumn[] = [
  { key: "when", label: "Received", nowrap: true },
  // width keeps the caps header from being crushed into "Tokens" when the history card is the
  // narrow column of pf-body; LedgerTable still sizes from content when there is room.
  { key: "cycle", label: "Cycle", numeric: true, nowrap: true, width: 72 },
  { key: "tokens", label: "Tokens" },
  { key: "value", label: "Value when sent", align: "right", numeric: true, nowrap: true, width: 130 },
  { key: "tx", label: "Tx", align: "right", nowrap: true, width: 110 },
];

/** Rows per page: one day of payouts at the two-hourly cadence, the same as the airdrops page. */
export const HISTORY_PAGE_SIZE = 12;

function TxLink({ tx }: { tx: Hex | null }) {
  if (!tx) return <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{DASH}</span>;
  const href = `${site.links.explorer}/tx/${tx}`;
  // Shorter than the shared shortHash: the history card shares the row with the side stack, and the
  // full 10+6 form was what pushed the Tx header past the card edge by a few pixels.
  const label = `${tx.slice(0, 8)}…${tx.slice(-4)}`;
  return (
    <a href={href} {...externalLinkProps(href)} style={{ color: "var(--text-secondary)" }}>
      <span style={{ ...mono, fontSize: 12 }}>{label}</span>
    </a>
  );
}

/**
 * Every payment to the wallet, newest first, paged like the airdrops table.
 *
 * The monitor serves the history a page at a time, so unlike the airdrops table this one does not
 * hold every row from the start: it asks for the next older page one page before the reader reaches
 * it, and the pager counts pages from the total the summary reports. Turning a page also brings the
 * table back into view if its top has scrolled off, since the buttons sit under twelve rows and the
 * new rows would otherwise start a screen above the cursor.
 */
export function HistoryCard({ h }: { h: PortfolioView["history"] }) {
  const [page, setPage] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(h.total / HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * HISTORY_PAGE_SIZE;
  const visible = h.rows.slice(start, start + HISTORY_PAGE_SIZE);
  /** Rows this page should have that are not here yet. */
  const pending = Math.max(0, Math.min(HISTORY_PAGE_SIZE, h.total - start) - visible.length);

  // One page ahead of the reader, so OLDER lands on rows that are already here. `safePage` is a
  // dependency so a fetch that failed is tried again on the next turn of the page.
  const { loadMore } = h;
  const needMore = loadMore !== undefined && h.rows.length < Math.min(h.total, start + 2 * HISTORY_PAGE_SIZE);
  useEffect(() => {
    if (needMore) loadMore?.();
  }, [needMore, safePage, loadMore]);

  const goTo = useCallback((n: number) => {
    setPage(n);
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top >= 0) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  return (
    <div ref={ref} style={{ scrollMarginTop: 84, minWidth: 0 }}>
      <Card label="Airdrop history" action={<span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{h.status}</span>}>
        {h.rows.length > 0 ? (
          <>
            {visible.length > 0 && (
              <div className="table-scroll">
                <LedgerTable
                  compact
                  columns={HISTORY_COLS}
                  rows={visible.map((r) => ({
                    when: <span style={{ fontSize: 13 }}>{r.when}</span>,
                    cycle: <span style={{ ...mono, fontSize: 13 }}>{r.cycle}</span>,
                    tokens: <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.tokens}</span>,
                    value: <span style={{ ...mono, fontSize: 13 }}>{r.value}</span>,
                    tx: <TxLink tx={r.tx} />,
                  }))}
                />
              </div>
            )}
            {pending > 0 && (
              <div style={{ ...body14, fontStyle: "italic", padding: "10px 0 4px" }}>
                {h.problem && !h.loadingMore
                  ? `${fmtNum(pending)} older ${plural(pending, "payment", "payments")} could not be read: ${h.problem}. Turn the page to try again.`
                  : `Reading ${fmtNum(pending)} older ${plural(pending, "payment", "payments")}…`}
              </div>
            )}
            <Pager page={safePage} pageCount={pageCount} total={h.total} pageSize={HISTORY_PAGE_SIZE} noun="payments" label="Airdrop history pages" onPage={goTo} />
          </>
        ) : (
          <div style={{ ...body14, fontStyle: "italic", padding: "6px 0 10px" }}>{h.empty}</div>
        )}
        <div style={{ borderTop: hairline, marginTop: 14, paddingTop: 14, fontSize: 13, color: "var(--text-muted)" }}>
          Every payout the airdrop has sent this address, newest first, from ouro-monitor&apos;s index of the chain. Each payment is valued at what its cycle
          paid the token out at, not at today&apos;s price.
        </div>
      </Card>
    </div>
  );
}

/* ── the side stack ───────────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "1:42:10", or "42:10" under an hour: the shape the vaults page counts down in. Hours run past 24 rather than turning into days. */
function fmtCountdown(c: Countdown): string {
  const hours = c.d * 24 + c.h;
  return hours > 0 ? `${hours}:${pad2(c.m)}:${pad2(c.s)}` : `${pad2(c.m)}:${pad2(c.s)}`;
}

/** The seconds to the estimated payment, ticking. Its own component so the second hand re-renders this figure and nothing else. */
function CountdownValue({ payAt }: { payAt: number }) {
  const target = useMemo(() => new Date(payAt * 1000), [payAt]);
  const c = useCountdown(target);
  return <>{c === null ? DASH : c.passed ? "due now" : fmtCountdown(c)}</>;
}

/**
 * When this wallet is next paid, as the monitor estimates it. Per wallet, not the keeper's slot: a
 * wallet just over the line is credited every cycle but paid only once what it is owed covers the gas
 * to send it, so its estimate can sit several cycles out. No clock runs when there is nothing to count
 * down to.
 */
export function NextPaymentCard({ n }: { n: NextView }) {
  return (
    <Card label="Next payment · estimate">
      <Stat value={n.payAt === null ? (n.value ?? DASH) : <CountdownValue payAt={n.payAt} />} footnote={n.footnote} />
      {n.badge && (
        <div style={{ marginTop: 12 }}>
          <Badge tone={n.badge.tone} dot>
            {n.badge.label}
          </Badge>
        </div>
      )}
      {n.rows.length > 0 && (
        <div style={{ marginTop: 14, borderTop: hairline }}>
          {n.rows.map((r, i) => (
            <KVRow key={i} label={r.label} value={r.value} border={i === n.rows.length - 1 ? "none" : "bottom"} />
          ))}
        </div>
      )}
      <div style={{ fontSize: 13, color: "var(--text-muted)", borderTop: hairline, paddingTop: 14, marginTop: n.rows.length > 0 ? 0 : 14 }}>{n.text}</div>
    </Card>
  );
}

export function HoldingsCard({ h }: { h: PortfolioView["holdings"] }) {
  return (
    <Card label="What it holds now">
      <div>
        {h.rows.map((r) => (
          <div className="pf-token-row" key={r.key}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <TokenIcon symbol={r.symbol} src={r.icon} size={28} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{r.symbol}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </span>
              </span>
            </span>
            <span style={{ textAlign: "right", flex: "none" }}>
              <span style={{ display: "block", ...mono, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{r.amount}</span>
              <span style={{ display: "block", ...mono, fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{r.value}</span>
            </span>
          </div>
        ))}
      </div>
      <KVRow label="Worth now, at today's prices" value={h.total} border="top" py={12} />
      <div style={{ fontSize: 13, color: "var(--text-muted)", borderTop: hairline, paddingTop: 14 }}>{h.note}</div>
    </Card>
  );
}

export function VaultsCard({ v }: { v: PortfolioView["vaults"] }) {
  return (
    <Card label="In the vaults">
      <div style={{ borderTop: hairline }}>
        {v.rows.map((r) => (
          <KVRow
            key={r.key}
            label={r.title}
            value={
              <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2, textAlign: "right" }}>
                <span>{r.deposit}</span>
                {r.collect && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--bronze-700)" }}>{r.collect}</span>}
              </span>
            }
          />
        ))}
      </div>
      <KVRow label="Total at today's prices" value={v.total} border="none" py={12} />
      <div style={{ fontSize: 13, color: "var(--text-muted)", borderTop: hairline, paddingTop: 14 }}>
        Deposits are priced through each vault&apos;s own totals, the way the vaults page prices them. Deposit, withdraw and collect on the{" "}
        <Link to="/vaults/">vaults page</Link>.
      </div>
    </Card>
  );
}

export function LineCard({ l }: { l: PortfolioView["line"] }) {
  return (
    <Card label="The line" tone="tint">
      <Stat value={l.tokens} unit={OURO.symbol} />
      <div style={{ ...body14, marginTop: 12 }}>{l.text}</div>
      <div className="cta-row" style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <Button size="sm" arrow href={site.links.buy} target="_blank" rel="noreferrer">
          Buy {site.ticker}
        </Button>
        <Button size="sm" variant="secondary" to="/vaults/">
          Pool with others
        </Button>
      </div>
    </Card>
  );
}

/* ── the whole thing ──────────────────────────────────────────────────────── */

/**
 * The figures and the tables, under the connect bar. `historyKey` remounts the history card, and so
 * resets its page, when the wallet on screen changes.
 */
export function PortfolioBody({ view, historyKey }: { view: PortfolioView; historyKey?: string }) {
  return (
    <>
      <MetricCards m={view.metrics} />
      <div className="pf-body">
        <HistoryCard key={historyKey} h={view.history} />
        <div className="pf-side">
          <NextPaymentCard n={view.next} />
          <HoldingsCard h={view.holdings} />
          <VaultsCard v={view.vaults} />
          <LineCard l={view.line} />
        </div>
      </div>
    </>
  );
}

const LINE = fmtNum(OURO.thresholdTokens);

/** What the prerender prints: the real page with every figure pending. The live module reuses its copy where a figure is still pending. */
export const STATIC_VIEW: PortfolioView = {
  metrics: {
    balance: {
      value: DASH,
      unit: OURO.symbol,
      footnote: "Connect a wallet to read it",
      note: "Read from the OURO token on Robinhood Chain for the connected wallet, through ouro-monitor, and refreshed every thirty seconds.",
    },
    share: {
      value: DASH,
      footnote: "of the $OURO above the line",
      note: `Airdrops need ${LINE} $OURO in one wallet. Above that, each cycle is split pro-rata across everyone who clears it.`,
    },
    received: {
      value: DASH,
      footnote: "Payments, valued when they were sent",
      note: "Basket tokens the airdrop has sent this wallet, valued at what each cycle paid them out at, not today's price.",
    },
    rate: {
      value: DASH,
      footnote: "At the average of recent cycles",
      note: "What recent payouts would pay a holding this size. It moves with volume and is not a forecast.",
    },
  },
  history: {
    rows: [],
    total: 0,
    loadingMore: false,
    problem: null,
    empty: "Connect a wallet. Every airdrop it has received appears here with the transaction that paid it.",
    status: "",
  },
  next: {
    payAt: null,
    footnote: "Connect a wallet to see when it is next paid",
    rows: [],
    text: "Wallets above the line are credited every cycle and paid once what they are owed covers about five times the gas to send it. Nothing owed is cancelled; a smaller holding simply waits a few cycles between payments.",
  },
  holdings: {
    rows: [OURO, ...BASKET_TOKENS].map((t) => ({ key: t.address, symbol: t.symbol, name: t.name, icon: t.icon, amount: DASH, value: DASH })),
    total: DASH,
    note: "Balances read from the tokens themselves. Airdropped tokens land in the wallet and stay yours to hold, sell or move.",
  },
  vaults: {
    rows: LIVE_VAULTS.map((v) => ({ key: v.entry.address, title: `Deposit ${v.token.symbol} · Earn ${v.payoutSymbol}`, deposit: DASH })),
    total: DASH,
  },
  line: {
    tokens: LINE,
    text: `Wallets holding ${LINE} $OURO or more are paid every cycle. Below it the token is still yours to hold and trade, and the vaults pool smaller holdings so they clear the line together.`,
  },
};

/** The prerendered section: same layout, figures pending, wallet button disabled. */
export function PortfolioStatic() {
  return (
    <>
      <ConnectBar title={BAR_TITLE} right={<Button disabled>Connect wallet</Button>} />
      <PortfolioBody view={STATIC_VIEW} />
    </>
  );
}

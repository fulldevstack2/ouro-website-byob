import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/airdrops";
import { Badge, Callout, Card, Input, LedgerTable, Stat, Tabs, type BadgeTone, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, Grid, KVRow, MicroLabel, PageHeader, PayoutCadence, SectionHead, body14, hairline, mono } from "~/components/site";
import { Bars } from "~/components/site/Bars";
import { COLLECTION_SPLIT_USD, COLLECT_THRESHOLD_USD } from "~/content/protocol";
import { externalLinkProps, site } from "~/content/site";
import { useClock } from "~/hooks/useClock";
import { pageMeta } from "~/lib/meta";
import {
  MONITOR_API,
  ago,
  fmtEth,
  fmtNum,
  fmtTokens,
  fmtUsd,
  fmtPct,
  fmtWhen,
  shortHash,
  useMonitor,
  type DailyRow,
  type OuroAsset,
  type OuroCycle,
  type OuroHolders,
  type OuroPayout,
  type OuroPending,
  type OuroQueueDay,
  type OuroYield,
  type Reserve,
} from "~/lib/monitorApi";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `The airdrops · every $OURO payout, read from the chain`,
    description:
      "Every airdrop Ouro has sent: what each cycle paid, to how many wallets, in which tokens, and what is queued to go out next. Read from Robinhood Chain. Check any address against the line.",
    path: location.pathname,
    image: "/og/airdrops.png",
  });
}

type PageStatus = "loading" | "live" | "stale" | "offline" | "unconfigured";

const STATUS_BADGE: Record<PageStatus, { tone: BadgeTone; label: string }> = {
  loading: { tone: "neutral", label: "Connecting" },
  live: { tone: "positive", label: "Live" },
  stale: { tone: "caution", label: "Stale" },
  offline: { tone: "negative", label: "Monitor offline" },
  unconfigured: { tone: "neutral", label: "Monitor not configured" },
};

const CYCLE_COLS: LedgerColumn[] = [
  { key: "n", label: "Cycle", numeric: true, nowrap: true },
  { key: "when", label: "Paid", nowrap: true },
  { key: "value", label: "Value", align: "right", numeric: true, nowrap: true },
  { key: "recipients", label: "Wallets", align: "right", numeric: true, nowrap: true },
  { key: "assets", label: "In" },
  { key: "tx", label: "Tx", align: "right", nowrap: true },
];

const THRESHOLD = `$${COLLECT_THRESHOLD_USD.toLocaleString("en-US")}`;
const TO_HOLDERS = `$${COLLECTION_SPLIT_USD.holders.toLocaleString("en-US")}`;
const TO_RESERVE = `$${COLLECTION_SPLIT_USD.reserve.toLocaleString("en-US")}`;

/**
 * The transactions that paid a cycle, in the order they landed.
 *
 * `meta.txs` is a list because one cycle number can be paid by more than one transaction: a large
 * allocation is split into batches, and a cycle number the keeper never retires gets paid again on a
 * later run — cycles 7, 8 and 32 each went out in two or three transactions, hours apart. Every one
 * of them is the cycle's evidence, so every one is linked rather than counted.
 */
function cycleTxs(c: OuroCycle): string[] {
  const m = c.meta as { txs?: unknown };
  return Array.isArray(m.txs) ? m.txs.filter((t): t is string => typeof t === "string") : [];
}

function TxLink({ explorer, tx }: { explorer: string | null; tx: string | undefined }) {
  if (!tx) return <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>—</span>;
  const text = <span style={{ ...mono, fontSize: 12 }}>{shortHash(tx)}</span>;
  if (!explorer) return text;
  const href = `${explorer}/tx/${tx}`;
  return (
    <a href={href} {...externalLinkProps(href)} style={{ color: "var(--text-secondary)" }}>
      {text}
    </a>
  );
}

/**
 * One row of the history table: one AIRDROP, which is one payout transaction.
 *
 * The table was a row per cycle NUMBER, which is the same thing only while a cycle is paid in one
 * transaction. It is not always: the keeper re-uses a cycle number when a run broadcasts and then
 * fails to commit its ledger, so cycle 32 was paid four times across eight hours. Merged into one
 * row that read `09-06 22:00 → 09-07 08:00 UTC` against four hashes, with a single value and a
 * single wallet count for four different payments — four airdrops described as one. Each payment has
 * its own clock, its own value and its own wallet set, so each gets its own row.
 */
interface PayoutRow {
  key: string;
  cycle: number;
  status: string;
  /** Position within the cycle, oldest = 1. Both 1 when the cycle was paid once. */
  nth: number;
  of: number;
  ts: number | null;
  /** Only set on the fallback path below, where the row is a whole cycle rather than one payment. */
  endTs: number | null;
  /**
   * How many payments this row covers when it could NOT be split — 0 on a real per-payment row.
   *
   * Without it the fallback row is indistinguishable from a single airdrop while the table claims to
   * list one row per payout, so the page contradicts itself: cycle 32's row showed one time, one
   * value and one wallet count for four payments and nothing said so.
   */
  merged: number;
  paidUsd: number | null;
  recipients: number | null;
  assets: OuroAsset[];
  txs: string[];
}

/**
 * Flatten cycles into payments, newest first.
 *
 * FALLS BACK to one row per cycle when `payouts` is absent — a monitor build older than the field,
 * or a cycle indexed before the backfill reached it. That row then brackets the cycle's window and
 * links every hash it knows, which is honest about being an aggregate rather than pretending to be
 * a single payment.
 */
function payoutRows(cycles: OuroCycle[]): PayoutRow[] {
  const out: PayoutRow[] = [];
  for (const c of cycles) {
    const payouts = c.payouts ?? [];
    if (payouts.length === 0) {
      out.push({
        key: `cycle-${c.epoch}`,
        cycle: c.epoch,
        status: c.status,
        nth: 1,
        of: 1,
        ts: c.startTs ?? c.endTs,
        endTs: c.endTs ?? c.startTs,
        merged: Math.max(cycleTxs(c).length, c.txs ?? 0),
        paidUsd: c.paidUsd,
        recipients: c.recipients,
        assets: c.assets,
        txs: cycleTxs(c),
      });
      continue;
    }
    // The API returns them oldest first; the table reads newest first.
    for (let i = payouts.length - 1; i >= 0; i--) {
      const p = payouts[i] as OuroPayout;
      out.push({
        key: p.tx,
        cycle: c.epoch,
        status: c.status,
        nth: i + 1,
        of: payouts.length,
        ts: p.ts,
        endTs: null,
        merged: 0,
        paidUsd: p.paidUsd,
        recipients: p.recipients,
        assets: p.assets,
        txs: [p.tx],
      });
    }
  }
  return out;
}

/**
 * When a row paid.
 *
 * A payment has one timestamp. A fallback row is a whole cycle, and if that cycle spanned more than
 * one transaction its window is printed as a bracket rather than as either end alone — the bug this
 * replaced showed the LAST payment's clock beside the FIRST payment's hash.
 */
function RowWhen({ r }: { r: PayoutRow }) {
  const spans = r.endTs !== null && r.ts !== null && r.endTs !== r.ts;
  return (
    <span style={{ fontSize: 13 }}>
      {spans ? (
        <>
          {fmtWhen(r.ts).replace(/ UTC$/, "")} <span style={{ color: "var(--text-faint)" }}>→</span> {fmtWhen(r.endTs)}
        </>
      ) : (
        fmtWhen(r.ts)
      )}
      {r.status !== "closed" && <span style={{ marginLeft: 8, color: "var(--text-faint)", fontSize: 12 }}>{r.status}</span>}
    </span>
  );
}

/**
 * Every transaction that paid a cycle, each one linked.
 *
 * The extras used to be a bare `+2` — dead text, so the other payments in a multi-transaction cycle
 * were neither readable nor reachable, and the single hash on offer was not the one the timestamp
 * beside it referred to. One line per payment, oldest first, so the count and the evidence are the
 * same thing.
 */
function CycleTxs({ explorer, txs }: { explorer: string | null; txs: string[] }) {
  if (txs.length <= 1) return <TxLink explorer={explorer} tx={txs[0]} />;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {txs.map((t) => (
        <TxLink key={t} explorer={explorer} tx={t} />
      ))}
    </span>
  );
}

function Method({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: hairline }}>
      <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: "var(--bronze-600)", width: 26, flex: "none" }}>{n}</span>
      <div style={body14}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{title}. </span>
        {children}
      </div>
    </div>
  );
}

/**
 * Paste an address and find out where it stands.
 *
 * The whole holder list is already on the page, so this is a local lookup rather than a request —
 * and deliberately says "not in the indexed set" rather than "not eligible" for an address it has
 * never seen, because those are different answers and only one of them is a fact about the wallet.
 *
 * IT ANSWERS ELIGIBILITY, NOT PAYMENT HISTORY. The holders endpoint reports balance, the line and
 * the exclusion policy; which wallets a given cycle actually paid lives in the indexer's `pushes`
 * table and is not exposed per address. So this says whether a wallet is paid *every* cycle, and
 * says nothing about any particular one. The copy said "whether the last cycle paid it", which it
 * cannot know — a lookup that overstates what it checked is worse than one that checks less.
 */
function AddressCheck({ holders, decimals, lineTokens, y }: { holders: OuroHolders | null; decimals: number; lineTokens: number; y: OuroYield | null }) {
  const [raw, setRaw] = useState("");
  const query = raw.trim().toLowerCase();
  const looksLikeAddress = /^0x[0-9a-f]{40}$/.test(query);
  const hit = useMemo(() => (holders && looksLikeAddress ? holders.holders.find((h) => h.address.toLowerCase() === query) : undefined), [holders, looksLikeAddress, query]);

  return (
    <Card label="Check a wallet">
      <Input value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="0x…" aria-label="Wallet address" style={{ ...mono, fontSize: 13 }} />
      <div style={{ marginTop: 14, minHeight: 96 }}>
        {query === "" && (
          <div style={{ ...body14, fontStyle: "italic" }}>
            Paste an address to see its balance and whether it clears the {fmtNum(lineTokens)} $OURO line, which is what decides whether every cycle pays it.
          </div>
        )}
        {query !== "" && !looksLikeAddress && <div style={{ ...body14, color: "var(--text-negative)" }}>That is not a 20-byte address.</div>}
        {looksLikeAddress && !holders && <div style={{ ...body14, fontStyle: "italic" }}>Reading the holder list…</div>}
        {looksLikeAddress && holders && !hit && (
          <div style={body14}>
            Not in the indexed holder set as of block {fmtNum(holders.snapshotBlock)}. That means it holds no $OURO, or its balance has never moved — it does not
            mean it is excluded.
          </div>
        )}
        {looksLikeAddress && holders && hit && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Badge tone={hit.excluded ? "negative" : hit.eligible ? "positive" : "caution"} dot>
                {hit.excluded ? "Excluded" : hit.eligible ? "Above the line · paid every cycle" : "Below the line"}
              </Badge>
            </div>
            <div style={{ borderTop: hairline }}>
              <KVRow label="Balance" value={`${fmtTokens(Number(hit.balance) / 10 ** decimals)} $OURO`} />
              <KVRow label="The line" value={`${fmtNum(lineTokens)} $OURO`} />
              <KVRow label="Read as of" value={`block ${fmtNum(holders.snapshotBlock)}`} border="none" />
            </div>
            {hit.excluded && <div style={{ ...body14, marginTop: 12 }}>Excluded because: {hit.excluded}</div>}
            {hit.eligible && !hit.excluded && (
              <>
                {(() => {
                  // Its share of the supply a cycle is divided among, and what the measured rate
                  // implies for a holding that size. Both fall back to a dash rather than a guess.
                  const bal = Number(hit.balance) / 10 ** decimals;
                  const share = y?.eligibleTokens ? bal / y.eligibleTokens : null;
                  const perDay = share === null || y?.paidUsdPerDay == null ? null : share * y.paidUsdPerDay;
                  return (
                    <div style={{ marginTop: 12, borderTop: hairline }}>
                      <KVRow label="Share of every cycle" value={share === null ? "—" : fmtPct(share, 4)} />
                      <KVRow
                        label={`At the last ${y?.basisDays ? fmtNum(y.basisDays, 1) : "—"} days' rate`}
                        value={perDay === null ? "—" : `${fmtUsd(perDay)} / day · ${fmtUsd(perDay * 30)} / month`}
                        border="none"
                      />
                    </div>
                  );
                })()}
                <div style={{ ...body14, marginTop: 12 }}>
                  A wallet above the line is included in every cycle. If a small balance is owed less than the gas to send it, that cycle holds it and a later
                  one pays it — the total is the same. The figures above are what recent payouts would pay a holding this size, not a forecast: they move with
                  volume, and this check does not report on any individual cycle.
                </div>
              </>
            )}
            {!hit.eligible && !hit.excluded && (
              <div style={{ ...body14, marginTop: 12 }}>
                It needs {fmtTokens(lineTokens - Number(hit.balance) / 10 ** decimals)} more $OURO to clear the line.
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * The two day-by-day series the big chart switches between.
 *
 * They are deliberately the same size and in the same slot rather than one of them tucked into a
 * card: the wallet-balance chart started life inside the narrow middle card below and was too small
 * to read a sawtooth in, which is the only thing that chart is for.
 */
type SeriesId = "paid" | "wallet";

const SERIES: { id: SeriesId; label: string; title: string; note: string; ariaLabel: string }[] = [
  {
    id: "paid",
    label: "Paid to holders",
    title: "Paid to holders, by day",
    note: "What each day's cycles actually sent, valued when they were sent.",
    ariaLabel: "US dollars airdropped to holders, by day",
  },
  {
    id: "wallet",
    label: "Airdrop wallet",
    title: "The airdrop wallet, by day",
    note: "Closing balance each day, at that day's price. It fills when a collection lands and drains as each cycle pays, so a flat or falling line is the wallet doing its job — not a stall.",
    ariaLabel: "Balance of the airdrop wallet in US dollars, by day",
  },
];

export default function Airdrops() {
  const clock = useClock();
  const [series, setSeries] = useState<SeriesId>("paid");
  const cycles = useMonitor<{ token: string; epochs: OuroCycle[] }>(MONITOR_API ? "/v1/ouro/epochs?limit=50" : null, 60_000);
  const pending = useMonitor<OuroPending>(MONITOR_API ? "/v1/ouro/pending" : null, 60_000);
  const holders = useMonitor<OuroHolders>(MONITOR_API ? "/v1/ouro/holders?min=100000" : null, 120_000);
  const daily = useMonitor<{ token: string; days: DailyRow[] }>(MONITOR_API ? "/v1/ouro/daily?days=30" : null, 300_000);
  const queue = useMonitor<{ days: OuroQueueDay[] }>(MONITOR_API ? "/v1/ouro/queue?days=30" : null, 300_000);
  const yieldPoll = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve" : null, 120_000);

  const nowSec = cycles.data ? Math.floor(Date.now() / 1000) : 0;
  const status: PageStatus = !MONITOR_API
    ? "unconfigured"
    : cycles.data
      ? cycles.updatedAt !== null && Date.now() - cycles.updatedAt < 5 * 60_000 && !cycles.error
        ? "live"
        : "stale"
      : cycles.error
        ? "offline"
        : "loading";
  const sb = STATUS_BADGE[status];
  const explorer = site.links.explorer !== "#" ? site.links.explorer : null;

  const rows = cycles.data?.epochs ?? [];
  const closed = rows.filter((c) => c.status === "closed" || c.status === "aborted");
  const last = closed[0];
  // All-or-nothing, the same rule the API uses: one unvalued cycle and the total is unknown.
  const paidAllTime = closed.length === 0 ? 0 : closed.some((c) => c.paidUsd === null) ? null : closed.reduce((t, c) => t + (c.paidUsd ?? 0), 0);
  /**
   * One row per payout, newest first — see `payoutRows`.
   *
   * Derived from `rows` rather than fetched: the payments come nested inside each cycle, so this
   * costs one pass over what the page already has.
   */
  const payouts = useMemo(() => payoutRows(rows), [rows]);
  /**
   * Wallet-PAYMENTS, which is what the footnote beside it claims.
   *
   * A cycle's own `recipients` is the last leg's count, so summing cycles under-counts a cycle paid
   * more than once — cycle 32's four payments reached 130, 186, 320 and 362 wallets and the cycle
   * reported 362. Sum the payments where they are known, and fall back to the cycle where they are
   * not (an older monitor build).
   */
  const walletsPaid = closed.reduce((t, c) => t + (c.payouts?.length ? c.payouts.reduce((a, p) => a + (p.recipients ?? 0), 0) : (c.recipients ?? 0)), 0);

  const line = holders.data ? Number(holders.data.eligibilityLine) / 10 ** holders.data.decimals : 100_000;
  const decimals = holders.data?.decimals ?? 18;

  const paidByDay = useMemo(() => {
    const byDay = new Map<number, number | null>();
    for (const d of daily.data?.days ?? []) byDay.set(d.day, d.paid_usd);
    const today = Math.floor((nowSec || Date.now() / 1000) / 86_400) * 86_400;
    const out: { t: number; value: number | null }[] = [];
    for (let day = today - 29 * 86_400; day <= today; day += 86_400) out.push({ t: day, value: byDay.get(day) ?? null });
    return out;
  }, [daily.data, nowSec]);

  /**
   * The wallet's closing balance per day, padded to a fixed window so one day of history does not
   * draw a single bar across the whole chart. It is a sawtooth on purpose: the wallet fills in
   * batches when a collection lands and drains in slices as each cycle pays.
   */
  const queueByDay = useMemo(() => {
    const byDay = new Map<number, number | null>();
    for (const d of queue.data?.days ?? []) byDay.set(d.day, d.balanceUsd);
    const today = Math.floor((nowSec || Date.now() / 1000) / 86_400) * 86_400;
    const out: { t: number; value: number | null }[] = [];
    for (let day = today - 29 * 86_400; day <= today; day += 86_400) out.push({ t: day, value: byDay.get(day) ?? null });
    return out;
  }, [queue.data, nowSec]);
  /**
   * Today's row, by date rather than "the last one we have".
   *
   * `days.at(-1)` is the most recent day with any movement, which is not today as soon as a day
   * passes without a collection or a payout — labelling it "today" then states yesterday's flows as
   * today's. A quiet day should read as quiet.
   */
  const active = SERIES.find((x) => x.id === series) ?? SERIES[0]!;
  const y = yieldPoll.data;

  /**
   * Switch the chart *and* go to it.
   *
   * The tabs sit at the top of the page and the link that reaches for them is in a card several
   * hundred pixels below, so selecting a tab on its own changes something the reader cannot see —
   * which reads exactly like a dead button. Honour `prefers-reduced-motion`: the site does elsewhere
   * (see `HeroRing`), and an unrequested smooth scroll of most of a page is precisely what that
   * setting is for.
   */
  const chartRef = useRef<HTMLDivElement>(null);
  const showSeries = useCallback((id: SeriesId) => {
    setSeries(id);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    chartRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, []);

  const queueTodayRow = useMemo(() => {
    const today = Math.floor((nowSec || Date.now() / 1000) / 86_400) * 86_400;
    return queue.data?.days.find((d) => d.day === today) ?? null;
  }, [queue.data, nowSec]);

  const claimableEth = pending.data ? Number(pending.data.claimableWei) / 1e18 : null;
  const ethUsd = reserve.data?.positions[0]?.side1.symbol === "WETH" ? reserve.data.positions[0].side1.priceUsd : (reserve.data?.positions.flatMap((p) => [p.side0, p.side1]).find((s) => s.symbol === "WETH")?.priceUsd ?? null);
  const claimableUsd = claimableEth === null || ethUsd === null ? null : claimableEth * ethUsd;
  const uncollected = reserve.data?.totals.uncollectedFeesUsd ?? null;

  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Live proof"
        title="The airdrops."
        lede="Every payout Ouro has sent, read from the chain: what each cycle paid, to how many wallets, and in which tokens. Plus what is already collected and waiting to go out. None of it is reported by hand."
        ledeStyle={{ maxWidth: 680 }}
        aside={
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 4 }}>
            <Badge tone={sb.tone} dot>
              {sb.label}
            </Badge>
            <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>
              {clock}
              {pending.data?.block ? ` · block ${fmtNum(pending.data.block)}` : ""}
            </span>
          </div>
        }
      />

      {status === "unconfigured" && (
        <Callout tone="caution" title="Monitor not configured for this build" style={{ marginTop: 32 }}>
          Set <code style={mono}>MONITOR_API_URL</code> at build time to the Monitor's origin. Until then every figure below shows a dash.
        </Callout>
      )}
      {status === "offline" && (
        <Callout tone="caution" title="The monitor is not answering" style={{ marginTop: 32 }}>
          The page could not reach <code style={mono}>{MONITOR_API}</code> ({cycles.error}). Figures return as soon as it does.
        </Callout>
      )}
      {status === "stale" && (
        <Callout tone="caution" title="Showing the last good reading" style={{ marginTop: 32 }}>
          Last refreshed {cycles.updatedAt ? ago((Date.now() - cycles.updatedAt) / 1000) : "—"} ago.
        </Callout>
      )}

      <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ margin: "40px 0 48px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}>
        <Stat label="Paid to holders · all time" value={fmtUsd(paidAllTime, { compact: true })} footnote={`Across ${fmtNum(closed.length)} cycle${closed.length === 1 ? "" : "s"}, marked at the time of each`} />
        <Stat label="Cycles run" value={fmtNum(closed.length)} footnote={last ? `Last one ${fmtWhen(last.endTs)}` : "None yet"} />
        <Stat label="Wallets paid · last cycle" value={fmtNum(last?.recipients ?? null)} footnote={`${fmtNum(walletsPaid)} wallet-payments in total`} />
        <Stat
          label="Eligible right now"
          value={fmtNum(holders.data?.counts.eligible ?? null)}
          footnote={holders.data ? `of ${fmtNum(holders.data.counts.holders)} holders · ${fmtNum(holders.data.counts.belowLine)} below the line` : `≥ ${fmtNum(line)} $OURO`}
        />
      </Grid>

      <Grid cols="1fr 0.8fr" gap={48} align="start" style={{ marginBottom: 64 }}>
        <div ref={chartRef}>
          <Tabs items={SERIES.map((x) => ({ id: x.id, label: x.label }))} active={series} onChange={(id) => setSeries(id as SeriesId)} style={{ marginBottom: 16 }} />
          <MicroLabel style={{ marginBottom: 12 }}>{active.title}</MicroLabel>
          <Bars
            data={series === "paid" ? paidByDay : queueByDay}
            format={(v) => fmtUsd(v, { compact: true })}
            height={160}
            ariaLabel={active.ariaLabel}
          />
          <div style={{ ...body14, marginTop: 12 }}>
            {active.note}
            {series === "wallet" && queueTodayRow && (
              <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>
                {" "}
                {fmtUsd(queueTodayRow.inUsd)} in · {fmtUsd(queueTodayRow.outUsd)} out today.
              </span>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 460 }}>
          <PayoutCadence />
        </div>
      </Grid>

      <SectionHead
        kicker="On its way"
        title="What is already earned but not yet sent."
        titleStyle={{ fontSize: 30 }}
        sub="Three pools feed the airdrop, at three different stages. None of these is a scheduled amount: a cycle runs when it is worth running, and a collection is spread over roughly 48 hours."
        subStyle={{ fontSize: 15 }}
        style={{ marginBottom: 24 }}
      />
      <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md" style={{ marginBottom: 24 }}>
        <Card label="1 · Still in the hook">
          <Stat label="Tax claimable" value={claimableUsd === null ? "—" : fmtUsd(claimableUsd)} unit={claimableEth === null ? undefined : `${fmtEth(claimableEth)} ETH`} />
          <div style={{ ...body14, marginTop: 12 }}>
            Tax the pool has charged and nobody has pulled out yet. Only the pool creator can claim it, and letscash keeps 6% of the gross when they do.
          </div>
        </Card>
        <Card label="2 · Collected, waiting to stream">
          <Stat label="Queued in the airdrop wallet" value={fmtUsd(pending.data?.queuedUsd ?? null)} />
          {pending.data && pending.data.queued.some((q) => q.amountF > 0) && (
            <div style={{ ...mono, fontSize: 13, marginTop: 14, color: "var(--text-primary)" }}>
              {pending.data.queued
                .filter((q) => q.amountF > 0)
                .map((q) => `${fmtTokens(q.amountF)} ${q.symbol ?? "?"}`)
                .join(" + ")}
            </div>
          )}
          <div style={{ ...body14, marginTop: 10 }}>
            It fills when a collection lands and drains as each cycle pays, so this is the pool the next several cycles are drawn from, not the next payout.{" "}
            <button
              type="button"
              onClick={() => showSeries("wallet")}
              style={{ appearance: "none", background: "none", border: "none", padding: 0, font: "inherit", color: "var(--text-accent)", cursor: "pointer", textDecoration: "underline" }}
            >
              See it day by day ↑
            </button>
          </div>
        </Card>
        <Card label="3 · Still in the pools">
          <Stat label="LP fees accrued" value={fmtUsd(uncollected)} footnote={uncollected === null ? `Collected at ${THRESHOLD}` : `of ${THRESHOLD} before a collection`} />
          <div style={{ ...body14, marginTop: 12 }}>
            Fees the Reserve's positions have earned and not yet collected. At {THRESHOLD} a collection is taken: {TO_HOLDERS} to the airdrop wallet,{" "}
            {TO_RESERVE} compounded. <Link to="/ledger/">See the positions →</Link>
          </div>
        </Card>
      </Grid>
      {pending.data && (
        <div style={{ borderTop: hairline }}>
          <KVRow label="Wallet the airdrop pays out of" value={<AddressCell address={pending.data.treasury as `0x${string}`} />} />
          <KVRow label="Read as of" value={`block ${fmtNum(pending.data.block)} · ${ago(nowSec - pending.data.at)} ago`} border="none" />
        </div>
      )}

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Yield"
          title="What a holding earns."
          titleStyle={{ fontSize: 30 }}
          sub="From payouts actually made, not a forecast. Cycles are split pro-rata by balance, so a holding's share of a cycle is its share of the eligible supply."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 24 }}
        />
        <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ paddingBottom: 28, borderBottom: hairline }}>
          <Stat
            label={`${fmtNum(y?.lineTokens ?? 100_000)} $OURO costs`}
            value={fmtUsd(y?.lineCostWithTaxUsd ?? null)}
            footnote={
              y?.lineCostUsd == null
                ? "Needs a $OURO price"
                : `${fmtUsd(y.lineCostUsd)} at mid, plus the ${fmtPct(y.taxBps / 10_000, 0)} trade tax. Excludes slippage.`
            }
          />
          <Stat
            label={`Per ${fmtNum(y?.lineTokens ?? 100_000)} $OURO · per day`}
            value={fmtUsd(y?.perLineUsdPerDay ?? null)}
            footnote={y?.basisDays ? `At the rate of the last ${fmtNum(y.basisDays, 1)} days (${fmtNum(y.cycles)} cycle${y.cycles === 1 ? "" : "s"}, ${fmtUsd(y.paidUsd)} paid)` : "Needs a payout to measure"}
          />
          <Stat
            label={`Per ${fmtNum(y?.lineTokens ?? 100_000)} $OURO · per 30 days`}
            value={fmtUsd(y?.perLineUsdPerMonth ?? null)}
            footnote="The same rate over thirty days. Volume moves it in both directions."
          />
          <Stat
            label="Annualised"
            value={y?.aprPct == null ? "—" : `${fmtNum(y.aprPct, 0)}%`}
            footnote={
              y?.aprPct == null
                ? (y?.withheld ?? "Needs a payout and a price to measure")
                : `${y.annualisable ? "Over the last seven days" : `On ${fmtNum(y.historyDays, 1)} days of payouts — subject to change`}. Pays back the cost in ${y.paybackDays == null ? "—" : fmtNum(y.paybackDays, 0)} days at this rate`
            }
          />
        </Grid>

        <Callout tone={y && !y.annualisable ? "caution" : "note"} title="Read the annual rate with its basis" style={{ marginTop: 28 }}>
          {y?.caveat ?? "The rate is measured over the last seven days of payouts."} An annual figure is the one number here that says anything about the
          future, and it is only as old as the payouts behind it: {fmtNum(y?.cycles ?? 0)} cycles over{" "}
          {y?.historyDays ? fmtNum(y.historyDays, 1) : "—"} days, at launch volume. The same payouts annualise to roughly a fifth of this over a seven-day
          window, because the divisor picks the answer. Treat it as what recent trading paid, not as a rate anyone is promising — the daily figures beside it
          are the measurements, and every cycle behind them is listed below.
        </Callout>

        <Grid cols="1fr 1fr" gap={48} align="start" style={{ marginTop: 28 }}>
          <div style={{ borderTop: hairline }}>
            <KVRow label="Eligible supply — what a cycle is divided among" value={y?.eligibleTokens == null ? "—" : `${fmtNum(y.eligibleTokens)} $OURO`} />
            <KVRow label="Its value at spot" value={fmtUsd(y?.eligibleValueUsd ?? null)} />
            <KVRow label="$OURO price used" value={y?.priceUsd == null ? "—" : `$${y.priceUsd.toPrecision(3)}`} />
            <KVRow
              label={`Cost of ${fmtNum(y?.lineTokens ?? 100_000)} $OURO — at mid, then with the tax`}
              value={y?.lineCostUsd == null ? "—" : `${fmtUsd(y.lineCostUsd)} → ${fmtUsd(y.lineCostWithTaxUsd)}`}
            />
            <KVRow label="Payout history indexed" value={y?.historyDays == null ? "—" : `${fmtNum(y.historyDays, 1)} days`} border="none" />
          </div>
          <div style={body14}>
            The eligible supply excludes what is never paid: wallets below the {fmtNum(y?.lineTokens ?? 100_000)} line, the pool contract, and the team vest.
            Counting those would make every holder's share look smaller than it is.
            <br />
            <br />
            One inexactness in the other direction. The keeper pays the three largest holders 30% less than strict pro-rata and hands the freed amount to
            everyone else, so a typical wallet receives slightly <em>more</em> than the figures above. They are a floor for most holders rather than an exact
            number, and erring low is the direction we would rather err in.
            <br />
            <br />
            The cost is a floor too: the quantity at the mid price plus the trade tax a buy pays on top of it. It leaves out what the pool charges in slippage,
            which at this size is small next to the tax — a line is worth tens of dollars against a pool holding tens of thousands.
          </div>
        </Grid>
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="History"
          title="Every airdrop, and what it paid."
          titleStyle={{ fontSize: 30 }}
          sub="One row per payout, newest first. Value is what the assets were worth when they were sent, not today — an airdrop is worth what it was worth on the day."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 24 }}
        />
        {payouts.length > 0 ? (
          <div className="table-scroll">
            <LedgerTable
              columns={CYCLE_COLS}
              rows={payouts.map((r) => ({
                n: (
                  <span style={{ ...mono, fontSize: 13 }}>
                    #{r.cycle}
                    {r.of > 1 && (
                      <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                        {" "}
                        {r.nth}/{r.of}
                      </span>
                    )}
                    {r.merged > 1 && (
                      <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                        {" "}
                        {r.merged} payments
                      </span>
                    )}
                  </span>
                ),
                when: <RowWhen r={r} />,
                value: <span style={{ ...mono, fontSize: 13 }}>{fmtUsd(r.paidUsd)}</span>,
                recipients: <span style={{ ...mono, fontSize: 13 }}>{fmtNum(r.recipients)}</span>,
                assets: (
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {r.assets.map((a) => `${fmtTokens(a.amountF)} ${a.symbol ?? shortHash(a.address)}`).join(" + ") || "—"}
                  </span>
                ),
                tx: <CycleTxs explorer={explorer} txs={r.txs} />,
              }))}
            />
          </div>
        ) : (
          <Card label="Cycles">
            <div style={{ ...body14, fontStyle: "italic" }}>
              {status === "unconfigured"
                ? "The Monitor's origin is not set for this build."
                : status === "offline"
                  ? "The Monitor is not answering."
                  : cycles.data
                    ? "No cycles indexed yet. The first airdrop writes row one."
                    : "Reading the chain…"}
            </div>
          </Card>
        )}
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Eligibility"
          title="Who gets paid."
          titleStyle={{ fontSize: 30 }}
          sub="Hold the line in your own wallet and every cycle is sent to you. Nothing to stake, nothing to claim. The balances behind these counts are replayed from the token's own transfers, so this is the same set a payout would actually use."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 24 }}
        />
        <Grid cols="0.9fr 1.1fr" gap={32} align="start">
          <AddressCheck holders={holders.data} decimals={decimals} lineTokens={line} y={yieldPoll.data} />
          <div>
            <MicroLabel style={{ marginBottom: 12 }}>The holder set</MicroLabel>
            <div style={{ borderTop: hairline }}>
              <KVRow label="The line: balance needed to be paid" value={`${fmtNum(line)} $OURO`} />
              <KVRow label="Holders indexed" value={fmtNum(holders.data?.counts.holders ?? null)} />
              <KVRow label="Above the line, and paid" value={holders.data ? `${fmtNum(holders.data.counts.eligible)} · ${fmtNum(holders.data.counts.paid)} paid` : "—"} />
              <KVRow label="Below the line" value={fmtNum(holders.data?.counts.belowLine ?? null)} />
              <KVRow label="Excluded by policy" value={fmtNum(holders.data?.counts.excludedByPolicy ?? null)} />
              <KVRow
                label="Snapshot"
                value={holders.data ? `block ${fmtNum(holders.data.snapshotBlock)}${holders.data.secondsBehind === null ? "" : ` · ${ago(holders.data.secondsBehind)} behind`}` : "—"}
                border="none"
              />
            </div>
            {holders.data && holders.data.exclusionPolicy.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <MicroLabel style={{ marginBottom: 12 }}>Never paid, however large</MicroLabel>
                <div className="table-scroll">
                  <LedgerTable
                    compact
                    columns={[
                      { key: "a", label: "Address" },
                      { key: "r", label: "Why" },
                    ]}
                    rows={holders.data.exclusionPolicy.map((e) => ({
                      a: <AddressCell address={e.address as `0x${string}`} />,
                      r: <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{e.reason}</span>,
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </Grid>

      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Method"
          title="How this is measured."
          titleStyle={{ fontSize: 30 }}
          sub="Every figure is derived from Robinhood Chain by the Monitor, an open indexer we run. A missing price leaves a dash, never an estimate."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 24 }}
        />
        <Grid cols="1fr 1fr" gap={48} align="start">
          <div>
            <Method n="01" title="A cycle">
              One <code style={mono}>Airdropped</code> event per asset per cycle from the Airdropper, which pulls each leg out of the airdrop wallet. A cycle may
              be paid in several transactions; the row keeps the widest window and every leg.
            </Method>
            <Method n="02" title="What a cycle was worth">
              Each leg priced at the moment it was sent, not today. If any leg's price is unknown the whole cycle shows a dash rather than the value of the
              priced legs, which would read as a complete figure.
            </Method>
            <Method n="03" title="Eligibility">
              Balances are replayed from the token's own <code style={mono}>Transfer</code> events and compared to the line exactly, in raw units — a float
              comparison drops a wallet sitting precisely on it. Pool contracts, the treasury and vesting are excluded when the list is built.
            </Method>
          </div>
          <div>
            <Method n="04" title="What is on its way">
              Claimable tax is read from the hook. Queued value is the airdrop wallet's own balance of each payable asset. Uncollected fees come from the
              positions. None of the three is a promise about the next cycle.
            </Method>
            <Method n="05" title="Why the next payout has no countdown">
              A cycle runs when it is worth running: gas can spike, a thin cycle waits and arrives larger, and a wallet owed less than the gas to pay it waits
              for a later one. Counting down to something that may sensibly not happen would break its word. Nothing is forfeited by waiting.
            </Method>
            <Method n="06" title="Wallets, not accounts">
              Tokens on an exchange or in a bridge are in someone else's wallet. Only the address holding the balance is paid, which is why the check above
              answers for an address rather than for a person.
            </Method>
          </div>
        </Grid>
        <Callout style={{ marginTop: 32 }} title="Where the money comes from">
          Two legs fund every cycle: the tax on each trade, and the fees the protocol's own liquidity earns. The Ledger reports the second one — what the pools
          hold, what they have earned, and whether owning them beats simply holding the tokens. <Link to="/ledger/">Open the Ledger →</Link>
        </Callout>
      </div>
    </Container>
  );
}

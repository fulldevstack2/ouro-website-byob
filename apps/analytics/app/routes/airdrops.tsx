import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";

import type { Route } from "./+types/airdrops";
import { Badge, Button, Callout, Card, Input, LedgerTable, Stat, Tabs, type BadgeTone, type LedgerColumn } from "@ouro/ds";
import { OuroFoot } from "~/components/OuroFoot";
import { Bars, Container, KVRow, PageHeader, Pager, SectionHead, body14, mono } from "~/components/site";
import { COLLECT_THRESHOLD_USD, LINE_TOKENS, TOTAL_SUPPLY_TOKENS } from "~/content/protocol";
import { externalLinkProps, ouroUrl, site } from "~/content/site";
import { useClock } from "~/hooks/useClock";
import { pageMeta } from "~/lib/meta";
import {
  MONITOR_API,
  ago,
  fmtDay,
  fmtEth,
  fmtNum,
  fmtPct,
  fmtTokens,
  fmtUsd,
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
} from "@ouro/monitor-client";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `The airdrops · every $OURO payout, read from the chain`,
    description: "Every cycle the keeper has paid, and what is on its way. Who is above the line, and the rate with its basis.",
    path: location.pathname,
    image: "/og/airdrops.png",
  });
}

type PageStatus = "loading" | "live" | "stale" | "offline" | "unconfigured";

const STATUS_BADGE: Record<PageStatus, { tone: BadgeTone; label: string }> = {
  loading: { tone: "neutral", label: "Connecting" },
  live: { tone: "positive", label: "Every 2 hours" },
  stale: { tone: "caution", label: "Stale" },
  offline: { tone: "negative", label: "Monitor offline" },
  unconfigured: { tone: "neutral", label: "Monitor not configured" },
};

const CYCLE_COLS: LedgerColumn[] = [
  { key: "when", label: "Closed", nowrap: true },
  { key: "n", label: "Cycle", numeric: true, nowrap: true },
  { key: "assets", label: "In kind", nowrap: true },
  { key: "recipients", label: "Wallets", align: "right", numeric: true, nowrap: true },
  { key: "value", label: "Paid", align: "right", numeric: true, nowrap: true },
  { key: "tx", label: "Tx", align: "right", nowrap: true },
];

/** Rows per page: one day of payouts at the two-hourly cadence. */
const HISTORY_PAGE_SIZE = 12;
/** Cycles the table holds, newest first; the totals above it come from every day, not from these. */
const TABLE_CYCLES = 50;

const THRESHOLD = `$${COLLECT_THRESHOLD_USD.toLocaleString("en-US")}`;

/** The transactions that paid a cycle, in the order they landed. A cycle number can be paid more than once. */
function cycleTxs(c: OuroCycle): string[] {
  const m = c.meta as { txs?: unknown };
  return Array.isArray(m.txs) ? m.txs.filter((t): t is string => typeof t === "string") : [];
}

function TxLink({ explorer, tx }: { explorer: string | null; tx: string | undefined }) {
  if (!tx) return <span className="mono-link" style={{ color: "var(--text-faint)" }}>—</span>;
  const short = `${tx.slice(0, 6)}…${tx.slice(-4)}`;
  if (!explorer) return <span className="mono-link">{short}</span>;
  const href = `${explorer}/tx/${tx}`;
  return (
    <a href={href} {...externalLinkProps(href)} className="mono-link">
      {short} ↗
    </a>
  );
}

/**
 * One row of the history table: one AIRDROP, which is one payout transaction. A cycle number the
 * keeper re-used is several payments, hours apart, and each gets its own row with its own clock,
 * value and wallet count. Falls back to one row per cycle on a monitor build without `payouts`.
 */
interface PayoutRow {
  key: string;
  cycle: number;
  status: string;
  nth: number;
  of: number;
  ts: number | null;
  endTs: number | null;
  merged: number;
  paidUsd: number | null;
  recipients: number | null;
  assets: OuroAsset[];
  txs: string[];
}

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
    for (let i = payouts.length - 1; i >= 0; i--) {
      const p = payouts[i] as OuroPayout;
      out.push({ key: p.tx, cycle: c.epoch, status: c.status, nth: i + 1, of: payouts.length, ts: p.ts, endTs: null, merged: 0, paidUsd: p.paidUsd, recipients: p.recipients, assets: p.assets, txs: [p.tx] });
    }
  }
  return out;
}

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

/** Every day's payouts summed: paid all time, and how many cycles. Withheld if any paid day is unpriced. */
function allTime(days: DailyRow[] | undefined) {
  if (!days) return null;
  let paid = 0;
  let priced = true;
  let cycles = 0;
  for (const d of days) {
    if (d.epochs === 0) continue;
    cycles += d.epochs;
    if (d.paid_usd === null) priced = false;
    else paid += d.paid_usd;
  }
  return { paidUsd: priced ? paid : null, cycles };
}

/**
 * Paste an address and find out where it stands. A local lookup over the holder list the page already
 * has, run when the button is pressed. IT ANSWERS ELIGIBILITY, NOT PAYMENT HISTORY: which wallets a
 * given cycle paid is not exposed per address, so this says whether a wallet is paid every cycle and
 * nothing about any particular one. An address it has never seen is "not in the indexed set", not
 * "not eligible", because only one of those is a fact about the wallet.
 */
function AddressCheck({ holders, decimals, lineTokens }: { holders: OuroHolders | null; decimals: number; lineTokens: number }) {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const run = (e: FormEvent) => {
    e.preventDefault();
    setQuery(raw.trim().toLowerCase());
  };
  const result = useMemo(() => {
    if (query === null) return null;
    if (!/^0x[0-9a-f]{40}$/.test(query)) return { tone: "neutral" as BadgeTone, label: "Not an address", text: "Paste a 0x… wallet address." };
    if (!holders) return { tone: "neutral" as BadgeTone, label: "Reading", text: "The holder list has not arrived yet. Press Check again in a moment." };
    const hit = holders.holders.find((h) => h.address.toLowerCase() === query);
    if (!hit) return { tone: "neutral" as BadgeTone, label: "Not in the indexed set", text: `No $OURO at block ${fmtNum(holders.snapshotBlock)}, or a balance that has never moved. Not the same as excluded.` };
    const bal = Number(hit.balance) / 10 ** decimals;
    if (hit.excluded) return { tone: "negative" as BadgeTone, label: "Excluded", text: `${fmtTokens(bal)} OURO · not paid, by policy: ${hit.excluded}.` };
    if (hit.eligible) return { tone: "positive" as BadgeTone, label: "Above the line", text: `${fmtTokens(bal)} OURO · credited every cycle.` };
    return { tone: "caution" as BadgeTone, label: "Below the line", text: `${fmtTokens(bal)} OURO · not paid. ${fmtTokens(lineTokens - bal)} more clears the line, or pool in a vault.` };
  }, [query, holders, decimals, lineTokens]);

  return (
    <div>
      <form className="check" onSubmit={run}>
        <div className="check__field">
          <Input mono placeholder="0x…" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Wallet address" autoComplete="off" spellCheck={false} />
        </div>
        <Button type="submit">Check</Button>
      </form>
      {result && (
        <div className="check__result" aria-live="polite">
          <Badge tone={result.tone} dot>
            {result.label}
          </Badge>
          <span>{result.text}</span>
        </div>
      )}
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: "16px 0 0" }}>
        The check answers eligibility, not payment history. Exchange and bridge balances sit in someone else&apos;s wallet and are not paid. Pool contracts, the
        treasury and infrastructure are excluded.
      </p>
    </div>
  );
}

type SeriesId = "paid" | "wallet";

const SERIES: { id: SeriesId; label: string; note: string; ariaLabel: string }[] = [
  {
    id: "paid",
    label: "Paid to holders, by day",
    note: "Each bar is what that day's cycles paid, valued when sent.",
    ariaLabel: "US dollars airdropped to holders, by day",
  },
  {
    id: "wallet",
    label: "Airdrop wallet balance",
    note: "The wallet fills when a collection lands and drains as each cycle pays, so a sawtooth is the wallet working. Each bar is the day's closing balance.",
    ariaLabel: "Balance of the airdrop wallet in US dollars, by day",
  },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Airdrops() {
  const clock = useClock();
  const [series, setSeries] = useState<SeriesId>("paid");
  const cycles = useMonitor<{ token: string; epochs: OuroCycle[] }>(MONITOR_API ? `/v1/ouro/epochs?limit=${TABLE_CYCLES}` : null, 60_000);
  const daily = useMonitor<{ token: string; days: DailyRow[] }>(MONITOR_API ? "/v1/ouro/daily?days=366" : null, 300_000);
  const pending = useMonitor<OuroPending>(MONITOR_API ? "/v1/ouro/pending" : null, 60_000);
  const holders = useMonitor<OuroHolders>(MONITOR_API ? "/v1/ouro/holders?min=100000" : null, 120_000);
  const queue = useMonitor<{ days: OuroQueueDay[] }>(MONITOR_API ? "/v1/ouro/queue?days=30" : null, 300_000);
  const yieldPoll = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve?hours=1" : null, 120_000);

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

  // The keeper wakes on wall-clock multiples of two hours. Waking is not paying: see the docs.
  const nextSlot = clock ? `${pad2((Math.floor(Number(clock.slice(0, 2)) / 2) * 2 + 2) % 24)}:00 UTC` : "";

  const rows = cycles.data?.epochs ?? [];
  const closed = rows.filter((c) => c.status === "closed" || c.status === "aborted");
  const last = closed.find((c) => c.paidUsd !== null) ?? closed[0];
  const all = allTime(daily.data?.days);
  const payouts = useMemo(() => payoutRows(rows), [rows]);

  const [historyPage, setHistoryPage] = useState(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(payouts.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(historyPage, pageCount - 1);
  const visiblePayouts = useMemo(() => payouts.slice(safePage * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE), [payouts, safePage]);
  const goToPage = useCallback((n: number) => {
    setHistoryPage(n);
    const el = historyRef.current;
    if (!el || el.getBoundingClientRect().top >= 0) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  const line = holders.data ? Number(holders.data.eligibilityLine) / 10 ** holders.data.decimals : LINE_TOKENS;
  const decimals = holders.data?.decimals ?? 18;
  const y = yieldPoll.data;

  const windowed = (rowsIn: { day: number; v: number | null }[]) => {
    const byDay = new Map<number, number | null>();
    for (const r of rowsIn) byDay.set(r.day, r.v);
    const today = Math.floor((nowSec || Date.now() / 1000) / 86_400) * 86_400;
    const out: { t: number; value: number | null }[] = [];
    for (let day = today - 29 * 86_400; day <= today; day += 86_400) out.push({ t: day, value: byDay.get(day) ?? null });
    return out;
  };
  const paidByDay = useMemo(() => windowed((daily.data?.days ?? []).map((d) => ({ day: d.day, v: d.paid_usd }))), [daily.data, nowSec]); // eslint-disable-line react-hooks/exhaustive-deps
  const queueByDay = useMemo(() => windowed((queue.data?.days ?? []).map((d) => ({ day: d.day, v: d.balanceUsd }))), [queue.data, nowSec]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = SERIES.find((x) => x.id === series) ?? SERIES[0]!;
  const firstPaid = paidByDay.find((b) => b.value !== null && b.value > 0);

  // The tax still sitting in the hook, in ETH, priced at the WETH price the Reserve's positions carry.
  const ethUsd = reserve.data?.positions.flatMap((p) => [p.side0, p.side1]).find((s) => s.symbol === "WETH")?.priceUsd ?? null;
  const hookEth = pending.data?.pendingWei ? Number(pending.data.pendingWei) / 1e18 : null;
  const hookUsd = hookEth === null || ethUsd === null ? null : hookEth * ethUsd;
  const uncollected = reserve.data?.totals.uncollectedFeesUsd ?? null;

  return (
    <Container className="page">
      <PageHeader
        kicker="Live proof"
        title="The airdrops."
        lede="Every cycle the keeper has paid, and what is on its way. If the site and the chain disagree, the chain is right."
        ledeStyle={{ maxWidth: 680 }}
        aside={
          <>
            <Badge tone={sb.tone} dot>
              {sb.label}
            </Badge>
            <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{nextSlot ? `Next cycle · ${nextSlot}` : ""}</span>
          </>
        }
      />

      {status === "unconfigured" && (
        <Callout tone="caution" title="Monitor not configured for this build" style={{ marginTop: 32 }}>
          Set <code style={mono}>MONITOR_API_URL</code> at build time to the monitor&apos;s origin. Until then every figure below shows a dash.
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

      <div className="stat-band">
        <Stat label="Paid to holders" value={fmtUsd(all?.paidUsd)} footnote={all ? `${fmtNum(all.cycles)} cycles · valued when sent` : "Every cycle, valued when sent"} />
        <Stat label="Last cycle" value={fmtUsd(last?.paidUsd)} footnote={last ? `#${last.epoch} · ${fmtWhen(last.endTs ?? last.startTs)} · ${fmtNum(last.recipients)} wallets` : "None yet"} />
        <Stat label="Wallets above the line" value={fmtNum(holders.data?.counts.eligible ?? null)} footnote={`${fmtNum(line)} OURO or more, in their own wallet`} />
        <Stat
          label="Eligible supply"
          value={y?.eligibleTokens == null ? "—" : `${(y.eligibleTokens / 1e6).toFixed(1)}M`}
          unit="OURO"
          footnote={y?.eligibleTokens == null ? "What each cycle is split across" : `${fmtPct(y.eligibleTokens / TOTAL_SUPPLY_TOKENS, 1)} of supply · what each cycle is split across`}
        />
      </div>

      <div className="cols-2">
        <div>
          <Tabs items={SERIES.map((x) => ({ id: x.id, label: x.label }))} active={series} onChange={(id) => setSeries(id as SeriesId)} />
          <Bars data={series === "paid" ? paidByDay : queueByDay} format={(v) => fmtUsd(v, { compact: true })} height={160} ariaLabel={active.ariaLabel} style={{ marginTop: 20 }} />
          {series === "paid" && firstPaid && (
            <div className="bars-axis" style={{ justifyContent: "center" }}>
              <span>{fmtDay(firstPaid.t)} · first payout in the window</span>
            </div>
          )}
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: "12px 0 0" }}>{active.note}</p>
        </div>
        <Card label="On its way">
          <KVRow label="01 · Tax still in the letscash hook" value={hookUsd !== null ? fmtUsd(hookUsd) : hookEth !== null ? `${fmtEth(hookEth)} ETH` : "—"} py={12} />
          <KVRow label="02 · Collected into the airdrop wallet" value={fmtUsd(pending.data?.queuedUsd ?? null)} py={12} />
          <KVRow label={`03 · LP fees accrued, of the ${THRESHOLD} threshold`} value={fmtUsd(uncollected)} py={12} border="none" />
          <div className="card-foot" style={{ marginTop: 6 }}>
            None of these is a scheduled amount. A collection streams out over about 48 hours, so this is the pool the next several cycles draw from.
          </div>
        </Card>
      </div>

      <div ref={historyRef} style={{ marginTop: 56, scrollMarginTop: 24 }}>
        <Card label="Cycles · newest first" action={<span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{clock ? `${clock} · watching` : ""}</span>}>
          {payouts.length > 0 ? (
            <>
              <div className="table-scroll">
                <LedgerTable
                  compact
                  columns={CYCLE_COLS}
                  rows={visiblePayouts.map((r) => ({
                    when: <RowWhen r={r} />,
                    n: (
                      <span style={{ ...mono, fontSize: 13 }}>
                        #{r.cycle}
                        {r.of > 1 && <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{` ${r.nth}/${r.of}`}</span>}
                        {r.merged > 1 && <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{` ${r.merged} payments`}</span>}
                      </span>
                    ),
                    assets: <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.assets.map((a) => a.symbol ?? shortHash(a.address)).join(" · ") || "—"}</span>,
                    recipients: <span style={{ ...mono, fontSize: 13 }}>{fmtNum(r.recipients)}</span>,
                    value: <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{fmtUsd(r.paidUsd)}</span>,
                    tx: <CycleTxs explorer={explorer} txs={r.txs} />,
                  }))}
                />
              </div>
              <Pager page={safePage} pageCount={pageCount} total={payouts.length} pageSize={HISTORY_PAGE_SIZE} noun="payouts" label="Airdrop history pages" onPage={goToPage} />
            </>
          ) : (
            <div style={{ ...body14, fontStyle: "italic" }}>
              {status === "unconfigured" ? "The monitor's origin is not set for this build." : status === "offline" ? "The monitor is not answering." : cycles.data ? "No cycles indexed yet. The first airdrop writes row one." : "Reading the chain…"}
            </div>
          )}
          <div className="card-foot card-foot--row">
            <span>Value is what the tokens were worth when they were sent, not today.</span>
            <span>The newest {TABLE_CYCLES} cycles, a row per payment.</span>
          </div>
        </Card>
      </div>

      <div className="cols-2" style={{ marginTop: 64 }}>
        <div>
          <SectionHead kicker="Eligibility" title="Is a wallet on the list?" size="small" style={{ marginBottom: 20 }} />
          <AddressCheck holders={holders.data} decimals={decimals} lineTokens={line} />
        </div>
        <div>
          <SectionHead kicker="The rate" title="Published with its basis." size="small" style={{ marginBottom: 20 }} />
          <Stat
            size="lg"
            label="Airdrop rate, annualised"
            value={y?.aprPct == null ? "—" : `${fmtNum(y.aprPct, 0)}%`}
            footnote={
              y?.aprPct == null
                ? (y?.withheld ?? "Needs a payout and a price to measure")
                : `Based on ${fmtNum(y.basisDays, 1)} days of payouts · ${fmtNum(y.cycles)} cycles · ${fmtUsd(y.paidUsd)} paid`
            }
          />
          <Callout tone="caution" title="A rate is only as good as its window" style={{ marginTop: 16 }}>
            {y?.caveat ?? `This one rests on ${y?.basisDays ? fmtNum(y.basisDays, 0) : "seven"} days.`} It moves with trading volume and is not a forecast.{" "}
            <a href={ouroUrl("/#calc")} {...externalLinkProps(ouroUrl("/#calc"))}>
              Try your size in the calculator on ourolayer.com ↗
            </a>
          </Callout>
        </div>
      </div>

      <OuroFoot />
    </Container>
  );
}

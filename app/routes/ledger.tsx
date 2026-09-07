import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/ledger";
import { Badge, Callout, Card, LedgerTable, Stat, type BadgeTone, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, Grid, KVRow, MicroLabel, PageHeader, PendingCell, SectionHead, body14, hairline, mono } from "~/components/site";
import { Bars } from "~/components/site/Bars";
import { COLLECTION_SPLIT_USD, COLLECT_THRESHOLD_USD, INFRASTRUCTURE, PROTOCOL_CONTRACTS, RESERVE_POOLS, type AddressEntry } from "~/content/protocol";
import { externalLinkProps, site } from "~/content/site";
import { useClock } from "~/hooks/useClock";
import { pageMeta } from "~/lib/meta";
import {
  MONITOR_API,
  ago,
  fmtAge,
  fmtEth,
  fmtFeeTier,
  fmtNum,
  fmtPct,
  fmtPctSigned,
  fmtTokens,
  fmtUsd,
  fmtUsdSigned,
  fmtWhen,
  shortHash,
  useMonitor,
  type Reserve,
  type ReserveEvent,
  type ReservePosition,
} from "~/lib/monitorApi";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `The Ledger · ${site.name} treasury, read from the chain`,
    description:
      "Every position the Ouro treasury owns, read from Robinhood Chain: what the pools hold, the fees they have earned, and what the same tokens would have been worth simply held. None of it is reported by hand.",
    path: location.pathname,
    image: "/og/ledger.png",
  });
}

type PageStatus = "loading" | "live" | "stale" | "offline" | "unconfigured" | "empty" | "syncing";

const STATUS_BADGE: Record<PageStatus, { tone: BadgeTone; label: string }> = {
  loading: { tone: "neutral", label: "Connecting" },
  live: { tone: "positive", label: "Live" },
  stale: { tone: "caution", label: "Stale" },
  offline: { tone: "negative", label: "Monitor offline" },
  unconfigured: { tone: "neutral", label: "Monitor not configured" },
  empty: { tone: "caution", label: "No positions yet" },
  syncing: { tone: "neutral", label: "Reading the chain" },
};

function pageStatus(poll: ReturnType<typeof useMonitor<Reserve>>, nowSec: number): PageStatus {
  if (!MONITOR_API) return "unconfigured";
  if (poll.data) {
    // `indexedTo` null means the indexer has not run yet, which is not the same as an empty
    // treasury. Claiming "no positions" off an unread ledger is the one thing this page must not do.
    if (poll.data.indexedTo === null) return "syncing";
    if (poll.data.positions.length === 0) return "empty";
    const fresh = poll.updatedAt !== null && Date.now() - poll.updatedAt < 5 * 60_000 && nowSec - poll.data.generatedAt < 10 * 60;
    return fresh && !poll.error ? "live" : "stale";
  }
  if (poll.error) return "offline";
  return "loading";
}

function TxLink({ explorer, tx }: { explorer: string | null; tx: string }) {
  const text = <span style={{ ...mono, fontSize: 12 }}>{shortHash(tx)}</span>;
  if (!explorer) return text;
  const href = `${explorer}/tx/${tx}`;
  return (
    <a href={href} {...externalLinkProps(href)} style={{ color: "var(--text-secondary)" }}>
      {text}
    </a>
  );
}

function addressRows(entries: AddressEntry[]) {
  return entries.map((e) => ({ c: e.name, a: e.address ? <AddressCell address={e.address} linked={!e.poolId} /> : <PendingCell>Publishes at launch</PendingCell> }));
}

const ADDR_COLS: LedgerColumn[] = [
  { key: "c", label: "Protocol contract" },
  { key: "a", label: "Address", align: "right" },
];
const INFRA_COLS: LedgerColumn[] = [
  { key: "c", label: "Canonical infrastructure" },
  { key: "a", label: "Address", align: "right" },
];
const POOL_COLS: LedgerColumn[] = [
  { key: "c", label: "Pools the Reserve is an LP in" },
  { key: "a", label: "Address", align: "right" },
];
const EVENT_COLS: LedgerColumn[] = [
  { key: "when", label: "When", nowrap: true },
  { key: "what", label: "What the Reserve did" },
  { key: "value", label: "Value", align: "right", numeric: true, nowrap: true },
  { key: "tx", label: "Tx", align: "right", nowrap: true },
];

const EVENT_LABEL: Record<string, string> = {
  mint: "Opened a position",
  increase: "Added liquidity",
  decrease: "Withdrew liquidity",
  collect: "Collected fees",
  transfer_in: "Position received",
  transfer_out: "Position transferred out",
};

/** Round policy figures as copy, so they are not run through `fmtUsd` ("$100.00"). */
const usd0 = (n: number) => `$${n.toLocaleString("en-US")}`;
const THRESHOLD = usd0(COLLECT_THRESHOLD_USD);
const TO_HOLDERS = usd0(COLLECTION_SPLIT_USD.holders);
const TO_RESERVE = usd0(COLLECTION_SPLIT_USD.reserve);

function pairOf(p: ReservePosition): string {
  return `${p.side0.symbol ?? "?"} / ${p.side1.symbol ?? "?"}`;
}

/**
 * One position. The two figures that matter sit next to each other on purpose: fees earned, and what
 * the same tokens would have been worth simply held. Reading either alone is how an LP convinces
 * itself a losing position is working.
 */
function PositionCard({ p, explorer }: { p: ReservePosition; explorer: string | null }) {
  const rangeBadge: { tone: BadgeTone; label: string } = !p.held
    ? { tone: "neutral", label: "No longer held" }
    : p.inRange === null
      ? { tone: "neutral", label: "Not polled yet" }
      : p.inRange
        ? { tone: "positive", label: "In range · earning" }
        : { tone: "caution", label: "Out of range · earning nothing" };

  return (
    <Card
      label={
        <>
          {pairOf(p)} <span style={{ ...mono, textTransform: "none", letterSpacing: 0, color: "var(--text-faint)" }}>#{p.tokenId}</span>
        </>
      }
      action={<Badge tone={rangeBadge.tone} dot>{rangeBadge.label}</Badge>}
    >
      <Grid cols="repeat(3, 1fr)" gap={20} className="grid--2col-md">
        <Stat label="Marked to market" value={fmtUsd(p.valueUsd)} footnote={`${fmtTokens(p.side0.amountF)} ${p.side0.symbol ?? ""} + ${fmtTokens(p.side1.amountF)} ${p.side1.symbol ?? ""}`} />
        <Stat
          label="Fees earned"
          value={fmtUsd(p.uncollectedFeesUsd === null || p.collectedFeesUsd === null ? null : p.uncollectedFeesUsd + p.collectedFeesUsd)}
          footnote={`${fmtUsd(p.uncollectedFeesUsd)} uncollected · ${fmtUsd(p.collectedFeesUsd)} taken out`}
        />
        <Stat
          label="Against simply holding"
          value={fmtUsdSigned(p.netVsHoldingUsd)}
          delta={p.netVsHoldingUsd === null || p.hodlUsd === null || p.hodlUsd <= 0 ? null : fmtPctSigned(p.netVsHoldingUsd / p.hodlUsd)}
          footnote={`Deposits would be ${fmtUsd(p.hodlUsd)} held`}
        />
      </Grid>

      <div style={{ marginTop: 20, borderTop: hairline }}>
        <KVRow
          label="Pool fee, and what the Reserve keeps of it"
          value={
            <>
              {fmtFeeTier(p.feeBps)} <span style={{ color: "var(--text-faint)" }}>tier</span> → {fmtFeeTier(p.lpFeeBps?.fee0 ?? null)} <span style={{ color: "var(--text-faint)" }}>to the LP</span>
            </>
          }
        />
        <KVRow label="Share of the pool's active liquidity" value={p.shareOfActiveLiquidity === null ? "—" : fmtPct(p.shareOfActiveLiquidity, 3)} />
        <KVRow
          label="Range, and where the price is"
          value={
            <>
              [{fmtNum(p.tickLower)}, {fmtNum(p.tickUpper)}) <span style={{ color: "var(--text-faint)" }}>at</span> {p.tick === null ? "—" : fmtNum(p.tick)}
            </>
          }
        />
        <KVRow label="Deposits, net of withdrawals" value={`${fmtTokens(p.side0.depositedF)} ${p.side0.symbol ?? ""} + ${fmtTokens(p.side1.depositedF)} ${p.side1.symbol ?? ""}`} />
        <KVRow label="Opened, and topped up since" value={`${fmtWhen(p.firstTs)} · ${fmtNum(p.adds)} add${p.adds === 1 ? "" : "s"}, ${fmtNum(p.collects)} collect${p.collects === 1 ? "" : "s"}`} />
        <KVRow
          label="Pool"
          value={
            explorer ? (
              <a href={`${explorer}/address/${p.pool}`} {...externalLinkProps(`${explorer}/address/${p.pool}`)} style={{ color: "var(--text-secondary)" }}>
                {shortHash(p.pool)} ↗
              </a>
            ) : (
              shortHash(p.pool)
            )
          }
          border="none"
        />
      </div>
    </Card>
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

export default function Ledger() {
  const clock = useClock();
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve?hours=720" : null, 60_000);
  const events = useMonitor<{ events: ReserveEvent[] }>(MONITOR_API ? "/v1/reserve/events?limit=12" : null, 60_000);
  const nowSec = reserve.data ? Math.floor(Date.now() / 1000) : 0;
  const status = pageStatus(reserve, nowSec);
  const sb = STATUS_BADGE[status];
  const d = reserve.data;
  const t = d?.totals;
  const explorer = d?.chain.explorer ?? (site.links.explorer !== "#" ? site.links.explorer : null);

  /**
   * One bar per UTC day, from the last snapshot of that day, over a fixed 30-day window ending today.
   *
   * The window is fixed rather than "however many days we have" because `Bars` sizes each bar as
   * `width / n`: on the Reserve's first day a single snapshot would draw one bar across the whole
   * chart, which reads as a full month at that value. Days with no snapshot draw nothing, which is
   * the honest gap the component is built for.
   */
  const navByDay = (() => {
    const byDay = new Map<number, number | null>();
    for (const s of d?.history ?? []) byDay.set(Math.floor(s.ts / 86_400) * 86_400, s.nav_usd);
    const today = Math.floor((nowSec || Date.now() / 1000) / 86_400) * 86_400;
    const out: { t: number; value: number | null }[] = [];
    for (let day = today - 29 * 86_400; day <= today; day += 86_400) out.push({ t: day, value: byDay.get(day) ?? null });
    return out;
  })();

  const held = (d?.positions ?? []).filter((p) => p.held);
  const closed = (d?.positions ?? []).filter((p) => !p.held);

  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Live proof"
        title="The Ledger."
        lede="Every position the treasury owns, read from the chain: what the pools hold, what they have earned, and what the same tokens would have been worth simply held. None of it is reported by hand."
        ledeStyle={{ maxWidth: 680 }}
        aside={
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 4 }}>
            <Badge tone={sb.tone} dot>
              {sb.label}
            </Badge>
            <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>
              {clock}
              {d?.block ? ` · block ${fmtNum(d.block)}` : ""}
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
          The page could not reach <code style={mono}>{MONITOR_API}</code> ({reserve.error}). Figures return as soon as it does. Nothing here is cached or
          estimated.
        </Callout>
      )}
      {status === "stale" && (
        <Callout tone="caution" title="Showing the last good reading" style={{ marginTop: 32 }}>
          Last refreshed {reserve.updatedAt ? ago((Date.now() - reserve.updatedAt) / 1000) : "—"} ago. The monitor's own reading is from {fmtWhen(d?.generatedAt)}.
        </Callout>
      )}
      {status === "syncing" && (
        <Callout title="The monitor is still reading the chain" style={{ marginTop: 32 }}>
          It has not finished indexing the Reserve's history yet, so nothing below is stated as fact — a dash here means
          "not read", not "zero". Figures fill in on their own within a few minutes of the monitor starting.
        </Callout>
      )}
      {status === "empty" && (
        <Callout tone="caution" title="The Reserve holds no positions yet" style={{ marginTop: 32 }}>
          The monitor has read the chain up to block {fmtNum(d?.indexedTo ?? null)} and finds no protocol-owned liquidity at{" "}
          <code style={mono}>{d?.lp}</code>. Every figure below stays a dash until the LP leg of the tax opens a position.
        </Callout>
      )}
      {t && t.priced === false && (
        <Callout tone="caution" title="One leg has no price, so the totals are withheld" style={{ marginTop: 32 }}>
          At least one token in the Reserve has no price the monitor trusts right now. Rather than publish a partial sum that reads like a complete one, the USD
          totals show a dash. The positions themselves, and their token amounts, are unaffected.
        </Callout>
      )}

      <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ margin: "40px 0 48px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}>
        <Stat label="Treasury NAV" value={fmtUsd(t?.navUsd, { compact: true })} footnote={`Owned liquidity, marked to market · ${fmtNum(t?.positions ?? null)} position${t?.positions === 1 ? "" : "s"}`} />
        <Stat
          label="Fees earned"
          value={fmtUsd(t?.feesTotalUsd)}
          footnote={
            t?.uncollectedFeesUsd === null || t?.uncollectedFeesUsd === undefined
              ? `Collected at ${THRESHOLD} of accrued fees`
              : t.uncollectedFeesUsd >= COLLECT_THRESHOLD_USD
                ? `${fmtUsd(t.uncollectedFeesUsd)} uncollected · at or over the ${THRESHOLD} collection threshold`
                : `${fmtUsd(t.uncollectedFeesUsd)} of ${THRESHOLD} uncollected · ${fmtUsd(COLLECT_THRESHOLD_USD - t.uncollectedFeesUsd)} to go before a collection`
          }
        />
        <Stat
          label="Divergence loss"
          value={fmtUsdSigned(t?.divergenceUsd)}
          footnote="What the pool gave up by rebalancing as the price moved"
        />
        <Stat
          label="Net against holding"
          value={fmtUsdSigned(t?.netVsHoldingUsd)}
          delta={t ? fmtPctSigned(t.netVsHoldingPct) : null}
          footnote={`Fees minus divergence, over ${fmtAge(t?.ageDays)}`}
        />
      </Grid>

      <Callout title="Why this page leads with the net, not the fees" style={{ marginBottom: 48 }}>
        A pool that earns fees can still lose to simply holding the tokens: as the price moves it sells the winner and buys the loser, and that divergence is a
        real cost. Fees earned alone would read {t ? fmtPctSigned(t.hodlUsd && t.hodlUsd > 0 && t.feesTotalUsd !== null ? t.feesTotalUsd / t.hodlUsd : null) : "—"} here.
        The honest figure is the net: {fmtUsdSigned(t?.netVsHoldingUsd)}, {t ? fmtPctSigned(t.netVsHoldingPct) : "—"} on {fmtUsd(t?.hodlUsd)} of deposits. Both are
        published above, and either can be checked against the chain from the addresses at the bottom of this page.
      </Callout>

      <Grid cols="1.1fr 0.9fr" gap={48} align="start" style={{ marginBottom: 64 }}>
        <div>
          <MicroLabel style={{ marginBottom: 12 }}>Treasury NAV, by day</MicroLabel>
          <Bars data={navByDay} format={(v) => fmtUsd(v, { compact: true })} ariaLabel="Treasury NAV in US dollars, by day" />
        </div>
        <div>
          <MicroLabel style={{ marginBottom: 12 }}>The Reserve</MicroLabel>
          <div style={{ borderTop: hairline }}>
            <KVRow label="Positions held, and earning right now" value={t ? `${fmtNum(t.positions)} · ${fmtNum(t.inRange)} in range` : "—"} />
            <KVRow label="Wallet that holds them" value={d ? <AddressCell address={d.lp as `0x${string}`} /> : "—"} />
            <KVRow label="Gas left to collect with" value={d ? `${fmtEth(d.gas.eth)} ETH${d.gas.usd === null ? "" : ` · ${fmtUsd(d.gas.usd)}`}` : "—"} />
            <KVRow
              label="Fees are collected at"
              value={
                <>
                  {THRESHOLD} accrued <span style={{ color: "var(--text-faint)" }}>→</span> {TO_HOLDERS} airdropped, {TO_RESERVE} compounded
                </>
              }
              border="none"
            />
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)" }}>
            Fees stay in the positions, earning, until {THRESHOLD} has accrued across all of them. Only then is a collection taken, and it splits on the usual
            80 / 20: {TO_HOLDERS} to the airdrop wallet, {TO_RESERVE} compounded straight back into the positions. A collect costs gas, and that cost would come
            out of the airdrop, so a small one is not worth taking. Nothing is sold to fund an airdrop, so what holders receive is what the pools earned.{" "}
            <Link to="/airdrops/">Every payout is on the airdrops page →</Link>
          </div>
        </div>
      </Grid>

      <SectionHead
        kicker="Positions"
        title="What the treasury owns."
        titleStyle={{ fontSize: 30 }}
        sub="One card per protocol-owned position, read from the Uniswap v3 position manager and the pool itself. A position that leaves the treasury keeps its history here."
        subStyle={{ fontSize: 15 }}
        style={{ marginBottom: 24 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 64 }}>
        {held.map((p) => (
          <PositionCard key={p.tokenId} p={p} explorer={explorer} />
        ))}
        {closed.map((p) => (
          <PositionCard key={p.tokenId} p={p} explorer={explorer} />
        ))}
        {(!d || status === "syncing") && (
          <Card label="Positions">
            <div style={{ ...body14, fontStyle: "italic" }}>
              {status === "unconfigured"
                ? "The Monitor's origin is not set for this build, so no positions can be read."
                : status === "offline"
                  ? "The Monitor is not answering."
                  : "Reading the chain…"}
            </div>
          </Card>
        )}
      </div>

      {/* Renamed from "Cycle feed" when /airdrops got the real one: this is the positions moving, not payouts. */}
      <Card label="Position feed" action={<span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{clock} · watching</span>} style={{ marginBottom: 64 }}>
        {events.data && events.data.events.length > 0 ? (
          <div className="table-scroll">
            <LedgerTable
              compact
              columns={EVENT_COLS}
              rows={events.data.events.map((e) => ({
                when: <span style={{ fontSize: 13 }}>{fmtWhen(e.ts)}</span>,
                what: (
                  <span style={{ fontSize: 13 }}>
                    {EVENT_LABEL[e.kind] ?? e.kind}
                    <span style={{ color: "var(--text-faint)" }}>
                      {" · "}
                      {e.kind === "transfer_in" || e.kind === "transfer_out"
                        ? `#${e.tokenId}`
                        : `${fmtTokens(e.amount0F)} ${e.symbol0 ?? ""} + ${fmtTokens(e.amount1F)} ${e.symbol1 ?? ""}`}
                    </span>
                  </span>
                ),
                value: <span style={{ ...mono, fontSize: 13 }}>{e.kind === "transfer_in" || e.kind === "transfer_out" ? "—" : fmtUsd(e.usd)}</span>,
                tx: <TxLink explorer={explorer} tx={e.tx} />,
              }))}
            />
          </div>
        ) : (
          <div style={{ ...body14, fontStyle: "italic" }}>
            {MONITOR_API ? "No movements indexed yet. The first one writes row one." : "The Monitor's origin is not set for this build."}
          </div>
        )}
        <div style={{ borderTop: hairline, marginTop: 14, paddingTop: 14, fontSize: 13, color: "var(--text-muted)" }}>
          Every add, withdrawal and fee collection the Reserve has made, priced at the moment it happened. A collect that shares a transaction with a withdrawal
          has the principal netted out, so what shows here as fees is fees.
        </div>
      </Card>

      <SectionHead
        kicker="Method"
        title="How this is measured."
        titleStyle={{ fontSize: 30 }}
        sub="Every number above is derived from Robinhood Chain by the Monitor, an open indexer we run. A missing price leaves a dash, never an estimate."
        subStyle={{ fontSize: 15 }}
        style={{ marginBottom: 24 }}
      />
      <Grid cols="1fr 1fr" gap={48} align="start" style={{ marginBottom: 64 }}>
        <div>
          <Method n="01" title="What a position holds">
            A v3 position stores liquidity, not balances, so the token amounts are derived from the pool's current price and the position's range — the same
            arithmetic <code style={mono}>LiquidityAmounts.sol</code> does, checked against a simulated full withdrawal to the wei.
          </Method>
          <Method n="02" title="Uncollected fees">
            A <code style={mono}>collect</code> call simulated as the owner, for the maximum. The position manager's stored{" "}
            <code style={mono}>tokensOwed</code> is only refreshed when the position is poked, so it is stale and is not used.
          </Method>
          <Method n="03" title="Fees the Reserve keeps">
            Both pools skim 1/6 of each side's fee for the v3 factory owner, who is not us, so a 0.30% pool pays the Reserve 0.25%. Each position card shows the
            tier and the share, and nothing here estimates fees from volume.
          </Method>
        </div>
        <div>
          <Method n="04" title="Divergence loss">
            Marked value minus what the deposited tokens would be worth held, at today's price. Deposits are net of withdrawals, taken from the position's own
            event log rather than a wallet snapshot.
          </Method>
          <Method n="05" title="Fees already collected">
            Valued at the price when they were collected, not today's. A collect in the same transaction as a withdrawal reports principal and fees together, so
            the principal is netted back out. Collections are taken only once {THRESHOLD} of fees has accrued across the positions, so this figure stays at zero
            — and the uncollected figure keeps rising — between collections. It counts the whole collection, including the fifth of it that compounds rather
            than being airdropped.
          </Method>
          <Method n="06" title="What is withheld">
            If any token in the Reserve has no price the monitor trusts, every USD total shows a dash rather than a partial sum. Token amounts, ranges and the
            in-range flag never depend on a price.
          </Method>
        </div>
      </Grid>

      <div>
        <SectionHead
          kicker="Addresses"
          title="Verify everything."
          titleStyle={{ fontSize: 30 }}
          sub="The wallet that holds the liquidity, the pools it is an LP in, and the canonical infrastructure Ouro builds on. All of it is onchain and checkable without us."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 32 }}
        />
        <Grid cols="1fr 1fr" gap={24} align="start">
          <LedgerTable compact columns={ADDR_COLS} rows={addressRows(PROTOCOL_CONTRACTS)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <LedgerTable compact columns={POOL_COLS} rows={addressRows(RESERVE_POOLS)} />
            <LedgerTable compact columns={INFRA_COLS} rows={addressRows(INFRASTRUCTURE)} />
          </div>
        </Grid>
      </div>
    </Container>
  );
}

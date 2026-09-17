import { Link } from "react-router";

import type { Route } from "./+types/ledger";
import { Badge, Callout, Card, LedgerTable, Stat, type BadgeTone, type LedgerColumn } from "@ouro/ds";
import { OuroFoot } from "~/components/OuroFoot";
import { AddressCell, Bars, Container, KVRow, MicroLabel, PageHeader, SectionHead, body14, mono } from "~/components/site";
import { COLLECT_THRESHOLD_USD } from "~/content/protocol";
import { externalLinkProps, ouroUrl, site } from "~/content/site";
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
} from "@ouro/monitor-client";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `The Ledger · ${site.name} treasury, read from the chain`,
    description: "What the Reserve owns, what it earned, and whether that beats simply holding. Read from Robinhood Chain.",
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
  if (!explorer) return <span className="mono-link">{shortHash(tx)}</span>;
  const href = `${explorer}/tx/${tx}`;
  return (
    <a href={href} {...externalLinkProps(href)} className="mono-link">
      {shortHash(tx)} ↗
    </a>
  );
}

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

function pairOf(p: ReservePosition): string {
  return `${p.side0.symbol ?? "?"} / ${p.side1.symbol ?? "?"}`;
}

/**
 * One position, whichever Uniswap it is in.
 *
 * The two figures that matter sit next to each other on purpose: fees earned, and what the same
 * tokens would have been worth simply held. Reading either alone is how an LP convinces itself a
 * losing position is working.
 *
 * ONE CARD FOR BOTH VENUES, and that is the point of it. Until the monitor indexed v4 this page drew
 * a second, poorer card for the v4 position with two of its three figures dashed, and a reader had
 * to know which Uniswap a row was in to know whether its number meant anything. The venue now
 * changes two rows and nothing else: v4 adds its protocol fee, which is charged differently, and its
 * pool is an id inside the PoolManager rather than a contract, so that row has no link to give.
 */
function PositionCard({ p, explorer }: { p: ReservePosition; explorer: string | null }) {
  const v4 = p.venue === "v4";
  const rangeBadge: { tone: BadgeTone; label: string } = !p.held
    ? { tone: "neutral", label: "No longer held" }
    : p.inRange === null
      ? { tone: "neutral", label: "Not polled yet" }
      : p.inRange
        ? { tone: "positive", label: "In range · earning" }
        : { tone: "caution", label: "Out of range · earning nothing" };
  // A v4 pool id is a key inside the singleton, not an address: linking it would 404.
  const poolHref = explorer && !v4 ? `${explorer}/address/${p.pool}` : null;

  return (
    <Card
      label={
        <>
          {pairOf(p)} <span style={{ ...mono, textTransform: "none", letterSpacing: 0, color: "var(--text-faint)" }}>#{p.tokenId}</span>
        </>
      }
      action={
        <Badge tone={rangeBadge.tone} dot>
          {rangeBadge.label}
        </Badge>
      }
    >
      <div className="pos__stats">
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
      </div>

      <div className="kv-list" style={{ marginTop: 20 }}>
        <KVRow
          label="Pool fee, and what the Reserve keeps of it"
          value={
            <>
              {fmtFeeTier(p.feeBps)} <span style={{ color: "var(--text-faint)" }}>tier →</span> {fmtFeeTier(p.lpFeeBps?.fee0 ?? null)}{" "}
              <span style={{ color: "var(--text-faint)" }}>to the LP</span>
            </>
          }
        />
        {p.protocolFeeBps !== null && (
          <KVRow
            label="Protocol fee, taken off each swap before the LP fee"
            value={
              <>
                {fmtFeeTier(p.protocolFeeBps)} <span style={{ color: "var(--text-faint)" }}>to the v4 fee controller</span>
              </>
            }
          />
        )}
        <KVRow label="Share of the pool's active liquidity" value={p.shareOfActiveLiquidity === null ? "—" : fmtPct(p.shareOfActiveLiquidity, 3)} />
        <KVRow
          label="Range, and where the price is"
          value={
            <>
              [{fmtNum(p.tickLower)}, {fmtNum(p.tickUpper)}) <span style={{ color: "var(--text-faint)" }}>at</span> {p.tick === null ? "—" : fmtNum(p.tick)}
            </>
          }
        />
        <KVRow label="Opened, and topped up since" value={`${fmtWhen(p.firstTs)} · ${fmtNum(p.adds)} add${p.adds === 1 ? "" : "s"}, ${fmtNum(p.collects)} collect${p.collects === 1 ? "" : "s"}`} />
        <KVRow
          label={v4 ? "Pool id (Uniswap v4)" : "Pool"}
          value={
            poolHref ? (
              <a href={poolHref} {...externalLinkProps(poolHref)} className="mono-link" style={{ fontSize: 13 }}>
                {shortHash(p.pool)} ↗
              </a>
            ) : (
              <span style={{ ...mono, fontSize: 13 }}>{shortHash(p.pool)}</span>
            )
          }
          border="none"
        />
      </div>
    </Card>
  );
}

export default function Ledger() {
  const clock = useClock();
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve?hours=720" : null, 60_000);
  const events = useMonitor<{ events: ReserveEvent[] }>(MONITOR_API ? "/v1/reserve/events?limit=12" : null, 60_000);
  const nowSec = reserve.data ? Math.floor(Date.now() / 1000) : 0;
  const status = pageStatus(reserve, nowSec);
  const d = reserve.data;
  const t = d?.totals;
  const explorer = d?.chain.explorer ?? (site.links.explorer !== "#" ? site.links.explorer : null);
  /**
   * Venues holding Reserve liquidity that the Monitor does not index. A venue reporting zero is not
   * news; a venue it could not read (`count === null`) is, because that is coverage we cannot claim.
   * A silent omission reads as a complete figure, which is the one thing the Ledger must never publish.
   */
  const unindexed = (d?.unindexed ?? []).filter((u) => u.count === null || u.count > 0);
  const unindexedTotal = unindexed.some((u) => u.count === null) ? null : unindexed.reduce((n, u) => n + (u.count ?? 0), 0);
  const sb = status === "empty" && unindexed.length > 0 ? { ...STATUS_BADGE[status], label: "No v3 positions" } : STATUS_BADGE[status];

  const nav = t?.navUsd ?? null;
  // The monitor counts every venue it indexes, so these are simply its own figures now.
  const positions = t?.positions ?? null;
  const inRange = t?.inRange ?? null;
  const unvalued = unindexedTotal;

  /**
   * One bar per UTC day, from the last snapshot of that day, over a fixed 30-day window ending today.
   * Days with no snapshot draw nothing, which is the honest gap the chart is built for.
   */
  const navByDay = (() => {
    const byDay = new Map<number, number | null>();
    for (const s of d?.history ?? []) byDay.set(Math.floor(s.ts / 86_400) * 86_400, s.nav_usd);
    const today = Math.floor((nowSec || Date.now() / 1000) / 86_400) * 86_400;
    const out: { t: number; value: number | null }[] = [];
    for (let day = today - 29 * 86_400; day <= today; day += 86_400) out.push({ t: day, value: byDay.get(day) ?? null });
    return out;
  })();
  const firstDay = navByDay.find((b) => b.value !== null);

  const held = (d?.positions ?? []).filter((p) => p.held);
  const closed = (d?.positions ?? []).filter((p) => !p.held);

  return (
    <Container className="page">
      <PageHeader
        kicker="Live proof"
        title="The Ledger."
        lede="What the Reserve owns, what it earned, and whether that beats simply holding."
        ledeStyle={{ maxWidth: 680 }}
        aside={
          <>
            <Badge tone={sb.tone} dot>
              {sb.label}
            </Badge>
            <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>
              {clock}
              {d?.block ? ` · block ${fmtNum(d.block)}` : ""}
            </span>
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
          The page could not reach <code style={mono}>{MONITOR_API}</code> ({reserve.error}). Figures return as soon as it does. Nothing here is cached or
          estimated.
        </Callout>
      )}
      {status === "stale" && (
        <Callout tone="caution" title="Showing the last good reading" style={{ marginTop: 32 }}>
          Last refreshed {reserve.updatedAt ? ago((Date.now() - reserve.updatedAt) / 1000) : "—"} ago. The monitor&apos;s own reading is from {fmtWhen(d?.generatedAt)}.
        </Callout>
      )}
      {status === "syncing" && (
        <Callout title="The monitor is still reading the chain" style={{ marginTop: 32 }}>
          It has not finished indexing the Reserve&apos;s history yet, so nothing below is stated as fact. A dash here means &quot;not read&quot;, not &quot;zero&quot;.
        </Callout>
      )}
      {status === "empty" && (
        <Callout tone="caution" title={unindexed.length > 0 ? "The Reserve holds no positions this page can read" : "The Reserve holds no positions yet"} style={{ marginTop: 32 }}>
          The monitor has read the chain up to block {fmtNum(d?.indexedTo ?? null)} and finds no Uniswap v3 liquidity at <code style={mono}>{d?.lp}</code>.{" "}
          {unindexed.length > 0 ? "That is not the same as an empty treasury: it holds liquidity in another venue, which is read from the chain and shown below." : "Every figure below stays a dash until the LP leg of the tax opens a position."}
        </Callout>
      )}
      {t && t.priced === false && (
        <Callout tone="caution" title="One leg has no price, so the totals are withheld" style={{ marginTop: 32 }}>
          At least one token in the Reserve has no price the monitor trusts right now. Rather than publish a partial sum that reads like a complete one, the USD
          totals show a dash. The positions themselves, and their token amounts, are unaffected.
        </Callout>
      )}
      {/* No "counted but not valued" callout here any more: the monitor indexes Uniswap v4 as well
          as v3, so a v4 position is an ordinary card among the others and an ordinary line in the
          totals. What is left to disclose is a venue the monitor still does not read at all, and
          that belongs in the NAV footnote, beside the figure it qualifies. */}
      <div className="stat-band">
        <Stat
          label="Treasury NAV"
          value={fmtUsd(nav)}
          footnote={
            positions === null
              ? "Owned liquidity, marked to market"
              : `Owned liquidity, marked to market · ${fmtNum(positions)} position${positions === 1 ? "" : "s"}` +
                (unvalued === null ? " · excludes liquidity held in an unread venue" : unvalued > 0 ? ` · excludes ${fmtNum(unvalued)} held elsewhere` : "")
          }
        />
        <Stat
          label="Fees earned"
          value={fmtUsd(t?.feesTotalUsd)}
          footnote={
            (t?.uncollectedFeesUsd === null || t?.uncollectedFeesUsd === undefined
              ? `Collected at ${THRESHOLD} of accrued fees`
              : t.uncollectedFeesUsd >= COLLECT_THRESHOLD_USD
                ? `${fmtUsd(t.uncollectedFeesUsd)} uncollected · at or over the ${THRESHOLD} collection threshold`
                : `${fmtUsd(t.uncollectedFeesUsd)} of ${THRESHOLD} uncollected · ${fmtUsd(COLLECT_THRESHOLD_USD - t.uncollectedFeesUsd)} to go before a collection`) +
            ""
          }
        />
        <Stat label="Divergence loss" value={fmtUsdSigned(t?.divergenceUsd)} footnote="What the pools gave up by rebalancing as prices moved" />
        <Stat
          label="Net against holding"
          value={fmtUsdSigned(t?.netVsHoldingUsd)}
          delta={t ? fmtPctSigned(t.netVsHoldingPct) : null}
          footnote={`Fees minus divergence, over ${fmtAge(t?.ageDays)}`}
        />
      </div>

      <Callout title="Why this page leads with the net, not the fees">
        Fees can still lose to holding. Fees alone: {t ? fmtPctSigned(t.hodlUsd && t.hodlUsd > 0 && t.feesTotalUsd !== null ? t.feesTotalUsd / t.hodlUsd : null) : "—"}. Net:{" "}
        {fmtUsdSigned(t?.netVsHoldingUsd)} ({t ? fmtPctSigned(t.netVsHoldingPct) : "—"}) on {fmtUsd(t?.hodlUsd)} held.
      </Callout>

      <div className="cols-2" style={{ marginTop: 48 }}>
        <div>
          <MicroLabel style={{ marginBottom: 12 }}>Treasury NAV, by day · 30 days</MicroLabel>
          <Bars data={navByDay} format={(v) => fmtUsd(v, { compact: true })} ariaLabel="Treasury NAV in US dollars, by day" />
          {firstDay && (
            <div className="bars-axis" style={{ justifyContent: "center" }}>
              <span>{new Date(firstDay.t * 1000).toISOString().slice(5, 10)} · first position in the window</span>
            </div>
          )}
          {/* The snapshots taken before the monitor indexed Uniswap v4 counted the v3 positions
              only, so bars older than that sit below the NAV above them by a whole venue. Said here
              rather than left for a reader to work out from a chart that does not line up. */}
          <div className="kv-note">Bars before 17 September 2026 are the Uniswap v3 positions only, which is when the Reserve&apos;s v4 liquidity was first indexed.</div>
        </div>
        <div>
          <MicroLabel style={{ marginBottom: 12 }}>The Reserve</MicroLabel>
          <div className="kv-list">
            <KVRow label="Positions held, earning now" value={positions === null ? "—" : `${fmtNum(positions)} · ${fmtNum(inRange)} in range`} />
            <KVRow label="Wallet that holds them" value={d ? <AddressCell address={d.lp as `0x${string}`} /> : "—"} />
            <KVRow label="Gas left to collect with" value={d ? `${fmtEth(d.gas.eth)} ETH${d.gas.usd === null ? "" : ` · ${fmtUsd(d.gas.usd)}`}` : "—"} />
            <KVRow
              label="Fees are collected at"
              value={
                <>
                  {THRESHOLD} accrued <span style={{ color: "var(--text-faint)" }}>→</span> all of it compounded
                </>
              }
              border="none"
            />
          </div>
          <div className="kv-note">
            Small collects are skipped for gas, and what is collected goes back into the positions. The airdrop is paid from the tax instead: every payout is on
            the <Link to="/airdrops/">airdrops page →</Link>
          </div>
        </div>
      </div>

      <SectionHead kicker="Positions" title="What the treasury owns." size="sub" style={{ margin: "64px 0 24px" }} />
      <div className="positions">
        {held.map((p) => (
          <PositionCard key={p.tokenId} p={p} explorer={explorer} />
        ))}
        {closed.map((p) => (
          <PositionCard key={p.tokenId} p={p} explorer={explorer} />
        ))}
        {(!d || status === "syncing") && (
          <Card label="Positions">
            <div style={{ ...body14, fontStyle: "italic" }}>
              {status === "unconfigured" ? "The monitor's origin is not set for this build, so no positions can be read." : status === "offline" ? "The monitor is not answering." : "Reading the chain…"}
            </div>
          </Card>
        )}
      </div>

      <div style={{ marginTop: 48 }}>
        <Card label="Position feed" action={<span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{clock ? `${clock} · watching` : ""}</span>}>
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
                        {e.kind === "transfer_in" || e.kind === "transfer_out" ? `#${e.tokenId}` : `${fmtTokens(e.amount0F)} ${e.symbol0 ?? ""} + ${fmtTokens(e.amount1F)} ${e.symbol1 ?? ""}`}
                      </span>
                    </span>
                  ),
                  value: <span style={{ ...mono, fontSize: 13 }}>{e.kind === "transfer_in" || e.kind === "transfer_out" ? "—" : fmtUsd(e.usd)}</span>,
                  tx: <TxLink explorer={explorer} tx={e.tx} />,
                }))}
              />
            </div>
          ) : (
            <div style={{ ...body14, fontStyle: "italic" }}>{MONITOR_API ? "No movements indexed yet. The first one writes row one." : "The monitor's origin is not set for this build."}</div>
          )}
          <div className="card-foot">
            Every add, withdrawal and fee collection the Reserve has made, priced at the moment it happened. Method in the{" "}
            <a href={ouroUrl("/docs/")} {...externalLinkProps(ouroUrl("/docs/"))}>
              docs ↗
            </a>
            .
          </div>
        </Card>
      </div>

      {/* The addresses live in the docs, on ourolayer.com, which is the one page that publishes every
          Ouro address. A second copy here was a second thing to keep right, and it is now a second
          thing on a second site. */}
      <div style={{ ...body14, marginTop: 40, maxWidth: 620 }}>
        <p style={{ margin: 0 }}>
          The Reserve wallet, the pools it is an LP in and the contracts behind them are published with every other Ouro address in the docs, each one linked
          to the explorer.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          <a href={ouroUrl("/docs/#d09")} {...externalLinkProps(ouroUrl("/docs/#d09"))}>
            Read the addresses on ourolayer.com ↗
          </a>
        </p>
      </div>

      <OuroFoot />
    </Container>
  );
}

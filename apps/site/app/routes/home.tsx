import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/home";
import { Badge, Button, Callout, Card, LedgerTable, Stat, type BadgeTone, type LedgerColumn } from "@ouro/ds";
import { AirdropCalc, Container, LoopPlate, MicroLabel, SectionHead, SplitBar, SplitRows, TokenIcon, body14, legRows, legWedges, mono } from "~/components/site";
import { FEE_SPLIT, FEE_SPLIT_LABEL, LINE_TOKENS, PROTOCOL_CONTRACTS, TAX_SPLIT, TOKEN_ICONS, TRADE_TAX_PCT, explorerAddressUrl, shortAddress } from "~/content/protocol";
import { analyticsUrl, externalLinkProps, site } from "~/content/site";
import { useClock } from "~/hooks/useClock";
import { pageMeta } from "~/lib/meta";
import {
  MONITOR_API,
  fmtDay,
  fmtFeeTier,
  fmtNum,
  fmtPctSigned,
  fmtUsd,
  fmtUsdSigned,
  useMonitor,
  type DailyRow,
  type OuroYield,
  type Reserve,
  type ReservePosition,
} from "@ouro/monitor-client";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    path: location.pathname,
    image: "/og/home.png",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: site.url, sameAs: [site.links.x] },
      { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, description: site.description },
    ],
  });
}

const OURO_ADDRESS = PROTOCOL_CONTRACTS[0]!.address!;

export default function Home() {
  return (
    <>
      <Hero />
      <LineBand />
      <LoopSection />
      <SplitSection />
      <ReserveSection />
      <DifferenceSection />
      <AirdropCalc />
      <RoadmapSection />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  const ouroUrl = explorerAddressUrl(OURO_ADDRESS);
  return (
    <Container className="hero">
      <div className="hero__grid">
        <div>
          <MicroLabel tone="accent">
            {site.chain.name} · {site.chain.id}
          </MicroLabel>
          <h1 className="hero-title" style={{ marginTop: 20 }}>
            {site.tagline}
          </h1>
          <p className="hero__lede">{site.description}</p>
          <div className="hero__ctas">
            <Button size="lg" arrow href={site.links.buy} {...externalLinkProps(site.links.buy)}>
              Buy {site.ticker}
            </Button>
            <Button size="lg" variant="secondary" arrow href={analyticsUrl("/ledger/")}>
              See the pools
            </Button>
          </div>
          <div className="hero__note">
            Every figure on this page is read from the chain.{" "}
            <a href={ouroUrl} {...externalLinkProps(ouroUrl)} className="mono-link">
              OURO {shortAddress(OURO_ADDRESS)} ↗
            </a>
          </div>
        </div>
        <HeroCard />
      </div>
    </Container>
  );
}

/** Every day's payouts summed: what the airdrop has paid all time, how many cycles, and when the first one was. */
function allTime(days: DailyRow[] | undefined) {
  if (!days) return null;
  let paid = 0;
  let priced = true;
  let cycles = 0;
  let firstDay: number | null = null;
  for (const d of days) {
    if (d.epochs === 0) continue;
    cycles += d.epochs;
    if (firstDay === null) firstDay = d.day;
    if (d.paid_usd === null) priced = false;
    else paid += d.paid_usd;
  }
  // The window reaches back past the first cycle only if it opens on a quiet day; otherwise the first
  // cycle may be older than the window and "since" would be wrong.
  const opensBeforeStart = days.length > 0 && days[0]!.epochs === 0;
  return { paidUsd: priced ? paid : null, cycles, since: opensBeforeStart && firstDay !== null ? fmtDay(firstDay) : null };
}

/**
 * The figures beside the headline, read from the chain through ouro-monitor: what the protocol owns
 * in liquidity, what it has paid holders, and what those payouts annualise to. A dash while a read is
 * in flight; the change over the day appears only once the window actually covers a day.
 *
 * The rate replaced the last cycle's amount here on 2026-09-15. One cycle's dollars answered "what
 * does a payout look like" and nothing a reader can act on: $309 means nothing without knowing whose
 * balance earned it. The rate is the figure this hero used to lead with, and every payout is still one
 * click away on the analytics site.
 */
function HeroCard() {
  const clock = useClock();
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve?hours=25" : null, 300_000);
  const daily = useMonitor<{ token: string; days: DailyRow[] }>(MONITOR_API ? "/v1/ouro/daily?days=366" : null, 300_000);
  // Same request and window the vaults page's rate comes from (hooks/usePrices.ts), so the two pages
  // cannot disagree about what a wallet above the line earns.
  const yields = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);

  const d = reserve.data;
  const t = d?.totals;
  // Every venue the Reserve holds liquidity in is in the monitor's own NAV now, v4 included, so the
  // headline and its 24 hour change come from one figure again.
  const monitorNav = t?.navUsd ?? null;
  const nav = monitorNav;
  const delta = (() => {
    const first = (d?.history ?? []).find((s) => s.nav_usd !== null && s.nav_usd > 0);
    // Withheld until the figure it qualifies is on screen: the monitor answers a second before the
    // chain read does, and a percentage change sitting next to a dash qualifies nothing.
    if (!d || !first || nav === null || monitorNav === null || first.nav_usd === null) return null;
    if ((d.generatedAt - first.ts) / 3600 < 20) return null;
    return (monitorNav - first.nav_usd) / first.nav_usd;
  })();
  const unvalued = (d?.unindexed ?? []).reduce((n, u) => n + (u.count ?? 0), 0);
  const all = allTime(daily.data?.days);

  /**
   * The rate, and the window it was measured over, which it never appears without.
   *
   * `caveat` comes from the monitor and MUST be shown whenever it is set: the same payouts annualise
   * to wildly different rates depending only on the basis, and that sentence names the history this
   * one actually rests on. When it is null the rate covers a full week, and the basis is stated in
   * the shortest form that is still a basis. A hero percentage is the most screenshot-able thing on
   * the site; it does not go out unqualified.
   */
  const rate = yields.data;
  const rateNote = !rate
    ? "From payouts actually made, at the rate of the last seven days."
    : rate.aprPct === null
      ? (rate.withheld ?? "Needs a payout and a price to measure")
      : (rate.caveat ??
        (rate.basisDays === null ? "From payouts actually made" : `${fmtNum(rate.basisDays, 0)}-day basis · ${fmtNum(rate.cycles)} cycles`));

  const positions = t?.positions ?? null;
  const navNote =
    positions === null
      ? "Marked to market, from the Reserve's positions"
      : `Marked to market · ${fmtNum(positions)} ${positions === 1 ? "position" : "positions"}${delta !== null ? " · past 24 hours" : ""}${
          unvalued > 0 ? ` · ${fmtNum(unvalued)} more in a venue the monitor does not read` : ""
        }`;

  return (
    <Card label="Read from the chain" action={<span style={{ ...mono, fontSize: 11, color: "var(--text-faint)" }}>{clock ? `Updated ${clock}` : ""}</span>} padding={28}>
      <Stat size="xl" label="Protocol-owned liquidity" value={fmtUsd(nav)} delta={delta === null ? null : fmtPctSigned(delta, 1)} footnote={navNote} />
      <div className="hero__pair">
        <Stat size="sm" label="Airdropped to holders" value={fmtUsd(all?.paidUsd)} footnote={all ? `${fmtNum(all.cycles)} cycles${all.since ? ` since ${all.since}` : ""}` : "Every cycle, valued when sent"} />
        <Stat size="sm" label="Airdrop rate, annualised" value={rate?.aprPct == null ? "—" : `${fmtNum(rate.aprPct, 0)}%`} footnote={rateNote} />
      </div>
      {/* Both of these are on the analytics site now. Same pages, same paths, another origin. */}
      <div className="hero__links">
        <a href={analyticsUrl("/ledger/")}>Open the ledger ↗</a>
        <a href={analyticsUrl("/airdrops/")}>Every payout ↗</a>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- The line, once */

function LineBand() {
  return (
    <div className="band">
      <Container className="band__inner">
        <div className="band__text">
          Hold <span style={{ ...mono, fontWeight: 600, color: "var(--text-primary)" }}>{fmtNum(LINE_TOKENS)}+</span> $OURO in your wallet and the airdrop
          lands every two hours. Nothing to stake or claim.
        </div>
        {/* The link is left unclassed so it takes the site's underlined link treatment; the wrapper
            carries the size and keeps it on one line, as the section heads do with their action. */}
        <div className="band__action">
          <Link to="/vaults/">Under the line? Pool in a vault →</Link>
        </div>
      </Container>
    </div>
  );
}

/* ------------------------------------------------------------- The split */

/**
 * The two bars the whole protocol runs on: what the 5% tax buys, and where a collection of pool fees
 * goes. The figures come from content/protocol, which the docs and the parameter table read too, so
 * the three places the site states them cannot drift apart.
 */
function SplitSection() {
  return (
    <Container id="split" className="home-section">
      <SectionHead
        kicker="The split"
        title="Where every trade goes."
        sub="Both are published. The tax a trade pays divides four ways. What the Reserve earns is not divided at all."
        action={<Link to="/docs/#d02">The method →</Link>}
      />
      <div className="cols-2">
        <div>
          <div className="split-block__head">
            <span className="split-block__figure">{TRADE_TAX_PCT}%</span>
            <span className="split-block__note">of every buy and sell, in ETH. Fixed in letscash&apos;s hook at launch, so nobody can change it.</span>
          </div>
          <SplitBar wedges={legWedges(TAX_SPLIT)} />
          <SplitRows rows={legRows(TAX_SPLIT)} />
        </div>
        <div>
          <div className="split-block__head">
            <span className="split-block__figure">{FEE_SPLIT_LABEL}</span>
            <span className="split-block__note">of every fee the Reserve collects, back into the positions that earned it, once a collection is worth taking.</span>
          </div>
          <SplitBar wedges={legWedges(FEE_SPLIT)} />
          <SplitRows rows={legRows(FEE_SPLIT)} />
        </div>
      </div>
    </Container>
  );
}

/* -------------------------------------------------------------- The loop */

const STEPS: { n: string; title: string; text: string }[] = [
  { n: "01", title: "Trade", text: "Every $OURO swap pays a 5% tax, in ETH." },
  { n: "02", title: "Buy", text: "3.3% buys liquidity in the chain's deepest pools. 1% buys tokens for holders." },
  { n: "03", title: "Own", text: "That liquidity is the Reserve. The protocol keeps it." },
  { n: "04", title: "Compound", text: "The Reserve earns swap fees. 100% goes back into compounding the LP." },
];

/** The same four, for the plate: it takes them as a prop so the figure and the list cannot disagree. */
const PLATE_STEPS = STEPS.map((s) => ({ n: s.n, title: s.title })) as [
  { n: string; title: string },
  { n: string; title: string },
  { n: string; title: string },
  { n: string; title: string },
];

function LoopSection() {
  return (
    <Container id="loop" className="home-section">
      <SectionHead kicker="The mechanism" title="One loop. Four steps." style={{ marginBottom: 40 }} />
      <div className="loop">
        <div className="loop__ring-wrap">
          <LoopPlate steps={PLATE_STEPS} />
        </div>
        <div>
          {STEPS.map((s) => (
            <div key={s.n} className="loop__step">
              <span className="row-index">{s.n}</span>
              <div>
                <div className="loop__step-title">{s.title}</div>
                <div className="loop__step-text">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

/* ----------------------------------------------------------- The Reserve */

const POOL_COLS: LedgerColumn[] = [
  { key: "pool", label: "Pool" },
  { key: "val", label: "Position value", align: "right", numeric: true, nowrap: true },
  { key: "fees", label: "Fees earned", align: "right", numeric: true, nowrap: true },
  { key: "net", label: "Net vs holding", align: "right", numeric: true, nowrap: true },
  { key: "range", label: "Range", align: "right", nowrap: true },
];

function rangeBadge(p: ReservePosition): { tone: BadgeTone; label: string } {
  if (!p.held) return { tone: "neutral", label: "No longer held" };
  if (p.inRange === null) return { tone: "neutral", label: "Not polled yet" };
  return p.inRange ? { tone: "positive", label: "In range" } : { tone: "caution", label: "Out of range" };
}

function poolRow(p: ReservePosition) {
  // The basket token first, the ether leg second, whatever order the pool sorts them in. A v4 pool
  // names native ether `ETH` rather than `WETH`, and matching only the latter put one row in the
  // table the other way round from the rest.
  const [tok, quote] = p.side0.symbol === "WETH" || p.side0.symbol === "ETH" ? [p.side1, p.side0] : [p.side0, p.side1];
  const sym = tok.symbol ?? "?";
  const fees = p.uncollectedFeesUsd === null || p.collectedFeesUsd === null ? null : p.uncollectedFeesUsd + p.collectedFeesUsd;
  const net = p.netVsHoldingUsd;
  const pct = net === null || p.hodlUsd === null || p.hodlUsd <= 0 ? null : net / p.hodlUsd;
  const badge = rangeBadge(p);
  return {
    pool: (
      <span className="pair-cell">
        <TokenIcon symbol={sym} src={TOKEN_ICONS[sym]} size={20} />
        <span className="pair-cell__name">
          {sym} / {quote.symbol ?? "?"}
        </span>
        <span className="pair-cell__sub">{fmtFeeTier(p.feeBps)}</span>
      </span>
    ),
    val: <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtUsd(p.valueUsd)}</span>,
    fees: <span style={{ fontSize: 13 }}>{fmtUsd(fees)}</span>,
    net: (
      <span style={{ fontSize: 13, fontWeight: 600, color: net === null ? "var(--text-faint)" : net < 0 ? "var(--text-negative)" : "var(--text-positive)" }}>
        {fmtUsdSigned(net)}
        {pct === null ? "" : ` · ${fmtPctSigned(pct)}`}
      </span>
    ),
    range: (
      <Badge tone={badge.tone} dot>
        {badge.label}
      </Badge>
    ),
  };
}

function ReserveSection() {
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve?hours=1" : null, 120_000);
  const d = reserve.data;
  const held = (d?.positions ?? []).filter((p) => p.held);
  const rows = held.map(poolRow);
  let empty: ReactNode = null;
  if (!MONITOR_API) empty = "The monitor's origin is not set for this build, so the positions cannot be read.";
  else if (!d && reserve.error) empty = "The monitor did not answer. The positions appear as soon as it does.";
  else if (!d) empty = "Reading the chain…";
  else if (d.indexedTo === null) empty = "The monitor is still reading the Reserve's history.";
  else if (rows.length === 0) empty = "No positions held yet.";

  return (
    <Container id="reserve" className="home-section">
      <SectionHead
        kicker="The Reserve"
        title="CASHCAT, PONS and microduck."
        sub="Protocol-owned positions in the chain's deepest pools. Never handed out."
        action={<a href={analyticsUrl("/ledger/")}>Full ledger ↗</a>}
      />
      <div className="table-scroll">
        <LedgerTable columns={POOL_COLS} rows={rows} />
      </div>
      {empty && <div style={{ ...body14, fontStyle: "italic", padding: "12px 0" }}>{empty}</div>}
      <div className="cols-2 cols-2--tight" style={{ marginTop: 24 }}>
        <div style={body14}>
          Each name is capped at 20–25% of the treasury, building toward five. The microduck position is in a Uniswap v4 pool, which reports none of the token
          amounts the others do, so its cost basis and its fee income are rebuilt from the pool's own storage. Every row here is read the same way and means the
          same thing. Adds and retirements happen by public governance, on-chain.
        </div>
        <Callout tone="caution" title="The pools can lose value">
          Constituents are volatile tokens, not stocks, and any of them can fail. Owned liquidity can lose to simply holding. Nothing here is a promise of
          returns.
        </Callout>
      </div>
    </Container>
  );
}

/* --------------------------------------------------------- The difference */

const CMP_HEAD: { label: string; sym: string | null; ouro?: boolean }[] = [
  { label: "HOOD10", sym: "HOOD10" },
  { label: "The Index", sym: "INDEX" },
  { label: "Ouro", sym: "OURO", ouro: true },
];

const CMP_ROWS: [string, string, string, string][] = [
  ["What the tax buys", "All handed out", "All handed out", "1% out, 3.3% kept as LP"],
  ["What the protocol keeps", "Nothing", "Nothing", "The Reserve, for good"],
  ["When volume cools", "Payouts stop", "Payouts stop", "Payouts thin, the Reserve keeps earning"],
];

function DifferenceSection() {
  return (
    <Container id="difference" className="home-section">
      <SectionHead kicker="The difference" title="They spend the tax. Ouro keeps most of it working." />
      <div className="cmp">
        <div className="cmp-head cmp-head--blank" aria-hidden="true" />
        {CMP_HEAD.map((h) => (
          <div key={h.label} className={h.ouro ? "cmp-head cmp-head--ouro" : "cmp-head"}>
            {h.sym && <TokenIcon symbol={h.sym} src={TOKEN_ICONS[h.sym]} size={20} />}
            <span>{h.label}</span>
          </div>
        ))}
        {CMP_ROWS.map(([label, a, b, ouro]) => (
          <div key={label} className="cmp-row">
            <div className="cmp-cell cmp-cell--label">{label}</div>
            <div className="cmp-cell" data-col="HOOD10">
              {a}
            </div>
            <div className="cmp-cell" data-col="The Index">
              {b}
            </div>
            <div className="cmp-cell cmp-cell--ouro" data-col="Ouro">
              {ouro}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
        Yield varies with markets and is never guaranteed. Method in the <Link to="/docs/">docs</Link>.
      </div>
    </Container>
  );
}

/* ---------------------------------------------------------------- Roadmap */

/**
 * What is being built next, in the order it is being built. Three items and no dates: a roadmap is
 * the one part of a site like this that cannot be read off the chain, so it says the least it can.
 */
const ROADMAP: { n: string; horizon: string; title: string; body: ReactNode }[] = [
  {
    n: "01",
    horizon: "Live",
    title: "The vaults",
    body: (
      <>
        Pool under the line and still get paid, in OURO, ETH or dollars. <Link to="/vaults/">Open the vaults →</Link>
      </>
    ),
  },
  {
    n: "02",
    horizon: "Medium term",
    title: "Build the Reserve up",
    body: "Keep buying protocol-owned liquidity with every trade. Deeper positions earn more fees, and all of those fees go straight back into them.",
  },
  {
    n: "03",
    horizon: "Long term",
    title: "Our own DEX",
    body: "Run the venue rather than trade on someone else's, so the protocol earns the DEX revenue instead of paying it away. That revenue buys $OURO back and burns it.",
  },
];

function RoadmapSection() {
  return (
    <Container id="roadmap" className="home-section">
      <SectionHead kicker="Roadmap" title="Three things, in order." sub="No dates." style={{ marginBottom: 24 }} />
      <div>
        {ROADMAP.map((r) => (
          <div key={r.n} className="road">
            <span className="row-index">{r.n}</span>
            <span className="road__horizon">{r.horizon}</span>
            <div className="road__body">
              <div className="road__title">{r.title}</div>
              <div className="road__text">{r.body}</div>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}

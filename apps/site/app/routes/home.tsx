import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/home";
import { Badge, Button, Callout, Card, Stat } from "@ouro/ds";
import { AprHeadline, AirdropCalc, Container, CrankFeed, Grid, HelpTip, HeroRing, KVRow, LoopRing, MicroLabel, NumberedRow, SectionHead, body14, display, hairline, PayoutCadence } from "~/components/site";
import { site } from "~/content/site";
import { TERMS } from "~/content/vaults";
import { pageMeta } from "~/lib/meta";

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

export default function Home() {
  return (
    <>
      <Hero />
      <ProofBand />
      <WhatYouDoSection />
      <LoopSection />
      <DifferenceSection />
      <BasketSection />
      <YieldSection />
      <AirdropCalc />
      <LiveProofSection />
      <RoadmapSection />
      <LockSection />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

/** Second beat of the tagline on its own line, in bronze italic; falls back to plain text if the copy changes. */
function Tagline() {
  const em = "Get paid.";
  const i = site.tagline.indexOf(em);
  if (i < 0) return <>{site.tagline}</>;
  return (
    <>
      {site.tagline.slice(0, i)}
      <br />
      <em className="hero-em">{em}</em>
    </>
  );
}

function Hero() {
  return (
    <div className="hero">
      <Container style={{ paddingTop: 72, paddingBottom: 80 }}>
        <Grid cols="1.05fr 0.95fr" gap={64} align="center">
          <div>
            <MicroLabel tone="accent" className="hero-in">
              {site.chain.name}
            </MicroLabel>
            <h1 className="hero-title hero-in" style={{ margin: "20px 0 0" }}>
              <Tagline />
            </h1>
            <p className="hero-in" style={{ margin: "22px 0 0", fontSize: 17, lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 460 }}>
              Hold 100,000+ $OURO and airdrops land in your wallet. No stake. No claim. Holding less? Pool with others so you still get paid.
            </p>
            <p className="hero-in" style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 460 }}>
              Every trade pays a 5% tax: 2% airdropped to holders, 2% into LP the protocol keeps so those pools pay you again, 0.7% ops, 0.3% the
              letscash platform.
            </p>
            <AprHeadline />
            <div className="cta-row hero-in" style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Button size="lg" arrow href={site.links.buy} target="_blank" rel="noreferrer">
                Buy {site.ticker}
              </Button>
              <Button size="lg" variant="secondary" href="#calc">
                Calculate your airdrop
              </Button>
              <Button size="lg" variant="ghost" href="#start">
                How it works
              </Button>
            </div>
            <div className="hero-in" style={{ marginTop: 24, maxWidth: 420 }}>
              <PayoutCadence />
            </div>
          </div>

          {/* The ouroboros itself: a bronze ring turning, the four steps of the loop riding it. Drag to turn. */}
          <HeroRing />
        </Grid>
      </Container>
    </div>
  );
}

/* ------------------------------------------------------------ Proof band */

function ProofBand() {
  return (
    <div style={{ borderTop: hairline, borderBottom: hairline, background: "var(--surface-tint)" }}>
      <Container style={{ paddingTop: 32, paddingBottom: 32 }}>
        <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md">
          <Stat label="Trade tax" value="5%" footnote="In ETH, every buy and sell" />
          <Stat className="cell-rule" label="Tax split" value="2 / 2 / 0.7" footnote="Airdrop · LP · ops (+0.3% launchpad)" />
          <Stat className="cell-rule" label="LP fee split" value="80 / 20" footnote="To holders · back into LP" />
          <Stat className="cell-rule" label="Supply" value="1,000,000,000" unit="OURO" />
        </Grid>
      </Container>
    </div>
  );
}

/* ---------------------------------------------------------- What you do */

function WhatYouDoSection() {
  return (
    <Container id="start" style={{ paddingTop: 96 }}>
      <SectionHead kicker="Start here" title="Three moves." sub="That is the whole product." />
      <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
        <div>
          <MicroLabel>01</MicroLabel>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Buy $OURO</div>
          <div style={{ ...body14, marginTop: 6 }}>
            <a href={site.links.buy} target="_blank" rel="noreferrer" style={{ color: "var(--text-accent)" }}>
              On letscash →
            </a>
          </div>
        </div>
        <div className="cell-rule">
          <MicroLabel>02</MicroLabel>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Hold 100,000+ $OURO</div>
          <div style={{ ...body14, marginTop: 6 }}>
            Or{" "}
            <Link to="/vaults/" style={{ color: "var(--text-accent)" }}>
              pool with others
            </Link>{" "}
            if you hold less.
          </div>
        </div>
        <div className="cell-rule">
          <MicroLabel>03</MicroLabel>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Get paid</div>
          <div style={{ ...body14, marginTop: 6 }}>Tokens land in your wallet. Nothing to claim.</div>
        </div>
      </Grid>
    </Container>
  );
}

/* -------------------------------------------------------------- The Loop */

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <NumberedRow n={n} py={18}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      <div style={{ ...body14, marginTop: 4, maxWidth: 440 }}>{children}</div>
    </NumberedRow>
  );
}

function LoopSection() {
  return (
    <Container id="loop" style={{ paddingTop: 96 }}>
      <SectionHead kicker="The mechanism" title="Where the money goes." sub="One loop. Four steps." />
      <Grid cols="1fr 1.1fr" gap={72} align="center">
        <LoopRing />
        <div>
          <Step n="01" title="Trade">
            Every ETH/OURO swap pays a 5% tax in ETH into the treasury.
          </Step>
          <Step n="02" title="Buy">
            That tax buys chain tokens: 2% of the trade airdropped to holders, 2% kept as LP. The last 1% covers ops and the launchpad.
          </Step>
          <Step n="03" title="Own">
            The kept 2% becomes LP the protocol owns forever (the Reserve). Never handed out.
          </Step>
          <Step n="04" title="Yield">
            Those pools earn fees. Each cycle: 80% airdropped to holders, 20% back into the Reserve.
          </Step>
        </div>
      </Grid>
    </Container>
  );
}

/* --------------------------------------------------------- The difference */

interface CompareRow {
  label: string;
  tip: string;
  tipPlacement?: "below" | "above";
  hood10: ReactNode;
  index: ReactNode;
  ouro: ReactNode;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "What the tax buys",
    tip: "Others hand out every tax point. Ouro airdrops 2% of a trade and keeps another 2% as fee-earning LP.",
    hood10: "All handed out",
    index: "All handed out",
    ouro: "2% out, 2% kept as LP",
  },
  {
    label: "Liquidity the protocol owns",
    tip: "LP bought with tax and held by the treasury. Airdrop-only models build none.",
    hood10: "None",
    index: "None",
    ouro: "Kept forever, earns fees",
  },
  {
    label: "Holders are paid from",
    tip: "Others: tax only. Ouro: tax plus fees from owned pools.",
    hood10: "The tax",
    index: "The tax",
    ouro: "Tax + pool fees",
  },
  {
    label: "Parallel pools",
    tip: "Untaxed volume. Measured 26–28 Aug 2026. Ouro sealed 16 venues at deploy.",
    hood10: "~36% volume taxed",
    index: "~6% volume taxed",
    ouro: "16 venues sealed",
  },
  {
    label: "When volume cools",
    tip: "Tax payouts shrink with volume. Owned pools can keep earning. Yield never guaranteed.",
    tipPlacement: "above",
    hood10: "Payouts stop",
    index: "Payouts stop",
    ouro: "Pools keep earning",
  },
];

function DifferenceSection() {
  return (
    <Container id="difference" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="The difference"
        title="They spend the tax. We keep half working."
        sub="We pay you from the tax, then keep equal LP that pays you again."
      />
      {/* Desktop: a 4-column grid. ≤860px: each row becomes a block: the label as a heading, then the
          three values stacked with their column name (from data-col), Ouro's highlighted. See site.css → "Comparison table". */}
      <div className="cmp">
        <div className="cmp-grid">
          <div className="cmp-head" aria-hidden="true" />
          <div className="cmp-head">HOOD10</div>
          <div className="cmp-head">The Index</div>
          <div className="cmp-head cmp-head--ouro">
            <span className="cmp-wordmark">Ouro</span>
            <Badge tone="accent">Owns the pools</Badge>
          </div>
          {COMPARE_ROWS.map((r) => (
            <div key={r.label} className="cmp-row">
              <div className="cmp-label">
                <span className="cmp-label__text">{r.label}</span>
                <HelpTip placement={r.tipPlacement}>{r.tip}</HelpTip>
              </div>
              <div className="cmp-cell" data-col="HOOD10">
                {r.hood10}
              </div>
              <div className="cmp-cell" data-col="The Index">
                {r.index}
              </div>
              <div className="cmp-cell cmp-cell--ouro" data-col="Ouro">
                {r.ouro}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
        Onchain, 26–28 Aug 2026. Method in the <Link to="/docs/">docs</Link>.
      </div>
    </Container>
  );
}

/* -------------------------------------------------------------- The pools */

const RULES: { n: string; lead: string; text: string }[] = [
  { n: "01", lead: "Bluechip and liquid.", text: " Deepest high-turnover pools on the chain." },
  { n: "02", lead: "Capped.", text: " Max 20–25% of treasury per name." },
  { n: "03", lead: "Wherever the liquidity is.", text: " Uniswap v3 or v4, depending on the token." },
  { n: "04", lead: "Governed in public.", text: " Adds or retires only by onchain governance." },
];

function BasketSection() {
  return (
    <Container id="basket" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="The pools"
        title="It starts with CASHCAT and PONS."
        sub="The Reserve is protocol-owned LP in deep markets. Never handed out."
      />
      <Grid cols="1.1fr 0.9fr" gap={64} align="start">
        <div>
          {RULES.map((r, i) => (
            <NumberedRow key={r.n} n={r.n} py={16} borderBottom={i === RULES.length - 1}>
              <div style={body14}>
                <strong style={{ color: "var(--text-primary)" }}>{r.lead}</strong>
                {r.text}
              </div>
            </NumberedRow>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Callout title="What these pools earn">
            Swap fees: 80% airdropped to holders, 20% compounds back into LP. That second leg can keep paying when volume cools.{" "}
            <Link to="/docs/#d07">Compounding</Link>.
          </Callout>
        </div>
      </Grid>
    </Container>
  );
}

/* ------------------------------------------------------------- Real yield */

function YieldSection() {
  const col = (label: string, text: string, rule: boolean) => (
    <div className={rule ? "cell-rule" : undefined}>
      <MicroLabel>{label}</MicroLabel>
      <div style={{ ...body14, marginTop: 8 }}>{text}</div>
    </div>
  );
  return (
    <Container id="yield" style={{ paddingTop: 96 }}>
      <SectionHead kicker="Real yield" title="Two paychecks. One wallet." sub="Nothing to stake or claim." />
      <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
        {col("Hold", "≥ 100,000 $OURO in your wallet. Or pool with others if you hold less.", false)}
        {col("Tax leg", "Part of each trade's 5% tax buys tokens and sends them to you. Tracks volume.", true)}
        {col("Pool leg", "80% of fees from protocol-owned LP. The other 20% compounds.", true)}
      </Grid>
      <div style={{ marginTop: 28, display: "flex", gap: 24, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Button variant="secondary" arrow to="/docs/#d05">
          How the airdrop works
        </Button>
      </div>
    </Container>
  );
}

/* ------------------------------------------------------------- Live proof */

function LiveProofSection() {
  return (
    <Container id="proof" style={{ paddingTop: 96 }}>
      <SectionHead kicker="Live proof" title="Recent payouts." sub="Onchain. Newest first. If the site and chain disagree, the chain is right." />
      <CrankFeed footer="Each payment links to its transaction on the airdrops page." />
    </Container>
  );
}

/* ---------------------------------------------------------------- Roadmap */

/**
 * What is being built next, in the order it is being built.
 *
 * Deliberately three items and no dates. A roadmap is the one part of a site like this that cannot
 * be read off the chain, so it says the least it can get away with: what the work is, why it is
 * worth doing, and which of them is nearest. Anything more specific would be a promise the
 * contracts cannot keep, on a page whose whole argument is that they can.
 */
const ROADMAP: { n: string; horizon: string; title: string; body: ReactNode }[] = [
  {
    n: "01",
    horizon: "Live",
    title: "The vaults",
    body: (
      <>
        Holding under 100,000 $OURO? Pool with others and still earn. {TERMS.performanceFeePct}% of profit (
        {TERMS.feeSplit.airdrops}/{TERMS.feeSplit.ops} airdrops/ops). Paid in OURO, WETH, or USDG.{" "}
        <Link to="/vaults/">Open vaults</Link>.
      </>
    ),
  },
  {
    n: "02",
    horizon: "Medium term",
    title: "Own the trading rails",
    body: (
      <>
        Leave letscash so less of each trade leaks to the launchpad or untaxed pools. <Link to="/docs/">Docs</Link>.
      </>
    ),
  },
  {
    n: "03",
    horizon: "Long term",
    title: "Multichain",
    body: <>Same machine on other chains. One holder base, not a new token each time.</>,
  },
];

function RoadmapSection() {
  return (
    <Container id="roadmap" style={{ paddingTop: 96 }}>
      <SectionHead kicker="Roadmap" title="Three things, in order." sub="Not a schedule. No dates." />
      <div>
        {ROADMAP.map((r, i) => (
          <NumberedRow key={r.n} n={r.n} py={20} borderBottom={i === ROADMAP.length - 1}>
            <MicroLabel className="roadmap-horizon" style={{ whiteSpace: "nowrap" }}>
              {r.horizon}
            </MicroLabel>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</div>
            <div style={{ ...body14, marginTop: 6, maxWidth: 620 }}>{r.body}</div>
          </NumberedRow>
        ))}
      </div>
    </Container>
  );
}

/* --------------------------------------------------------------- The lock */

function LockSection() {
  return (
    <Container id="lock" style={{ paddingTop: 96 }}>
      <Card tone="inverse" padding={0}>
        <Grid cols="1.1fr 0.9fr" gap={64} className="lock-grid">
          <div>
            <Badge tone="accent">What the contract fixes</Badge>
            <h2 style={{ margin: "20px 0 0", ...display, fontSize: 34, lineHeight: 1.15, color: "#FFFFFF" }}>Fixed supply. Public rules.</h2>
            <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.65, color: "var(--text-inverse-muted)", maxWidth: 440 }}>
              No mint function. Tax changes only by public governance. Your wallet can never be blocked.
            </p>
            <div style={{ marginTop: 28 }}>
              <Button variant="inverse" arrow to="/docs/#d08">
                Read the parameters
              </Button>
            </div>
          </div>
          <div style={{ alignSelf: "center" }}>
            <KVRow inverse py={13} border="top" label="Total supply" value="Fixed · no mint" />
            <KVRow inverse py={13} border="top" label="Trade tax" value="5% · in ETH" />
            <KVRow inverse py={13} border="top" label="Your wallet" value="Never blockable" />
            <KVRow inverse py={13} border="top" label="Every fee cycle" value="80% to holders" />
          </div>
        </Grid>
      </Card>
    </Container>
  );
}

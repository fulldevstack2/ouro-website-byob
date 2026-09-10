import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/home";
import { Badge, Button, Callout, Card, Stat } from "~/components/ds";
import { AprHeadline, Container, CrankFeed, Grid, HelpTip, HeroRing, KVRow, LoopRing, MicroLabel, NumberedRow, SectionHead, body14, display, hairline, PayoutCadence } from "~/components/site";
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
      <LiveProofSection />
      <RoadmapSection />
      <LockSection />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

/** Second beat of the tagline in bronze italic; falls back to plain text if the copy changes. */
function Tagline() {
  const em = "Get paid.";
  const i = site.tagline.indexOf(em);
  if (i < 0) return <>{site.tagline}</>;
  return (
    <>
      {site.tagline.slice(0, i)}
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
            <p className="hero-in" style={{ margin: "22px 0 0", fontSize: 17, lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 440 }}>
              Hold 100,000+ $OURO and airdrops land in your wallet. No stake. No claim. Holding less? Pool with others so you still get paid.
            </p>
            <p className="hero-in" style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 440 }}>
              How: every trade pays a 5% tax. Half goes to holders. Half buys LP the protocol keeps, and those pools pay you again.
            </p>
            <AprHeadline />
            <div className="cta-row hero-in" style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Button size="lg" arrow href={site.links.buy} target="_blank" rel="noreferrer">
                Buy {site.ticker}
              </Button>
              <Button size="lg" variant="secondary" href="#start">
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
          <Stat label="Trade tax" value="5%" footnote="Charged in ETH on every buy and sell" />
          <Stat className="cell-rule" label="Tax split" value="2 / 2 / 0.7" footnote="Airdrop · LP kept · ops · plus 0.3% launchpad" />
          <Stat className="cell-rule" label="LP fee split" value="80 / 20" footnote="Airdropped to holders · compounded into LP" />
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
      <SectionHead kicker="Start here" title="Three moves." sub="That is the whole product. Detail is below." />
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
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Hold 100,000+</div>
          <div style={{ ...body14, marginTop: 6 }}>
            Or{" "}
            <Link to="/vaults/" style={{ color: "var(--text-accent)" }}>
              deposit with others
            </Link>{" "}
            so small holdings still earn.
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
            Every ETH/OURO swap pays a 5% tax (in ETH) into the treasury.
          </Step>
          <Step n="02" title="Buy">
            Most of that tax buys strong chain tokens: half for the airdrop, half kept as LP. A slice covers ops and the launchpad.
          </Step>
          <Step n="03" title="Own">
            Kept half becomes LP (liquidity in trading pools) the protocol owns forever. That is the Reserve.
          </Step>
          <Step n="04" title="Yield">
            Those pools earn fees. Each cycle: 80% airdropped to holders, 20% back into the Reserve. Loop repeats.
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
    tip: "Competitors hand out every tax point the same epoch. Ouro hands out half and keeps half as fee-earning LP it owns.",
    hood10: "All of it handed out. Nothing kept",
    index: "All of it handed out. Nothing kept",
    ouro: "Half handed out, half kept as liquidity",
  },
  {
    label: "Liquidity the protocol owns",
    tip: "LP bought with the tax and held by the treasury. Airdrop-only models build none. Ouro puts two points of every trade into positions it keeps.",
    hood10: "No treasury liquidity",
    index: "No treasury liquidity",
    ouro: "kept forever, generating fees",
  },
  {
    label: "Holders are paid from",
    tip: "Competitors pay only from the tax, so payouts track volume and stop with it. Ouro also pays from fees its own pools earn, which can grow across cycles.",
    hood10: "The tax itself",
    index: "The tax itself",
    ouro: "The tax, plus the fees the pools earn",
  },
  {
    label: "Parallel pools",
    tip: "Volume that never hits the taxed pool. Measured onchain 26–28 Aug 2026: competitors taxed ~6% to ~36% of their own volume. Ouro sealed 16 venues at deploy.",
    hood10: "Only ~36% of volume taxed",
    index: "Only ~6% of volume taxed",
    ouro: "16 venues sealed at deploy",
  },
  {
    label: "When volume cools",
    tip: "Tax-funded payouts shrink with volume. Ouro's tax leg does too, but pools already owned keep earning fees on past buys. Yield is never guaranteed.",
    tipPlacement: "above",
    hood10: "Payouts stop",
    index: "Payouts stop",
    ouro: "The pools keep earning",
  },
];

function DifferenceSection() {
  return (
    <Container id="difference" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="The difference"
        title="They spend the tax. We keep half working."
        sub="Others hand out every tax point. We pay you, then keep equal LP that pays you again."
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
        Measured on Robinhood Chain from events and state, 26 to 28 Aug 2026, not from the projects&apos; marketing. The Ouro column is the shipped design;
        method is in the <Link to="/docs/">docs</Link>.
      </div>
    </Container>
  );
}

/* -------------------------------------------------------------- The pools */

const RULES: { n: string; lead: string; text: string }[] = [
  { n: "R1", lead: "Bluechip and liquid.", text: " High-turnover tokens with the deepest pool on the chain." },
  { n: "R2", lead: "Capped.", text: " Each name is at most 20% to 25% of the treasury, and Ouro never becomes an outsized share of any single pool." },
  { n: "R3", lead: "Venue agnostic.", text: " LP'd where each token's real liquidity is: Uniswap v3 for most, v4 for others." },
  { n: "R4", lead: "Governed in public.", text: " Add, retire, or reweight only by governance. Every change is an onchain transaction." },
];

function BasketSection() {
  return (
    <Container id="basket" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="The pools"
        title="It starts with CASHCAT and PONS."
        sub="The Reserve = protocol-owned LP in deep markets. Never handed out. Rules below."
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
            Swap fees → 80% airdropped to holders (in the assets earned), 20% compounds back into LP. That second leg can keep paying when volume cools.{" "}
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
      <SectionHead kicker="Real yield" title="Two paychecks. One wallet." sub="Nothing to stake, lock, or claim." />
      <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
        {col("Hold", "≥ 100,000 $OURO in your own wallet (0.01% of supply). Or use a vault under that line.", false)}
        {col("Tax leg", "Part of each trade's 5% tax buys tokens and sends them to you. Tracks volume.", true)}
        {col("Pool leg", "80% of fees from protocol-owned LP, in the tokens those pools earned. 20% compounds.", true)}
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
      <SectionHead kicker="Live proof" title="Recent payouts." sub="Onchain. Newest first. Chain wins if anything disagrees." />
      <CrankFeed footer="Every payment links to its transaction on the airdrops page. If a number on this site ever disagrees with the chain, the chain is right." />
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
        Under 100,000 $OURO? Deposit with others and still earn. {TERMS.performanceFeePct}% of harvest gain (
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
        Move off letscash so less of each trade leaks to the launchpad or untaxed parallel pools.{" "}
        <Link to="/docs/">Docs</Link>.
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
              Fixed supply. No mint. Tax changes only by public governance. Your wallet cannot be blocked.
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

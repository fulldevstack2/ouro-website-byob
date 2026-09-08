import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/home";
import { Badge, Button, Callout, Card, Stat } from "~/components/ds";
import { AprHeadline, Container, CrankFeed, Grid, HelpTip, HeroRing, KVRow, LoopRing, MicroLabel, NumberedRow, SectionHead, body14, display, hairline, PayoutCadence } from "~/components/site";
import { site } from "~/content/site";
import { pageMeta } from "~/lib/meta";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `${site.name} · ${site.tagline}`,
    description: "A 5% tax on every $OURO trade: 2% airdropped to holders, 2% buying pools the protocol keeps, 1% ops. 80% of the fees those pools earn is airdropped to holders too.",
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

/** The tagline with its operative phrase set in bronze italic; falls back to plain text if the copy changes. */
function Tagline() {
  const em = "fee generating layer";
  const i = site.tagline.indexOf(em);
  if (i < 0) return <>{site.tagline}</>;
  return (
    <>
      {site.tagline.slice(0, i)}
      <em className="hero-em">{em}</em>
      {site.tagline.slice(i + em.length)}
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
              Protocol owned liquidity · {site.chain.name}
            </MicroLabel>
            <h1 className="hero-title hero-in" style={{ margin: "20px 0 0" }}>
              <Tagline />
            </h1>
            <p className="hero-in" style={{ margin: "22px 0 0", fontSize: 17, lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 480 }}>
              Every $OURO trade pays a 5% tax. Two of those five points are airdropped to you from the first trade. Two more buy pools the protocol keeps,
              and 80% of the fees they earn is airdropped too.
            </p>
            <AprHeadline />
            <div className="cta-row hero-in" style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Button size="lg" arrow href={site.links.buy} target="_blank" rel="noreferrer">
                Buy {site.ticker}
              </Button>
              <Button size="lg" variant="secondary" to="/docs/">
                Read the docs
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
          <Stat label="Trade tax" value="5%" footnote="Charged in ETH on every buy and every sell" />
          <Stat className="cell-rule" label="Tax split" value="2 / 2 / 0.7" footnote="Airdrop · LP · ops · 0.3 letscash" />
          <Stat className="cell-rule" label="LP Fee split" value="80 / 20" footnote="Airdrop holders · Compound LP" />
          <Stat className="cell-rule" label="Supply" value="1,000,000,000" unit="OURO"  />
        </Grid>
      </Container>
    </div>
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
      <SectionHead kicker="The mechanism" title="One loop, four steps." />
      <Grid cols="1fr 1.1fr" gap={72} align="center">
        <LoopRing />
        <div>
          <Step n="01" title="Trade">
            Every swap on the ETH/OURO pool pays a 5% tax, taken from the ETH leg. It never reaches a person. It flows to the protocol
            treasury.
          </Step>
          <Step n="02" title="Buy">
            Four of those five points buy the strongest tokens on Robinhood Chain at market: two to airdrop to holders, two to keep as liquidity. The rest
            covers ops, less the launchpad's 0.3% platform fee. What the treasury buys is public the moment it happens.
          </Step>
          <Step n="03" title="Own">
            The half it keeps is paired into full range liquidity the protocol owns and never hands out. Pool by pool,
            that is the layer.
          </Step>
          <Step n="04" title="Yield">
            The pools earn a fee on every swap that crosses them, in both of the tokens they hold. Each cycle sends 80% of those fees to holders exactly as
            earned, and puts the other 20% back into the Reserve. Then the loop repeats, on bigger pools.
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
    tip: "What happens to the tokens the tax buys. Both competitors hand out every point of their tax, so nothing is left the following epoch. Ouro hands out half and keeps the other half as fee earning liquidity the protocol owns.",
    hood10: "All of it handed out. Nothing kept",
    index: "All of it handed out. Nothing kept",
    ouro: "Half handed out, half kept as liquidity",
  },
  {
    label: "Liquidity the protocol owns",
    tip: "Liquidity bought with the tax and held by the protocol's own treasury. Airdrop models build none: what the tax buys is handed out the same epoch. Ouro puts two points of every trade into positions it keeps, and they compound.",
    hood10: "No treasury liquidity",
    index: "No treasury liquidity",
    ouro: "kept forever, generating fees",
  },
  {
    label: "Holders are paid from",
    tip: "Where holder payouts come from. Both competitors pay only from the tax, so the payout tracks volume one to one and stops with it. Ouro pays from the tax as well, but a second leg pays from the fees its own pools earn, and that leg grows with every cycle instead of tracking the day's volume.",
    hood10: "The tax itself",
    index: "The tax itself",
    ouro: "The tax, plus the fees the pools earn",
  },
  {
    label: "Parallel pools",
    tip: "Volume that never reaches the taxed pool. Measured onchain 26 to 28 Aug 2026, competitors captured only 6% to 36% of their own volume. Ouro seals the known venues in the launch transaction itself, before any of their pools exist.",
    hood10: "Only ~36% of volume taxed",
    index: "Only ~6% of volume taxed",
    ouro: "16 venues sealed at deploy",
  },
  {
    label: "When volume cools",
    tip: "Tax funded payouts track volume: The Index peaked at ~156 ETH/day and now pays ≈ 1 to 2 ETH/day. Ouro's tax leg shrinks with volume in exactly the same way, but the pools it kept go on earning fees on everything bought so far. Yield varies and is never guaranteed.",
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
        title="They spend the tax. We keep half of it working."
        sub="HOOD10 and The Index hand out every point of their tax, so nothing is left when trading cools. Ouro pays you from the tax too, then keeps an equal share as pools it owns for good. Those pools pay you a second time, and they outlive any one trading run."
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
        Measured on Robinhood Chain from events and state, 26 to 28 Aug 2026, not from the projects' marketing. The Ouro column describes the shipped design.
        It becomes verifiable onchain. Method is in the <Link to="/docs/">docs</Link>.
      </div>
    </Container>
  );
}

/* -------------------------------------------------------------- The pools */

const RULES: { n: string; lead: string; text: string }[] = [
  { n: "R1", lead: "Bluechip and liquid.", text: " Proven, high turnover tokens with the deepest pool on the chain. Depth and staying power, not narrative." },
  { n: "R2", lead: "Capped.", text: " Each constituent holds 20% to 25% of the treasury at most, and Ouro never becomes an outsized share of any single pool." },
  { n: "R3", lead: "Venue agnostic.", text: " LP'd where each token's real liquidity is: Uniswap v3 for most names, v4 for others." },
  { n: "R4", lead: "Governed in public.", text: " Add, retire, or reweight only by governance, and every change is an onchain transaction anyone can read." },
];

function BasketSection() {
  return (
    <Container id="basket" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="The pools"
        title="It starts with CASHCAT and PONS."
        sub="The Reserve is full range liquidity the protocol owns in the chain's strongest tokens: never loose tokens, never handed out. It opens with two of the deepest and most heavily traded markets on Robinhood Chain, and widens toward five as the treasury grows enough for a fifth position to be worth holding. The rules below decide what goes in, and every change is a governance action anyone can read."
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
            Every swap that crosses a position pays a fee, in both of the tokens that position holds. Each cycle 80% of it is airdropped to holders in the assets it was
            earned in, nothing sold. The other 20% is added back into the same positions, so the next cycle earns on a slightly larger share. That is the leg
            that keeps paying when trading cools.{" "}
            <Link to="/docs/#d07">How compounding works</Link>.
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
      <SectionHead
        kicker="Real yield"
        title="Hold $OURO. Two things pay you."
        sub="Nothing to stake, nothing to lock, nothing to claim. Hold the token in your own wallet and each cycle's airdrop arrives there."
      />
      <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
        {col("Hold", "Hold at least 100,000 $OURO, 0.01% of supply, in your own wallet. Every wallet above that line earns a share of every cycle, and it is sent as soon as it is worth more than the gas to send it.", false)}
        {col("The tax leg", "Two of every five tax points buy tokens and airdrop them to you. This one pays from the first trade, and it rises and falls with volume.", true)}
        {col("The pool leg", "80% of the fees the protocol's own pools earn, airdropped in the tokens and ETH they earned, nothing sold. The other 20% compounds, so this leg grows.", true)}
      </Grid>
      <div
        style={{ marginTop: 28, display: "flex", gap: 24, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}
      >
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
      <SectionHead
        kicker="Live proof"
        title="Every cycle, narrated."
        sub="The treasury advances in public cycles. Every amount below is an onchain transaction this feed reads — the three most recent, newest first."
      />
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
    horizon: "Short term",
    title: "The vaults",
    body: (
      <>
        HOOD10 and INDEX pay their holders in kind, on their own clock, and leave every holder to do something with it. The vaults do it once for everyone:
        deposit the index token and take its dividend compounded back into itself, or paid in WETH or USDG, for 10% of the gain and nothing on the way in or
        out. They also run the machinery the Reserve needs — a keeper that collects on schedule, sells through the right venue and books it onchain — early,
        and against someone else's basket.
      </>
    ),
  },
  {
    n: "02",
    horizon: "Medium term",
    title: "Close the leak: token and liquidity migration",
    body: (
      <>
        $OURO trades on letscash's shared hook. That fixes the 5% for the pool's whole life, which is a guarantee worth having, but the rails are not ours:
        0.3% of every trade is theirs, and nothing on them stops a second ETH/OURO pool that pays no tax at all. Leakage like that is what leaves the
        projects in the table above taxing as little as 6% of their own volume. Closing it means moving the token and its liquidity onto rails Ouro
        controls — a venue of our own, or a partner's on terms we set. On rails like that, sealed venues stop being a design and become something a contract
        enforces, the 0.3% comes back to the treasury, and the pools the protocol already owns sit on an exchange it has a say in rather than one it rents.
      </>
    ),
  },
  {
    n: "03",
    horizon: "Long term",
    title: "Multichain expansion",
    body: (
      <>
        Owning the fee generating layer is not a claim about Robinhood Chain in particular. Every chain has one, and every chain asks the same two things
        of it: pools deep enough to be worth owning, and a venue that lets one charge a fee. Where both hold, the machine runs unchanged — the Reserve takes
        a position in the layer the chain's own trading has to cross, and one holder base is paid out of all of them at once. A chain each, not a token
        each.
      </>
    ),
  },
];

function RoadmapSection() {
  return (
    <Container id="roadmap" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="Roadmap"
        title="Three things, in order."
        sub="The order the work is being done in, not a schedule — nothing here carries a date. Each one arrives as a transaction you can read rather than an announcement, and this list changes when the work does."
      />
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
              The supply is fixed at deploy with no mint function, so nothing dilutes you. The tax and the splits are set by governance, and every change it
              makes is a public onchain transaction. Your wallet can never be blocked. Don't take our word for it. Read the contracts when they publish at
              launch.
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

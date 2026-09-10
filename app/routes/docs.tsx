import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { smoothScrollNextNavigation } from "~/lib/scroll";

import type { Route } from "./+types/docs";
import { Callout, LedgerTable, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, Grid, KVRow, MicroLabel, PageHeader, PendingCell, SplitBar, hairline, mono, rowIndex } from "~/components/site";
import { COLLECTION_SPLIT_USD, COLLECT_THRESHOLD_USD, INFRASTRUCTURE, PARAMETERS, PROTOCOL_CONTRACTS, VENUE, type AddressEntry } from "~/content/protocol";
import { site } from "~/content/site";
import { pageMeta } from "~/lib/meta";

const LEDE = "Hold $OURO. Get paid. Everything below is how.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `${site.name} docs · How Ouro works`,
    description: "Hold $OURO, get paid from every trade. Tax, Reserve LP, airdrops, compounding, parameters, risks.",
    path: location.pathname,
    image: "/og/docs.png",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  });
}

const TOC: { id: string; label: string }[] = [
  { id: "d01", label: "01 · Overview" },
  { id: "d02", label: "02 · The tax" },
  { id: "d03", label: "03 · The Loop" },
  { id: "d04", label: "04 · The Reserve" },
  { id: "d05", label: "05 · The airdrop" },
  { id: "d06", label: "06 · When it arrives" },
  { id: "d07", label: "07 · Compounding" },
  { id: "d08", label: "08 · Parameters" },
  { id: "d09", label: "09 · Governance & security" },
  { id: "d10", label: "10 · What Ouro can't do" },
  { id: "d11", label: "11 · Risks" },
  { id: "d12", label: "12 · Addresses" },
  { id: "d13", label: "13 · FAQ" },
];

const PARAM_COLS: LedgerColumn[] = [
  { key: "p", label: "Parameter" },
  { key: "v", label: "Value", align: "right", numeric: true },
  { key: "m", label: "Mutable?", align: "right" },
];
const PARAM_ROWS = PARAMETERS.map((r) => ({
  p: r.parameter,
  v: <span style={{ ...mono, fontSize: 13 }}>{r.value}</span>,
  m: <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.mutable}</span>,
}));

function addressRows(entries: AddressEntry[]) {
  return entries.map((e) => ({
    c: e.name,
    a: e.address ? <AddressCell address={e.address} linked={!e.poolId} /> : <PendingCell>Publishes at launch</PendingCell>,
  }));
}
const addrCols = (label: string): LedgerColumn[] => [
  { key: "c", label },
  { key: "a", label: "Address", align: "right" },
];

const CANT: { lead: string; text: string }[] = [
  { lead: "Can't mint.", text: " Supply is fixed at deploy: there is no mint function and no emission, so nothing dilutes you. Every airdrop is fees the pools already earned." },
  { lead: "Can't change the tax.", text: " The 5% is written into letscash's shared hook when the pool is registered and the hook has no function that can change it afterwards. Not us, not letscash, not anyone. A pool charges one rate for its whole life." },
  { lead: "Can't touch your wallet.", text: " The token is a standard ERC20 with no transfer tax, no blocklist and no owner. Nobody can freeze, seize or claw back your $OURO." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is Ouro different from HOOD10 or The Index?",
    a: "They hand out every tax point; when volume cools, payouts stop. Ouro hands out half, keeps half as fee-earning LP, and airdrops 80% of those fees. That second leg can keep paying.",
  },
  {
    q: "What do I have to do to get paid?",
    a: "Hold ≥ 100,000 $OURO in your own wallet. No stake, lock, or claim. Tiny amounts wait until they are worth the gas. Exchange/bridge balances do not count.",
  },
  {
    q: "I hold less than 100,000 $OURO. What then?",
    a: "Deposit with others (Vaults). The pool clears the 100,000 line together; you earn in OURO, ETH, or dollars.",
  },
  {
    q: "Do I need to stake or claim?",
    a: "No for wallet holdings. ETH/dollar vaults have a collect step for that payout; your OURO still withdraws anytime.",
  },
  {
    q: "What is the Reserve? What is LP?",
    a: "LP = tokens in a trading pool earning swap fees. The Reserve is that LP owned by the protocol (bought with half the tax). Its fees fund the second airdrop leg.",
  },
  {
    q: "What is a cycle?",
    a: "One public payout run. Target about every two hours; only when worth the gas. Fee collections stream over ~48 hours.",
  },
  {
    q: "What am I paid in, and when?",
    a: "Tokens. Tax leg: bought at market. Fee leg: whatever Reserve pools earned (often basket + WETH). Target every two hours; see When it arrives.",
  },
  {
    q: "Is the basket safe? Are these stocks?",
    a: "No. Crypto tokens on Robinhood Chain, including memecoins. They can go to zero.",
  },
];

/* ---------------------------------------------------------------- pieces */

function DocSection({ id, n, title, children, wide = false, last = false, titleStyle }: { id: string; n: string; title: string; children: ReactNode; wide?: boolean; last?: boolean; titleStyle?: CSSProperties }) {
  return (
    <section id={id} style={{ borderTop: hairline, padding: last ? "32px 0 0" : "32px 0", scrollMarginTop: 84 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "baseline" }}>
        <span style={{ ...rowIndex, width: 28 }}>{n}</span>
        <div style={{ maxWidth: wide ? undefined : 600, flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, letterSpacing: "var(--tracking-tight)", ...titleStyle }}>{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function P({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)", marginTop: 10, ...style }}>{children}</div>;
}

/** The tax and fee split tables (docs §02, §03, §05). */
function SplitRows({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ marginTop: 14, borderTop: hairline }}>
      {rows.map(([label, value], i) => (
        <KVRow
          key={label}
          py={10}
          border={i === rows.length - 1 ? "none" : "bottom"}
          label={label}
          value={value}
          labelStyle={{ fontSize: 14, color: "var(--text-secondary)" }}
          valueStyle={{ fontWeight: 600 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Docs() {
  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader kicker="Documentation" title="How Ouro works." lede={LEDE} ledeStyle={{ maxWidth: 620 }} />

      <Grid cols="210px 1fr" gap={64} style={{ marginTop: 48 }}>
        <nav className="docs-toc" aria-label="Contents">
          <MicroLabel style={{ marginBottom: 10 }}>Contents</MicroLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOC.map((t) => (
              <Link key={t.id} to={`#${t.id}`} className="toc-link" onClick={smoothScrollNextNavigation}>
                {t.label}
              </Link>
            ))}
          </div>
        </nav>

        <div>
          <DocSection id="d01" n="01" title="Overview">
            <P>
              Hold $OURO → get paid from every trade. Mechanically: fixed-supply ERC20, ETH/OURO pool on Uniswap v4 (letscash hook), 5% tax in ETH. Half of what
              the tax buys is airdropped; half becomes protocol-owned LP (the Reserve). 80% of that LP&apos;s fees are airdropped too. Tax leg tracks volume; pool
              leg can keep paying after volume cools.
            </P>
          </DocSection>

          <DocSection id="d02" n="02" title="The tax">
            <P>
              5% in ETH on every buy and sell. The pool charges no extra LP fee, so 5% is the whole trade cost. The rate is fixed in letscash&apos;s hook at launch;
              nobody can change it. Part goes to the launchpad as platform fee; the rest funds the airdrop and the Reserve.
            </P>
            <SplitBar
              wedges={[
                { label: "Airdrop", value: "2%", weight: 20 },
                { label: "LP", value: "2%", weight: 20, tone: "accent" },
                { label: "Ops", value: "0.7%", weight: 7 },
                { label: "letscash", value: "0.3%", weight: 3 },
              ]}
              left="Paid out to holders"
              right="Operations · platform"
            />
            <SplitRows
              rows={[
                ["Airdrop: buys tokens and hands them to holders", "2% of the trade"],
                ["LP: buys the Reserve and keeps it as owned liquidity", "2% of the trade"],
                ["Ops: gas, infra, listings", "0.7% of the trade"],
                ["letscash.fun: the launchpad's platform fee", "0.3% of the trade"],
              ]}
            />
          </DocSection>

          <DocSection id="d03" n="03" title="The Loop">
            <P>
              The treasury advances in cycles (public payout runs). Each cycle deploys accumulated tax on the split above and collects fees from every Reserve
              position. Those fees split again:
            </P>
            <SplitBar
              wedges={[
                { label: "Holders", value: "80%", weight: 80 },
                { label: "Reserve", value: "20%", weight: 20 },
              ]}
              left="Airdropped to you"
              right="Compounded"
            />
            <SplitRows
              rows={[
                ["Holders: airdropped to every wallet above the line, as earned", "80%"],
                ["Reserve: tops up the positions, so the next cycle earns more", "20%"],
              ]}
            />
            <P style={{ marginTop: 12 }}>
              Every cycle is public onchain; the Ledger reads each amount. Tax legs buy at market (slippage applies). The fee leg passes through in the assets
              the pools earned, so nothing is sold for it.
            </P>
          </DocSection>

          <DocSection id="d04" n="04" title="The Reserve">
            <P>
              The Reserve is protocol-owned LP: a small set of liquid Robinhood Chain tokens (building toward five), held in trading pools Ouro owns and never
              hands out. It opens with <strong>CASHCAT</strong> and <strong>PONS</strong>, the deepest crypto markets on the chain, and widens as the treasury
              grows. Each name is capped at 20% to 25% of the treasury. LP sits where the token&apos;s real liquidity is (Uniswap v3 or v4). That earns the fees
              that feed the Loop; the tradeoff vs holding is divergence (impermanent loss). Adds, retires, and reweights are public governance transactions.
            </P>
            <P>
              The treasury also holds ETH/OURO LP seeded at launch, earning into the same 80/20 split. That position sits in the treasury multisig under its
              policy.
            </P>
          </DocSection>

          <DocSection id="d05" n="05" title="The airdrop">
            <P>
              Two legs pay holders. Tax leg: two of every five tax points buy tokens at market and send them to you from the first trade. Pool leg: 80% of fees
              from protocol-owned LP. Nothing to stake, lock, or claim: hold $OURO in your wallet and both legs are sent to you.
            </P>
            <SplitRows
              rows={[
                ["The line: the balance a wallet needs to be paid", "100,000 OURO"],
                ["As a share of supply", "0.01%"],
              ]}
            />
            <P style={{ marginTop: 12 }}>
              The tax leg is bought at market each cycle (slippage applies). The fee leg is in kind: LP collects fees in both tokens it holds, so you get basket
              tokens plus whatever they are paired with, usually ETH. Nothing is sold for that leg. Fees are collected only once {`$${COLLECT_THRESHOLD_USD}`} has
              accrued (gas otherwise eats the collect); of each collection, {`$${COLLECTION_SPLIT_USD.holders}`} reaches holders. See{" "}
              <a href="#d06">06 · When it arrives</a>.
            </P>
            <P style={{ marginTop: 12 }}>
              ETH in payouts is sent as <strong>WETH</strong> (1:1 wrapped) so wallets can index an ordinary transfer. Native ETH would not show cleanly next to
              the tokens.
            </P>
            <Callout title="Who is excluded" style={{ marginTop: 14 }}>
              Pool contracts, the treasury's own addresses and the protocol's infrastructure are left out of the recipient list, so income is not paid to Ouro
              itself or stranded in an AMM. Both competitors pay their own pools as though they were holders. The Index has roughly $5,000 of stock tokens
              stranded in one Uniswap v3 pool because of it. Tokens you hold on an exchange or in a bridge are in someone else's wallet, not yours, and are
              not paid. To be precise about what this is: exclusions are applied when the list is built, in the same place the 100,000 line is applied. The
              contract does not check them, so it is a promise about how payouts are run rather than something the code enforces.
            </Callout>
          </DocSection>

          <DocSection id="d06" n="06" title="When it arrives">
            <P>
              Target: an airdrop about every two hours. That is a target, not a promise. A cycle runs when it is worth the gas.
            </P>
            <SplitRows
              rows={[
                ["Target cadence", "every 2 hours"],
                ["Fees are collected once they reach", `$${COLLECT_THRESHOLD_USD} accrued`],
                ["A collection then splits", `$${COLLECTION_SPLIT_USD.holders} airdropped / $${COLLECTION_SPLIT_USD.reserve} compounded`],
                ["A collection is streamed over", "about 48 hours"],
                ["Assets paid today", "CASHCAT + PONS"],
              ]}
            />
            <P style={{ marginTop: 12 }}>
              <strong>Fees are not collected the moment they are earned.</strong> Collecting costs gas. Fees stay in positions until{" "}
              <strong>{`$${COLLECT_THRESHOLD_USD}`} has accrued</strong>, then split 80 / 20: {`$${COLLECTION_SPLIT_USD.holders}`} to the airdrop wallet and{" "}
              {`$${COLLECTION_SPLIT_USD.reserve}`} back into the positions. Waiting costs holders nothing; uncollected fees still earn and the Ledger shows them
              next to the threshold.
            </P>
            <P style={{ marginTop: 12 }}>
              <strong>Income is streamed, not dumped in one shot.</strong> Volume is uneven, so each collection is spread across roughly 48 hours. What you receive
              tracks about the last two days of trading, not the last two hours.
            </P>
            <P style={{ marginTop: 12 }}>
              <strong>Small balances wait until they are worth sending.</strong> If what you are owed is less than a few times the gas to send it, it stays
              credited and arrives in a later cycle. Same total either way.
            </P>
            <Callout title="What makes a cycle wait" style={{ marginTop: 14 }}>
              Gas is expensive, so the cycle waits for a cheaper one. The cycle is thin, and the gas to send it would eat too much of it, so it waits and
              arrives larger. Nobody is yet owed enough to clear the cost of sending. The pools have earned fees but not yet the {`$${COLLECT_THRESHOLD_USD}`} that makes a
              collection worth taking. The keeper that runs the cycle is offline. Or there were no trades, so there is no tax and no fees to pay out. In every one of those cases what you have earned is still yours and still accounted for: a cycle
              that does not run rolls into the one that does. Nothing is forfeited by waiting.
            </Callout>
            <P style={{ marginTop: 12 }}>
              <strong>The cadence is policy, not code.</strong> The Airdropper contract does not know what a cycle is, how often one should run, or which
              wallets sit above the line. It moves the amounts it is told to move, out of the treasury, in one transaction. So the schedule is a
              commitment kept in public against a Ledger anyone can read, and not something a contract enforces. Judge it on that record rather than on
              this page.
            </P>
          </DocSection>

          <DocSection id="d07" n="07" title="Compounding">
            <P>
              Two things grow the Reserve: two tax points of every trade buy into it and stay, and 20% of each cycle&apos;s fees go back into the same
              positions. Nothing is sold for either. Larger LP means the fee leg can grow even when volume (and the tax leg) does not.
            </P>
          </DocSection>

          <DocSection id="d08" n="08" title="Parameters" wide>
            <P style={{ margin: "10px 0 14px", maxWidth: 600 }}>
              "Governed" means changeable only by governance, as public onchain transactions, and only within the hard bounds the contracts
              enforce.
            </P>
            <LedgerTable compact columns={PARAM_COLS} rows={PARAM_ROWS} />
          </DocSection>

          <DocSection id="d09" n="09" title="Governance & security">
            <P>
              $OURO is a standard ERC20: no owner, no transfer tax, no blocklist. The 5% tax and its split are fixed in letscash&apos;s shared hook at launch.
              What the team does with the fee stream it receives (basket, cadence, splits below) is operator policy: visible onchain, not enforced by code. Hard
              limits are in{" "}
              <Link to="#d10" onClick={smoothScrollNextNavigation}>
                what Ouro can&apos;t do
              </Link>
              . Everything else is multisig policy in public.
            </P>
            {site.auditPublished ? (
              <Callout title="Audit status" style={{ marginTop: 14 }}>
                The audit report is published. Read it alongside the code before interacting.
              </Callout>
            ) : (
              <Callout tone="caution" title="Audit status" style={{ marginTop: 14 }}>
                To be published before mainnet launch. Until an audit link appears here, treat Ouro as unaudited experimental software.
              </Callout>
            )}
          </DocSection>

          <DocSection id="d10" n="10" title="What Ouro can't do">
            <div style={{ marginTop: 12, borderTop: hairline }}>
              {CANT.map((c, i) => (
                <div key={c.lead} style={{ padding: "10px 0", borderBottom: i === CANT.length - 1 ? undefined : hairline, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{c.lead}</strong>
                  {c.text}
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="d11" n="11" title="Risks">
            <P>
              The airdrop depends on volume: the tax leg tracks it and stops when trading does. The fee leg depends on fees the pools earn; quiet markets earn
              little. The basket is volatile crypto (including memecoins) that can fall sharply or to zero, and LP underperforms holding when prices move hard.
              A 5% tax both ways makes short-term trading expensive by design. One chain (4663). Large cycles move prices. Cycles run only when the protocol runs
              them. Wallets below 100,000 are unpaid unless they use a vault. Rails are letscash&apos;s, not ours (0.3% of every trade is theirs). Airdrop
              conduct is a team promise about the fee stream, not something code enforces.
            </P>
            <Callout tone="caution" title="No promises" style={{ marginTop: 14 }}>
              An airdrop is a share of fees the pools happened to earn. It is not a yield, not a rate, and not a promise of profit. Nothing here is financial
              advice or a security offering. Do not risk more than you can lose.
            </Callout>
          </DocSection>

          <DocSection id="d12" n="12" title="Addresses" wide>
            <P style={{ maxWidth: 600 }}>
              Everything Ouro runs on, onchain and readable today. The team allocation is held in a Sablier stream that cannot be canceled, with nothing
              withdrawable before the cliff in March 2027 and the last of it vesting in September 2027. Don't take our word for any of it. Read the chain.
            </P>
            <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 20 }}>
              <LedgerTable compact columns={addrCols("Protocol contract")} rows={addressRows(PROTOCOL_CONTRACTS)} />
              <LedgerTable compact columns={addrCols("Trading venue")} rows={addressRows(VENUE)} />
              <LedgerTable compact columns={addrCols("Canonical infrastructure")} rows={addressRows(INFRASTRUCTURE)} />
            </div>
            <P style={{ maxWidth: 600, fontSize: 13, color: "var(--text-muted)" }}>
              The ETH/OURO pool is a Uniswap v4 pool, so it is an id inside the PoolManager rather than a contract with an address of its own. That is why it
              is the one row without an explorer link.
            </P>
          </DocSection>

          <DocSection id="d13" n="13" title="FAQ" last titleStyle={{ margin: "0 0 6px" }}>
            {FAQ.map((f, i) => (
              <div key={f.q} style={{ padding: "14px 0", borderBottom: i === FAQ.length - 1 ? undefined : hairline }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{f.q}</div>
                <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)", marginTop: 6 }}>{f.a}</div>
              </div>
            ))}
          </DocSection>
        </div>
      </Grid>
    </Container>
  );
}

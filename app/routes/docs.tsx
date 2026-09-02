import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { smoothScrollNextNavigation } from "~/lib/scroll";

import type { Route } from "./+types/docs";
import { Callout, LedgerTable, type LedgerColumn } from "~/components/ds";
import { Container, Grid, KVRow, MicroLabel, PageHeader, SplitBar, hairline, mono, rowIndex } from "~/components/site";
import { PARAMETERS } from "~/content/protocol";
import { site } from "~/content/site";
import { pageMeta } from "~/lib/meta";

const LEDE =
  "Ouro is building the fee generating layer of Robinhood Chain. Every trade pays a tax. Half of what it buys is airdropped to holders and half is kept as pools the protocol owns, and the fees those pools earn are airdropped too.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `${site.name} docs · How the fee generating layer works`,
    description: "How Ouro works: the 5% tax, the Loop, the Reserve, the airdrop, compounding, parameters, governance and risks.",
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
  { id: "d06", label: "06 · Compounding" },
  { id: "d07", label: "07 · Parameters" },
  { id: "d08", label: "08 · Governance & security" },
  { id: "d09", label: "09 · What Ouro can't do" },
  { id: "d10", label: "10 · Risks" },
  { id: "d11", label: "11 · Addresses" },
  { id: "d12", label: "12 · FAQ" },
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

const CANT: { lead: string; text: string }[] = [
  { lead: "Can't mint.", text: " Supply is fixed at deploy: there is no mint function and no emission, so nothing dilutes you. Every airdrop is fees the pools already earned." },
  { lead: "Can't raise the tax past the hook's ceiling.", text: " The ceiling is fixed in the contract at deploy and enforced there, not by policy. Governance can move the rate underneath it, and every change is a public onchain transaction." },
  { lead: "Can't touch your wallet.", text: " The token is a standard ERC20 with no transfer tax, no blocklist and no owner. Nobody can freeze, seize or claw back your $OURO." },
  { lead: "Can't hand over ownership in one step.", text: " Token and hook ownership transfers in two steps: the new owner has to accept it before it takes effect." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is Ouro different from HOOD10 or The Index?",
    a: "They hand out every point of their tax, so when volume cools the payouts stop. Ouro hands out half and keeps the other half as permanent, fee earning liquidity, then airdrops 80% of what those pools earn on top. The first leg behaves like theirs. The second is what keeps paying after the volume goes.",
  },
  {
    q: "What do I have to do to get paid?",
    a: "Hold at least 100,000 $OURO, 0.01% of supply, in your own wallet. There is nothing to stake, nothing to lock and nothing to claim: each cycle's airdrop is sent to every wallet above the line. Tokens sitting in a pool contract, a bridge or an exchange's omnibus wallet are not your wallet, and are excluded.",
  },
  {
    q: "What am I paid in?",
    a: "Tokens. The tax leg buys the strongest tokens on the chain at market and hands those to you. The fee leg arrives in whatever the pools actually earned: each position collects fees in both of its tokens, so it is a mix of the basket tokens and whatever they are paired with, usually ETH. Nothing is sold for that second leg.",
  },
  { q: "Is the basket safe? Are these stocks?", a: "No. The basket holds crypto tokens on Robinhood Chain, bluechip memecoins among them, chosen for liquidity and depth. They can go to zero." },
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
              $OURO is an ERC20 with a fixed supply of 1,000,000,000 and one trading pool: ETH/OURO on Uniswap v4 with an Ouro hook attached. Every swap pays
              a tax in ETH. The tax never reaches a person. It flows to the protocol treasury, which buys the strongest tokens on the chain. Half of what it
              buys is airdropped to holders and half is paired into liquidity the protocol owns and keeps. That liquidity earns fees, and each cycle 80% of
              those fees is airdropped too while 20% buys more liquidity. So holders are paid twice: once from the tax, which rises and falls with volume, and
              once from the pools, which go on earning after it. That second leg is the entire point.
            </P>
          </DocSection>

          <DocSection id="d02" n="02" title="The tax">
            <P>
              5%, charged in ETH, on every buy and every sell: exact in and exact out, all four shapes. The pool charges no LP fee on top, so 5% is the whole
              cost of a trade. It is taken by letscash's shared hook and fixed at launch — nobody, including us, can raise or lower it. A share goes to the
              launchpad as their platform fee; the rest funds everything below, and the reason the tax has to build something that outlasts it.
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
              The treasury advances in cycles. Each cycle collects the fees earned by every position, in kind, and deploys the accumulated tax on the split
              above: 2% of the trade to the airdrop, 2% into liquidity it keeps, 0.7% to ops. The fees collected this cycle are then split again:
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
              Every cycle is a set of public onchain transactions. The Ledger reads each amount. Every swap the treasury makes is protected by a minimum output
              set for the trade. The tax legs buy at market, so they carry the usual slippage and price impact. The fee leg is passed straight through in the
              assets the pools earned, so nothing is sold for it.
            </P>
          </DocSection>

          <DocSection id="d04" n="04" title="The Reserve">
            <P>
              A small set, building toward five, of liquid Robinhood Chain tokens, held as full range liquidity Ouro owns, not as loose tokens and never handed
              out. It opens with <strong>CASHCAT</strong> and <strong>PONS</strong>, the two deepest and most heavily traded crypto markets on the chain, and
              widens as the treasury grows: early on the basket leg is a small share of a small volume, and splitting it five ways would buy five positions too
              small to matter against the cost of taking them. Selection favors mature, high turnover tokens with the deepest pool on the chain, and each
              constituent is capped at 20% to 25% of the treasury.
              Constituents are LP'd where their real liquidity is: canonical Uniswap v3 for most names, v4 for others. LP'ing earns the trading fees that
              feed the Loop. The tradeoff is impermanent loss versus holding. Neither name is a commitment to hold it forever: adding, retiring and reweighting
              are governance actions, made as public onchain transactions, and a constituent that stops meeting the rules is retired the same way it was added.
            </P>
            <P>
              Alongside the Reserve the treasury holds one more position: Ouro's own ETH/OURO liquidity, seeded at launch as a full range position and left
              in place, earning fees into the same split as everything else. Be clear on what backs that. It is held by the treasury multisig and protected by
              its policy.
            </P>
          </DocSection>

          <DocSection id="d05" n="05" title="The airdrop">
            <P>
              Holders are paid from two legs. The first is the tax: two of every five tax points buy tokens at market and hand them straight to holders, so
              the airdrop starts on the first trade and rises and falls with volume. The second is the fees the protocol's own pools earn, of which 80% is
              airdropped. There is no staking, no lock and no claim: hold $OURO in your own wallet and both legs are sent to you.
            </P>
            <SplitRows
              rows={[
                ["The line: the balance a wallet needs to be paid", "100,000 OURO"],
                ["As a share of supply", "0.01%"],
              ]}
            />
            <P style={{ marginTop: 12 }}>
              The two legs arrive differently. The tax leg is bought at market, so it costs a trade each cycle and carries the slippage and price impact any
              trade does. The fee leg is passed through in kind: a full range position collects its fees in both of the tokens it holds, so it arrives as a mix
              of the Reserve's constituents and whatever each is paired with, exactly as the pools earned it. Nothing is sold for that leg, so it costs no slippage and
              puts no sell pressure on anything the protocol owns.
            </P>
            <P style={{ marginTop: 12 }}>
              The ETH share is paid as <strong>WETH</strong>, wrapped one for one. That is a practical choice, not an economic one: a native ETH transfer emits
              no event, so wallets have nothing to index and it shows up at best as an internal transaction on a separate explorer tab. You would see the tokens
              land and the ETH apparently missing. WETH emits an ordinary transfer, so every asset in a payout appears in your history together.
            </P>
            <Callout title="Who is excluded" style={{ marginTop: 14 }}>
              Pool contracts, the treasury's own addresses and the protocol's infrastructure are left out of the recipient list, so income is not paid to Ouro
              itself or stranded in an AMM. Both competitors pay their own pools as though they were holders. The Index has roughly $5,000 of stock tokens
              stranded in one Uniswap v3 pool because of it. Tokens you hold on an exchange or in a bridge are in someone else's wallet, not yours, and are
              not paid. To be precise about what this is: exclusions are applied when the list is built, in the same place the 100,000 line is applied. The
              contract does not check them, so it is a promise about how payouts are run rather than something the code enforces.
            </Callout>
          </DocSection>

          <DocSection id="d06" n="06" title="Compounding">
            <P>
              Two things grow the Reserve. Two points of every trade buy into it and stay there, and the 20% of each cycle's fees that is not airdropped is
              added straight back into the same positions. Nothing is sold and nothing is distributed for either: the treasury's own income buys it a slightly
              larger share of the pools it already owns, so the next cycle earns a little more than this one. That is why the fee leg of the airdrop can grow
              even when volume, and with it the tax leg, does not.
            </P>
          </DocSection>

          <DocSection id="d08" n="07" title="Parameters" wide>
            <P style={{ margin: "10px 0 14px", maxWidth: 600 }}>
              "Governed" means changeable only by governance, as public onchain transactions, and only within the hard bounds the contracts
              enforce.
            </P>
            <LedgerTable compact columns={PARAM_COLS} rows={PARAM_ROWS} />
          </DocSection>

          <DocSection id="d09" n="08" title="Governance & security">
            <P>
              $OURO trades on letscash's shared launchpad rails, and that is where the trust model now sits. The token itself is a standard ERC20: no owner,
              no transfer tax, no blocklist, so nothing about your holding can be changed by anyone. The 5% trade tax and its split are fixed in the shared hook
              at launch and cannot be tuned afterwards. What is discretionary is what the team does with the fee stream it receives — the basket, the airdrop
              cadence, the splits below — and that is operator policy, visible onchain but not enforced by code. The limits that hold regardless are listed in{" "}
              <Link to="#d10" onClick={smoothScrollNextNavigation}>
                what Ouro can't do
              </Link>
              . Everything else is operator policy carried out by a multisig, public onchain but not locked by code: the treasury, the basket, the splits and
              the airdrop cadence.
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

          <DocSection id="d10" n="09" title="What Ouro can't do">
            <div style={{ marginTop: 12, borderTop: hairline }}>
              {CANT.map((c, i) => (
                <div key={c.lead} style={{ padding: "10px 0", borderBottom: i === CANT.length - 1 ? undefined : hairline, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{c.lead}</strong>
                  {c.text}
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="d11" n="10" title="Risks">
            <P>
              Plainly: the airdrop depends on volume. Its tax leg tracks volume one for one and stops when trading does, exactly as a competitor's payout
              would. Its fee leg is funded by the fees the pools earn, and quiet markets earn little. The basket is
              volatile crypto tokens, memecoins among them, that can fall sharply or to zero, and full range LP sells a winner into its rally, and being paid in
              those same tokens means your airdrop falls with them too. A 5% tax on both sides is a heavy round trip, so short term trading in $OURO is
              expensive by design. Everything lives on one chain (4663). Large cycles move prices, and minimum output protection bounds, but does not eliminate,
              bad fills. The Loop advances only when the protocol runs a cycle. Wallets below the 100,000 line are not paid at all. The trading rails are
              letscash's shared hook, not ours, so its behaviour is outside our control and 0.3% of every trade is theirs, not the treasury's. The airdrop is run by the team from the fee
              stream, which makes it a promise about conduct rather than something code enforces.
            </P>
            <Callout tone="caution" title="No promises" style={{ marginTop: 14 }}>
              An airdrop is a share of fees the pools happened to earn. It is not a yield, not a rate, and not a promise of profit. Nothing here is financial
              advice or a security offering. Do not risk more than you can lose.
            </Callout>
          </DocSection>

          <DocSection id="d12" n="11" title="Addresses">
            <P>
              Protocol addresses publish at launch. The canonical Uniswap infrastructure Ouro builds on is already onchain and verifiable today.
            </P>
          </DocSection>

          <DocSection id="d13" n="12" title="FAQ" last titleStyle={{ margin: "0 0 6px" }}>
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

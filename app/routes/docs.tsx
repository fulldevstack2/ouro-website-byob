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
  { lead: "Can't mint.", text: " Fixed supply. No mint. Airdrops are fees already earned." },
  { lead: "Can't change the tax.", text: " 5% is fixed in the letscash hook. Nobody can change it." },
  { lead: "Can't touch your wallet.", text: " Standard ERC20. No freeze, seize, or clawback." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is Ouro different from HOOD10 or The Index?",
    a: "They hand out every tax point, so payouts stop when volume cools. Ouro hands out half, keeps half as fee-earning LP, and airdrops 80% of those fees.",
  },
  {
    q: "What do I have to do to get paid?",
    a: "Hold at least 100,000 $OURO in your own wallet. No stake, lock, or claim. Exchange or bridge balances do not count.",
  },
  {
    q: "I hold less than 100,000 $OURO. What then?",
    a: "Pool with others on Vaults. Deposits clear the line together; you earn in OURO, ETH, or dollars.",
  },
  {
    q: "Do I need to stake or claim?",
    a: "No for wallet holdings. ETH and dollar vaults have a collect step for that payout; your OURO still withdraws anytime.",
  },
  {
    q: "What is the Reserve? What is LP?",
    a: "LP means tokens sitting in a trading pool earning swap fees. The Reserve is that LP owned by the protocol, bought with half the tax. Its fees fund the second airdrop leg.",
  },
  {
    q: "What is a cycle?",
    a: "One public payout run. Target about every two hours, but only when worth the gas. Fee collections stream out over about 48 hours.",
  },
  {
    q: "What am I paid in, and when?",
    a: "Tokens. The tax leg is bought at market; the fee leg arrives as the pools earned it (often basket tokens plus WETH). Target about every two hours.",
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
              Hold $OURO and get paid from every trade. A 5% tax buys tokens: half is airdropped to holders, half becomes protocol-owned LP (the Reserve). 80% of
              that LP&apos;s fees are airdropped too.
            </P>
          </DocSection>

          <DocSection id="d02" n="02" title="The tax">
            <P>
              5% in ETH on every buy and sell. Fixed in letscash&apos;s hook at launch; nobody can change it. After the launchpad fee, the rest funds the airdrop
              and the Reserve.
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
            <P>Each cycle deploys accumulated tax on the split above and collects fees from Reserve LP. Those fees split again:</P>
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
              Every cycle is public onchain. Tax legs buy at market. The fee leg passes through as the pools earned it, so nothing is sold for it.
            </P>
          </DocSection>

          <DocSection id="d04" n="04" title="The Reserve">
            <P>
              Protocol-owned LP in liquid Robinhood Chain tokens. It opens with <strong>CASHCAT</strong> and <strong>PONS</strong>, building toward five. Each
              name is capped at 20–25% of the treasury. Those pools earn the fees that feed the Loop; the tradeoff vs holding is divergence. Changes are public
              governance. The treasury also holds ETH/OURO LP on the same 80/20 split.
            </P>
          </DocSection>

          <DocSection id="d05" n="05" title="The airdrop">
            <P>
              Two legs: the tax leg and 80% of protocol LP fees. Hold at least 100,000 $OURO in your wallet. Nothing to stake, lock, or claim.
            </P>
            <SplitRows
              rows={[
                ["The line: the balance a wallet needs to be paid", "100,000 OURO"],
                ["As a share of supply", "0.01%"],
              ]}
            />
            <P style={{ marginTop: 12 }}>
              Tax leg is bought at market. Fee leg arrives in kind (basket tokens plus usually ETH). Fees are collected only after {`$${COLLECT_THRESHOLD_USD}`}
              has accrued; {`$${COLLECTION_SPLIT_USD.holders}`} of each collect reaches holders. ETH is paid as WETH. See <a href="#d06">When it arrives</a>.
            </P>
            <Callout title="Who is excluded" style={{ marginTop: 14 }}>
              Pool contracts, treasury, and infrastructure are left out (operator policy, not enforced by the contract). Tokens on an exchange or bridge are in
              someone else&apos;s wallet and are not paid.
            </Callout>
          </DocSection>

          <DocSection id="d06" n="06" title="When it arrives">
            <P>Target: an airdrop about every two hours. That is a target, not a promise. A cycle runs when it is worth the gas.</P>
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
              <strong>Fees wait until {`$${COLLECT_THRESHOLD_USD}`} has accrued.</strong> Then they split 80/20 to the airdrop wallet and the Reserve.
              Uncollected fees still earn while they wait.
            </P>
            <P style={{ marginTop: 12 }}>
              <strong>Income is streamed over about 48 hours</strong> so payouts track recent trading days, not a single spike hour.
            </P>
            <P style={{ marginTop: 12 }}>
              <strong>Tiny balances wait</strong> until they are worth more than the gas to send. Same total either way.
            </P>
            <Callout title="What makes a cycle wait" style={{ marginTop: 14 }}>
              Expensive gas, a thin cycle, debts below the cost to send, fees under {`$${COLLECT_THRESHOLD_USD}`}, keeper offline, or no trades. Waiting forfeits
              nothing; it rolls into the next cycle.
            </Callout>
            <P style={{ marginTop: 12 }}>
              <strong>Cadence is policy, not code.</strong> Judge it on the public Ledger record.
            </P>
          </DocSection>

          <DocSection id="d07" n="07" title="Compounding">
            <P>
              Two tax points of every trade buy more Reserve LP, and 20% of fees compound back in. The fee leg can grow even when volume does not.
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
              Standard ERC20. Tax fixed in the hook. Basket/cadence/splits below are operator policy (visible onchain). Hard limits in{" "}
              <Link to="#d10" onClick={smoothScrollNextNavigation}>
                what Ouro can&apos;t do
              </Link>
              .
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
              Tax leg tracks volume and stops with it. Fee leg needs pool fees. Basket can go to zero. LP can lose to holding. 5% both ways is expensive for
              short-term trading. One chain. Under 100,000 unpaid unless you pool with others. Rails are letscash&apos;s. Airdrop cadence is policy, not code.
            </P>
            <Callout tone="caution" title="No promises" style={{ marginTop: 14 }}>
              An airdrop is a share of fees earned. Not a yield promise. Not financial advice. Don&apos;t risk more than you can lose.
            </Callout>
          </DocSection>

          <DocSection id="d12" n="12" title="Addresses" wide>
            <P style={{ maxWidth: 600 }}>
              Onchain and readable. Team vest: Sablier, uncancellable; cliff Mar 2027, ends Sep 2027. Read the chain.
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

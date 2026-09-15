import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/docs";
import { Callout, LedgerTable, type LedgerColumn } from "@ouro/ds";
import { AddressCell, Container, MicroLabel, PageHeader, PendingCell, SplitBar, SplitRows, fitTable, legRows, legWedges, mono } from "~/components/site";
import {
  COLLECTION_SPLIT_USD,
  COLLECT_THRESHOLD_USD,
  FEE_SPLIT,
  INFRASTRUCTURE,
  PARAMETERS,
  PROTOCOL_CONTRACTS,
  RESERVE_POOLS,
  TAX_SPLIT,
  TRADE_TAX_PCT,
  VENUE,
  type AddressEntry,
} from "~/content/protocol";
import { analyticsUrl, site } from "~/content/site";
import { VAULT_CONTRACTS } from "~/content/vaults";
import { pageMeta } from "~/lib/meta";
import { smoothScrollNextNavigation } from "~/lib/scroll";

const LEDE = "Hold $OURO. Get paid from the liquidity it builds. Everything below is how.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `${site.name} docs · How Ouro works`,
    description: "The tax, the Loop, the Reserve, the airdrop, the parameters, what Ouro cannot do, the risks and every address.",
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
  { id: "d06", label: "06 · Parameters" },
  { id: "d07", label: "07 · What Ouro can't do" },
  { id: "d08", label: "08 · Risks" },
  { id: "d09", label: "09 · Addresses" },
  { id: "d10", label: "10 · FAQ" },
];

const PARAM_COLS: LedgerColumn[] = [
  { key: "p", label: "Parameter" },
  { key: "v", label: "Value", align: "right", numeric: true },
  { key: "m", label: "Mutable?", align: "right", nowrap: true },
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
  { lead: "Can't mint.", text: " Fixed supply. Airdrops are fees already earned." },
  { lead: "Can't change the tax.", text: " 5% is fixed in the letscash hook." },
  { lead: "Can't touch your wallet.", text: " Standard ERC20. No freeze, seize or clawback." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is Ouro different from HOOD10 or The Index?",
    a: "They hand out every tax point, so payouts stop when volume cools. Ouro keeps 3.3% of a trade as fee-earning liquidity, airdrops 1% outright, and airdrops 80% of the fees that liquidity earns.",
  },
  { q: "What do I have to do to get paid?", a: "Hold at least 100,000 $OURO in your own wallet. No stake, lock or claim. Exchange and bridge balances do not count." },
  { q: "I hold less than 100,000 $OURO. What then?", a: "Pool with others in the vaults. Deposits clear the line together; you earn in OURO, ETH or dollars." },
  {
    q: "What am I paid in, and when?",
    a: "Tokens, every two hours. The tax leg is bought at market; the fee leg arrives as the pools earned it, usually basket tokens plus WETH.",
  },
  { q: "Is the basket safe? Are these stocks?", a: "No. They are crypto tokens on Robinhood Chain, including memecoins. They can go to zero." },
  {
    q: "Where can I see what my wallet has been paid?",
    a: "On the portfolio page. Connect a wallet to see its $OURO, every airdrop it received with the transaction that paid it, and its vault deposits.",
  },
];

/* ---------------------------------------------------------------- pieces */

function Doc({ id, n, title, children, wide = false }: { id: string; n: string; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section id={id} className="doc">
      <div className="doc__row">
        <span className="row-index" style={{ width: 28 }}>
          {n}
        </span>
        <div className={wide ? "doc__main doc__main--wide" : "doc__main"}>
          <h2 className="doc__title">{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <div className="doc__text">{children}</div>;
}

const usd0 = (n: number) => `$${n.toLocaleString("en-US")}`;

/* ------------------------------------------------------------------ page */

export default function Docs() {
  return (
    <Container className="page">
      <PageHeader kicker="Documentation" title="How Ouro works." lede={LEDE} />

      <div className="docs">
        <nav className="docs-toc" aria-label="Contents">
          <MicroLabel style={{ marginBottom: 10 }}>Contents</MicroLabel>
          <div className="docs-toc__links">
            {TOC.map((t) => (
              <Link key={t.id} to={`#${t.id}`} className="toc-link" onClick={smoothScrollNextNavigation}>
                {t.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="docs-body">
          <Doc id="d01" n="01" title="Overview">
            <P>
              A 5% tax on every $OURO trade buys tokens: 3.3% becomes protocol-owned liquidity (the Reserve), 1% is airdropped to holders, 0.7% covers ops and
              the launchpad. 80% of the Reserve&apos;s fees are airdropped too.
            </P>
          </Doc>

          <Doc id="d02" n="02" title="The tax">
            <P>{TRADE_TAX_PCT}% in ETH on every buy and sell, fixed in letscash&apos;s hook at launch. Nobody can change it.</P>
            <SplitBar wedges={legWedges(TAX_SPLIT)} />
            <SplitRows rows={legRows(TAX_SPLIT)} />
          </Doc>

          <Doc id="d03" n="03" title="The Loop">
            <P>Each cycle deploys the accumulated tax on the split above and collects fees from the Reserve. Those fees split again:</P>
            <SplitBar wedges={legWedges(FEE_SPLIT)} />
            <SplitRows rows={legRows(FEE_SPLIT)} />
          </Doc>

          <Doc id="d04" n="04" title="The Reserve">
            <P>
              Protocol-owned LP in liquid Robinhood Chain tokens. It opened with <strong>CASHCAT</strong> and <strong>PONS</strong>, and{" "}
              <strong>microduck</strong> is the third, held as an ETH pair in a Uniswap v4 pool, which the{" "}
              <a href={analyticsUrl("/ledger/")}>Ledger ↗</a> reads straight from the chain. It builds toward five, each capped at 20–25% of the treasury. The tradeoff against holding is divergence; the Ledger publishes both.
            </P>
          </Doc>

          <Doc id="d05" n="05" title="The airdrop">
            <P>
              Two legs: the tax leg, bought at market, and 80% of Reserve fees, passed through as the pools earned them. Hold at least 100,000 $OURO in your own
              wallet. Nothing to stake, lock or claim.
            </P>
            <SplitRows
              rows={[
                { label: "The line", value: "100,000 OURO · 0.01% of supply" },
                { label: "Cadence", value: "Every 2 hours" },
                { label: "Fees are collected once they reach", value: `${usd0(COLLECT_THRESHOLD_USD)} · then ${usd0(COLLECTION_SPLIT_USD.holders)} airdropped, ${usd0(COLLECTION_SPLIT_USD.reserve)} compounded` },
                { label: "A collection is streamed over", value: "About 48 hours" },
              ]}
            />
            <Callout title="What makes a cycle wait" style={{ marginTop: 14 }}>
              Expensive gas, a thin cycle, a balance owed less than the cost to send, or no trades. Waiting forfeits nothing; it rolls into the next cycle.
              Cadence is policy, not code.
            </Callout>
          </Doc>

          <Doc id="d06" n="06" title="Parameters" wide>
            <P>&quot;Policy&quot; means the operator can change it, as a public on-chain transaction. &quot;Fixed&quot; means nobody can.</P>
            <div className="table-scroll" style={{ marginTop: 14 }}>
              <LedgerTable compact style={fitTable} columns={PARAM_COLS} rows={PARAM_ROWS} />
            </div>
          </Doc>

          <Doc id="d07" n="07" title="What Ouro can't do">
            <div className="doc__list">
              {CANT.map((c) => (
                <div key={c.lead} className="doc__item">
                  <strong style={{ color: "var(--text-primary)" }}>{c.lead}</strong>
                  {c.text}
                </div>
              ))}
            </div>
            {site.auditPublished ? (
              <Callout title="Audit status" style={{ marginTop: 14 }}>
                The audit report is published. Read it alongside the code before interacting.
              </Callout>
            ) : null}
          </Doc>

          <Doc id="d08" n="08" title="Risks">
            <P>
              The tax leg tracks volume and stops with it. The fee leg needs pool fees. The basket can go to zero. LP can lose to holding. 5% both ways is
              expensive for short-term trading. The rails are letscash&apos;s. One chain.
            </P>
            <Callout tone="caution" title="No promises" style={{ marginTop: 14 }}>
              An airdrop is a share of fees already earned. Not a yield promise. Not financial advice. Don&apos;t risk more than you can lose.
            </Callout>
          </Doc>

          <Doc id="d09" n="09" title="Addresses" wide>
            <P>
              On-chain and readable. Team vest: Sablier, uncancellable; cliff Mar 2027, ends Sep 2027. The pools the Reserve is an LP in and the vault
              contracts are here too, which is where the <a href={analyticsUrl("/ledger/")}>Ledger ↗</a> and the <Link to="/vaults/">vaults page</Link> send anyone
              looking for them.
            </P>
            <div className="stack stack--wide" style={{ marginTop: 14 }}>
              <div className="table-scroll">
                <LedgerTable compact style={fitTable} columns={addrCols("Protocol contract")} rows={addressRows(PROTOCOL_CONTRACTS)} />
              </div>
              <div className="table-scroll">
                <LedgerTable compact style={fitTable} columns={addrCols("Trading venue")} rows={addressRows(VENUE)} />
              </div>
              <div className="table-scroll">
                <LedgerTable compact style={fitTable} columns={addrCols("Pools the Reserve is an LP in")} rows={addressRows(RESERVE_POOLS)} />
              </div>
              <div className="table-scroll">
                <LedgerTable compact style={fitTable} columns={addrCols("Vault contract")} rows={addressRows(VAULT_CONTRACTS)} />
              </div>
              <div className="table-scroll">
                <LedgerTable compact style={fitTable} columns={addrCols("Canonical infrastructure")} rows={addressRows(INFRASTRUCTURE)} />
              </div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 12, maxWidth: 640 }}>
              The ETH/OURO pool and the Reserve&apos;s ETH / microduck pool are Uniswap v4 pools, ids inside the PoolManager rather than contracts of their
              own, so they are the two rows here without an explorer link. What the Reserve holds in those pools, and what it has earned there, is on the{" "}
              <a href={analyticsUrl("/ledger/")}>Ledger ↗</a>.
            </div>
          </Doc>

          <Doc id="d10" n="10" title="FAQ">
            <div style={{ marginTop: 6 }}>
              {FAQ.map((f) => (
                <div key={f.q} className="faq">
                  <div className="faq__q">{f.q}</div>
                  <div className="faq__a">{f.a}</div>
                </div>
              ))}
            </div>
          </Doc>
        </div>
      </div>
    </Container>
  );
}

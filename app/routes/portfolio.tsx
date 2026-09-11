import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/portfolio";
import { Badge, Callout } from "~/components/ds";
import { Container, Grid, PageHeader, SectionHead, body14, hairline, mono } from "~/components/site";
import { PortfolioStatic } from "~/components/portfolio/PortfolioFrame";
import { site } from "~/content/site";
import { TOKENS } from "~/content/vaults";
import { pageMeta } from "~/lib/meta";

const OURO = TOKENS.find((t) => t.key === "ouro")!;

/**
 * The wallet half of the page, loaded on the client only, exactly as /vaults does it. The prerender
 * (a real render pass in node) and the first client frame both show `PortfolioStatic`; once mounted,
 * the live section and with it wagmi, RainbowKit and viem arrive as their own chunk. That keeps the
 * wallet stack out of the server bundle and out of the way of crawlers.
 */
const PortfolioLive = lazy(() => import("~/components/portfolio/PortfolioLive"));

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: "Portfolio · your $OURO and every airdrop it received",
    description: "Your Ouro in one place: your $OURO, every airdrop it received with the transaction that paid it, what it holds now and your vault deposits.",
    path: location.pathname,
    image: "/og/portfolio.png",
  });
}

function PortfolioSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <PortfolioStatic />;
  return (
    <Suspense fallback={<PortfolioStatic />}>
      <PortfolioLive />
    </Suspense>
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

export default function Portfolio() {
  return (
    <Container className="pf-page" style={{ minHeight: 640 }}>
      <PageHeader
        kicker="Your wallet"
        title="Your portfolio."
        lede="Your $OURO, every airdrop it has received, when the next one is due, what it holds now and what sits in the vaults."
        ledeStyle={{ maxWidth: 620 }}
        aside={
          <div style={{ paddingBottom: 4 }}>
            <Badge tone="positive" dot>
              Read from {site.chain.name}
            </Badge>
          </div>
        }
      />

      <div style={{ marginTop: 32 }}>
        <PortfolioSection />
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Method"
          title="How this is measured."
          titleStyle={{ fontSize: 30 }}
          sub="From the chain through ouro-monitor, for one wallet. Missing price → dash, never an estimate."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 24 }}
        />
        <Grid cols="1fr 1fr" gap={48} align="start">
          <div>
            <Method n="01" title="Balances">
              $OURO, the basket tokens and the vault deposits are read from their contracts on {site.chain.name} by ouro-monitor as the page asks for
              them, and asked for again every thirty seconds. Vault deposits are priced through each vault&apos;s own totals.
            </Method>
            <Method n="02" title="History">
              Every payout the airdrop has sent this address, from the monitor&apos;s index of the airdrop transactions on {site.chain.name}, newest first
              and a page at a time back to the first cycle.
            </Method>
            <Method n="03" title="Valued when sent">
              Each payment is priced at what its cycle valued that token at, from the monitor. A leg the monitor could not price shows a dash, and so does
              any total it is part of.
            </Method>
          </div>
          <div>
            <Method n="04" title="Share of a cycle">
              Balance over the eligible supply, the weighted balance a cycle is divided among. The top three holders take 30% less than pro-rata, so the
              figure is a floor for most wallets.
            </Method>
            <Method n="05" title="Not a forecast">
              The daily and monthly figures apply the average of recent cycles to this wallet&apos;s share of the supply, and the next payment is an
              estimate from the same. Both move with volume, in both directions.
            </Method>
            <Method n="06" title="One wallet">
              Everything here is read for one wallet, with no account and no sign-in. Exchange and bridge balances are someone else&apos;s wallet, and a
              wallet under {fmtLine()} $OURO is paid nothing until it clears the line.
            </Method>
          </div>
        </Grid>
        <Callout style={{ marginTop: 32 }} title="Where the money comes from">
          Tax leg: part of each trade&apos;s 5%. Pool leg: 80% of fees from protocol-owned LP. Every cycle, across all holders, is on the{" "}
          <Link to="/airdrops/">airdrops page</Link>, and the liquidity that funds the second leg on the <Link to="/ledger/">Ledger</Link>.
        </Callout>
      </div>
    </Container>
  );
}

function fmtLine() {
  return OURO.thresholdTokens.toLocaleString("en-US");
}

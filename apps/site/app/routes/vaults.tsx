import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/vaults";
import { Badge, Callout, LedgerTable, type LedgerColumn } from "@ouro/ds";
import { Container, PageHeader, SectionHead, body14, fitTable, mono } from "~/components/site";
import { VaultsStatic } from "~/components/vaults/VaultFrame";
import { LINE_TOKENS } from "~/content/protocol";
import { site } from "~/content/site";
import { TERMS } from "~/content/vaults";
import { pageMeta } from "~/lib/meta";
import { fmtNum } from "@ouro/monitor-client";

/**
 * The wallet half of the page, loaded on the client only. The prerender (a real render pass in node)
 * and the first client frame both show `VaultsStatic`; once mounted, the live section and with it
 * wagmi, RainbowKit and viem arrive as their own chunk. That keeps the wallet stack out of the
 * server bundle, where it would slow every route's prerender, and out of the way of crawlers.
 */
const VaultsLive = lazy(() => import("~/components/vaults/VaultsLive"));

function VaultsSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <VaultsStatic />;
  return (
    <Suspense fallback={<VaultsStatic />}>
      <VaultsLive />
    </Suspense>
  );
}

const LINE = fmtNum(LINE_TOKENS);
const LEDE = `Pool your $OURO with others, clear the ${LINE} line together, and get paid in OURO, ETH or dollars.`;

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `The vaults · ${site.name}`,
    description: `${LEDE} ${TERMS.performanceFeePct}% fee on profit only.`,
    path: location.pathname,
    image: "/og/vaults.png",
  });
}

const STEPS: { lead: string; text: string }[] = [
  { lead: "Deposit any amount.", text: "You get vault tokens for your slice. No deposit or withdrawal fee." },
  { lead: "The pool clears the line,", text: "so the airdrop lands in the vault every two hours." },
  {
    lead: "A keeper sells it into what your vault pays.",
    text: `You keep ${100 - TERMS.performanceFeePct}%. ${TERMS.performanceFeePct}% of profit funds more airdrops and ops. Withdraw any time.`,
  },
];

const PARAM_COLS: LedgerColumn[] = [
  { key: "p", label: "Parameter" },
  { key: "v", label: "Value", align: "right", numeric: true },
];
const PARAM_ROWS = [
  ["Performance fee", `${TERMS.performanceFeePct}% of harvest gains, cap ${TERMS.maxPerformanceFeePct}%`],
  ["Fee split: airdrops / ops", `${TERMS.feeSplit.airdrops}% / ${TERMS.feeSplit.ops}% of the gain · policy`],
  ["Deposit and withdrawal fees", "0"],
  ["Gains vest over", `${TERMS.profitUnlock}, cap ${TERMS.maxProfitUnlock}`],
  ["Swap venue", "Uniswap UniversalRouter"],
  ["Pause", "Stops deposits and harvests only"],
  ["Deployed", "2026-09-08 · blocks 57,376,688 to 57,376,793"],
].map(([p, val]) => ({ p, v: <span style={{ ...mono, fontSize: 12 }}>{val}</span> }));

export default function Vaults() {
  return (
    <Container className="page">
      <PageHeader
        kicker="For holders under the line"
        title="The vaults."
        lede={LEDE}
        aside={
          <Badge tone="positive" dot>
            Live on {site.chain.name}
          </Badge>
        }
      />

      <VaultsSection />

      <div className="cols-2" style={{ marginTop: 64 }}>
        <div>
          <SectionHead kicker="How it works" title="Three steps." size="small" style={{ marginBottom: 8 }} />
          <div className="vsteps">
            {STEPS.map((s, i) => (
              <div key={s.lead} className="vstep">
                <span className="row-index">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong style={{ color: "var(--text-primary)" }}>{s.lead}</strong> {s.text}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="stack" style={{ paddingTop: 20 }}>
          <Callout tone="caution" title="New and unaudited">
            The contracts are new and unaudited. Yield is Ouro&apos;s airdrop only and shrinks when trading cools. Withdrawals never pause.
          </Callout>
          <Callout title="Say you hold 20,000 OURO">
            Too small alone. In the dollars vault the airdrop lands in the pool, a keeper sells it for USDG, and you collect your share. Your 20,000 OURO
            stays yours.
          </Callout>
        </div>
      </div>

      <div className="cols-2 cols-2--tight" style={{ marginTop: 64 }}>
        <div className="table-scroll">
          <LedgerTable compact style={fitTable} columns={PARAM_COLS} rows={PARAM_ROWS} />
        </div>
        {/* The addresses live in the docs, which is the one page that publishes every address on this
            site. A second copy here was a second thing to keep right. */}
        <div style={{ ...body14, paddingTop: 4 }}>
          <p style={{ margin: 0 }}>
            The three vault contracts, the swap venue and the payout tokens are published with every other Ouro address in the docs, each one linked to the
            explorer.
          </p>
          <p style={{ margin: "12px 0 0" }}>
            <Link to="/docs/#d09">Read the addresses →</Link>
          </p>
        </div>
      </div>
    </Container>
  );
}

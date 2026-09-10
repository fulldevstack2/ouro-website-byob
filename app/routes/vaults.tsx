import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/vaults";
import { Badge, Callout, LedgerTable, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, Disclosure, DisclosureList, Grid, KVRow, MicroLabel, NumberedRow, PageHeader, SectionHead, body14, hairline, mono } from "~/components/site";
import { VaultsStatic } from "~/components/vaults/VaultFrame";
import { site } from "~/content/site";
import { LIVE_VAULTS, PAYOUT_TOKENS, TERMS, TOKENS } from "~/content/vaults";
import { pageMeta } from "~/lib/meta";

const OURO = TOKENS.find((t) => t.key === "ouro")!;

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

const LEDE = "Holding under 100,000 OURO? Pool with others and still earn OURO, dollars, or ETH.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `OURO vaults · ${site.name}`,
    description: `Holding under 100,000 OURO? Pool with others and still earn OURO, dollars, or ETH. ${TERMS.performanceFeePct}% fee on profit only.`,
    path: location.pathname,
    image: "/og/vaults.png",
  });
}

const HOW: { title: string; text: ReactNode }[] = [
  {
    title: "Put your OURO in",
    text: "Any amount. You get vault tokens for your slice of the pool. No deposit or withdrawal fee.",
  },
  {
    title: "The pool qualifies, so you do",
    text: "Airdrops need 100,000 OURO. Alone you may be under; pooled together, the vault clears the line and the airdrop lands there.",
  },
  {
    title: "A bot sells it for you",
    text: "A keeper turns airdropped tokens into whatever your vault pays: OURO, ETH, or dollars. Only on allowlisted venues, never below a price floor.",
  },
  {
    title: "You keep 90%",
    text: `${TERMS.performanceFeePct}% of profit only (${TERMS.feeSplit.airdrops}% to more airdrops, ${TERMS.feeSplit.ops}% ops). Your share unlocks over ${TERMS.profitUnlock}.`,
  },
  {
    title: "Take it out anytime",
    text: "OURO vault: your balance just grows. ETH/dollar vaults: collect payout when you want. Your OURO withdraws even if paused.",
  },
];

const BUILT_IN = [
  "Only you can withdraw your deposit or payout token. No role can move them otherwise.",
  "The keeper can only sell basket tokens on allowlisted venues, never below a floor.",
  "Every harvest books from the vault's real balance.",
  "Pause stops deposits and harvests. Withdrawals never pause.",
  "Ownership changes take two steps, so a mistyped address cannot take a vault.",
];

const RISKS = [
  "Contracts are new and unaudited. Treat this as experimental.",
  "The keeper handles basket tokens between airdrop and harvest. A bad route costs yield, not principal.",
  "Trades cost fees and slippage. OURO buy-backs pay the 5% tax on purpose so that tax funds holders.",
  "Airdropped tokens go to whoever is still deposited when they are sold.",
  "Yield is Ouro's airdrop only. It shrinks when trading cools. No promised returns.",
];

const TRUST: { who: string; can: string; cannot: string }[] = [
  { who: "Anyone", can: "Deposit, mint, withdraw, redeem, claim.", cannot: "Move anyone else's shares or a vault's deposits." },
  {
    who: "Keeper",
    can: "Run a harvest with any steps against the allowlisted venue. Set the minimum the vault must receive.",
    cannot: "Sell OURO or the vault's shares. Use a venue that is not allowlisted.",
  },
  {
    who: "Owner",
    can: `Set keepers and venues, the performance fee (at most ${TERMS.maxPerformanceFeePct}%), the vesting period (at most ${TERMS.maxProfitUnlock}), the deposit limit and the fee recipient. Pause. While paused, rescue tokens other than OURO and the payout token.`,
    cannot: "Approve, transfer or rescue OURO or the payout token. Rescue anything while the vault is running. Register OURO or the vault itself as a venue.",
  },
];

const PARAM_COLS: LedgerColumn[] = [
  { key: "p", label: "Parameter" },
  { key: "v", label: "Value", align: "right", numeric: true },
];
const PARAM_ROWS = [
  ["Vaults", `${LIVE_VAULTS.length}, all pooling OURO: paid in OURO, WETH or USDG`],
  ["Performance fee", `${TERMS.performanceFeePct}% of harvest gains, cap ${TERMS.maxPerformanceFeePct}%`],
  ["Fee split: airdrops / ops", `${TERMS.feeSplit.airdrops}% / ${TERMS.feeSplit.ops}% of the gain, operator policy`],
  ["Deposit and withdrawal fees", "0"],
  ["Gains vest over", `${TERMS.profitUnlock}, cap ${TERMS.maxProfitUnlock}`],
  ["Deposit limit", "None"],
  ["Swap venue", TERMS.venue.name],
  ["Pause", "Stops deposits and harvests. Withdrawals stay open"],
  ["Deployed", "2026-09-08, blocks 57376688 to 57376793"],
  ["Chain", `${site.chain.name} (${site.chain.id})`],
].map(([p, val]) => ({ p, v: <span style={{ ...mono, fontSize: 13 }}>{val}</span> }));

const ADDR_COLS: LedgerColumn[] = [
  { key: "c", label: "Contract" },
  { key: "a", label: "Address", align: "right" },
];
const ADDR_ROWS = [
  ...LIVE_VAULTS.map((v) => ({ c: `${v.token.symbol} → ${v.payoutSymbol} vault (${v.entry.shareSymbol})`, a: <AddressCell address={v.entry.address} /> })),
  { c: "OURO token", a: <AddressCell address={OURO.address} /> },
  { c: "OURO pool hook (charges the 5% tax)", a: <AddressCell address={OURO.hook.address} /> },
  { c: "Swap venue", a: <AddressCell address={TERMS.venue.address} /> },
  { c: PAYOUT_TOKENS.weth.symbol, a: <AddressCell address={PAYOUT_TOKENS.weth.address} /> },
  { c: PAYOUT_TOKENS.usdg.symbol, a: <AddressCell address={PAYOUT_TOKENS.usdg.address} /> },
];

function RuleList({ items }: { items: string[] }) {
  return (
    <div style={{ borderTop: hairline }}>
      {items.map((t, i) => (
        <div key={i} style={{ padding: "10px 0", borderBottom: i === items.length - 1 ? undefined : hairline, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {t}
        </div>
      ))}
    </div>
  );
}

function Col({ label, children, rule = false }: { label: string; children: ReactNode; rule?: boolean }) {
  return (
    <div className={rule ? "cell-rule" : undefined}>
      <MicroLabel>{label}</MicroLabel>
      <div style={{ ...body14, marginTop: 8 }}>{children}</div>
    </div>
  );
}

export default function Vaults() {
  return (
    <Container className="vault-page" style={{ minHeight: 640 }}>
      <PageHeader
        kicker="For OURO holders"
        title="The vaults."
        lede={LEDE}
        ledeStyle={{ maxWidth: 620 }}
        aside={
          <div style={{ paddingBottom: 4 }}>
            <Badge tone="positive" dot>
              Live on {site.chain.name}
            </Badge>
          </div>
        }
      />

      <VaultsSection />


      <div className="vault-prose">
        <SectionHead kicker="Questions" title="How it actually works." titleStyle={{ fontSize: 30 }} style={{ marginBottom: 4 }} />
        <DisclosureList>
          <Disclosure kicker="The basics" title="How does a vault earn me anything?">
            {/* Was a two-column spread with a spec table of nine KVRows down the left. Removed: it
                answered questions nobody had yet, in the vocabulary the page is trying to avoid
                ("ERC4626 shares, 1:1 at deposit"), directly above the plain-language version of the
                same facts. The numbers it carried are all in the steps below, and the
                yield-is-the-airdrop caution now lives in "What can go wrong?" where a reader looking
                for risk will actually find it. */}
            <div>
              <div>
                {/* The single most useful thing on the page for a first-time reader: one concrete
                    person, one concrete amount, no vocabulary. Added after "I don't get how this
                    works lol". Deliberately no yield figure — the live cards carry that, and a
                    number in prose here would read as a promise and go stale. */}
                <Callout title="Say you hold 20,000 OURO" style={{ marginBottom: 24 }}>
                  Too small alone for airdrops. Pool with others in the Earn&nbsp;dollars vault: the airdrop lands in the pool, a bot sells it for USDG, and you
                  claim your share. Your 20,000 OURO stays yours.
                </Callout>
                <MicroLabel style={{ marginBottom: 6 }}>How the vaults work</MicroLabel>
                {HOW.map((s, i) => (
                  <NumberedRow key={s.title} n={String(i + 1).padStart(2, "0")} py={16} borderBottom={i === HOW.length - 1}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ ...body14, marginTop: 4 }}>{s.text}</div>
                  </NumberedRow>
                ))}
                <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
                  How the airdrop itself works, and what has been paid so far, is on the <Link to="/airdrops/">airdrops page</Link>.
                </div>
              </div>
            </div>
          </Disclosure>

          {/* Was two sections, "Why a vault" and "Why Ouro built them", making the same argument
              twice: the line prices out small holders, pooling clears it, and the keeper does the
              chore in public. Merged into the three columns it always wanted to be. */}
          <Disclosure kicker="Eligibility" title="Do I need 100,000 OURO?">
            <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
              <Col label="The line">
                Airdrops need 100,000 OURO. Pool with others to clear that together without moving the line.
              </Col>
              <Col label="The chore" rule>
                Airdrops arrive as basket tokens every two hours. One keeper converts them for everyone. Fee: {TERMS.feeSplit.airdrops}% airdrops /{" "}
                {TERMS.feeSplit.ops}% ops.
              </Col>
              <Col label="The proof" rule>
                Every harvest is a public transaction. Amounts from the chain; dollar prices from the monitor.
              </Col>
            </Grid>
          </Disclosure>

          <Disclosure kicker="Control" title="Can anyone take my deposit?">
            <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
              {TRUST.map((r, i) => (
                <div key={r.who} className={i ? "cell-rule" : undefined}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{r.who}</div>
                  <MicroLabel tone="faint" style={{ marginTop: 14 }}>
                    Can
                  </MicroLabel>
                  <div style={{ ...body14, marginTop: 6 }}>{r.can}</div>
                  <MicroLabel tone="faint" style={{ marginTop: 14 }}>
                    Cannot
                  </MicroLabel>
                  <div style={{ ...body14, marginTop: 6 }}>{r.cannot}</div>
                </div>
              ))}
            </Grid>
          </Disclosure>

          <Disclosure kicker="Risk" title="What can go wrong?" sub="What is built in, and what can still go wrong. The contracts are new and unaudited.">
            <Grid cols="1fr 1fr" gap={48} align="start">
              <div>
                <MicroLabel style={{ marginBottom: 10 }}>Built in</MicroLabel>
                <RuleList items={BUILT_IN} />
              </div>
              <div>
                <MicroLabel style={{ marginBottom: 10 }}>The risks</MicroLabel>
                <RuleList items={RISKS} />
              </div>
            </Grid>
          </Disclosure>

          <Disclosure
            kicker="Parameters and addresses"
            title="Verify everything."
            sub="Set at deploy and readable from each contract. All three vaults are verified on the explorer."
          >
            <Grid cols="1fr 1fr" gap={24} align="start">
              <LedgerTable compact columns={PARAM_COLS} rows={PARAM_ROWS} />
              <LedgerTable compact columns={ADDR_COLS} rows={ADDR_ROWS} />
            </Grid>
          </Disclosure>
        </DisclosureList>
      </div>

      <div className="vault-prose vault-prose--tight">
        <SectionHead
          kicker="Planned"
          title="More vaults/pairs soon."
          titleStyle={{ fontSize: 30 }}
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 0 }}
        />
      </div>
    </Container>
  );
}

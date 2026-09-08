import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/vaults";
import { Badge, Callout, LedgerTable, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, Grid, KVRow, MicroLabel, NumberedRow, PageHeader, PendingCell, SectionHead, body14, hairline, mono } from "~/components/site";
import { VaultsStatic } from "~/components/vaults/VaultFrame";
import { site } from "~/content/site";
import { LIVE_VAULTS, PAYOUTS, PAYOUT_TOKENS, STATUS_LABEL, TERMS, TOKENS, VAULTS } from "~/content/vaults";
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

const LEDE =
  "Pool your OURO. Together the deposits clear the airdrop line, one keeper sells each airdrop for everyone, and you choose what it pays you in: more OURO, WETH, or USDG. Deposit, withdraw and claim right here.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `OURO vaults · ${site.name}`,
    description: "Pool your OURO, clear the airdrop line together and let one keeper sell every airdrop for everyone. Paid in OURO, WETH or USDG. Live on Robinhood Chain.",
    path: location.pathname,
    image: "/og/vaults.png",
  });
}

const HOW: { title: string; text: ReactNode }[] = [
  { title: "Deposit", text: "Deposit any amount of OURO into the vault of your choice and receive ERC4626 shares priced in OURO. There is no minimum and nothing is charged on the way in or out." },
  {
    title: "Collect",
    text: "About every two hours Ouro's airdrop pays every wallet above the line, 100,000 OURO, in kind: the Reserve basket, CASHCAT and PONS today. Pooled, a vault clears the line even when no single depositor does, and the basket lands in the vault.",
  },
  {
    title: "Harvest",
    text: `A keeper sells the basket through the allowlisted venue into what the vault pays: more OURO, WETH or USDG. ${TERMS.performanceFeePct}% of the gain is the vault's fee, and the rest vests to depositors over ${TERMS.profitUnlock}.`,
  },
  {
    title: "Redeem or claim",
    text: "In the OURO vault every share is now worth more OURO. In the WETH and USDG vaults the payout accrues to your shares and you claim it whenever you like. Withdraw your deposit any time, including while a vault is paused.",
  },
];

const BUILT_IN = [
  "Your deposit only ever leaves a vault through your own withdrawal. No role can approve, transfer or rescue it, and the same holds for the payout token.",
  "The keeper can only sell the basket tokens, only through the venue the owner allowlisted, and never below the floor it commits to.",
  "Every harvest is booked from the vault's real balance. Tokens sent to a vault cannot move the share price until the keeper accounts for them.",
  "Pausing stops deposits and harvests. Withdrawals can never be paused.",
  "Ownership changes take two steps, so a mistyped address cannot take a vault.",
];

const RISKS = [
  "The vault contracts are new and have not been audited. Treat this as experimental software.",
  "The keeper is trusted with the basket tokens between airdrop and harvest. A bad route costs yield, not principal.",
  "Every swap a vault makes pays a pool fee and price impact, and the OURO vault's rebuy pays the 5% pool tax like any other buy. The keeper sells through the deepest pool it can find.",
  "Basket tokens waiting in a vault belong to whoever holds shares at the harvest. Withdrawing before a harvest forfeits your slice.",
  "The yield is Ouro's airdrop and nothing else. When trading in OURO cools, airdrops shrink, and the value of a deposit moves with the OURO price.",
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

const PLANNED_COLS: LedgerColumn[] = [
  { key: "v", label: "Vault" },
  { key: "s", label: "Status", align: "right" },
];
const PLANNED_ROWS = VAULTS.filter((x) => x.status !== "live").map((x) => {
  const t = TOKENS.find((k) => k.key === x.token)!;
  const p = PAYOUTS.find((k) => k.key === x.payout)!;
  return {
    v: `${t.symbol} → ${p.asset(t)}${x.shareSymbol ? ` (${x.shareSymbol})` : ""}`,
    s: x.address ? <AddressCell address={x.address} /> : <PendingCell>{STATUS_LABEL[x.status]}</PendingCell>,
  };
});

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
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
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

      <Callout title="Which payout?" style={{ marginTop: 24 }}>
        The OURO vault keeps you fully in OURO: each rebuy goes through WETH into the OURO pool and pays that pool's fee, the 5% tax and price impact, and the
        gain shows up as a rising share price. The WETH and USDG vaults leave your deposit untouched and skip the rebuy: the yield accrues to your shares in that
        token and you claim it, but it no longer compounds inside the vault. The keeper, the venue and the fee are the same in all three.
      </Callout>

      <Grid cols="0.95fr 1.05fr" gap={48} align="start" style={{ marginTop: 64 }}>
        <div>
          <MicroLabel style={{ marginBottom: 6 }}>The terms</MicroLabel>
          <div style={{ borderTop: hairline }}>
            <KVRow label="You deposit" value="OURO" />
            <KVRow label="You receive" value="ERC4626 shares, 1:1 at deposit" />
            <KVRow label="Minimum deposit" value="None" />
            <KVRow label="Deposit and withdrawal fees" value="0" />
            <KVRow label="Performance fee" value={`${TERMS.performanceFeePct}% of harvest gains`} />
            <KVRow label="Gains vest over" value={`${TERMS.profitUnlock}, linear`} />
            <KVRow label="Withdraw" value="Any time, even while paused" />
            <KVRow label="Claim (WETH, USDG vaults)" value="Any time, even while paused" />
          </div>
          <Callout tone="caution" title="The yield is the airdrop, nothing else" style={{ marginTop: 24 }}>
            Each vault holds OURO and only that. Its growth is whatever the airdrop pays: when trading in OURO cools, airdrops shrink and so does the vault's
            yield, and the value of a deposit moves with the OURO price. Nothing here is a promise of returns.
          </Callout>
        </div>

        <div>
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
      </Grid>

      <div style={{ marginTop: 96 }}>
        <SectionHead kicker="Why a vault" title="One line, cleared together." />
        <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
          <Col label="The line">
            The airdrop pays only wallets holding at least 0.01% of the supply, 100,000 OURO, and that line is fixed in tokens: as the market cap grows it
            prices out every holder who arrives later. Pools and the team vest are excluded, ordinary contracts are not, so pooled deposits clear the line
            together.
          </Col>
          <Col label="The chore" rule>
            The airdrop arrives as other tokens, the Reserve basket, about every two hours. Turning it into one asset by hand, every time, is a job. One
            keeper does it once, for everyone, into the asset each vault promises.
          </Col>
          <Col label="The proof" rule>
            Every harvest is a transaction: what was sold, where, and how much came back, booked against the vault's real balance. Each vault's history is
            public from its first block. Every amount on this page is read from the chain; only the dollar prices come from Ouro's own monitor.
          </Col>
        </Grid>
      </div>

      <div style={{ marginTop: 96 }}>
        <SectionHead
          kicker="Why Ouro built them"
          title="Every holder in, however small."
          sub="The airdrop line exists so that a payout in many small tokens is not shredded into dust across thousands of wallets. It also means the smallest holders, the ones the protocol most wants to keep, are the ones it cannot pay. The vaults square that: the line stays where it is, and anyone can stand behind it."
          style={{ marginBottom: 0 }}
        />
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: 620 }}>
          They also run, in public, the machinery the Reserve needs: a keeper that collects on schedule, sells through the right venue, books it onchain and
          shows its work. Ouro gets a track record anyone can check, and OURO holders get their airdrop in the form they prefer.
        </p>
      </div>

      <div style={{ marginTop: 96 }}>
        <SectionHead kicker="Trust model" title="Who can do what." titleStyle={{ fontSize: 30 }} style={{ marginBottom: 32 }} />
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
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead kicker="Safety and risks" title="Read before depositing." titleStyle={{ fontSize: 30 }} style={{ marginBottom: 32 }} />
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
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Parameters and addresses"
          title="Verify everything."
          titleStyle={{ fontSize: 30 }}
          sub="The terms are set at deploy and readable from each contract. All three vaults are verified on the explorer."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 32 }}
        />
        <Grid cols="1fr 1fr" gap={24} align="start">
          <LedgerTable compact columns={PARAM_COLS} rows={PARAM_ROWS} />
          <LedgerTable compact columns={ADDR_COLS} rows={ADDR_ROWS} />
        </Grid>
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Planned"
          title="The same vaults for HOOD10 and INDEX."
          titleStyle={{ fontSize: 30 }}
          sub="The contracts pool any dividend token whose payer excludes only pools and distributors. HOOD10 and INDEX are next; nothing of theirs is deployed, and each address publishes here the moment it exists."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 32 }}
        />
        <Grid cols="1fr 1fr" gap={24} align="start">
          <LedgerTable compact columns={PLANNED_COLS} rows={PLANNED_ROWS} />
        </Grid>
      </div>
    </Container>
  );
}

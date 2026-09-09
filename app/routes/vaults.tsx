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

const LEDE =
  "Deposit OURO, earn OURO. Or deposit OURO and earn dollars, or ETH \u2014 you pick. Ouro only pays its airdrops to wallets holding 100,000 OURO or more; a vault pools everyone's together so the pool qualifies even when you don't, and your share gets sold for you into whichever of the three you chose.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `OURO vaults · ${site.name}`,
    // Kept under ~155 characters, which is where a search result truncates.
    description: `Deposit OURO and earn OURO, dollars or ETH. The vault pools deposits so they clear Ouro's 100,000 OURO airdrop minimum together. ${TERMS.performanceFeePct}% fee on profit only.`,
    path: location.pathname,
    image: "/og/vaults.png",
  });
}

const HOW: { title: string; text: ReactNode }[] = [
  {
    title: "Put your OURO in",
    text: "Send any amount of OURO to the vault you want and you get back vault tokens that track your slice of the pool: own a hundredth of the pool, earn a hundredth of everything it makes. There is no minimum, and nothing is charged going in or coming out.",
  },
  {
    title: "The pool qualifies, so you do",
    text: "Every couple of hours Ouro pays an airdrop to each wallet holding 100,000 OURO or more, in the actual tokens \u2014 CASHCAT and PONS today. On your own, 20,000 OURO earns nothing at all. Sitting in the vault alongside everyone else's, the pool is comfortably over the line and the airdrop lands in the vault.",
  },
  {
    title: "A bot sells it for you",
    text: "On your own you would be sorting out CASHCAT and PONS by hand every two hours. Instead a bot does it \u2014 selling them for whatever your vault pays out in, and buying OURO back through Ouro's own pool so the trade's tax returns to holders instead of leaking to outside market makers. It can only ever sell the airdropped tokens, only on an exchange the owner approved in advance, and never below a price floor it commits to before the trade.",
  },
  {
    title: "You keep 90% of what it earns",
    text: `The vault takes ${TERMS.performanceFeePct}% of the profit it makes you, and nothing at all if it makes nothing. Your share of each sale phases in over ${TERMS.profitUnlock} rather than landing at once, so nobody can deposit just before a payout and walk off with it. Of the full ${TERMS.performanceFeePct}%, ${TERMS.feeSplit.airdrops} goes back out as more airdrops to OURO holders and ${TERMS.feeSplit.ops} covers gas, servers and the bot \u2014 our own policy rather than something the contract enforces, so a vault sends its whole fee to one address that anyone can watch on the explorer.`,
  },
  {
    title: "Take it out whenever you want",
    text: "In the OURO vault there is nothing to claim: each of your vault tokens is simply worth more OURO than it was. In the WETH and USDG vaults the money stacks up beside your deposit and you press claim when you feel like it. Your OURO itself comes back whenever you ask for it, even if the vault has been paused.",
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
  "Every trade a vault makes costs something: the exchange's own fee, plus a little slippage. The OURO vault's buy-back also pays OURO's 5% pool tax, deliberately \u2014 that tax goes to Ouro's treasury and back out to holders, where a cheaper route would hand the same money to outside market makers.",
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

      <Callout title="Which payout?" style={{ marginTop: 24 }}>
        The OURO vault keeps you fully in OURO: each rebuy routes through WETH into the OURO pool, paying that pool's fee, the 5% tax and price impact, and the
        gain shows up as a rising share price. The WETH and USDG vaults skip the rebuy and leave your deposit untouched: the yield accrues to your shares in that
        token and you claim it, but it stops compounding. The keeper, the venue and the fee are the same in all three.
      </Callout>

      <div className="vault-prose">
        <SectionHead kicker="Before you deposit" title="The details." titleStyle={{ fontSize: 30 }} style={{ marginBottom: 4 }} />
        <DisclosureList>
          <Disclosure kicker="The terms" title="What you get, and how it works.">
            <Grid cols="0.95fr 1.05fr" gap={48} align="start">
              <div>
                <div style={{ borderTop: hairline }}>
                  <KVRow label="You deposit" value="OURO" />
                  <KVRow label="You receive" value="ERC4626 shares, 1:1 at deposit" />
                  <KVRow label="Minimum deposit" value="None" />
                  <KVRow label="Deposit and withdrawal fees" value="0" />
                  <KVRow label="Performance fee" value={`${TERMS.performanceFeePct}% of harvest gains`} />
                  <KVRow label="Where the fee goes" value={`${TERMS.feeSplit.airdrops}% airdrops / ${TERMS.feeSplit.ops}% ops`} />
                  <KVRow label="Gains vest over" value={`${TERMS.profitUnlock}, linear`} />
                  <KVRow label="Withdraw" value="Any time, even while paused" />
                  <KVRow label="Claim (WETH, USDG vaults)" value="Any time, even while paused" />
                </div>
                <Callout tone="caution" title="The yield is the airdrop, nothing else" style={{ marginTop: 24 }}>
                  Each vault holds OURO and only that. Its growth is whatever the airdrop pays: when trading in OURO cools, airdrops shrink and so does the
                  vault's yield, and the value of a deposit moves with the OURO price. Nothing here is a promise of returns.
                </Callout>
              </div>

              <div>
                {/* The single most useful thing on the page for a first-time reader: one concrete
                    person, one concrete amount, no vocabulary. Added after "I don't get how this
                    works lol". Deliberately no yield figure — the live cards carry that, and a
                    number in prose here would read as a promise and go stale. */}
                <Callout title="Say you hold 20,000 OURO" style={{ marginBottom: 24 }}>
                  That is about a fifth of the 100,000 you need to qualify, so today Ouro&rsquo;s airdrops pass you by completely. Deposit it in the
                  Earn&nbsp;dollars vault and your 20,000 sits with everyone else&rsquo;s. Every couple of hours the pool is paid its airdrop, a bot sells
                  it for USDG, and your slice is credited to you &mdash; press claim whenever you like. Your 20,000 OURO is still yours the whole time and
                  comes back whenever you ask.
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
            </Grid>
          </Disclosure>

          {/* Was two sections, "Why a vault" and "Why Ouro built them", making the same argument
              twice: the line prices out small holders, pooling clears it, and the keeper does the
              chore in public. Merged into the three columns it always wanted to be. */}
          <Disclosure kicker="Why a vault" title="One line, cleared together.">
            <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
              <Col label="The line">
                The airdrop pays only wallets holding at least 0.01% of the supply, 100,000 OURO. That line exists so a payout in many small tokens is not
                shredded into dust across thousands of wallets, but it is fixed in tokens: as the market cap grows it prices out every holder who arrives
                later, and the smallest holders, the ones the protocol most wants to keep, are the ones it cannot pay. Pools and the team vest are excluded,
                ordinary contracts are not, so pooled deposits clear the line together and the line itself never has to move.
              </Col>
              <Col label="The chore" rule>
                The airdrop arrives as other tokens, the Reserve basket, about every two hours. Turning it into one asset by hand, every time, is a job. One
                keeper does it once, for everyone, into the asset each vault promises, and the fee that pays for it goes back out: {TERMS.feeSplit.airdrops}% of
                each harvest gain to more airdrops, {TERMS.feeSplit.ops}% to ops.
              </Col>
              <Col label="The proof" rule>
                Every harvest is a transaction: what was sold, where, and how much came back, booked against the vault's real balance. Each vault's history is
                public from its first block, so Ouro gets a track record anyone can check. Every amount on this page is read from the chain; only the dollar
                prices come from Ouro's own monitor.
              </Col>
            </Grid>
          </Disclosure>

          <Disclosure kicker="Trust model" title="Who can do what.">
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

          <Disclosure kicker="Safety and risks" title="Read before depositing." sub="What is built in, and what can still go wrong. The contracts are new and unaudited.">
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

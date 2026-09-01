import type { ReactNode } from "react";

import type { Route } from "./+types/vaults";
import { Badge, Button, Callout, Card, LedgerTable, Stat, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, Grid, KVRow, MicroLabel, NumberedRow, PageHeader, PendingCell, SectionHead, TokenIcon, body14, hairline, mono } from "~/components/site";
import { externalLinkProps, site } from "~/content/site";
import { PAYOUTS, STATUS_LABEL, TERMS, TOKENS, VAULTS, vaultFor, type IndexToken } from "~/content/vaults";
import { pageMeta } from "~/lib/meta";

const LEDE =
  "Pool your HOOD10 or INDEX in one vault. Together the deposits clear the dividend line, and one keeper sells each epoch's dividend for everyone. Choose what it pays you in: more of the token you deposited, WETH, or USDG.";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `HOOD10 and INDEX vaults · ${site.name}`,
    description: "Pool HOOD10 or INDEX, clear the dividend line together and let one keeper sell each epoch's dividend for everyone. Paid in your token, WETH or USDG.",
    path: location.pathname,
    image: "/og/vaults.png",
  });
}

const HOW: { title: string; text: string }[] = [
  { title: "Deposit", text: "Deposit HOOD10 or INDEX into the vault of your choice and receive ERC4626 shares priced in your token. Zap in with ETH if you prefer." },
  {
    title: "Collect",
    text: "Each token pays every address above its dividend line a dividend in kind each epoch, pushed straight to the holder: ten Robinhood Chain tokens for HOOD10, tokenized stocks for INDEX. Pooled, the vault clears the line even when no single depositor does.",
  },
  {
    title: "Harvest",
    text: `A keeper sells the dividend through allowlisted venues into the vault's payout asset. ${TERMS.performanceFeePct}% of the gain is the vault's fee, and the rest vests to depositors over a day.`,
  },
  {
    title: "Redeem or claim",
    text: "In a compounding vault every share is now worth more of your token. In a WETH or USDG vault the payout accrues to your shares to claim whenever you like. Withdraw your deposit any time, including while the vault is paused.",
  },
];

const BUILT_IN = [
  "Your deposit only ever leaves a vault through your own withdrawal. No role can approve, transfer or rescue it, and the same holds for the payout token.",
  "Keepers can only sell dividend tokens, only through venues the owner allowlisted, and never below the floor they commit to.",
  "Every harvest is booked from the vault's real balance. Tokens sent to a vault cannot move the share price until a keeper accounts for them.",
  "Pausing stops deposits and harvests. Withdrawals can never be paused.",
  "Ownership changes take two steps, so a mistyped address cannot take a vault.",
];

const RISKS = [
  "The vault contracts are new and have not been audited. Treat this as experimental software.",
  "Keepers are trusted with the dividend tokens between airdrop and harvest. A bad route costs yield, not principal.",
  "Every swap the vault makes pays a pool fee and price impact: zaps, dividend sales and compounding rebuys. The keeper sells through the cheapest venue it can quote and rebuys through WETH into the deepest pool it can find.",
  "Dividend tokens waiting in a vault belong to whoever holds shares at the harvest. Withdrawing before a harvest forfeits your slice.",
  "INDEX dividends arrive as tokenized stocks. Selling them depends on a venue that trades them, and stock market hours can delay a harvest.",
  "The yield is the index token's dividend and nothing else. When trading in HOOD10 or INDEX cools, dividends shrink, and the value of a deposit moves with the token's price.",
];

const TRUST: { who: string; can: string; cannot: string }[] = [
  { who: "Anyone", can: "Deposit, mint, withdraw, redeem, zap in, claim.", cannot: "Move anyone else's shares or a vault's deposits." },
  {
    who: "Keeper",
    can: "Run a harvest with any steps against allowlisted venues. Set the minimum the vault must receive.",
    cannot: "Sell the deposit token or the vault's shares. Use a venue that is not allowlisted.",
  },
  {
    who: "Owner (a Safe)",
    can: `Set keepers and venues, the performance fee (at most ${TERMS.maxPerformanceFeePct}%), the vesting period (at most ${TERMS.maxProfitUnlock}), the deposit limit and the fee recipient. Pause. While paused, rescue tokens other than the deposit and payout tokens.`,
    cannot: "Approve, transfer or rescue the deposit token or the payout token. Rescue anything while the vault is running. Register the deposit token or the vault itself as a venue.",
  },
];

const PARAM_COLS: LedgerColumn[] = [
  { key: "p", label: "Parameter" },
  { key: "v", label: "Value", align: "right", numeric: true },
];
const PARAM_ROWS = [
  ["Vaults", "6: HOOD10 and INDEX, each paying in itself, WETH or USDG"],
  ["Performance fee", `${TERMS.performanceFeePct}% of harvest gains, cap ${TERMS.maxPerformanceFeePct}%`],
  ["Deposit and withdrawal fees", "0"],
  ["Gains vest over", `${TERMS.profitUnlock}, cap ${TERMS.maxProfitUnlock}`],
  ["Deposit limit", "None at deploy"],
  ["Swap venues", `${TERMS.venue.name}, more allowlisted per token`],
  ["Pause", "Stops deposits and harvests. Withdrawals stay open"],
  ["Chain", `${site.chain.name} (${site.chain.id})`],
].map(([p, val]) => ({ p, v: <span style={{ ...mono, fontSize: 13 }}>{val}</span> }));

const ADDR_COLS: LedgerColumn[] = [
  { key: "c", label: "Contract" },
  { key: "a", label: "Address", align: "right" },
];
const ADDR_ROWS = [
  ...VAULTS.map((x) => {
    const t = TOKENS.find((k) => k.key === x.token)!;
    const p = PAYOUTS.find((k) => k.key === x.payout)!;
    return { c: `${t.symbol} → ${p.asset(t)} vault${x.shareSymbol ? ` (${x.shareSymbol})` : ""}`, a: x.address ? <AddressCell address={x.address} /> : <PendingCell>Publishes at deploy</PendingCell> };
  }),
  ...TOKENS.map((t) => ({ c: `${t.symbol} token`, a: <AddressCell address={t.address} /> })),
  ...TOKENS.map((t) => ({ c: t.hook.name, a: <AddressCell address={t.hook.address} /> })),
  { c: "Swap venue", a: <AddressCell address={TERMS.venue.address} /> },
  { c: TERMS.weth.name, a: <AddressCell address={TERMS.weth.address} /> },
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

/** One index token's three vaults, side by side, with the token's own dividend facts underneath. */
function TokenVaults({ token }: { token: IndexToken }) {
  return (
    <Card
      label={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TokenIcon symbol={token.symbol} src={token.icon} size={22} />
          {token.symbol} · {token.name}
        </span>
      }
      action={<span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>Dividend line {token.threshold}</span>}>
      <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
        {PAYOUTS.map((p, i) => {
          const entry = vaultFor(token.key, p.key);
          return (
            <div key={p.key} className={i ? "cell-rule" : undefined}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <MicroLabel>{p.label(token)}</MicroLabel>
                <Badge tone={entry.status === "awaiting-deploy" ? "caution" : "neutral"}>{STATUS_LABEL[entry.status]}</Badge>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, marginTop: 10 }}>
                <TokenIcon symbol={token.symbol} src={token.icon} size={20} />
                <span>
                  {token.symbol} → {p.asset(token)}
                </span>
              </div>
              <div style={{ ...body14, marginTop: 6 }}>{p.text(token)}</div>
              <div style={{ marginTop: 12, ...mono, fontSize: 12, color: "var(--text-faint)" }}>TVL — · {entry.shareSymbol ?? "Share token set at deploy"}</div>
            </div>
          );
        })}
      </Grid>
      <div style={{ marginTop: 24, borderTop: hairline }}>
        <KVRow label="Tax on every trade" value={token.taxLine} />
        <KVRow label="Dividend" value={token.dividend} />
        <KVRow label="Paid" value={token.cadence} />
        <div style={{ paddingTop: 12, fontSize: 13 }}>
          <a href={token.docsUrl ?? token.siteUrl} {...externalLinkProps(token.docsUrl ?? token.siteUrl)}>
            {token.docsUrl ? `How ${token.symbol} pays dividends ↗` : `${token.name} website ↗`}
          </a>
        </div>
      </div>
    </Card>
  );
}

export default function Vaults() {
  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="For HOOD10 and INDEX holders"
        title="The vaults."
        lede={LEDE}
        ledeStyle={{ maxWidth: 620 }}
        aside={
          <div style={{ paddingBottom: 4 }}>
            <Badge tone="caution">Awaiting deploy</Badge>
          </div>
        }
      />

      <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ margin: "40px 0 48px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}>
        <Stat label="Vaults" value={String(VAULTS.length)} footnote="Two index tokens, three payouts each" />
        <Stat className="cell-rule" label="Combined TVL" value="—" footnote="Publishes at deploy" />
        <Stat className="cell-rule" label="Harvests" value="0" footnote="One per epoch once dividends arrive" />
        <Stat className="cell-rule" label="Performance fee" value={`${TERMS.performanceFeePct}%`} footnote={`Of harvest gains only. Hard cap ${TERMS.maxPerformanceFeePct}%, and no deposit or withdrawal fee`} />
      </Grid>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {TOKENS.map((t) => (
          <TokenVaults key={t.key} token={t} />
        ))}
      </div>

      <Callout title="Which payout?" style={{ marginTop: 24 }}>
        Compounding keeps you fully in the index token. Each rebuy goes through WETH into the deepest pool the keeper can find and costs that pool's fee and price
        impact. WETH and USDG payouts leave your deposit untouched and skip the rebuy, but the yield no longer compounds inside the vault. The keeper, the venues and the fee are the same in all six.
      </Callout>

      <Grid cols="0.95fr 1.05fr" gap={48} align="start" style={{ marginTop: 64 }}>
        <Card label="Deposit and withdraw">
          <div style={{ padding: "8px 0 16px", ...body14 }}>The vault app handles deposits, zaps from ETH, claims and withdrawals. It opens with the first deploy. The terms are fixed now.</div>
          <div style={{ borderTop: hairline }}>
            <KVRow label="You deposit" value="HOOD10 or INDEX, or ETH via zap" />
            <KVRow label="You receive" value="ERC4626 shares" />
            <KVRow label="Minimum deposit" value="None" />
            <KVRow label="Deposit and withdrawal fees" value="0" />
            <KVRow label="Performance fee" value={`${TERMS.performanceFeePct}% of harvest gains`} />
            <KVRow label="Gains vest over" value={`${TERMS.profitUnlock}, linear`} />
            <KVRow label="Withdraw" value="Any time, even while paused" />
          </div>
          <div className="cta-row" style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <Button disabled>Open the vaults · at deploy</Button>
          </div>
        </Card>

        <div>
          <MicroLabel style={{ marginBottom: 6 }}>How the vaults work</MicroLabel>
          {HOW.map((s, i) => (
            <NumberedRow key={s.title} n={String(i + 1).padStart(2, "0")} py={16} borderBottom={i === HOW.length - 1}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
              <div style={{ ...body14, marginTop: 4 }}>{s.text}</div>
            </NumberedRow>
          ))}

          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 11, color: "var(--text-faint)", marginBottom: 6 }}>
              <span>0 h</span>
              <span>Harvest vesting</span>
              <span>24 h</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--neutral-050)", border: hairline }} />
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>No harvest yet. The first follows the first dividend.</div>
          </div>

          <Callout tone="caution" title="The yield is the token's dividend, nothing else" style={{ marginTop: 24 }}>
            Each vault holds its deposit token and only that. Its growth is whatever the token pays: when trading in HOOD10 or INDEX cools, dividends shrink
            and so does the vault's yield, and the value of a deposit moves with the token's price. Nothing here is a promise of returns.
          </Callout>
        </div>
      </Grid>

      <div style={{ marginTop: 96 }}>
        <SectionHead kicker="Why a vault" title="Many swaps every epoch, done once for everyone." />
        <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
          <Col label="The line">
            HOOD10 pays only wallets above 0.01% of supply, 100,000 HOOD10. INDEX pays only wallets holding at least 10,000 INDEX. Pools and the distributors
            are excluded, and ordinary contracts are not. Pooled deposits clear the line together.
          </Col>
          <Col label="The chore" rule>
            Dividends arrive as many tokens: ten for HOOD10 roughly every three hours, tokenized stocks for INDEX every hour. Turning them into one asset by
            hand is a job. One keeper does it once, for everyone.
          </Col>
          <Col label="The proof" rule>
            Every harvest is a transaction: what was sold, where, and how much came back, booked against the vault's real balance. Each vault's history is
            public from its first block.
          </Col>
        </Grid>
      </div>

      <div style={{ marginTop: 96 }}>
        <SectionHead
          kicker="Why Ouro built them"
          title="The same machinery, running early."
          sub="HOOD10 and INDEX pay their baskets out. Ouro keeps its own as owned liquidity. The designs disagree about what to do with a basket, and agree on what has to sit underneath one: a keeper that collects yield on schedule, sells it through the right venue, books it onchain and shows its work. The vaults run that machinery first."
          style={{ marginBottom: 0 }}
        />
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: 620 }}>
          The vaults are that machinery running in public before Ouro's own pool opens. HOOD10 and INDEX holders get their yield in the form they prefer, and
          Ouro gets a track record anyone can check.
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
          sub="The terms are set at deploy and readable from each contract. Vault addresses publish here the moment they exist."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 32 }}
        />
        <Grid cols="1fr 1fr" gap={24} align="start">
          <LedgerTable compact columns={PARAM_COLS} rows={PARAM_ROWS} />
          <LedgerTable compact columns={ADDR_COLS} rows={ADDR_ROWS} />
        </Grid>
      </div>
    </Container>
  );
}

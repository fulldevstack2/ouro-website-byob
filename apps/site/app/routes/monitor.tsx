import type { ReactNode } from "react";

import type { Route } from "./+types/monitor";
import { Badge, Callout, Card, LedgerTable, Stat, type BadgeTone, type LedgerColumn } from "@ouro/ds";
import { Bars } from "~/components/site/Bars";
import { AddressCell, Container, Grid, MicroLabel, PageHeader, SectionHead, TokenIcon, body14, hairline, mono } from "~/components/site";
import { externalLinkProps, site } from "~/content/site";
import { TOKENS, type IndexToken } from "~/content/vaults";
import { useClock } from "~/hooks/useClock";
import { pageMeta } from "~/lib/meta";
import {
  MONITOR_API,
  ago,
  fmtEth,
  fmtNum,
  fmtPct,
  fmtUsd,
  fmtWhen,
  shortHash,
  useMonitor,
  type AdminEvent,
  type DailyRow,
  type EpochOut,
  type Liveness,
  type Summary,
  type TokenKey,
  type TokenSummary,
} from "@ouro/monitor-client";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `Dividend monitor · INDEX and HOOD10, read from the chain`,
    description:
      "Live monitor of the two dividend tokens the Ouro vaults are built on: every INDEX and HOOD10 payout, the tax that funds it, who still receives it and what the operators change. Read from Robinhood Chain. Nothing is reported by hand.",
    path: location.pathname,
    image: "/og/monitor.png",
  });
}

const LEDE =
  "The two index tokens the vaults farm, watched from Robinhood Chain: every payout epoch, the tax that funds it, who still clears the dividend line, and every change their operators make. Independent and unaffiliated. None of it is reported by hand.";

type PageStatus = "loading" | "live" | "stale" | "offline" | "unconfigured";

function pageStatus(s: ReturnType<typeof useMonitor<Summary>>, nowSec: number): PageStatus {
  if (!MONITOR_API) return "unconfigured";
  if (s.data) {
    const fresh = s.updatedAt !== null && Date.now() - s.updatedAt < 5 * 60_000 && nowSec - s.data.generatedAt < 10 * 60;
    return fresh && !s.error ? "live" : "stale";
  }
  if (s.error) return "offline";
  return "loading";
}

const STATUS_BADGE: Record<PageStatus, { tone: BadgeTone; label: string }> = {
  loading: { tone: "neutral", label: "Connecting" },
  live: { tone: "positive", label: "Live" },
  stale: { tone: "caution", label: "Stale" },
  offline: { tone: "negative", label: "Monitor offline" },
  unconfigured: { tone: "neutral", label: "Monitor not configured" },
};

const LIVENESS_BADGE: Record<Liveness, { tone: BadgeTone; label: string }> = {
  ok: { tone: "positive", label: "Paying on time" },
  late: { tone: "caution", label: "Payout late" },
  stalled: { tone: "negative", label: "Payouts stalled" },
  unknown: { tone: "neutral", label: "No payout indexed yet" },
};

function TxLink({ explorer, tx }: { explorer: string | null; tx: string | undefined }) {
  if (!tx) return <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>—</span>;
  const text = <span style={{ ...mono, fontSize: 12 }}>{shortHash(tx)}</span>;
  if (!explorer) return text;
  const href = `${explorer}/tx/${tx}`;
  return (
    <a href={href} {...externalLinkProps(href)} style={{ color: "var(--text-secondary)" }}>
      {text}
    </a>
  );
}

const EPOCH_COLS: LedgerColumn[] = [
  { key: "n", label: "#", numeric: true },
  { key: "when", label: "Paid" },
  { key: "value", label: "Value", align: "right", numeric: true },
  { key: "recipients", label: "Recipients", align: "right", numeric: true },
  { key: "assets", label: "Tokens", align: "right", numeric: true },
  { key: "tx", label: "Tx", align: "right" },
];
const ADMIN_COLS: LedgerColumn[] = [
  { key: "when", label: "When" },
  { key: "what", label: "Operator action" },
  { key: "tx", label: "Tx", align: "right" },
];

function epochTx(e: EpochOut): string | undefined {
  const m = e.meta as Record<string, string | undefined>;
  return m.finalizedTx ?? m.endTx ?? m.rootTx ?? m.closedTx ?? m.startTx;
}

function epochRows(epochs: EpochOut[], explorer: string | null) {
  return epochs.map((e) => ({
    n: <span style={{ ...mono, fontSize: 13 }}>{e.epoch}</span>,
    when: (
      <span style={{ fontSize: 13 }}>
        {fmtWhen(e.endTs ?? e.startTs)}
        {e.status !== "closed" && <span style={{ marginLeft: 8, color: "var(--text-faint)", fontSize: 12 }}>{e.status === "aborted" ? "aborted" : "in progress"}</span>}
      </span>
    ),
    value: <span style={{ ...mono, fontSize: 13 }}>{fmtUsd(e.paidUsd)}</span>,
    recipients: <span style={{ ...mono, fontSize: 13 }}>{fmtNum(e.recipients)}</span>,
    assets: (
      <span style={{ ...mono, fontSize: 13 }} title={e.assets.map((a) => `${a.symbol ?? shortHash(a.address)} ${fmtNum(a.amountF, 4)}`).join("\n")}>
        {e.assets.length || "—"}
      </span>
    ),
    tx: <TxLink explorer={explorer} tx={epochTx(e)} />,
  }));
}

function adminRows(events: AdminEvent[], explorer: string | null) {
  const tone: Record<AdminEvent["severity"], BadgeTone> = { info: "neutral", warn: "caution", alert: "negative" };
  return events.map((ev) => ({
    when: <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmtWhen(ev.ts)}</span>,
    what: (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
        <Badge tone={tone[ev.severity]} dot>
          {ev.severity}
        </Badge>
        <span>{ev.summary}</span>
      </span>
    ),
    tx: <TxLink explorer={explorer} tx={ev.tx} />,
  }));
}

function poolsLabel(n: number | null): string {
  if (n === null) return "—";
  return n >= 60 ? "60+" : String(n);
}

/** A vault deposit token that ouro-monitor measures. OURO has vaults too, but the monitor tracks only the index tokens. */
type MonitoredToken = IndexToken & { key: TokenKey };
const MONITORED: MonitoredToken[] = TOKENS.filter((t): t is MonitoredToken => t.key === "hood10" || t.key === "index");

/** One index token: the live figures, two daily charts, the recent epochs, and the operator log. */
function TokenMonitor({ token, data, explorer, nowSec }: { token: MonitoredToken; data: TokenSummary | null; explorer: string | null; nowSec: number }) {
  const key: TokenKey = token.key;
  const daily = useMonitor<{ days: DailyRow[] }>(MONITOR_API ? `/v1/${key}/daily?days=30` : null, 120_000);
  const epochs = useMonitor<{ epochs: EpochOut[] }>(MONITOR_API ? `/v1/${key}/epochs?limit=10` : null, 60_000);
  const admin = useMonitor<{ events: AdminEvent[] }>(MONITOR_API ? `/v1/${key}/admin-log?limit=6` : null, 120_000);

  const live = data?.liveness;
  const lb = LIVENESS_BADGE[live?.status ?? "unknown"];
  const m = data?.market ?? null;
  const taxUsd24 = data && data.tax.ethPriceUsd !== null ? data.tax.h24.tax_eth * data.tax.ethPriceUsd : null;
  const due = live?.dueTs ?? null;
  const dueText = due === null ? "—" : due > nowSec ? `in ${ago(due - nowSec)}` : `${ago(nowSec - due)} overdue`;
  const lastText = live?.lastTs ? `${ago(nowSec - live.lastTs)} ago` : "—";
  const line = data?.dividendLineTokens ?? (token.key === "index" ? 10_000 : 100_000);
  const y = data?.yield;

  const days = daily.data?.days ?? [];
  const paidBars = days.map((d) => ({ t: d.day, value: d.paid_usd }));
  const taxBars = days.map((d) => ({ t: d.day, value: d.tax_eth > 0 ? d.tax_eth : null }));

  return (
    <Card
      label={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TokenIcon symbol={token.symbol} src={token.icon} size={22} />
          {token.symbol} · {token.name}
        </span>
      }
      action={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{data ? `epoch ${fmtNum(data.epochsIndexed)}` : ""}</span>
          <Badge tone={lb.tone} dot>
            {lb.label}
          </Badge>
        </span>
      }>
      <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ padding: "8px 0 24px", borderBottom: hairline }}>
        <Stat
          label="Paid to holders · 24 h"
          value={fmtUsd(data?.paid.h24.paid_usd ?? null, { compact: true })}
          footnote={data ? `${fmtUsd(data.paid.all.paid_usd, { compact: true })} all time across ${fmtNum(data.paid.all.epochs)} epochs` : "Publishes when the monitor is live"}
        />
        <Stat
          className="cell-rule"
          label={`Yield per ${fmtNum(line)} ${token.symbol}`}
          value={y && y.perLineUsdPerDay !== null ? fmtUsd(y.perLineUsdPerDay) : "—"}
          unit="/ day"
          footnote={y && y.aprPct !== null ? `≈ ${fmtNum(y.aprPct, 1)}% APR at spot, from the last ${y.basisDays} day${y.basisDays === 1 ? "" : "s"} of payouts` : "From payouts actually made, divided by the eligible supply"}
        />
        <Stat
          className="cell-rule"
          label="Tax collected · 24 h"
          value={fmtEth(data?.tax.h24.tax_eth ?? null)}
          unit="ETH"
          footnote={
            data
              ? `${taxUsd24 === null ? "" : `${fmtUsd(taxUsd24, { compact: true })} · `}${fmtEth(data.tax.all.tax_eth)} ETH all time · ${data.tax.exact ? "exact, from the hook's own events" : `estimated at ${data.taxBps / 100}% of the ETH leg`}`
              : token.taxLine
          }
        />
        <Stat
          className="cell-rule"
          label="Taxed share of volume"
          value={fmtPct(m?.taxed_share ?? null)}
          footnote={m ? `${fmtUsd(m.vol24_taxed_usd, { compact: true })} of ${fmtUsd(m.vol24_all_usd, { compact: true })} 24 h volume went through the taxed pool · ${poolsLabel(m.pools)} pools` : "Hook pool volume ÷ volume across every pool"}
        />
      </Grid>
      <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ padding: "24px 0", borderBottom: hairline }}>
        <Stat size="sm" label="Price" value={m && m.price_usd !== null ? `$${m.price_usd < 1 ? m.price_usd.toPrecision(4) : m.price_usd.toFixed(2)}` : "—"} footnote={m ? `FDV ${fmtUsd(m.fdv_usd, { compact: true })}` : undefined} />
        <Stat
          size="sm"
          className="cell-rule"
          label="Holders above the line"
          value={fmtNum(data?.holders.aboveLine ?? null)}
          footnote={data ? `${fmtNum(data.holders.recipientsLast)} paid in the last epoch${data.eligibleTokens ? ` · ${fmtNum(data.eligibleTokens / 1e6, 1)}M ${token.symbol} eligible` : ""}` : `Line: ${token.threshold}`}
        />
        <Stat size="sm" className="cell-rule" label="Last payout" value={lastText} footnote={data?.lastEpoch ? `Epoch ${data.lastEpoch.epoch} · ${fmtUsd(data.lastEpoch.paidUsd)} to ${fmtNum(data.lastEpoch.recipients)} holders` : token.cadence} />
        <Stat size="sm" className="cell-rule" label="Next expected" value={dueText} footnote={live ? `${live.source} · cadence ≈ ${ago(live.cadenceSec)}` : token.cadence} />
      </Grid>

      <Grid cols="1fr 1fr" gap={32} className="grid--2col-md" style={{ padding: "24px 0", borderBottom: hairline }}>
        <div>
          <MicroLabel style={{ marginBottom: 10 }}>Paid to holders · $ per day · 30 days</MicroLabel>
          <Bars data={paidBars} format={(v) => fmtUsd(v, { compact: true })} ariaLabel={`${token.symbol} dividends paid per day, last 30 days`} />
        </div>
        <div>
          <MicroLabel style={{ marginBottom: 10 }}>Tax collected · ETH per day · 30 days</MicroLabel>
          <Bars data={taxBars} format={(v) => `${fmtEth(v)} ETH`} color="var(--text-muted)" ariaLabel={`${token.symbol} pool tax collected per day, last 30 days`} />
        </div>
      </Grid>

      <div style={{ paddingTop: 24 }}>
        <MicroLabel style={{ marginBottom: 12 }}>Recent payout epochs</MicroLabel>
        {epochs.data && epochs.data.epochs.length > 0 ? (
          <LedgerTable compact columns={EPOCH_COLS} rows={epochRows(epochs.data.epochs, explorer)} />
        ) : (
          <div style={{ ...body14, color: "var(--text-faint)", padding: "8px 0 16px" }}>{epochs.loading ? "Loading…" : "No epochs indexed yet."}</div>
        )}
      </div>

      <div style={{ paddingTop: 24 }}>
        <MicroLabel style={{ marginBottom: 12 }}>Operator actions · what the keys did</MicroLabel>
        {admin.data && admin.data.events.length > 0 ? (
          <LedgerTable compact columns={ADMIN_COLS} rows={adminRows(admin.data.events, explorer)} />
        ) : (
          <div style={{ ...body14, color: "var(--text-faint)", padding: "8px 0 16px" }}>{admin.loading ? "Loading…" : "No operator actions indexed."}</div>
        )}
      </div>

      <div style={{ marginTop: 24, borderTop: hairline, paddingTop: 14, display: "flex", flexWrap: "wrap", gap: "6px 24px", fontSize: 12, color: "var(--text-faint)", alignItems: "center" }}>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Token <AddressCell address={token.address} />
        </span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Hook <AddressCell address={token.hook.address} />
        </span>
        <a href={token.docsUrl ?? token.siteUrl} {...externalLinkProps(token.docsUrl ?? token.siteUrl)}>
          {token.name} ↗
        </a>
      </div>
    </Card>
  );
}

function Method({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: hairline }}>
      <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: "var(--accent)", width: 26, flex: "none" }}>{n}</span>
      <div style={body14}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{title}. </span>
        {children}
      </div>
    </div>
  );
}

export default function Monitor() {
  const clock = useClock();
  const summary = useMonitor<Summary>(MONITOR_API ? "/v1/summary" : null, 30_000);
  const nowSec = summary.data ? Math.floor(Date.now() / 1000) : 0;
  const status = pageStatus(summary, nowSec);
  const sb = STATUS_BADGE[status];
  const explorer = summary.data?.chain.explorer ?? (site.links.explorer !== "#" ? site.links.explorer : null);

  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Live proof · upstream"
        title="The dividend monitor."
        lede={LEDE}
        ledeStyle={{ maxWidth: 680 }}
        aside={
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 4 }}>
            <Badge tone={sb.tone} dot>
              {sb.label}
            </Badge>
            <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>
              {clock}
              {summary.data ? ` · block ${fmtNum(summary.data.head)}` : ""}
            </span>
          </div>
        }
      />

      {status === "unconfigured" && (
        <Callout tone="caution" title="Monitor not configured for this build" style={{ marginTop: 32 }}>
          Set <code style={mono}>MONITOR_API_URL</code> at build time to the Monitor's origin. Until then every figure below shows a dash.
        </Callout>
      )}
      {status === "offline" && (
        <Callout tone="caution" title="The monitor is not answering" style={{ marginTop: 32 }}>
          The page could not reach the Monitor ({summary.error}). Figures return as soon as it does. Nothing is cached or estimated here.
        </Callout>
      )}
      {status === "stale" && summary.data && (
        <Callout tone="caution" title="Showing the last good reading" style={{ marginTop: 32 }}>
          Last refreshed {summary.updatedAt ? ago((Date.now() - summary.updatedAt) / 1000) : "—"} ago. The monitor's own reading is from {fmtWhen(summary.data.generatedAt)}.
        </Callout>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 40 }}>
        {MONITORED.map((t) => (
          <TokenMonitor key={t.key} token={t} data={summary.data?.tokens[t.key] ?? null} explorer={explorer} nowSec={nowSec} />
        ))}
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Method"
          title="How this is measured."
          titleStyle={{ fontSize: 30 }}
          sub="Every number is derived from Robinhood Chain events by the Monitor, an open indexer we run. Prices and pool volumes come from GeckoTerminal. A missing price leaves a dash, never an estimate."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 24 }}
        />
        <Grid cols="1fr 1fr" gap={48} align="start">
          <div>
            <Method n="01" title="INDEX payouts">
              One epoch per distribution cycle of <code style={mono}>USDGBuyerDistributorV2</code>: the keeper's USDG → stock buys, the holder snapshot, and the <code style={mono}>Distributed</code> event per stock. Value is the USDG actually spent (the buys reveal each stock's price). Recipients and the eligible supply come from the cycle's own events.
            </Method>
            <Method n="02" title="HOOD10 payouts">
              The distributor is unverified, so it is read from its own events: <code style={mono}>PeriodClosed</code> / <code style={mono}>RootCommitted</code>, one <code style={mono}>Claimed</code> per wallet per basket token as the crank pushes, and a settlement event whose WETH figure is the period's cost. Payouts are marked to GeckoTerminal daily closes at push time. The eligible supply is Σ balances ≥ 100,000 HOOD10, replayed from the token's own transfers. Tokens that leave the distributor without a claim show up in the operator log.
            </Method>
            <Method n="03" title="Tax">
              HOOD10: exact, from the hook's <code style={mono}>FeeAccrued</code> events. INDEX: its hook emits nothing, so the tax is estimated at 3% of the ETH leg of every swap in the taxed pool (the four swap shapes differ by less than 0.1% of volume) and checked against the treasury's USDG inflows.
            </Method>
          </div>
          <div>
            <Method n="04" title="Taxed share of volume">
              The taxed pool's 24 h volume divided by 24 h volume across every pool GeckoTerminal lists for the token. This is the leak: volume the tax never touches, paying nothing to holders.
            </Method>
            <Method n="05" title="Yield">
              Payouts over the last seven days, per day, divided by the eligible supply, scaled to one dividend line. The APR uses the spot price. It is what holders actually received, not a projection.
            </Method>
            <Method n="06" title="Liveness">
              INDEX publishes <code style={mono}>nextDistribution()</code>. HOOD10 does not, so the typical gap between recent periods is used. Late means more than half a cycle overdue. Stalled means more than two cycles.
            </Method>
          </div>
        </Grid>
        <Callout style={{ marginTop: 32 }} title="Why this page exists">
          The vaults' yield is exactly these dividend streams and nothing else. Anyone deciding whether to pool their HOOD10 or INDEX should be able to see the stream live, including the moments the operators change something. The Ledger applies the same treatment to Ouro's own treasury.
        </Callout>
      </div>
    </Container>
  );
}

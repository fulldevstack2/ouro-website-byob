import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";

import { Badge, Button, Card, Stat } from "@ouro/ds";
import { BASKET_TOKENS } from "~/content/protocol";
import { site } from "~/content/site";
import { TOKENS } from "~/content/vaults";
import {
  MONITOR_API,
  fmtNum,
  fmtPct,
  fmtTokens,
  fmtUsd,
  useMonitor,
  type OuroCycle,
  type OuroYield,
} from "@ouro/monitor-client";
import { Container } from "./Container";
import { Grid } from "./Grid";
import { KVRow } from "./KVRow";
import { MicroLabel } from "./MicroLabel";
import { SectionHead } from "./SectionHead";
import { TokenIcon } from "./TokenIcon";
import { body14, hairline, mono } from "./text";

const OURO = TOKENS.find((t) => t.key === "ouro")!;
const LINE = OURO.thresholdTokens;
const PRESETS = [LINE, 250_000, 500_000, 1_000_000, 5_000_000] as const;
const MAX_HOLD = 50_000_000;

/** Site-known basket marks, keyed by address — the monitor may still return a null symbol for a new leg. */
const BASKET_BY_ADDR = new Map(BASKET_TOKENS.map((b) => [b.address.toLowerCase(), b]));
const BASKET_ORDER = new Map(BASKET_TOKENS.map((b, i) => [b.address.toLowerCase(), i]));

/**
 * Landing-page airdrop calculator, in the spirit of HOOD10's #calc: drag a holding size, see what
 * recent cycles would have paid it. Trailing, not a forecast. Numbers come from `/v1/ouro/yield`
 * and the latest closed cycle's basket legs.
 *
 * Deliberately wallet-free: the home page keeps wagmi/RainbowKit out of its bundle (same rule as
 * AprHeadline). Connect on /portfolio for a live balance check.
 */
export function AirdropCalc() {
  const y = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);
  const epochs = useMonitor<{ token: string; epochs: OuroCycle[] }>(MONITOR_API ? "/v1/ouro/epochs?limit=5" : null, 120_000);

  const [holdings, setHoldings] = useState<number>(LINE);

  const last = useMemo(() => {
    const rows = epochs.data?.epochs ?? [];
    return rows.find((c) => (c.status === "closed" || c.status === "aborted") && c.paidUsd !== null) ?? null;
  }, [epochs.data]);

  const d = y.data;
  const price = d?.priceUsd ?? null;
  const eligible = d?.eligibleTokens ?? null;
  const paidPerDay = d?.paidUsdPerDay ?? null;
  const above = holdings >= LINE;
  const positionUsd = price === null ? null : holdings * price;
  const share = above && eligible && eligible > 0 ? holdings / eligible : null;
  const perDay = share === null || paidPerDay === null ? null : share * paidPerDay;
  const perMonth = perDay === null ? null : perDay * 30;
  const trailingPct =
    above && positionUsd !== null && positionUsd > 0 && perDay !== null ? (perDay * 365) / positionUsd : null;

  const slice = useMemo(() => {
    if (!last?.assets?.length || share === null) return [];
    return last.assets
      .filter((a) => a.amountF > 1e-6)
      .map((a) => {
        const known = BASKET_BY_ADDR.get(a.address.toLowerCase());
        return {
          address: a.address.toLowerCase(),
          symbol: known?.symbol ?? a.symbol ?? a.address.slice(0, 6),
          icon: known?.icon,
          amountF: a.amountF * share,
          usd: a.usd === null ? null : a.usd * share,
        };
      })
      .sort((a, b) => {
        const ia = BASKET_ORDER.get(a.address) ?? 999;
        const ib = BASKET_ORDER.get(b.address) ?? 999;
        return ia - ib || a.symbol.localeCompare(b.symbol);
      });
  }, [last, share]);

  const status = !MONITOR_API
    ? "unconfigured"
    : y.loading && !d
      ? "loading"
      : d?.withheld
        ? "withheld"
        : d
          ? "ready"
          : y.error
            ? "offline"
            : "loading";

  return (
    <Container id="calc" style={{ paddingTop: 96 }}>
      <SectionHead
        kicker="The calculator"
        title="What would you collect."
        sub="Based on recent airdrops, trailing, not a forecast."
      />

      <Grid cols="1.1fr 0.9fr" gap={28} className="grid--2col-md" align="start">
        <Card label="You hold">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...mono, fontSize: 28, fontWeight: 600, letterSpacing: "var(--tracking-mono-big)", color: "var(--text-primary)" }}>
              {fmtTokens(holdings)} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>OURO</span>
            </div>
            <span style={{ ...body14, color: "var(--text-muted)", fontStyle: "italic" }}>Drag or pick a size</span>
          </div>

          <input
            type="range"
            min={0}
            max={MAX_HOLD}
            step={LINE / 10}
            value={Math.min(holdings, MAX_HOLD)}
            onChange={(e) => setHoldings(Number(e.target.value))}
            aria-label="OURO holdings"
            style={{ width: "100%", marginTop: 18, accentColor: "var(--bronze-600)" }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {PRESETS.map((n) => (
              <button key={n} type="button" onClick={() => setHoldings(n)} style={chip(holdings === n)}>
                {n === LINE ? "The line" : fmtTokens(n)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, borderTop: hairline }}>
            <KVRow label="Position value" value={fmtUsd(positionUsd)} />
            <KVRow label="Share of eligible supply" value={share === null ? "—" : fmtPct(share, 4)} />
            <KVRow label="The line" value={`${fmtNum(LINE)} OURO`} border="none" />
          </div>

          {!above && (
            <div style={{ ...body14, marginTop: 14 }}>
              Below {fmtNum(LINE)} OURO this wallet is not paid by the airdrop.{" "}
              <Link to="/vaults/" style={{ color: "var(--text-accent)" }}>
                Pool in a vault →
              </Link>
            </div>
          )}
        </Card>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <MicroLabel>You&apos;d collect</MicroLabel>
            {above ? (
              <Badge tone="positive" dot>
                Above the line
              </Badge>
            ) : (
              <Badge tone="caution" dot>
                Below the line
              </Badge>
            )}
          </div>

          {status === "unconfigured" || status === "offline" || status === "withheld" ? (
            <p style={{ ...body14, fontStyle: "italic", color: "var(--text-muted)" }}>
              {status === "withheld" ? (d?.withheld ?? "Nothing to state yet.") : "The monitor did not answer. Figures stay a dash until it does."}
            </p>
          ) : status === "loading" ? (
            <p style={{ ...body14, fontStyle: "italic", color: "var(--text-muted)" }}>Reading recent payouts…</p>
          ) : (
            <>
              <Grid cols="1fr 1fr" gap={20}>
                <Stat label="Per day" value={above ? fmtUsd(perDay) : "—"} footnote="At the recent rate" size="lg" />
                <Stat className="cell-rule" label="Per month" value={above ? fmtUsd(perMonth) : "—"} footnote="× 30 days" size="lg" />
              </Grid>
              <div style={{ marginTop: 20, borderTop: hairline }}>
                <KVRow label="Trailing yield" value={trailingPct === null ? "—" : `${fmtNum(trailingPct * 100, 1)}% / yr`} />
                <KVRow
                  label="Basis"
                  value={
                    d?.basisDays != null
                      ? `${fmtNum(d.basisDays, 1)} days · ${fmtNum(d.cycles)} cycles · ${fmtUsd(d.paidUsd)} paid`
                      : "—"
                  }
                  border="none"
                />
              </div>
              {d?.caveat && <p style={{ ...body14, marginTop: 12, color: "var(--text-muted)" }}>{d.caveat}</p>}
              <p style={{ ...body14, marginTop: 12, color: "var(--text-muted)" }}>
                What recent payouts would pay a holding this size. It moves with volume and is not a forecast.
                {last ? ` Slice below uses cycle ${last.epoch}.` : ""}
              </p>
            </>
          )}
        </div>
      </Grid>

      {above && slice.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <MicroLabel>Your slice, last cycle · in kind</MicroLabel>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {slice.map((s) => (
              <div
                key={s.address}
                style={{
                  border: hairline,
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  background: "var(--surface-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TokenIcon symbol={s.symbol} src={s.icon} size={18} />
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>{s.symbol}</span>
                </div>
                <div style={{ ...mono, marginTop: 8, fontSize: 16, fontWeight: 600 }}>{fmtTokens(s.amountF)}</div>
                <div style={{ ...body14, marginTop: 2, color: "var(--text-muted)" }}>{fmtUsd(s.usd)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Button variant="secondary" arrow to="/airdrops/">
          See every payout
        </Button>
        <Button variant="ghost" arrow href={site.links.buy} target="_blank" rel="noreferrer">
          Buy $OURO
        </Button>
      </div>
    </Container>
  );
}

function chip(active: boolean): CSSProperties {
  return {
    border: active ? "1px solid var(--bronze-600)" : hairline,
    background: active ? "var(--surface-tint)" : "var(--surface-card)",
    color: "var(--text-primary)",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "var(--tracking-caps)",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  };
}

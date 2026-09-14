import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Badge, Button, Card, Stat } from "@ouro/ds";
import { BASKET_TOKENS, LINE_TOKENS } from "~/content/protocol";
import { site } from "~/content/site";
import { MONITOR_API, fmtNum, fmtPct, fmtTokens, fmtUsd, useMonitor, type OuroCycle, type OuroYield } from "@ouro/monitor-client";
import { Container } from "./Container";
import { KVRow } from "./KVRow";
import { MicroLabel } from "./MicroLabel";
import { SectionHead } from "./SectionHead";
import { TokenIcon } from "./TokenIcon";
import { body14 } from "./text";

const LINE = LINE_TOKENS;
const PRESETS = [LINE, 250_000, 500_000, 1_000_000, 5_000_000] as const;
const MAX_HOLD = 50_000_000;

/** Site-known basket marks, keyed by address: the monitor may still return a null symbol for a new leg. */
const BASKET_BY_ADDR = new Map(BASKET_TOKENS.map((b) => [b.address.toLowerCase(), b]));
const BASKET_ORDER = new Map(BASKET_TOKENS.map((b, i) => [b.address.toLowerCase(), i]));

/** "250K", "1M": the preset chips, short. */
function compactTokens(n: number): string {
  const trim = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, ""));
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trim(n / 1_000)}K`;
  return fmtNum(n);
}

/**
 * The calculator: drag a holding size, see what recent cycles would have paid it. Trailing, not a
 * forecast. Numbers come from `/v1/ouro/yield` and the latest closed cycle's basket legs.
 *
 * Deliberately wallet-free: the home page keeps wagmi and RainbowKit out of its bundle. Connect on
 * /portfolio for a live balance.
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
  const trailingPct = above && positionUsd !== null && positionUsd > 0 && perDay !== null ? (perDay * 365) / positionUsd : null;

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

  const status = !MONITOR_API ? "unconfigured" : y.loading && !d ? "loading" : d?.withheld ? "withheld" : d ? "ready" : y.error ? "offline" : "loading";

  return (
    <Container id="calc" className="home-section">
      <SectionHead kicker="The calculator" title="What a holding your size collects." sub="Trailing, from recent cycles. Not a forecast." />

      <div className="calc">
        <Card label="You hold">
          <div className="calc__figure">
            <div className="calc__holdings">
              {fmtNum(holdings)} <span className="calc__unit">OURO</span>
            </div>
            <span className="calc__hint">Drag or pick a size</span>
          </div>

          <input
            type="range"
            className="calc__range"
            min={0}
            max={MAX_HOLD}
            step={LINE / 10}
            value={Math.min(holdings, MAX_HOLD)}
            onChange={(e) => setHoldings(Number(e.target.value))}
            aria-label="OURO holdings"
          />

          <div className="calc__presets">
            {PRESETS.map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={holdings === n} onClick={() => setHoldings(n)}>
                {n === LINE ? "The line" : compactTokens(n)}
              </button>
            ))}
          </div>

          <div className="calc__rows">
            <KVRow label="Position value" value={fmtUsd(positionUsd)} />
            <KVRow label="Share of eligible supply" value={share === null ? "—" : fmtPct(share, 4)} />
            <KVRow label="The line" value={`${fmtNum(LINE)} OURO`} border="none" />
          </div>

          {!above && (
            <div style={{ ...body14, marginTop: 6 }}>
              Below {fmtNum(LINE)} OURO this wallet is not paid by the airdrop. <Link to="/vaults/">Pool in a vault →</Link>
            </div>
          )}
        </Card>

        <div>
          <div className="calc__collect-head">
            <MicroLabel>You&apos;d collect</MicroLabel>
            <Badge tone={above ? "positive" : "caution"} dot>
              {above ? "Above the line" : "Below the line"}
            </Badge>
          </div>

          {status === "unconfigured" || status === "offline" || status === "withheld" ? (
            <p style={{ ...body14, fontStyle: "italic", color: "var(--text-muted)", margin: 0 }}>
              {status === "withheld" ? (d?.withheld ?? "Nothing to state yet.") : "The monitor did not answer. Figures stay a dash until it does."}
            </p>
          ) : status === "loading" ? (
            <p style={{ ...body14, fontStyle: "italic", color: "var(--text-muted)", margin: 0 }}>Reading recent payouts…</p>
          ) : (
            <>
              <div className="calc__pair">
                <Stat size="lg" label="Per day" value={above ? fmtUsd(perDay) : "—"} footnote="At the recent rate" />
                <Stat size="lg" className="cell-rule" label="Per month" value={above ? fmtUsd(perMonth) : "—"} footnote="× 30 days" />
              </div>
              <div className="calc__rows">
                <KVRow label="Trailing yield" value={trailingPct === null ? "—" : `${fmtNum(trailingPct * 100, 0)}% / yr`} />
                <KVRow
                  label="Basis"
                  value={d?.basisDays != null ? `${fmtNum(d.basisDays, 1)} days · ${fmtNum(d.cycles)} cycles · ${fmtUsd(d.paidUsd)} paid` : "—"}
                  border="none"
                />
              </div>
              <p style={{ ...body14, color: "var(--text-muted)", margin: "12px 0 0" }}>
                {d?.caveat ? `${d.caveat} ` : ""}What recent payouts would pay a holding this size. It moves with volume.
                {last && above ? ` The slice below uses cycle ${last.epoch}.` : ""}
              </p>
            </>
          )}

          {above && slice.length > 0 && (
            <div className="slice">
              {slice.map((s) => (
                <div key={s.address} className="slice__card">
                  <div className="slice__sym">
                    <TokenIcon symbol={s.symbol} src={s.icon} size={16} />
                    <span>{s.symbol}</span>
                  </div>
                  <div className="slice__amt">{fmtTokens(s.amountF)}</div>
                  <div className="slice__usd">{fmtUsd(s.usd)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="calc__ctas">
            <Button variant="secondary" arrow to="/airdrops/">
              See every payout
            </Button>
            <Button variant="ghost" arrow href={site.links.buy} target="_blank" rel="noreferrer">
              Buy {site.ticker}
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}

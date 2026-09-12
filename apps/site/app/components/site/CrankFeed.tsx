import { Link } from "react-router";

import { Badge, Card } from "@ouro/ds";
import { useClock } from "~/hooks/useClock";
import { MONITOR_API, fmtNum, fmtTokens, fmtUsd, fmtWhen, useMonitor, type OuroCycle } from "@ouro/monitor-client";
import { NumberedRow } from "./NumberedRow";
import { hairline, mono } from "./text";

/** What a cycle does, shown before there is a cycle to show. */
const STEPS: { n: string; title: string; detail: string; unit?: string }[] = [
  { n: "01", title: "Collect", detail: ": fees from every position, in the tokens they were earned in" },
  { n: "02", title: "Deploy", detail: ": tax ETH split 2 airdrop / 2 LP / 0.7 ops", unit: " ETH" },
  { n: "03", title: "Airdrop", detail: ": cycle fees split 80 / 20 between holders and the Reserve" },
];

/**
 * "Cycle feed" card: the last three cycles, read from the chain.
 *
 * It used to be a hardcoded prelaunch placeholder — a caution badge reading "Awaiting cycle #1" and
 * a dash in every amount — and it stayed that way past launch, so the section headed LIVE PROOF was
 * the one part of the site stating something the chain disagreed with: 38 cycles had run and were
 * listed in full on /airdrops. A page that argues "if a number here ever disagrees with the chain,
 * the chain is right" cannot carry a dead placeholder under that heading.
 *
 * The three steps survive as the EMPTY STATE. They are still true, and they are the right thing to
 * show when the monitor is unset for a build or unreachable — better than an empty card, and it is
 * how the page renders when it is pre-rendered, before hydration reaches the API.
 */
export function CrankFeed({ footer }: { footer: string }) {
  const clock = useClock();
  const cycles = useMonitor<{ epochs: OuroCycle[] }>(MONITOR_API ? "/v1/ouro/epochs?limit=3" : null, 120_000);
  const rows = cycles.data?.epochs ?? [];
  const latest = rows[0];

  return (
    <Card label="Cycle feed">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14 }}>
          {latest ? (
            <Badge tone="positive" dot>
              Cycle #{latest.epoch}
            </Badge>
          ) : (
            <Badge tone="caution">Awaiting cycle #1</Badge>
          )}
          <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>
            {clock} · {latest ? "live" : "watching"}
          </span>
        </div>

        {latest
          ? rows.map((c) => (
              <NumberedRow
                key={c.epoch}
                n={`#${c.epoch}`}
                py={14}
                align="baseline"
                indexWidth={36}
                trailing={<span style={{ ...mono, fontSize: 13, whiteSpace: "nowrap" }}>{fmtUsd(c.paidUsd)}</span>}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtWhen(c.endTs ?? c.startTs)}</span>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  {" · "}
                  {c.assets.map((a) => `${fmtTokens(a.amountF)} ${a.symbol ?? "?"}`).join(" + ") || "—"} to {fmtNum(c.recipients)} wallets
                  {/* A cycle number the keeper re-used is several payments, not one. Say so rather than
                      publish four payouts as a single line. /airdrops gives each its own row. */}
                  {c.txs > 1 ? ` · ${fmtNum(c.txs)} payments` : ""}
                </span>
              </NumberedRow>
            ))
          : STEPS.map((s) => (
              <NumberedRow
                key={s.n}
                n={s.n}
                py={14}
                align="baseline"
                trailing={<span style={{ ...mono, fontSize: 13, color: "var(--text-faint)" }}>—{s.unit}</span>}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</span>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{s.detail}</span>
              </NumberedRow>
            ))}

        <div style={{ borderTop: hairline, paddingTop: 14, fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ maxWidth: 520 }}>{footer}</span>
          <Link to="/airdrops/" style={{ whiteSpace: "nowrap" }}>
            See every airdrop →
          </Link>
        </div>
      </div>
    </Card>
  );
}

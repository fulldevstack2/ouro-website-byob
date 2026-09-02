import { useMemo } from "react";
import { useCountdown } from "~/hooks/useCountdown";
import { site } from "~/content/site";
import { mono } from "./text";

const pad = (n: number) => String(n).padStart(2, "0");

const cell: React.CSSProperties = {
  ...mono,
  fontSize: 22,
  lineHeight: 1,
  color: "var(--text-primary)",
  fontVariantNumeric: "tabular-nums",
};
const unit: React.CSSProperties = {
  ...mono,
  fontSize: 9.5,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  marginTop: 5,
};

export function PayoutCountdown({ compact = false }: { compact?: boolean }) {
  const target = useMemo(() => new Date(site.firstPayoutISO), []);
  const c = useCountdown(target);

  const parts = c
    ? [
        { v: pad(c.d), u: "days" },
        { v: pad(c.h), u: "hrs" },
        { v: pad(c.m), u: "min" },
        { v: pad(c.s), u: "sec" },
      ]
    : [
        { v: "––", u: "days" },
        { v: "––", u: "hrs" },
        { v: "––", u: "min" },
        { v: "––", u: "sec" },
      ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: compact ? "14px 16px" : "16px 20px",
        background: "var(--surface-card)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <span style={{ ...mono, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-accent)" }}>
        {c?.passed ? "First payout · due now" : "First payout in"}
      </span>
      {c?.passed ? (
        <span style={{ ...cell, fontSize: compact ? 16 : 18 }}>Running the first cycle</span>
      ) : (
        <div style={{ display: "flex", gap: compact ? 18 : 26 }}>
          {parts.map((p) => (
            <span key={p.u} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={cell}>{p.v}</span>
              <span style={unit}>{p.u}</span>
            </span>
          ))}
        </div>
      )}
      <span style={{ ...mono, fontSize: 11, color: "var(--text-secondary)" }}>
        12:00 GMT+8 &nbsp;·&nbsp; hold ≥ 100,000 $OURO to be paid
      </span>
    </div>
  );
}

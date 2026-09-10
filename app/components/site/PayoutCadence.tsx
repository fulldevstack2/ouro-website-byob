import { useMemo } from "react";
import { Link } from "react-router";
import { useCountdown } from "~/hooks/useCountdown";
import { site } from "~/content/site";
import { mono } from "./text";

/**
 * The airdrop cadence, stated as a target rather than a promise.
 *
 * This replaced a live countdown to the next payout. The countdown was the wrong shape for the
 * mechanism: it read as a guarantee that a payout lands on a fixed clock, when a cycle actually runs
 * only if it is worth running. Gas can spike, a cycle can be too thin to be worth sending, and a
 * wallet owed less than the gas to pay it waits for a later cycle. Counting down to something that
 * may reasonably not happen sets up a broken promise every time it slips, and there is nothing to
 * gain from it: a cycle that waits loses nobody anything.
 *
 * It is also static, which is a small bonus. The countdown had to render null until mounted so the
 * prerendered HTML and the first client render agreed. This has no clock, so it prerenders whole.
 *
 * ONE EXCEPTION, AND IT IS TEMPORARY. The block above the rule counts down to the third airdrop,
 * which is the last one sent by hand. That is a fixed time we control and can simply keep, not a
 * cycle that may reasonably wait, so counting down to it promises nothing we cannot deliver. It
 * removes itself the moment it passes, leaving exactly the card described above. Once the keeper is
 * running, delete the block, `site.finalManualAirdropISO` and `useCountdown` with it.
 */
const pad = (n: number) => String(n).padStart(2, "0");

const digit: React.CSSProperties = { ...mono, fontSize: 20, lineHeight: 1, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" };
const digitUnit: React.CSSProperties = {
  ...mono,
  fontSize: 9,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  marginTop: 4,
};

/** Counts down to the final manual airdrop, then disappears. See the note on PayoutCadence. */
function FinalManualAirdrop() {
  const target = useMemo(() => new Date(site.finalManualAirdropISO), []);
  const c = useCountdown(target);
  if (c?.passed) return null;
  const parts = c
    ? [
        { v: pad(c.d), u: "days" },
        { v: pad(c.h), u: "hrs" },
        { v: pad(c.m), u: "min" },
        { v: pad(c.s), u: "sec" },
      ]
    : [
        { v: "\u2013\u2013", u: "days" },
        { v: "\u2013\u2013", u: "hrs" },
        { v: "\u2013\u2013", u: "min" },
        { v: "\u2013\u2013", u: "sec" },
      ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 14, borderBottom: "1px solid var(--border-hairline)" }}>
      <span style={{ ...mono, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-accent)" }}>
        Third airdrop · the last manual one
      </span>
      <div style={{ display: "flex", gap: 20 }}>
        {parts.map((p) => (
          <span key={p.u} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={digit}>{p.v}</span>
            <span style={digitUnit}>{p.u}</span>
          </span>
        ))}
      </div>
      <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        We have sent the first two by hand. After this one the keeper takes over and the target below is what it runs to.
      </span>
    </div>
  );
}

export function PayoutCadence({ compact = false }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: compact ? "14px 16px" : "16px 20px",
        background: "var(--surface-card)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <FinalManualAirdrop />
      <span style={{ ...mono, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-accent)" }}>
        Airdrop cadence · target
      </span>
      <span style={{ ...mono, fontSize: compact ? 18 : 22, lineHeight: 1, color: "var(--text-primary)" }}>Every 2 hours</span>
      <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        Target, not a promise. Streams over ~48 hours. Runs when worth the gas; waiting forfeits nothing.
      </span>
      <span style={{ ...mono, fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>hold ≥ 100,000 $OURO to be paid</span>
      <Link to="/docs/#d06" style={{ ...mono, fontSize: 11, color: "var(--text-accent)" }}>
        What decides whether a cycle runs
      </Link>
    </div>
  );
}

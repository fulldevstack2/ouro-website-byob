import { Link } from "react-router";

import { MONITOR_API, fmtNum, useMonitor, type OuroYield } from "~/lib/monitorApi";
import { mono } from "./text";

/**
 * The live airdrop rate, for the home hero.
 *
 * TWO RULES IT FOLLOWS.
 *
 * It renders **no figure** until it has data — every other live figure on this site shows a dash
 * while it loads, which is right on a page of figures, but the hero is prerendered and a dash that
 * turns into a large number is a flash of wrong information in the first thing anyone sees.
 *
 * It does, however, hold its own height while the request is in flight, because it sits directly
 * above the primary call to action. Appearing from nothing would shove the Buy button down the page
 * a second after load, under whatever the reader was about to click. Reserved space is only held
 * while loading: if the monitor is unreachable, unconfigured, or has no rate to give, the element
 * collapses to nothing rather than leaving a permanent hole in the hero.
 *
 * And the number never appears without its basis. `caveat` comes from the monitor and names the
 * actual history the rate rests on, because the same payouts annualise to wildly different rates
 * depending only on the window: a bare percentage in a hero is the most screenshot-able thing on the
 * site and it has to carry its own qualification.
 */
export function AprHeadline() {
  const y = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);
  const d = y.data;
  // 85px is the rendered height of the block below (34px figure + 8px + two lines of 13px/1.6
  // caption), measured rather than estimated — with the request held open at 84px the buttons still
  // moved a pixel. The figure now arrives in place instead of displacing the CTA under it.
  if (y.loading) return <div aria-hidden style={{ marginTop: 28, height: 85 }} />;
  if (!d || d.aprPct === null) return null;

  return (
    <div className="hero-in" style={{ marginTop: 28, maxWidth: 460 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span
          style={{
            ...mono,
            fontWeight: 600,
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: "var(--tracking-mono-big)",
            color: "var(--text-primary)",
          }}
        >
          {fmtNum(d.aprPct, 0)}%
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Airdrop rate, annualised
        </span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 8 }}>
        {d.caveat ?? "From payouts actually made, at the rate of the last seven days."}{" "}
        <Link to="/airdrops/" style={{ color: "var(--text-accent)" }}>
          See every payout →
        </Link>
      </div>
    </div>
  );
}

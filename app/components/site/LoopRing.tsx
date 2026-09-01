import { Fragment, type CSSProperties } from "react";
import { micro } from "./text";

/** Seconds per lap of the loop; each of the four steps gets a quarter. */
const CYCLE_S = 12;

const NODES: { n: string; name: string; dot: CSSProperties; label: CSSProperties }[] = [
  { n: "01", name: "Trade", dot: { top: 25, left: 145 }, label: { top: 0, left: "50%", transform: "translateX(-50%)" } },
  { n: "02", name: "Buy", dot: { top: 145, left: 265 }, label: { top: 158, right: 0, background: "var(--surface-page)", padding: "2px 0 2px 6px" } },
  { n: "03", name: "Own", dot: { top: 265, left: 145 }, label: { bottom: 0, left: "50%", transform: "translateX(-50%)" } },
  { n: "04", name: "Yield", dot: { top: 145, left: 25 }, label: { top: 158, left: 0, background: "var(--surface-page)", padding: "2px 6px 2px 0" } },
];

/**
 * The ouroboros, abstracted: a thin closed ring with four bronze nodes. A traveller dot laps
 * the ring; as it reaches each node the node ripples and its label turns to ink (see site.css
 * "The loop diagram"). Static under prefers-reduced-motion.
 */
export function LoopRing() {
  const centre: CSSProperties = { fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, color: "var(--text-muted)" };
  const ring = { position: "relative", width: 300, height: 300, margin: "0 auto", "--cycle": `${CYCLE_S}s` } as CSSProperties;

  return (
    <div className="loop-ring" role="img" aria-label="The loop: 01 trade, 02 buy, 03 own, 04 yield, and again, forever" style={ring}>
      <div style={{ position: "absolute", inset: 30, border: "1.5px solid var(--neutral-200)", borderRadius: "50%" }} />
      <div className="loop-orbit" aria-hidden="true" />
      {NODES.map((s, i) => {
        const delay = { "--delay": `${(i * CYCLE_S) / NODES.length}s` } as CSSProperties;
        return (
          <Fragment key={s.n}>
            <div className="loop-node" style={{ position: "absolute", zIndex: 2, width: 10, height: 10, borderRadius: 99, background: "var(--bronze-600)", ...s.dot, ...delay }} />
            <div className="loop-label" style={{ position: "absolute", ...micro, color: "var(--text-secondary)", whiteSpace: "nowrap", ...s.label, ...delay }}>
              {s.n} · {s.name}
            </div>
          </Fragment>
        );
      })}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", flexDirection: "column", gap: 4 }}>
        <span style={centre}>and again,</span>
        <span style={centre}>forever</span>
      </div>
    </div>
  );
}

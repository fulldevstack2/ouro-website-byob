/**
 * The ouroboros, abstracted: a thin closed ring with four bronze nodes, one per step of the loop.
 *
 * Still, on purpose. The brief allows figures to tick and nothing else to move unprompted, and a ring
 * that turned read as decoration on a page whose whole argument is that nothing here is decoration.
 * The side labels sit outside the ring on a wide screen and move inside it on a phone (styles/site.css).
 */
const NODES: { n: string; name: string; dot: { top: number; left: number }; side: "top" | "right" | "bottom" | "left" }[] = [
  { n: "01", name: "Trade", dot: { top: 23, left: 135 }, side: "top" },
  { n: "02", name: "Buy", dot: { top: 135, left: 247 }, side: "right" },
  { n: "03", name: "Own", dot: { top: 247, left: 135 }, side: "bottom" },
  { n: "04", name: "Yield", dot: { top: 135, left: 23 }, side: "left" },
];

export function LoopRing() {
  return (
    <div className="loop-ring" role="img" aria-label="The loop: 01 trade, 02 buy, 03 own, 04 yield, and again, forever">
      <div className="loop-ring__circle" />
      {NODES.map((s) => (
        <span key={s.n}>
          <span className="loop-ring__dot" style={s.dot} />
          <span className={`loop-ring__label loop-ring__label--${s.side}`}>
            {s.n} · {s.name}
          </span>
        </span>
      ))}
      <div className="loop-ring__centre">
        and again,
        <br />
        forever
      </div>
    </div>
  );
}

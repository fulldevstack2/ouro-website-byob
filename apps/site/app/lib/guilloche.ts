/**
 * Guilloché: the engine-turned line work engraved on banknotes, bond coupons and share
 * certificates. A rose-engine lathe cuts one continuous line while two gears turn against each
 * other; the interference of a family of such lines is the lace. It is Ouro's mark for the same
 * reason it is a certificate's: one closed line, no beginning and no end, that is expensive to
 * fake and cheap to verify.
 *
 * Pure maths, no DOM, so the same functions bake the static SVG at prerender time and drive the
 * canvas every frame in the browser.
 *
 * A trace is the epi/hypotrochoid  z(t) = e^{it} + d·e^{imt}  in the complex plane, normalised so
 * |z| ≤ 1 and scaled. Its rotational symmetry is of order |m − 1|, so choosing m = −(n−1) or
 * m = n+1 both give an n-fold figure — one lobed outward ("hand" +1), one inward (−1). Because the
 * figure maps onto itself every 2π/n, a family of `traces` copies spread over exactly that arc
 * fills the band evenly: that is the lathe's index gear.
 */

/** One trace family. `d` ∈ (0,1) is the depth of the lobes; the figure spans radius scale·(1−d)/(1+d) … scale. */
export interface Family {
  /** Lobes around the ring. */
  n: number;
  /** Lobe depth. Larger = deeper waves = a wider band. */
  d: number;
  /** Outer radius, in unit coordinates (1 = half the stage). */
  scale: number;
  /** +1 lobes cut outward, −1 inward. Two hands crossing is what makes the lace. */
  hand: 1 | -1;
  /** Traces in the family. */
  traces: number;
}

/** The trace's second frequency: both branches give an n-fold figure (|m − 1| = n). */
function freq(f: Pick<Family, "n" | "hand">): number {
  return f.hand === 1 ? -(f.n - 1) : f.n + 1;
}

/** The lathe's index: successive traces are offset by this angle, filling one symmetry sector. */
export function traceStep(f: Family): number {
  return (Math.PI * 2) / (f.n * f.traces);
}

interface Table {
  c1: Float64Array;
  s1: Float64Array;
  cm: Float64Array;
  sm: Float64Array;
}

const tables = new Map<string, Table>();

/** cos/sin of both terms on a fixed t-grid: constant for a given (n, hand), so trig runs once. */
function table(f: Pick<Family, "n" | "hand">, samples: number): Table {
  const key = `${f.n}|${f.hand}|${samples}`;
  let t = tables.get(key);
  if (!t) {
    const m = freq(f);
    const c1 = new Float64Array(samples + 1);
    const s1 = new Float64Array(samples + 1);
    const cm = new Float64Array(samples + 1);
    const sm = new Float64Array(samples + 1);
    for (let i = 0; i <= samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      c1[i] = Math.cos(a);
      s1[i] = Math.sin(a);
      cm[i] = Math.cos(m * a);
      sm[i] = Math.sin(m * a);
    }
    t = { c1, s1, cm, sm };
    tables.set(key, t);
  }
  return t;
}

/** One point of the trace, at parameter `t` radians (not on the sample grid). Used by the tracer. */
export function tracePoint(f: Pick<Family, "n" | "hand" | "d" | "scale">, t: number): { x: number; y: number } {
  const m = freq(f);
  const k = f.scale / (1 + f.d);
  return { x: k * (Math.cos(t) + f.d * Math.cos(m * t)), y: k * (Math.sin(t) + f.d * Math.sin(m * t)) };
}

/** One trace as a flat [x0,y0,x1,y1,…] ring (last point repeats the first). */
export function tracePoints(f: Family, samples: number, out?: Float64Array): Float64Array {
  const tab = table(f, samples);
  const k = f.scale / (1 + f.d);
  const pts = out && out.length === (samples + 1) * 2 ? out : new Float64Array((samples + 1) * 2);
  for (let i = 0; i <= samples; i++) {
    pts[i * 2] = k * (tab.c1[i] + f.d * tab.cm[i]);
    pts[i * 2 + 1] = k * (tab.s1[i] + f.d * tab.sm[i]);
  }
  return pts;
}

/** An SVG path `d` for one trace, coordinates in a −100…100 viewBox. */
export function tracePathData(f: Family, samples: number, viewScale = 100, precision = 1): string {
  const pts = tracePoints(f, samples);
  let out = "";
  for (let i = 0; i <= samples; i++) {
    const x = (pts[i * 2] * viewScale).toFixed(precision);
    const y = (pts[i * 2 + 1] * viewScale).toFixed(precision);
    out += `${i === 0 ? "M" : "L"}${x} ${y}`;
  }
  return out + "Z";
}

import { useEffect, useRef } from "react";
import { type Family, traceStep, tracePathData, tracePoint, tracePoints } from "~/lib/guilloche";

/* --------------------------------------------------------------- The plate */

/**
 * Two trace families turning against each other, the way a rose engine cuts a certificate: an outer
 * lace in bronze and an inner one in green, the second ink. `d` is animated between OPEN[0] and
 * OPEN[1] — the lathe's depth of cut — so the lace breathes and answers the drag.
 */
const OUTER: Family = { n: 13, d: 0.22, scale: 0.95, hand: 1, traces: 13 };
const INNER: Family = { n: 7, d: 0.3, scale: 0.52, hand: -1, traces: 9 };
const OUTER_OPEN: [number, number] = [0.16, 0.3];
const INNER_OPEN: [number, number] = [0.23, 0.4];

/**
 * The rules that give the plate its structure, the way a certificate is banded: a collar outside the
 * outer lace, a rule between the two laces, and the eye around the void the ring encloses.
 * `w` is the stroke in CSS px, `a` its alpha.
 */
const RULES: { r: number; w: number; a: number }[] = [
  { r: 0.985, w: 1.3, a: 0.72 },
  { r: 0.955, w: 0.6, a: 0.42 },
  { r: 0.578, w: 0.6, a: 0.38 },
  { r: 0.558, w: 1, a: 0.6 },
  { r: 0.252, w: 1, a: 0.6 },
  { r: 0.232, w: 0.6, a: 0.38 },
];

/** Radius of the plate as a fraction of half the stage; the rest is the margin the names sit in. */
const PLATE = 0.88;
/** Seconds per lap of the tracer. One lap is one turn of the Loop. */
const CYCLE_S = 12;

/**
 * The four stations sit on the DIAGONALS, not at the compass points, and each one points at its name
 * in the corner of the square the plate is inscribed in.
 *
 * A circle in a square leaves its four corners empty, and that is the only room on this figure for a
 * name at a legible size: the plate's own margin is 12% of half the stage, about 27px, which takes a
 * numeral and nothing more. Setting the names at north and south and east and west instead would mean
 * either shrinking the lace to a third of the frame to clear them, or reserving 70px gutters that a
 * phone has not got. On the diagonals the names cost nothing: at the height they are set the circle
 * is not there at all.
 *
 * Clockwise from the top left, which is both reading order and the order the tracer arrives in.
 */
const STATION_ANGLES = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
/** How near, in radians, the tracer has to be for a station to count as the one it is at. */
const LIT_ARC = 0.55;
/** Below this a station is only warming up, and the name it belongs to stays quiet. */
const LIT_ON = 0.3;

/** Samples per trace: enough that a 13-lobed figure has no visible facets at 520 px. */
const SAMPLES = 720;
/** The baked SVG is coarser and rounder — it is on screen for one frame, and is the reduced-motion still. */
const SVG_SAMPLES = 240;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const family = (f: Family, open: [number, number], amount: number): Family => ({ ...f, d: lerp(open[0], open[1], amount) });

/* ----------------------------------------------------------- Baked still */

/**
 * Rendered at module load: in Node during the prerender it becomes the SVG the page ships with, so
 * the plate is engraved before any script runs. One `<path>` per family plus a `<use>` per trace
 * keeps it a few KB instead of a few hundred.
 */
const STILL = (() => {
  const outer = family(OUTER, OUTER_OPEN, 0.5);
  const inner = family(INNER, INNER_OPEN, 0.5);
  return {
    outer: { d: tracePathData(outer, SVG_SAMPLES), step: (traceStep(outer) * 180) / Math.PI, traces: outer.traces },
    inner: { d: tracePathData(inner, SVG_SAMPLES), step: (traceStep(inner) * 180) / Math.PI, traces: inner.traces },
  };
})();

/* ---------------------------------------------------------------- Colour */

interface Ink {
  /** Stroke per trace, dark to light, applied around the family so the lace has light and shade. */
  bronze: string;
  green: string;
  /** The one trace the tracer rides, inked darker than the family around it. */
  line: string;
  collar: string;
  tracer: string;
  tracerHalo: string;
  paper: string;
  station: string;
}

const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function readInk(): Ink {
  const css = getComputedStyle(document.documentElement);
  const tok = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
  };
  return {
    bronze: tok("--bronze-600", "#86641F"),
    green: tok("--green-900", "#0C2C1D"),
    line: tok("--bronze-700", "#6A4E19"),
    collar: tok("--bronze-700", "#6A4E19"),
    tracer: tok("--bronze-800", "#4F3A13"),
    tracerHalo: tok("--bronze-400", "#BC9848"),
    paper: tok("--page", "#FFFFFF"),
    station: tok("--bronze-600", "#86641F"),
  };
}

/* -------------------------------------------------------------- Renderer */

interface Plate {
  /** Unit-coordinate paths, rebuilt only when the depth of cut changes. */
  outer: Path2D[];
  inner: Path2D[];
  /** The depth these were cut at, so a frame can tell whether they are stale. */
  amount: number;
}

function cutPlate(amount: number): Plate {
  const outer = family(OUTER, OUTER_OPEN, amount);
  const inner = family(INNER, INNER_OPEN, amount);
  const buf = new Float64Array((SAMPLES + 1) * 2);

  const spin = (f: Family): Path2D[] => {
    const base = tracePoints(f, SAMPLES, buf);
    const step = traceStep(f);
    const paths: Path2D[] = [];
    for (let i = 0; i < f.traces; i++) {
      // The lathe indexes the work by one step per trace; rotating the points keeps every path in
      // the same coordinate frame, so a frame can stroke them without touching the transform.
      const a = i * step;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const p = new Path2D();
      for (let k = 0; k <= SAMPLES; k++) {
        const x = base[k * 2]!;
        const y = base[k * 2 + 1]!;
        const rx = x * ca - y * sa;
        const ry = x * sa + y * ca;
        if (k === 0) p.moveTo(rx, ry);
        else p.lineTo(rx, ry);
      }
      p.closePath();
      paths.push(p);
    }
    return paths;
  };

  return { outer: spin(outer), inner: spin(inner), amount };
}

interface Stage {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Half the plate, in px: unit coordinates times this are screen offsets from the centre. */
  radius: number;
  ink: Ink;
}

interface Pose {
  /** Rotation of the outer plate, radians. */
  rot: number;
  /** Depth of cut, 0…1 across OPEN. */
  amount: number;
  /** The tracer's parameter along the outer trace, radians. */
  t: number;
}

/** The inner plate turns against the outer one — the two gears of the lathe, and the loop feeding itself. */
const INNER_RATIO = -0.62;

/** Draws a frame and returns the station the tracer is at, or -1 between stations. */
function draw(stage: Stage, plate: Plate, pose: Pose): number {
  const { ctx, width, height, radius, ink } = stage;
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const outer = family(OUTER, OUTER_OPEN, pose.amount);

  const shade = (i: number, n: number, lo: number, hi: number) => lo + (hi - lo) * (0.5 + 0.5 * Math.cos((Math.PI * 2 * i) / n));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(radius, radius);
  ctx.lineJoin = "round";

  // Outer lace, bronze.
  ctx.save();
  ctx.rotate(pose.rot);
  ctx.lineWidth = 0.85 / radius;
  plate.outer.forEach((p, i) => {
    ctx.strokeStyle = rgba(ink.bronze, shade(i, plate.outer.length, 0.16, 0.6));
    ctx.stroke(p);
  });

  // The line the tracer is cutting, inked darker than its siblings: "one line, no end" has to be
  // followable by eye, or the lace is only a texture.
  ctx.lineWidth = 1.1 / radius;
  ctx.strokeStyle = rgba(ink.line, 0.62);
  ctx.stroke(plate.outer[0]!);

  // The tracer: one lit segment of a single trace, lapping the plate for ever. It rides the outer
  // plate, so it stays on the line it is cutting.
  const tail = 0.46;
  const steps = 40;
  for (let k = steps; k > 0; k--) {
    const a = tracePoint(outer, pose.t - (tail * k) / steps);
    const b = tracePoint(outer, pose.t - (tail * (k - 1)) / steps);
    const f = 1 - k / steps;
    ctx.strokeStyle = rgba(ink.tracer, 0.05 + 0.95 * f * f);
    ctx.lineWidth = (0.9 + 1.5 * f) / radius;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const head = tracePoint(outer, pose.t);
  ctx.restore();

  // Inner lace, the second ink, turning the other way.
  ctx.save();
  ctx.rotate(pose.rot * INNER_RATIO);
  ctx.lineWidth = 0.85 / radius;
  plate.inner.forEach((p, i) => {
    ctx.strokeStyle = rgba(ink.green, shade(i, plate.inner.length, 0.16, 0.52));
    ctx.stroke(p);
  });
  ctx.restore();

  // The rules sit still: the plate turns inside them.
  for (const r of RULES) {
    ctx.lineWidth = r.w / radius;
    ctx.strokeStyle = rgba(ink.collar, r.a);
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // The tracer's head, and the four stations it visits — drawn upright, in screen space.
  const hx = cx + radius * (head.x * Math.cos(pose.rot) - head.y * Math.sin(pose.rot));
  const hy = cy + radius * (head.x * Math.sin(pose.rot) + head.y * Math.cos(pose.rot));
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fillStyle = rgba(ink.tracerHalo, 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.fillStyle = ink.paper;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy, 2.9, 0, Math.PI * 2);
  ctx.fillStyle = ink.tracer;
  ctx.fill();

  // The four stations, and a short leader from each out towards the name in its corner. No numerals
  // on the plate any more: the names carry them, and drawing both would number every step twice.
  const headAngle = Math.atan2(hy - cy, hx - cx);
  let at = -1;
  let best = LIT_ON;
  for (let i = 0; i < STATION_ANGLES.length; i++) {
    const a = STATION_ANGLES[i]!;
    // How near the tracer is, in angle: the station lights as it arrives and fades as it leaves.
    const delta = Math.abs(((headAngle - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const lit = Math.max(0, 1 - delta / LIT_ARC);
    if (lit > best) {
      best = lit;
      at = i;
    }
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const sx = cx + radius * ca;
    const sy = cy + radius * sa;

    ctx.strokeStyle = rgba(ink.station, 0.18 + 0.4 * lit);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + radius * 1.02 * ca, cy + radius * 1.02 * sa);
    ctx.lineTo(cx + radius * (1.09 + 0.03 * lit) * ca, cy + radius * (1.09 + 0.03 * lit) * sa);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sx, sy, 3 + 2.5 * lit, 0, Math.PI * 2);
    ctx.fillStyle = rgba(ink.tracerHalo, 0.45 * lit);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(ink.station, 0.6 + 0.4 * lit);
    ctx.fill();
  }
  return at;
}

/* ------------------------------------------------------------- Component */

export interface LoopStep {
  /** "01"… */
  n: string;
  title: string;
}

export interface LoopPlateProps {
  /**
   * The Loop's four steps, clockwise from the top left. Passed in rather than held here, so the plate
   * and the list of steps beside it cannot come to disagree.
   */
  steps: [LoopStep, LoopStep, LoopStep, LoopStep];
  className?: string;
}

/**
 * Ouro's plate, and the home page's drawing of the Loop: guilloché engraved live, the engine-turned
 * line work of a share certificate. Two families of lathe traces turn against each other while one
 * lit line laps the outer figure for ever, lighting the Loop's four stations as it passes. Dragging
 * works the lathe: sideways turns the plate, up and down changes the depth of cut.
 *
 * It replaced a thin four-node ring in the same slot. The argument for it is the brand's, not
 * decoration: the ouroboros is one closed line with no beginning and no end, which is what a
 * guilloché figure is and what the four steps beside it describe.
 *
 * Ships a static SVG in the prerendered HTML (visible before hydration and with JS off), draws a
 * single still under prefers-reduced-motion, and sleeps while off screen or in a hidden tab.
 * See site.css → "The plate".
 */
export function LoopPlate({ steps, className }: LoopPlateProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = stageRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reduceMq.matches;
    let stage: Stage | null = null;
    let plate = cutPlate(0.5);
    let raf = 0;
    let inView = false;
    let disposed = false;
    let ready = false;

    // Idle motion is a function of elapsed time; the hand adds an offset with a little inertia, and
    // the depth of cut eases back to the resting figure once the pointer lets go.
    let t = 0;
    let last = 0;
    const hand = { rot: 0, vel: 0, open: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastMove = 0;

    const pose = (): Pose => ({
      rot: 0.055 * t + hand.rot,
      amount: Math.max(0, Math.min(1, 0.5 + 0.06 * Math.sin(0.42 * t) + hand.open)),
      t: (Math.PI * 2 * t) / CYCLE_S,
    });

    /** The station last reported to the DOM, so the attribute is written on arrival and not per frame. */
    let litAt = -1;

    const render = () => {
      if (!stage) return;
      const p = pose();
      if (Math.abs(p.amount - plate.amount) > 0.004) plate = cutPlate(p.amount);
      const at = draw(stage, plate, p);
      if (at !== litAt) {
        litAt = at;
        // The name in the corner lights with the station the tracer has reached; see site.css.
        if (at < 0) delete host.dataset.lit;
        else host.dataset.lit = String(at);
      }
      if (!ready) {
        ready = true;
        host.dataset.ready = "true";
      }
    };

    const active = () => inView && !reduced && !document.hidden && !disposed;

    const tick = (now: number) => {
      raf = 0;
      if (!active()) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      t += dt;
      if (!dragging) {
        if (hand.vel !== 0) {
          hand.rot += hand.vel * dt;
          hand.vel *= Math.pow(0.03, dt); // ~3% of the velocity left after a second
          if (Math.abs(hand.vel) < 0.005) hand.vel = 0;
        }
        if (hand.open !== 0) {
          hand.open *= Math.pow(0.12, dt);
          if (Math.abs(hand.open) < 0.002) hand.open = 0;
        }
      }
      render();
      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf || !active()) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const sleep = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const rebuild = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stage = { ctx, width: rect.width, height: rect.height, radius: (Math.min(rect.width, rect.height) / 2) * PLATE, ink: readInk() };
      render();
    };

    rebuild();
    if (document.fonts?.load) {
      // The station numerals are set in the mono face; redraw once it is in.
      document.fonts.load('600 10px "JetBrains Mono"').then(
        () => {
          if (!disposed && !raf) render();
        },
        () => {},
      );
    }

    const ro = new ResizeObserver(() => rebuild());
    ro.observe(host);

    const onTheme = () => {
      if (stage) {
        stage.ink = readInk();
        if (!raf) render();
      }
    };
    const themeObs = new MutationObserver(onTheme);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        if (inView) wake();
        else sleep();
      },
      { rootMargin: "80px" },
    );
    io.observe(host);

    const onVisibility = () => (document.hidden ? sleep() : wake());
    document.addEventListener("visibilitychange", onVisibility);

    const onReduce = () => {
      reduced = reduceMq.matches;
      if (reduced) {
        sleep();
        render();
      } else wake();
    };
    reduceMq.addEventListener("change", onReduce);

    // Work the lathe. touch-action: pan-y (CSS) keeps vertical scrolling on touch screens.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMove = e.timeStamp;
      hand.vel = 0;
      canvas.setPointerCapture(e.pointerId);
      host.dataset.dragging = "true";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dt = Math.max(1, e.timeStamp - lastMove) / 1000;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMove = e.timeStamp;
      const gain = 0.006;
      hand.rot += dx * gain;
      hand.vel = hand.vel * 0.5 + ((dx * gain) / dt) * 0.5;
      hand.open = Math.max(-0.45, Math.min(0.45, hand.open - dy * 0.0022));
      if (!raf) render();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      delete host.dataset.dragging;
      // Cap fling speed so a flick doesn't spin the plate into a blur.
      hand.vel = Math.max(-4, Math.min(4, hand.vel));
      if (reduced) {
        hand.vel = 0;
        hand.open = 0;
        render();
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      themeObs.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMq.removeEventListener("change", onReduce);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const spoken = steps.map((s) => `${s.n} ${s.title.toLowerCase()}`).join(", ");

  return (
    <div className={className ? `plate-frame ${className}` : "plate-frame"}>
      <div
        ref={stageRef}
        className="plate"
        role="img"
        aria-label={`The Loop, drawn as guilloché: one continuous closed line engraved as it turns, passing the four stations ${spoken}, and returning to the first.`}
      >
      <svg className="plate__still" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
        <defs>
          <path id="ouro-plate-outer" d={STILL.outer.d} />
          <path id="ouro-plate-inner" d={STILL.inner.d} />
        </defs>
        <g fill="none" stroke="var(--accent)" strokeWidth="0.52" opacity="0.44">
          {Array.from({ length: STILL.outer.traces }, (_, i) => (
            <use key={i} href="#ouro-plate-outer" transform={`rotate(${(i * STILL.outer.step).toFixed(3)})`} />
          ))}
        </g>
        <g fill="none" stroke="var(--text-positive)" strokeWidth="0.48" opacity="0.4">
          {Array.from({ length: STILL.inner.traces }, (_, i) => (
            <use key={i} href="#ouro-plate-inner" transform={`rotate(${(i * STILL.inner.step).toFixed(3)})`} />
          ))}
        </g>
        <g fill="none" stroke="var(--accent-strong)">
          {RULES.map((r) => (
            <circle key={r.r} cx="0" cy="0" r={r.r * 100} strokeWidth={r.w * 0.5} opacity={r.a} />
          ))}
        </g>
      </svg>
        <canvas ref={canvasRef} className="plate__canvas" aria-hidden="true" />
        {/* One name per corner, each opposite the station that points at it. `aria-hidden`, because the
            plate's own label already reads the four in order and the list beside it gives them in full. */}
        {steps.map((s, i) => (
          <span key={s.n} className={`plate-step plate-step--${i}`} aria-hidden="true">
            <span className="plate-step__n">{s.n}</span> {s.title}
          </span>
        ))}
      </div>
      <div className="plate-foot">
        <em>and again, forever</em>
        <span className="plate-foot__hint">Drag to turn</span>
      </div>
    </div>
  );
}

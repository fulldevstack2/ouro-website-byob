import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The design's `.qt` "?" dot with a hover/focus tooltip. Styles live in site.css ("Help tooltips").
 *
 * `follow` is for the vaults stat band:
 *   - fine pointer + hover: tip follows the cursor
 *   - touch / coarse pointer: tap toggles a tip anchored under the "?", outside tap closes it
 */
export function HelpTip({
  children,
  placement = "below",
  follow = false,
}: {
  children: ReactNode;
  placement?: "below" | "above";
  follow?: boolean;
}) {
  if (!follow) {
    return (
      <span className="qt">
        <span className="qt-dot" tabIndex={0} aria-label="More detail">
          ?
        </span>
        <span className={placement === "above" ? "qt-tip qt-tip--above" : "qt-tip"} role="tooltip">
          {children}
        </span>
      </span>
    );
  }
  return <FollowHelpTip>{children}</FollowHelpTip>;
}

const TIP_WIDTH = 260;
const TIP_PAD = 14;

function useFinePointer(): boolean {
  const [fine, setFine] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return fine;
}

function clampTip(x: number, y: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + TIP_WIDTH > vw - 8) left = vw - TIP_WIDTH - 8;
  if (left < 8) left = 8;
  if (top + 140 > vh - 8) top = Math.max(8, vh - 148);
  if (top < 8) top = 8;
  return { x: left, y: top };
}

function FollowHelpTip({ children }: { children: ReactNode }) {
  const fine = useFinePointer();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const rootRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  // Outside tap closes the touch tip.
  useEffect(() => {
    if (!open || fine) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, fine]);

  // Switch input mode: drop any open tip so it does not stick in the wrong shape.
  useEffect(() => setOpen(false), [fine]);

  const onMouseMove = (e: MouseEvent) => {
    if (!fine) return;
    setPos(clampTip(e.clientX + TIP_PAD, e.clientY + TIP_PAD));
  };

  const placeFromDot = () => {
    const el = dotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let x = r.left;
    let y = r.bottom + 8;
    if (y + 140 > window.innerHeight - 8) y = r.top - 8 - 120;
    setPos(clampTip(x, y));
  };

  const onDotActivate = (e: MouseEvent | KeyboardEvent) => {
    if (fine) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen((was) => {
      const next = !was;
      if (next) placeFromDot();
      return next;
    });
  };

  return (
    <span
      ref={rootRef}
      className="qt qt--follow"
      onMouseEnter={() => {
        if (fine) setOpen(true);
      }}
      onMouseLeave={() => {
        if (fine) setOpen(false);
      }}
      onMouseMove={onMouseMove}
    >
      <span
        ref={dotRef}
        className="qt-dot"
        tabIndex={0}
        role="button"
        aria-label="More detail"
        aria-expanded={open}
        onClick={onDotActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onDotActivate(e);
        }}
      >
        ?
      </span>
      {mounted &&
        open &&
        createPortal(
          <span className="qt-tip qt-tip--follow" role="tooltip" style={{ left: pos.x, top: pos.y, width: TIP_WIDTH }}>
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}

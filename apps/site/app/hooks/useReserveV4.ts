import { useEffect, useState } from "react";

import { RESERVE_V4_POSITIONS } from "~/content/protocol";
import { dexQuote } from "~/lib/dexscreener";
import type { V4PositionState } from "~/lib/v4Position";

export interface ReserveV4Row extends V4PositionState {
  /** Both legs marked to market, or null when either price is missing: a partial sum reads as a whole one. */
  valueUsd: number | null;
}

export interface ReserveV4 {
  rows: ReserveV4Row[];
  /** True until the first read settles, so a table can wait rather than flash a row in and out. */
  loading: boolean;
}

/**
 * The Reserve's Uniswap v4 positions, read from the chain and marked to market.
 *
 * The monitor does not value these (it indexes v3), so this is the only place on the site where a v4
 * figure comes from. Prices come from DexScreener's deepest Robinhood pool, the same fallback the
 * rest of the site uses, and native ETH is priced off WETH, which is the same ether.
 *
 * ONE reader for the whole page, not one per component. The home page states the same position twice,
 * in the headline total and in the Reserve table, and two independent reads would have them disagree
 * by whatever the price moved between them, which is exactly the kind of small contradiction this
 * site cannot afford. So the poll lives here at module scope and every hook is a subscriber to it.
 *
 * Client-side only, after paint, so the prerendered HTML never carries a figure that was true at
 * build time. The reader itself is loaded with `import()` rather than at the top of the file, and
 * deliberately: it pulls viem, 130KB the home page otherwise never touches, and a static import
 * would put that in the route's chunk, preload it on first paint and walk it during prerender.
 */
const REFRESH_MS = 120_000;

let state: ReserveV4 = { rows: [], loading: RESERVE_V4_POSITIONS.length > 0 };
const listeners = new Set<(s: ReserveV4) => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let ctrl: AbortController | undefined;

function publish(next: ReserveV4) {
  state = next;
  for (const l of listeners) l(next);
}

async function readAll() {
  // The controller belongs to the poll, not to a subscriber: it is created when the first hook
  // mounts and aborted when the last one leaves, so a read in flight is dropped rather than landing
  // on a page nobody is looking at.
  const signal = (ctrl ??= new AbortController()).signal;
  try {
    const { readV4Position } = await import("~/lib/v4Position");
    const read = await Promise.all(RESERVE_V4_POSITIONS.map((p) => readV4Position(p).catch(() => null)));
    const live = read.filter((r): r is V4PositionState => r !== null);
    const rows = await Promise.all(
      live.map(async (r) => {
        const [token, quote] = await Promise.all([
          dexQuote(r.entry.token.address, signal).catch(() => ({ priceUsd: null })),
          dexQuote(r.entry.quote.priceAddress, signal).catch(() => ({ priceUsd: null })),
        ]);
        const valueUsd = token.priceUsd === null || quote.priceUsd === null ? null : r.amountToken * token.priceUsd + r.amountQuote * quote.priceUsd;
        return { ...r, valueUsd };
      }),
    );
    if (!signal.aborted) publish({ rows, loading: false });
  } catch {
    // Leave the last good read on the page; the next tick tries again.
    if (!signal.aborted) publish({ ...state, loading: false });
  }
  if (!signal.aborted) timer = setTimeout(() => void readAll(), REFRESH_MS);
}

export function useReserveV4(): ReserveV4 {
  const [s, setS] = useState<ReserveV4>(state);
  useEffect(() => {
    if (RESERVE_V4_POSITIONS.length === 0) return;
    listeners.add(setS);
    setS(state);
    if (listeners.size === 1) {
      ctrl = new AbortController();
      void readAll();
    }
    return () => {
      listeners.delete(setS);
      if (listeners.size === 0) {
        clearTimeout(timer);
        ctrl?.abort();
        ctrl = undefined;
      }
    };
  }, []);
  return s;
}

/**
 * What the v4 positions add to the treasury, or null if any one of them is unpriced, or the read is
 * still in flight: a sum missing a leg reads exactly like a complete one, which is the failure this
 * page guards against.
 *
 * In flight is UNKNOWN, not zero, and the distinction is the whole reason this takes the state rather
 * than the rows. The monitor answers in about a second and the chain read lands a second after it, so
 * treating the empty first second as "nothing here" published the monitor's own NAV, thousands of
 * dollars light, and then jumped it. No position CONFIGURED is genuinely zero, so a build with none
 * still shows its NAV on the monitor's first answer.
 */
export function v4ValueUsd(v4: ReserveV4): number | null {
  if (v4.loading) return null;
  let sum = 0;
  for (const r of v4.rows) {
    if (r.valueUsd === null) return null;
    sum += r.valueUsd;
  }
  return sum;
}

/** The monitor's NAV plus what the site read itself, withheld unless both sides are known. */
export function navWithV4(monitorNav: number | null | undefined, v4: ReserveV4): number | null {
  const extra = v4ValueUsd(v4);
  if (monitorNav === null || monitorNav === undefined || extra === null) return null;
  return monitorNav + extra;
}

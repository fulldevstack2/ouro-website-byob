import { useEffect, useState } from "react";

/**
 * What the vaults hold, shared between the page header and the bar above the cards.
 *
 * The header lives in the route shell, which is prerendered; the read is a multicall inside the live
 * section, which is a client-only lazy chunk and has to stay one (wagmi and viem in the server bundle
 * cost every route's prerender, and RR8 allows each ten seconds). So the live section publishes its
 * total here and the header subscribes to it rather than reading the chain a second time: two reads
 * of the same three vaults disagree by whatever landed between them, and the page would then state
 * its headline share twice, differently, a hundred pixels apart.
 *
 * Plain numbers, not bigints, and deliberately: the route shell imports this module, so it must not
 * drag `lib/vaultYield` and viem's `formatUnits` along with it.
 *
 * The figure survives leaving the page, which is what makes the header paint on a second visit rather
 * than flashing a dash; the live section republishes within its refetch interval either way.
 */

/** OURO pooled across every live vault, or null before the first read lands. */
let pooled: number | null = null;
const listeners = new Set<(n: number | null) => void>();

/** The live section owns the only read. This is how it hands the figure up to the header. */
export function publishPooled(tokens: number | null) {
  if (tokens === pooled) return;
  pooled = tokens;
  for (const l of listeners) l(tokens);
}

export function useVaultsPooled(): number | null {
  const [n, setN] = useState<number | null>(pooled);
  useEffect(() => {
    listeners.add(setN);
    setN(pooled);
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}

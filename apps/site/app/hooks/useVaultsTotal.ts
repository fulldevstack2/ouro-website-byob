import { useEffect, useState } from "react";

/**
 * What the vaults hold, shared between the page header and the bar above the cards.
 *
 * The header lives in the route shell, which is prerendered; the read is a multicall inside the live
 * section, which is a client-only lazy chunk and has to stay one (wagmi and viem in the server bundle
 * cost every route's prerender, and RR8 allows each ten seconds). So the live section publishes its
 * total here and the header subscribes to it rather than reading the chain a second time: two reads
 * of the same three vaults disagree by whatever landed between them, and the page would then state
 * its headline figures twice, differently, a hundred pixels apart.
 *
 * Plain numbers, not bigints, and deliberately: the route shell imports this module, so it must not
 * drag `lib/vaultYield` and viem's `formatUnits` along with it.
 *
 * The figures survive leaving the page, which is what makes the header paint on a second visit rather
 * than flashing a dash; the live section republishes within its refetch interval either way.
 */

/**
 * Pooled across every live vault: the OURO, and the same holding in dollars. Each side is null until
 * what it rests on has landed, the chain for the tokens and the chain and a price for the dollars, so
 * a missing price costs the dollar figure and not the token count.
 */
export interface VaultsTotal {
  tokens: number | null;
  usd: number | null;
}

let total: VaultsTotal = { tokens: null, usd: null };
const listeners = new Set<(t: VaultsTotal) => void>();

/**
 * The live section owns the only read. This is how it hands the figures up to the header.
 *
 * Field by field, not by identity: the publisher builds the object fresh, so an identity check would
 * never match and every render would notify.
 */
export function publishVaultsTotal(next: VaultsTotal) {
  if (next.tokens === total.tokens && next.usd === total.usd) return;
  total = next;
  for (const l of listeners) l(total);
}

export function useVaultsTotal(): VaultsTotal {
  const [t, setT] = useState<VaultsTotal>(total);
  useEffect(() => {
    listeners.add(setT);
    setT(total);
    return () => {
      listeners.delete(setT);
    };
  }, []);
  return t;
}

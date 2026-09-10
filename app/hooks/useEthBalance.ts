import { useEffect, useState } from "react";
import { createPublicClient, type Address } from "viem";

import { rpcTransport } from "~/lib/rpc";

/**
 * The native ETH balance of one address, read straight from the chain.
 *
 * Deliberately NOT routed through ouro-monitor, unlike every other figure on the site. Those come
 * from the indexer because they are derived — summed, priced, replayed from events — and a balance
 * is none of those: it is one `eth_getBalance` against the keyless public RPC the bundle already
 * ships for the wallet connection. Adding a field to the API, deploying it, storing it and polling
 * it would be four moving parts for a number the browser can ask for itself.
 *
 * Plain viem rather than wagmi's `useBalance`, so a page that never connects a wallet does not pull
 * RainbowKit into its bundle.
 *
 * A failed read keeps the last good value rather than falling back to zero: "we could not reach the
 * chain" and "the wallet is empty" are different claims, and only one of them is ever true here.
 */
const client = createPublicClient({ transport: rpcTransport() });

export function useEthBalance(address: Address | undefined, intervalMs = 60_000): bigint | null {
  const [wei, setWei] = useState<bigint | null>(null);

  useEffect(() => {
    if (!address) return;
    let live = true;
    const read = async () => {
      try {
        const balance = await client.getBalance({ address });
        if (live) setWei(balance);
      } catch {
        // Keep whatever was last read; the initial state is already a dash.
      }
    };
    void read();
    const timer = setInterval(read, intervalMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [address, intervalMs]);

  return wei;
}

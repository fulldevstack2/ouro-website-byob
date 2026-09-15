import { fallback, http } from "viem";

import { site } from "~/content/site";

/** Hosts that reject a batched request often enough that it is not worth sending them one. */
const NO_BATCH = ["rpc.mainnet.chain.robinhood.com"];

/**
 * How this app talks to Robinhood Chain: one transport per public endpoint, tried in the order
 * site.chain.rpcUrls lists them. Copied from apps/site, whose wallet connection reads the same list;
 * here it backs one thing, the Ledger's Uniswap v4 position.
 *
 * `fallback` moves to the next endpoint only when one ERRORS, so the order is the priority and the
 * timeout is what rescues a node that hangs rather than refuses. That is the failure this exists for:
 * at viem's ten-second default a stalled primary held the vault figures, and the wallet connection
 * behind them, off the page long after everything else was ready. Five seconds leaves a healthy but
 * loaded endpoint room (the slowest good sample was 2.3s) and gives up on a sick one before a reader
 * does. No transport-level retry: with five more endpoints behind the first, retrying the one
 * that just failed only doubles the wait before a different one is tried, and wagmi retries the
 * query itself if every endpoint is down.
 *
 * `batch` coalesces the JSON-RPC calls a load makes into one POST per endpoint: each panel's
 * multicall, the shared wallet balance, the chain id. Every endpoint here answers batched requests
 * except the chain's own, which answered three of eight with an error, so that one is asked one call
 * at a time instead of being written off for it.
 *
 * Its own module, and imported lazily by lib/v4Position.ts: viem is 130 KB that no other page here
 * touches, and a static import would put it in a shared chunk and preload it on first paint.
 */
export function rpcTransport() {
  return fallback(
    site.chain.rpcUrls.map((url) => http(url, { batch: !NO_BATCH.some((host) => url.includes(host)), timeout: 5_000, retryCount: 0 })),
  );
}


import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";
import { createConfig } from "wagmi";

import { site } from "~/content/site";
import { rpcTransport } from "~/lib/rpc";

/**
 * Robinhood Chain is not in viem/chains, so it is defined here. Multicall3 is pre-deployed at the
 * canonical address, which wagmi uses to batch reads. Every working public endpoint is listed, so a
 * wallet that adds the chain from this page gets the fallbacks too; which one this site reads
 * through is decided by the transport (app/lib/rpc.ts), not by this list.
 */
export const robinhoodChain = defineChain({
  id: site.chain.id,
  name: site.chain.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: site.chain.rpcUrls } },
  blockExplorers: { default: { name: "Blockscout", url: site.links.explorer } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/**
 * WalletConnect needs a project id, and it is a public identifier that ships in the client bundle,
 * not a secret. Ouro needs its OWN project rather than borrowing another product's, because the id
 * is what WalletConnect attributes sessions and analytics to.
 *
 * Without one we still build a working config, just injected-only: a browser extension wallet keeps
 * working and only the QR / mobile path is missing. That is a much better failure than a page that
 * throws on load because an env var was not set at build time.
 */
const projectId = "0031ff4cbef4968b799fc2910156439c";

export const hasWalletConnect = projectId.length > 0;

/**
 * `ssr: false` is deliberate and load-bearing, and the same choice helios-dex-ui documents.
 *
 * With `ssr: true` wagmi defers reconnection past the first render, so on a refresh the first frame
 * is disconnected with an empty address and anything keyed on the wallet flashes its logged-out
 * state. This site prerenders every route to HTML at build time, but the wallet tree is mounted
 * client-side only (see WalletProvider), so nothing here ever runs in node and wagmi is free to
 * reconnect synchronously.
 */
const transports = { [robinhoodChain.id]: rpcTransport() };

export const wagmiConfig = hasWalletConnect
  ? getDefaultConfig({
      appName: site.name,
      projectId,
      chains: [robinhoodChain],
      transports,
      ssr: false,
    })
  : createConfig({
      chains: [robinhoodChain],
      connectors: [injected()],
      transports,
      ssr: false,
    });

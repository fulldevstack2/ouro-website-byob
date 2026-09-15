import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  base,
  binanceWallet,
  bitgetWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";
import { createConfig } from "wagmi";

import { site } from "~/content/site";
import { robinhoodWallet } from "~/lib/robinhoodWallet";
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
 * Written here as a constant, on purpose. There used to be a build-time define
 * (`__WALLETCONNECT_PROJECT_ID__`) fed by a Netlify variable; both belonged to the /referral page,
 * nothing ever read them, and they went with it on 2026-09-15. A value that is public, that changes
 * about never, and whose absence quietly costs the wallet modal its QR path is better checked in than
 * configured in a dashboard nobody looks at.
 *
 * Empty is still handled rather than fatal: `hasWalletConnect` below falls the config back to
 * injected-only, so a browser extension wallet keeps working and only the QR / mobile path is missing.
 */
const projectId = "0031ff4cbef4968b799fc2910156439c";

export const hasWalletConnect = projectId.length > 0;

/**
 * Curated list on top of RainbowKit's stock Popular set. Robinhood Wallet is first because this
 * site runs on Robinhood Chain and RH is not in RainbowKit's built-ins (custom connector in
 * robinhoodWallet.ts). OKX / Bitget / Trust / Binance ship with WalletConnect deep links so the
 * compact modal works on phone (QR + open-in-app). Rabby is extension-only; RainbowKit still shows
 * it on desktop and installed browsers via EIP-6963. WalletConnect stays last among the named apps
 * as the catch-all for any other mobile wallet.
 */
const wallets = [
  {
    groupName: "Popular",
    wallets: [
      robinhoodWallet,
      okxWallet,
      metaMaskWallet,
      trustWallet,
      bitgetWallet,
      binanceWallet,
      rainbowWallet,
      base,
      rabbyWallet,
      walletConnectWallet,
      safeWallet,
    ],
  },
];

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
      appUrl: site.url,
      projectId,
      chains: [robinhoodChain],
      transports,
      wallets,
      ssr: false,
    })
  : createConfig({
      chains: [robinhoodChain],
      connectors: [injected()],
      transports,
      ssr: false,
    });

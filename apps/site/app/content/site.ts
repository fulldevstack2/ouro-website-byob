/**
 * Site-wide configuration.
 *
 * `xHandle` and `auditPublished` were the editable props of the Claude Design
 * component; `links` centralises the URLs the design left as "#". Fill the TODOs
 * before launch; everything that reads them updates in one place.
 */
const xHandle = "@ourolayer";

export const site = {
  /** Public origin, resolved at build time (scripts/site-url.mjs). No trailing slash. */
  url: __SITE_URL__,
  name: "Ouro",
  ticker: "$OURO",
  tagline: "Hold $OURO. Get paid.",
  description:
    "Hold 100,000+ $OURO and airdrops land in your wallet. Holding less? Pool with others. Every trade pays a 5% tax: 2% to holders, 2% to LP that pays again, 1% to ops and the launchpad.",
  xHandle,
  /**
   * Every public Robinhood Chain endpoint that works, in the order they are tried. All keyless, so
   * they ship in the client bundle by design; they back the wallet connection (app/lib/wagmi.ts),
   * every vault read, and the one figure the site takes from the chain rather than from ouro-monitor
   * (useEthBalance.ts). One failing hands over to the next: see app/lib/rpc.ts.
   *
   * Measured here on 2026-09-10, eight rounds of the request a panel load actually makes (a batched
   * eth_blockNumber plus a multicall3 aggregate3), median round trip and failures out of eight:
   *
   *   publicnode       146ms   0
   *   blockmachine     274ms   0
   *   ordofi           294ms   0
   *   bloXroute        668ms   0   (chainlist marks this one as tracking requests)
   *   POKT             990ms   0
   *   the chain's own  525ms   3 batched requests rejected, 1 state read came back empty
   *
   * which is why the chain's own endpoint goes LAST despite holding the freshest head: it is the one
   * that fails, and its 2.3s worst case is the delay this list exists to fix. The rest lag it by
   * 16-45 blocks, under five seconds at a tenth of a second per block, and all six agree on a vault's
   * `totalAssets`, carry multicall3 and allow this origin. Left out, all tried the same way:
   * arrowrpc (530), routeme (429, public rate limit), nodeflare (403), thirdweb ("Invalid chain"),
   * drpc (answers eth_chainId and nothing else without a key).
   */
  chain: {
    name: "Robinhood Chain",
    id: 4663,
    rpcUrls: [
      "https://robinhood-rpc.publicnode.com",
      "https://rpc-robinhood.blockmachine.io",
      "https://rpc.ordofi.network",
      "https://robinhood.rpc.blxrbdn.com",
      "https://robinhood.api.pocket.network",
      "https://rpc.mainnet.chain.robinhood.com",
    ],
  },
  /** Set to true once the audit report is published; it swaps the docs §10 callout. */
  auditPublished: false,
  /**
   * The third airdrop, and the last one sent by hand: 12:00 on 4 Sep 2026, GMT+8 (= 04:00 UTC).
   * Drives the countdown in PayoutCadence, which retires itself once this passes. Delete this
   * field and the countdown block with it once the keeper is running.
   */
  finalManualAirdropISO: "2026-09-04T04:00:00Z",
  links: {
    x: `https://x.com/${xHandle.replace(/^@/, "")}`,
    /** Where $OURO trades. The token is a letscash launchpad token, so buying happens there. */
    buy: "https://www.letscash.fun/token/0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc",
    /** Block explorer for Robinhood Chain (also used for address links on the Ledger and in docs §11). */
    explorer: "https://robinhoodchain.blockscout.com",
    /** TODO: Robinhood Chain site. */
    robinhoodChain: "#",
  },
};

export interface NavItem {
  to: string;
  /** When set, the item is an external link and `to` is only its key. */
  href?: string;
  label: string;
  /**
   * Kept out of the nav and the footer, but still routed, prerendered and reachable at its URL. This is a
   * one-word way to shelve a page without deleting it; flip it off to bring the link back.
   */
  hidden?: boolean;
}

/** Primary navigation. (Staking was removed on 2026-08-31: holders are paid directly, nothing is staked.) */
export const NAV: NavItem[] = [
  { to: "/", label: "Overview" },
  { to: "buy", label: "Buy $OURO", href: site.links.buy },
  // Shipped 2026-09-08 with its route (see app/routes.ts): the OURO vaults are live.
  { to: "/vaults/", label: "Vaults" },
  // Shelved 2026-08-31 until it is ready to show. Route, page and URL are untouched.
  { to: "/monitor/", label: "Monitor", hidden: true },
  // Unshelved 2026-09-04: the Reserve holds real positions and the Ledger now reads them from the
  // chain through ouro-monitor's /v1/reserve. It needs MONITOR_API_URL set at build time.
  { to: "/ledger/", label: "Ledger" },
  { to: "/airdrops/", label: "Airdrops" },
  // Added 2026-09-10: the connected wallet's view of the same data. Its $OURO, every airdrop it
  // received, its vault deposits. (?address=0x… shows another wallet, on purpose unadvertised.)
  { to: "/portfolio/", label: "Portfolio" },
  // Held back 2026-09-08 with its route (see app/routes.ts). A nav link to a 404 is worse than no
  // link at all.
  { to: "/referral/", label: "Referral", hidden: true },
  { to: "/docs/", label: "Docs" },
];

/** What the site chrome actually links. Use this, not NAV, anywhere a reader can click. */
export const VISIBLE_NAV = NAV.filter((item) => !item.hidden);

/** `target="_blank"` only for real external URLs, not for "#" placeholders. */
export function externalLinkProps(href: string) {
  return /^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {};
}

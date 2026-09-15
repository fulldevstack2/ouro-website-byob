/**
 * Site-wide configuration.
 *
 * `xHandle` and `auditPublished` were the editable props of the Claude Design
 * component; `links` centralises the URLs the design left as "#". Everything
 * that reads them updates in one place.
 */
const xHandle = "@ourolayer";
const tgHandle = "@ourolayer";

export const site = {
  /** Public origin, resolved at build time (scripts/site-url.mjs). No trailing slash. */
  url: __SITE_URL__,
  name: "Ouro",
  ticker: "$OURO",
  /** The hero's headline and the footer's italic line. One sentence, declarative, no exclamation. */
  tagline: "Liquidity that pays its holders.",
  description:
    "Every $OURO trade buys protocol-owned liquidity in the top Robinhood Chain tokens. The fees those pools earn are airdropped to holders every two hours.",
  xHandle,
  tgHandle,
  /**
   * Every public Robinhood Chain endpoint that works, in the order they are tried. All keyless, so
   * they ship in the client bundle by design; they back the wallet connection (app/lib/wagmi.ts) and
   * every vault read. One failing hands over to the next: see app/lib/rpc.ts.
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
  /**
   * Set to true once the audit report is published; it shows the docs' "Audit status" callout.
   *
   * While it is false the docs say nothing about an audit either way. The "not yet audited" caution
   * that used to stand in its place was removed on 2026-09-15.
   */
  auditPublished: false,
  links: {
    x: `https://x.com/${xHandle.replace(/^@/, "")}`,
    telegram: `https://t.me/${tgHandle.replace(/^@/, "")}`,
    /** Where $OURO trades. The token is a letscash launchpad token, so buying happens there. */
    buy: "https://www.letscash.fun/token/0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc",
    /** Block explorer for Robinhood Chain (address and transaction links everywhere). */
    explorer: "https://robinhoodchain.blockscout.com",
    /**
     * The analytics site: the airdrop meta across every tax-index token on the chain, and since
     * 2026-09-15 the Ledger and the airdrops, which used to be pages of this site.
     *
     * THE ONE PLACE this address is written. It is a separate standalone app (apps/analytics in this
     * repo, its own Netlify site), so this site only ever links to it; change this constant and the
     * nav, the footer, the hero and the docs all follow, as do the redirects in netlify.toml, which
     * are the other half and are NOT read from here.
     *
     * TEMPORARY 2026-09-15: the raw Netlify subdomain, until analytics.ourolayer.com is pointed at
     * that site. No trailing slash, or analyticsUrl() below builds "//ledger/". Restore the real
     * host here and in netlify.toml together, and put those redirects back to 301 at the same time.
     */
    analytics: "https://resilient-souffle-95850c.netlify.app",
    /** TODO: Robinhood Chain site. Linked nowhere until it is set. */
    robinhoodChain: "#",
  },
};

export interface NavItem {
  to: string;
  label: string;
  /**
   * Leaves this site: rendered as a plain anchor with an arrow rather than a router Link, which would
   * try to resolve an absolute URL as a route of this app.
   */
  external?: boolean;
  /**
   * Kept out of the nav and the footer, but still routed, prerendered and reachable at its URL. This is a
   * one-word way to shelve a page without deleting it; flip it off to bring the link back.
   */
  hidden?: boolean;
}

/**
 * Primary navigation: the six views. Buying is not a nav item any more; it is the button at the right
 * end of the bar (SiteNav) and a line in the footer, so the links are all pages of this site.
 */
export const NAV: NavItem[] = [
  { to: "/", label: "Overview" },
  // Shipped 2026-09-08 with its route (see app/routes.ts): the OURO vaults are live.
  { to: "/vaults/", label: "Vaults" },
  // Shelved 2026-08-31 until it is ready to show. Route, page and URL are untouched.
  { to: "/monitor/", label: "Monitor", hidden: true },
  // The Ledger and the airdrops MOVED on 2026-09-15, to the analytics site, which is where everything
  // read off the chain now lives. This one link replaces both of them; their old URLs on this site
  // redirect onto their new ones (netlify.toml), so nothing posted anywhere stops working.
  { to: site.links.analytics, label: "Analytics", external: true },
  // Added 2026-09-10: the connected wallet's view of the same data. Its $OURO, every airdrop it
  // received, its vault deposits. (?address=0x… shows another wallet; the share card's code opens it.)
  { to: "/portfolio/", label: "Portfolio" },
  // Held back 2026-09-08 with its route (see app/routes.ts). A nav link to a 404 is worse than no
  // link at all.
  { to: "/referral/", label: "Referral", hidden: true },
  { to: "/docs/", label: "Docs" },
];

/** What the site chrome actually links. Use this, not NAV, anywhere a reader can click. */
export const VISIBLE_NAV = NAV.filter((item) => !item.hidden);

/**
 * A page of the analytics site, absolute. `/ledger/` and `/airdrops/` kept their paths when they
 * moved there, so a link that named one still names the same page.
 */
export function analyticsUrl(path = "/") {
  return `${site.links.analytics}${path}`;
}

/** `target="_blank"` only for real external URLs, not for "#" placeholders. */
export function externalLinkProps(href: string) {
  return /^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {};
}

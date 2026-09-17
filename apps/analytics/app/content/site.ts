/**
 * The Ouro facts this app needs, and only those.
 *
 * apps/site has the full version of this file: the tagline, the socials, the buy link, the nav. This
 * app is not ourolayer.com and must not grow a second copy of it, so what is here is what the two
 * pages moved over from that site actually read — the chain they are on, where to link an address,
 * and the operator's own site to point back at.
 *
 * `url` is THIS app's origin (analytics.ourolayer.com), not Ouro's, because it is what the canonical
 * and Open Graph URLs of these pages now resolve against. `home` is the other way round.
 */
export const site = {
  /** Public origin of this app, resolved at build time (vite.config.ts). No trailing slash. */
  url: __SITE_URL__,
  /** Where ourolayer.com lives, for the links back out of these pages. */
  home: "https://ourolayer.com",
  name: "Ouro",
  ticker: "$OURO",
  xHandle: "@ourolayer",
  /**
   * The chain these pages report on, by name, for the footer and the page furniture.
   *
   * No RPC endpoints any more. This app talked to the chain for exactly one thing — reading the
   * Reserve's Uniswap v4 position, which the monitor did not index — and since 2026-09-17 it does,
   * so every figure here comes from the monitor over HTTP. The endpoint list, `app/lib/rpc.ts` and
   * `app/lib/dexQuote.ts` went with it. apps/site keeps its own copies: its wallet connection needs
   * them, and this page has no wallet.
   */
  chain: {
    name: "Robinhood Chain",
    id: 4663,
  },
  links: {
    /** Block explorer for Robinhood Chain (address and transaction links on both pages). */
    explorer: "https://robinhoodchain.blockscout.com",
  },
};

/** `target="_blank"` only for real external URLs, not for "#" placeholders. */
export function externalLinkProps(href: string) {
  return /^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {};
}

/** A path on ourolayer.com, absolute: every link out of these pages now leaves this origin. */
export function ouroUrl(path: string) {
  return `${site.home}${path}`;
}

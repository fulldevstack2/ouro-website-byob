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
   * Robinhood Chain, and every public endpoint that works, in the order they are tried. All keyless,
   * so they ship in the client bundle by design. The list and its order are apps/site's, measured
   * there on 2026-09-10: the chain's own endpoint goes LAST despite holding the freshest head,
   * because it is the one that rejects batched requests and returns empty state reads. One failing
   * hands over to the next (app/lib/rpc.ts).
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
  links: {
    /** Block explorer for Robinhood Chain (address and transaction links on both pages). */
    explorer: "https://robinhoodchain.blockscout.com",
    /**
     * Where a reader tells us a figure is wrong.
     *
     * This page reports on projects Ouro does not run, off adapters we wrote, so the figures can be
     * wrong in ways only the project itself would spot. A correction route in the chrome is the
     * cheap half of that; answering one is the other half. Ouro's own channel, same handle as
     * apps/site, which is the operator disclosure being consistent rather than a second identity.
     */
    telegram: "https://t.me/ourolayer",
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

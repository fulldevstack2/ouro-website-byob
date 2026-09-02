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
  tagline: "Own the fee generating layer of Robinhood Chain.",
  description:
    "Ouro is building the fee generating layer of Robinhood Chain: pools the protocol buys and holds. Every $OURO trade pays a 5% tax: 2% is airdropped to holders, 2% buys pools the protocol keeps and 1% covers ops. 80% of the fees those pools earn is airdropped too.",
  xHandle,
  chain: { name: "Robinhood Chain", id: 4663 },
  /** Set to true once the audit report is published; it swaps the docs §10 callout. */
  auditPublished: false,
  /** First holder payout: 12:00 on 3 Sep 2026, GMT+8 (= 04:00 UTC). One place to change it. */
  firstPayoutISO: "2026-09-03T04:00:00Z",
  links: {
    x: `https://x.com/${xHandle.replace(/^@/, "")}`,
    /** Where $OURO trades. The token is a letscash launchpad token, so buying happens there. */
    buy: "https://www.letscash.fun/token/0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc",
    /** TODO: block explorer for Robinhood Chain (also used for address links on the Ledger). */
    explorer: "#",
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
  // Shelved 2026-08-31 until each is ready to show. Routes, pages and URLs are untouched.
  { to: "/vaults/", label: "Vaults", hidden: true },
  { to: "/monitor/", label: "Monitor", hidden: true },
  { to: "/ledger/", label: "Ledger", hidden: true },
  { to: "/docs/", label: "Docs" },
];

/** What the site chrome actually links. Use this, not NAV, anywhere a reader can click. */
export const VISIBLE_NAV = NAV.filter((item) => !item.hidden);

/** `target="_blank"` only for real external URLs, not for "#" placeholders. */
export function externalLinkProps(href: string) {
  return /^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {};
}

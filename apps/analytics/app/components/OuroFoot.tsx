import { externalLinkProps, site } from "~/content/site";

/**
 * The foot of an Ouro page on a site that is not ourolayer.com.
 *
 * The Ledger and the airdrops used to sit inside ourolayer.com's chrome, which carried the operator's
 * name, the chain the figures come from and the risk disclaimer on every page. Moving the pages here
 * moved them out from under all three, so they carry their own: what they are read from, whose they
 * are, and the same warning the site gives, which is the part that must not be lost in a move.
 *
 * The comparison page has its own foot with its own lines, and says the opposite thing about
 * operation: it reports on projects Ouro does not run, while these two are Ouro's own.
 */
export function OuroFoot() {
  return (
    <footer className="foot page-foot">
      <span>Read from {site.chain.name} · nothing reported by hand</span>
      <span>
        {site.ticker} and this page are operated by {site.name} ·{" "}
        <a href={site.home} {...externalLinkProps(site.home)}>
          ourolayer.com ↗
        </a>
      </span>
      <span className="page-foot__legal">
        Ouro is experimental, unaudited software on an emerging chain, and is not affiliated with or endorsed by Robinhood. The pools hold volatile tokens
        that can lose value, including to zero. Nothing here is financial advice or a promise of returns.
      </span>
    </footer>
  );
}

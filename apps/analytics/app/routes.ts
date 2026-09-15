import { type RouteConfig, index, route } from "@react-router/dev/routes";

/**
 * Three pages, and they are not the same kind of page.
 *
 * The index is the comparison: every tax-index token on Robinhood Chain that pays its holders, ranked
 * beside each other, reporting on two projects Ouro does not run. The other two are Ouro's own books,
 * moved here from ourolayer.com on 2026-09-15 so that everything read off the chain lives on one
 * site and the product site is left to say what Ouro is. The nav labels them as Ouro's rather than
 * letting them read as more of the neutral comparison.
 *
 * Their URLs are the ones they had, so ourolayer.com/ledger/ and /airdrops/ redirect straight onto
 * them (apps/site/netlify.toml) and every link already posted still lands on the page it named.
 *
 * The per-project page is still to come: it will be `:key`, resolved against app/registry.ts, so
 * adding a fourth project adds no route.
 */
export default [
  index("routes/home.tsx"),
  route("ledger", "routes/ledger.tsx"),
  route("airdrops", "routes/airdrops.tsx"),
] satisfies RouteConfig;

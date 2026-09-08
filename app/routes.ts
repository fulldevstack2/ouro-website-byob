import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The design's views as real routes, plus the vaults and the dividend monitor.
// (/stake was removed on 2026-08-31 when staking was dropped: holders are paid directly.)
export default [
  index("routes/home.tsx"),
  // Held back 2026-09-08, the same way as referral below: not going out yet. UNREGISTERED rather
  // than shelved — `hidden` in NAV only takes a page out of the chrome and leaves the URL live,
  // pre-rendered and indexable, which for a page whose every figure still reads "Pending" is not
  // hiding it. Re-add this line, drop `hidden` in NAV and restore the roadmap's link to ship it.
  // route("vaults", "routes/vaults.tsx"),
  route("monitor", "routes/monitor.tsx"),
  route("ledger", "routes/ledger.tsx"),
  route("airdrops", "routes/airdrops.tsx"),
  // Held back 2026-09-08: referral is not going ahead for now. A product decision this time, not a
  // readiness one — it was briefly re-registered on the 8th. UNREGISTERED, not shelved: `hidden` in
  // NAV only takes a page out of the chrome, and this one must not be pre-rendered, indexed or
  // reachable — unknown URLs get a real 404 (see netlify.toml). Nothing is deleted: the route file
  // and everything it imports are untouched, and ouro-monitor goes on answering /v1/referrals, so
  // re-adding this line ships it.
  // route("referral", "routes/referral.tsx"),
  route("docs", "routes/docs.tsx"),
] satisfies RouteConfig;

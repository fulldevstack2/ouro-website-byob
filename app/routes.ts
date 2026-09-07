import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The design's views as real routes, plus the vaults and the dividend monitor.
// (/stake was removed on 2026-08-31 when staking was dropped: holders are paid directly.)
export default [
  index("routes/home.tsx"),
  route("vaults", "routes/vaults.tsx"),
  route("monitor", "routes/monitor.tsx"),
  route("ledger", "routes/ledger.tsx"),
  route("airdrops", "routes/airdrops.tsx"),
  // Held back 2026-09-07: the referral UI is mid-build (wallet connect, EIP-712 bind, claim), so it
  // ships with no route rather than as a half-finished page. UNREGISTERED, not shelved: `hidden`
  // in NAV only takes a page out of the chrome, and this one must not be pre-rendered or
  // reachable at all — unknown URLs get a real 404 (see netlify.toml). Re-add this line to ship
  // it; app/routes/referral.tsx and everything it imports are untouched.
  // route("referral", "routes/referral.tsx"),
  route("docs", "routes/docs.tsx"),
] satisfies RouteConfig;

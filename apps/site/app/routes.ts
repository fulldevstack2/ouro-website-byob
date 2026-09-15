import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The design's views as real routes, plus the vaults and the dividend monitor.
// (/stake was removed on 2026-08-31 when staking was dropped: holders are paid directly.)
export default [
  index("routes/home.tsx"),
  // Shipped 2026-09-08: the three OURO vaults are live on chain and the page is their app (deposit,
  // withdraw and claim with a connected wallet). It was held back earlier the same day while every
  // figure still read "Pending".
  route("vaults", "routes/vaults.tsx"),
  route("monitor", "routes/monitor.tsx"),
  // /ledger and /airdrops MOVED to the analytics site on 2026-09-15 (apps/analytics), which is now
  // the one place everything read off the chain lives. Their paths are unchanged there, and this
  // site 301s both of them across (netlify.toml), so every link already posted still resolves.
  // Added 2026-09-10: the connected wallet's view of the airdrop (its balance, every payout it
  // received, its vault deposits). ?address=0x… shows another wallet and is deliberately offered
  // nowhere on the site; it is read on the client only, since the route is prerendered.
  route("portfolio", "routes/portfolio.tsx"),
  // Held back 2026-09-08: referral is not going ahead for now. A product decision this time, not a
  // readiness one — it was briefly re-registered on the 8th. UNREGISTERED, not shelved: `hidden` in
  // NAV only takes a page out of the chrome, and this one must not be pre-rendered, indexed or
  // reachable — unknown URLs get a real 404 (see netlify.toml). Nothing is deleted: the route file
  // and everything it imports are untouched, and ouro-monitor goes on answering /v1/referrals, so
  // re-adding this line ships it.
  // route("referral", "routes/referral.tsx"),
  route("docs", "routes/docs.tsx"),
] satisfies RouteConfig;

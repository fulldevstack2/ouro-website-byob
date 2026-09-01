import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The design's views as real routes, plus the vaults and the dividend monitor.
// (/stake was removed on 2026-08-31 when staking was dropped: holders are paid directly.)
export default [
  index("routes/home.tsx"),
  route("vaults", "routes/vaults.tsx"),
  route("monitor", "routes/monitor.tsx"),
  route("ledger", "routes/ledger.tsx"),
  route("docs", "routes/docs.tsx"),
] satisfies RouteConfig;

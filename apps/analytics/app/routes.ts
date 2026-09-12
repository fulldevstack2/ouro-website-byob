import { type RouteConfig, index } from "@react-router/dev/routes";

/**
 * Routes are registry-driven from here on: the per-project page will be `:key`, resolved against
 * `app/registry.ts`, so adding a fourth project adds no route. The overview is the whole first
 * iteration — the comparison table is the thing the site exists to be.
 */
export default [index("routes/home.tsx")] satisfies RouteConfig;

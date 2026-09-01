import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { resolveSiteUrl } from "./scripts/site-url.mjs";

export default defineConfig({
  plugins: [reactRouter()],
  define: {
    // Public origin for canonical / Open Graph URLs; see scripts/site-url.mjs.
    __SITE_URL__: JSON.stringify(resolveSiteUrl()),
    // Origin of ouro-monitor (the INDEX / HOOD10 indexer); empty = the /monitor page shows its "not configured" state.
    __MONITOR_API__: JSON.stringify(process.env.MONITOR_API_URL ?? ""),
  },
  resolve: {
    tsconfigPaths: true,
  },
});

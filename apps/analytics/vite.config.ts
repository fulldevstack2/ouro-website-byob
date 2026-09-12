import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter()],
  define: {
    /**
     * Origin of ouro-monitor. THE ONLY PLACE THIS APP DECIDES IT.
     *
     * `@ouro/monitor-client` declares the global and reads it; it cannot define it, because the two
     * apps may legitimately point at different origins — a dev server against a local indexer while
     * the deployed site builds against the live one. Same default as apps/site, and for the same
     * reason: an env var you have to remember is an env var you forget, and forgetting it produces
     * a page that says "monitor offline" and looks exactly like a production outage.
     *
     * `MONITOR_API_URL=http://localhost:8787 pnpm dev` to develop against a local monitor;
     * `MONITOR_API_URL= pnpm dev` for the "not configured" state, to check how it renders.
     */
    __MONITOR_API__: JSON.stringify(process.env.MONITOR_API_URL ?? "https://ouro-monitor.onrender.com"),
    __SITE_URL__: JSON.stringify(process.env.SITE_URL ?? "https://analytics.ourolayer.com"),
  },
  resolve: { tsconfigPaths: true },
  server: { watch: { ignored: ["**/build/**", "**/.react-router/**"] } },
});

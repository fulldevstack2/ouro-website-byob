import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { resolveSiteUrl } from "./scripts/site-url.mjs";

export default defineConfig({
  plugins: [reactRouter()],
  define: {
    // Public origin for canonical / Open Graph URLs; see scripts/site-url.mjs.
    __SITE_URL__: JSON.stringify(resolveSiteUrl()),
    /**
     * Origin of ouro-monitor, the indexer /ledger and /monitor read. THE ONLY PLACE THIS IS DECIDED.
     *
     * It defaults to the live monitor rather than to localhost or to nothing, because both of those
     * defaults were wrong in practice: `pnpm dev` used to fall back to `http://localhost:8787` and a
     * plain `pnpm build` to the empty string, so the honest thing to do with a dev server was to
     * remember an env var, and forgetting it produced a page reporting "monitor offline" that looked
     * exactly like a production outage. The API is read-only, cacheable and CORS-open, so pointing at
     * it from a dev server costs nothing and shows real data.
     *
     * Override to develop against a local monitor: `MONITOR_API_URL=http://localhost:8787 pnpm dev`.
     * Setting it to the empty string is still honoured, and gives the "not configured" state.
     */
    __MONITOR_API__: JSON.stringify(process.env.MONITOR_API_URL ?? "https://ouro-monitor.onrender.com"),
  },
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    /**
     * Do not watch the build output.
     *
     * `pnpm build` writes `build/` and a post-build step deletes `build/server/`, all inside the
     * directory the dev server watches. Vite reacts to its own output: the log fills with
     * "page reload build/client/…/index.html" and the process has repeatedly fallen over partway
     * through a build, taking the dev server with it. Running a build while `pnpm dev` is up is a
     * perfectly reasonable thing to do — check a production build without losing your HMR session —
     * so the watcher is told to ignore the output instead.
     */
    watch: { ignored: ["**/build/**", "**/.react-router/**"] },
  },
});

/**
 * Runs after `react-router build`. Copied from apps/site, and worth having here for the same two
 * reasons plus one of its own: /ledger/ and /airdrops/ were indexed at ourolayer.com for weeks, so
 * a sitemap is how their new home gets crawled rather than only inferred from the 301s.
 *
 * What it does:
 *  - drops build/server (only used to pre-render; nothing serves it),
 *  - copies the SPA fallback to 404.html so static hosts (Netlify) return a real 404 status
 *    for unknown URLs while the app still renders its own "Page not found",
 *  - writes robots.txt and sitemap.xml for the pre-rendered routes.
 */
import { copyFileSync, existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSiteUrl } from "./site-url.mjs";

// fileURLToPath, not .pathname: on Windows the pathname is "/D:/WORK%20CODE/…", which join() turns into "D:D:…".
const root = fileURLToPath(new URL("..", import.meta.url));
const client = join(root, "build", "client");
const siteUrl = resolveSiteUrl();

rmSync(join(root, "build", "server"), { recursive: true, force: true });

const fallback = join(client, "__spa-fallback.html");
if (existsSync(fallback)) copyFileSync(fallback, join(client, "404.html"));

// Every pre-rendered route is a directory with an index.html (plus the root).
const routes = ["/"];
for (const name of readdirSync(client)) {
  const dir = join(client, name);
  if (statSync(dir).isDirectory() && existsSync(join(dir, "index.html")) && !["assets", "fonts", "og"].includes(name)) {
    routes.push(`/${name}/`);
  }
}
const lastmod = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((p) => `  <url><loc>${siteUrl}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(client, "sitemap.xml"), sitemap);
writeFileSync(join(client, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log(`postbuild: 404.html, robots.txt, sitemap.xml (${routes.length} urls) for ${siteUrl}`);

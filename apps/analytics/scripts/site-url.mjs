/**
 * This app's public origin, resolved at build time. Used by the postbuild script for robots.txt and
 * sitemap.xml; the pages themselves get it through vite's `define` (__SITE_URL__), from the same
 * env var. Order: SITE_URL (explicit, set in netlify.toml) → URL (Netlify's build image) → the
 * fallback below.
 */
const FALLBACK = "https://analytics.ourolayer.com";

export function resolveSiteUrl(env = process.env) {
  const raw = env.SITE_URL || env.URL || FALLBACK;
  return raw.replace(/\/+$/, "");
}

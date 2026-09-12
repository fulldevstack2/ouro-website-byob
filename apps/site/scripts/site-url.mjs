/**
 * The site's public origin, resolved at build time. Used for canonical URLs, Open Graph URLs,
 * robots.txt and sitemap.xml. Order: SITE_URL (explicit) → URL (set by Netlify's build image;
 * becomes the custom domain once one is attached) → the current Netlify subdomain.
 */
const FALLBACK = "https://ourolayer.com";

export function resolveSiteUrl(env = process.env) {
  const raw = env.SITE_URL || env.URL || FALLBACK;
  return raw.replace(/\/+$/, "");
}

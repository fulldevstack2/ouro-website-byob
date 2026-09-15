import type { MetaDescriptor } from "react-router";
import { site } from "~/content/site";

/**
 * Route `meta()` for the pages that came over from ourolayer.com.
 *
 * `site.url` here is THIS app's origin, so a canonical URL points at the page where it now lives
 * rather than at the one it moved off. The rest is apps/site's helper unchanged, cards included.
 */
export interface PageMetaInput {
  /** ≤ 60 characters. */
  title: string;
  /** ≤ 155 characters. */
  description: string;
  /** The route's pathname (from `Route.MetaArgs["location"]`). */
  path: string;
  /** 1200×630 card under public/og. The two cards moved here with their pages; there is no card
   *  for the comparison page, and a page without one simply omits the image tags rather than
   *  advertising a file that is not there. */
  image?: string;
  imageAlt?: string;
  /** schema.org objects emitted as JSON-LD. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/** Netlify serves directories at their trailing-slash URL, so that is the canonical form. */
export function canonicalPath(pathname: string) {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : `${p}/`;
}

/** Route `meta()` helper: title, description, canonical, Open Graph, Twitter card, JSON-LD. */
export function pageMeta({ title, description, path, image, imageAlt, jsonLd }: PageMetaInput): MetaDescriptor[] {
  const url = site.url + canonicalPath(path);
  const out: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: site.name },
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:site", content: site.xHandle },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    const img = site.url + image;
    out.push(
      { property: "og:image", content: img },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: imageAlt ?? title },
      { name: "twitter:image", content: img },
    );
  }
  for (const ld of jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []) out.push({ "script:ld+json": ld });
  return out;
}

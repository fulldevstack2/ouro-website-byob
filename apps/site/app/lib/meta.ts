import type { MetaDescriptor } from "react-router";
import { site } from "~/content/site";

export interface PageMetaInput {
  /** ≤ 60 characters. */
  title: string;
  /** ≤ 155 characters. */
  description: string;
  /** The route's pathname (from `Route.MetaArgs["location"]`). */
  path: string;
  /** 1200×630 card under public/og; regenerate with `node scripts/og-cards.mjs`. */
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
export function pageMeta({ title, description, path, image = "/og/home.png", imageAlt, jsonLd }: PageMetaInput): MetaDescriptor[] {
  const url = site.url + canonicalPath(path);
  const img = site.url + image;
  const out: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: site.name },
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt ?? title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: site.xHandle },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
  ];
  for (const ld of jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []) out.push({ "script:ld+json": ld });
  return out;
}

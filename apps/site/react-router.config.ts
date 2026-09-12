import type { Config } from "@react-router/dev/config";

export default {
  // Static marketing site — no runtime server. Every route in app/routes.ts is
  // pre-rendered to HTML at build time (build/client/**/index.html) and then
  // hydrates into a client-side app. See README → "Deploying".
  ssr: false,
  prerender: true,
} satisfies Config;

import type { Config } from "@react-router/dev/config";

export default {
  // Same shape as the site: no runtime server, every route pre-rendered to HTML at build time and
  // hydrated on the client. The figures are all read from ouro-monitor in the browser, so a static
  // build is not a limitation here — it is the deploy model the data already assumes.
  ssr: false,
  prerender: true,
} satisfies Config;

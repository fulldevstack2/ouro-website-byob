import { http, createConfig, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { robinhood } from "./chain";

/** ssr:false because the site prerenders to static HTML — wagmi must not try to hydrate
 *  from a server snapshot that never existed. */
export const wagmiConfig = createConfig({
  chains: [robinhood],
  connectors: [injected()],
  transports: { [robinhood.id]: http(robinhood.rpcUrls.default.http[0]) },
  ssr: false,
  storage:
    typeof window !== "undefined"
      ? createStorage({ storage: window.localStorage, key: "ouro.wagmi" })
      : undefined,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

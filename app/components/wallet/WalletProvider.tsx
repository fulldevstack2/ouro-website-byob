import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "~/lib/wagmi";

/**
 * The wallet tree, mounted on the client only.
 *
 * Every route here is prerendered to HTML at build time, which is a real render pass in node. wagmi
 * and RainbowKit reach for browser globals (storage, WalletConnect's transport), so running them in
 * that pass is how a static site starts failing its own build. Gating on a mounted flag means the
 * prerendered HTML is always the disconnected state, which is exactly what a first-time visitor and
 * a crawler should see anyway.
 *
 * `fallback` is what the prerender writes and what the first client frame shows, so it must be the
 * real logged-out UI rather than a spinner, or the page has nothing in it when shared or indexed.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** RainbowKit, dressed in Ouro's own tokens rather than its default purple. */
const ouroTheme = lightTheme({
  accentColor: "#86641F",
  accentColorForeground: "#FFFFFF",
  borderRadius: "small",
  fontStack: "system",
});

export function WalletProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{fallback ?? null}</>;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={ouroTheme} modalSize="compact" showRecentTransactions={false}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

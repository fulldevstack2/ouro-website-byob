import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "~/lib/dex/wagmi";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/**
 * The site prerenders to static HTML with ssr:false, so wagmi must not run during the build:
 * it reaches for window/localStorage and would either throw or bake a "disconnected" snapshot
 * that the client then has to correct, which is what makes a connected wallet flicker on load.
 * Mount-gating renders `fallback` into the prerendered HTML and swaps in the live tree on hydration.
 */
export function Web3Provider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback ?? null}</>;
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

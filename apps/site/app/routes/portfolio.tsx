import { Suspense, lazy, useEffect, useState } from "react";

import type { Route } from "./+types/portfolio";
import { Container } from "~/components/site";
import { PortfolioStatic } from "~/components/portfolio/PortfolioFrame";
import { pageMeta } from "~/lib/meta";

/**
 * The wallet half of the page, loaded on the client only, exactly as /vaults does it. The prerender
 * (a real render pass in node) and the first client frame both show `PortfolioStatic`; once mounted,
 * the live section and with it wagmi, RainbowKit and viem arrive as their own chunk. That keeps the
 * wallet stack out of the server bundle and out of the way of crawlers.
 *
 * The header is part of the split, because its right-hand side is the wallet: connect, the address,
 * Share. So the whole page body lives in components/portfolio, and this file only chooses which half.
 */
const PortfolioLive = lazy(() => import("~/components/portfolio/PortfolioLive"));

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: "The portfolio · your $OURO and every airdrop it received",
    description: "Your $OURO, every airdrop it has received with the transaction that paid it, what it holds now and what sits in the vaults.",
    path: location.pathname,
    image: "/og/portfolio.png",
  });
}

function PortfolioSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <PortfolioStatic />;
  return (
    <Suspense fallback={<PortfolioStatic />}>
      <PortfolioLive />
    </Suspense>
  );
}

export default function Portfolio() {
  return (
    <Container className="page">
      <PortfolioSection />
    </Container>
  );
}

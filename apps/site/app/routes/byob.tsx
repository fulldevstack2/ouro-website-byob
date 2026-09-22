import { Suspense, lazy, useEffect, useState } from "react";

import type { Route } from "./+types/byob";
import { ByobStatic } from "~/components/byob/ByobFrame";
import { pageMeta } from "~/lib/meta";

/**
 * Build Your Ouro Basket — choose the mix of CASHCAT / PONS / AI in your airdrop.
 * Wallet + SIWE live half is client-only (same pattern as /portfolio and /vaults).
 */
const ByobLive = lazy(() => import("~/components/byob/ByobLive"));

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: "BYOB · build your airdrop basket",
    description:
      "Pick how much CASHCAT, PONS and AI you want in your Ouro airdrop. Changes wait a couple of cycles. Equal basket stays the default until you opt in.",
    path: location.pathname,
  });
}

function ByobSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ByobStatic />;
  return (
    <Suspense fallback={<ByobStatic />}>
      <ByobLive />
    </Suspense>
  );
}

export default function Byob() {
  return <ByobSection />;
}

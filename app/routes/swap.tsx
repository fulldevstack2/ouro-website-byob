import type { Route } from "./+types/swap";
import { Callout } from "~/components/ds";
import { Container, Grid, PageHeader, mono } from "~/components/site";
import { Web3Provider } from "~/components/dex/Web3Provider";
import { SwapCard } from "~/components/dex/SwapCard";
import { OURO, HOOK } from "~/lib/dex/addresses";
import { robinhood } from "~/lib/dex/chain";
import { site } from "~/content/site";
import { pageMeta } from "~/lib/meta";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `Trade $OURO · ${site.name}`,
    description:
      "Buy and sell $OURO on its official Uniswap v4 pool on Robinhood Chain. Every trade pays the 5% tax that funds the airdrop and the pools the protocol keeps.",
    path: location.pathname,
  });
}

const skeleton = (
  <div style={{ ...mono, fontSize: 12, color: "var(--text-faint)", padding: "24px 0" }}>
    Loading the trading interface…
  </div>
);

export default function Swap() {
  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Trade"
        title="Buy and sell $OURO."
        lede="Straight to the official pool. This is the only venue the tax reaches, so it is the only one that funds the airdrop and the pools the protocol keeps."
      />
      <Grid cols="minmax(0, 460px) minmax(0, 1fr)" gap={56} align="start">
        <Web3Provider fallback={skeleton}>
          <SwapCard />
        </Web3Provider>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 460 }}>
          <Callout title="What a trade costs">
            5% tax on the ETH leg, plus the pool's standard 1% LP fee: about 6% all in, on buys and on sells.
            The quote you see already has both taken out, so what it says is what arrives.
          </Callout>
          <Callout tone="warning" title="Only trade on this pool">
            Any other $OURO pool is untaxed, funds nothing, and can be blocklisted. If you provide liquidity
            to one, a block stops transfers both ways and it cannot be withdrawn from at all, your ETH as
            well as your $OURO.
          </Callout>
          <div style={{ ...mono, fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.9 }}>
            <div>token &nbsp;<a href={`${robinhood.blockExplorers.default.url}/address/${OURO}`} target="_blank" rel="noreferrer">{OURO}</a></div>
            <div>hook &nbsp;&nbsp;<a href={`${robinhood.blockExplorers.default.url}/address/${HOOK}`} target="_blank" rel="noreferrer">{HOOK}</a></div>
            <div>chain &nbsp;Robinhood Chain · 4663 · fee tier 1%</div>
          </div>
        </div>
      </Grid>
    </Container>
  );
}

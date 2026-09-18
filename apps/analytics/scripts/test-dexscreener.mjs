/**
 * Unit checks for Dex price/FDV pair selection (HOOD10 LIME quote trap).
 * Run: node apps/analytics/scripts/test-dexscreener.mjs
 *
 * Uses a tiny inline copy of the selection rules so this script stays free of a TS runner.
 * Keep in sync with pickPricePair / summarise in app/lib/dexscreener.ts.
 */
import assert from "node:assert/strict";

const HOOD10 = "0x0D257cA40d40090BE60C2d2Ed5bB3535392838cc";
const CANON = "0x2e152bc12f30bd46eb39f0ead2367df62b9572ba3a2d54ea3e3aca43c00ae9f6";

function pickPricePair(pairs, token, canonicalPoolId) {
  if (pairs.length === 0) return null;
  const canon = canonicalPoolId.toLowerCase();
  const want = token.toLowerCase();
  const canonical = pairs.find((p) => (p.pairAddress ?? "").toLowerCase() === canon);
  if (canonical) return canonical;
  let best = null;
  let deepest = -1;
  for (const p of pairs) {
    if ((p.baseToken?.address ?? "").toLowerCase() !== want) continue;
    const liq = Number(p.liquidity?.usd ?? 0);
    if (!Number.isFinite(liq) || liq <= deepest) continue;
    deepest = liq;
    best = p;
  }
  return best;
}

const pairs = [
  {
    pairAddress: "0x9652c30b273b8c40f3f90e58535f0aed85336525fa856a9bc05d3d3725d4ae42",
    priceUsd: "0.6529",
    fdv: 652_981_976,
    liquidity: { usd: 4_897_364 },
    volume: { h24: 100 },
    baseToken: { address: "0xLIME" },
    quoteToken: { address: HOOD10 },
  },
  {
    pairAddress: CANON,
    priceUsd: "0.00074",
    fdv: 735_000,
    liquidity: { usd: 81_000 },
    volume: { h24: 50 },
    baseToken: { address: HOOD10 },
    quoteToken: { address: "0xETH" },
  },
  {
    pairAddress: "0xother",
    priceUsd: "0.00050",
    fdv: 500_000,
    liquidity: { usd: 8_000 },
    volume: { h24: 10 },
    baseToken: { address: HOOD10 },
    quoteToken: { address: "0xUSDG" },
  },
];

const picked = pickPricePair(pairs, HOOD10, CANON);
assert.equal(picked?.pairAddress?.toLowerCase(), CANON.toLowerCase());
assert.equal(Number(picked?.priceUsd), 0.00074);

const withoutCanon = pairs.filter((p) => p.pairAddress !== CANON);
const fallback = pickPricePair(withoutCanon, HOOD10, CANON);
assert.equal(fallback?.pairAddress, "0xother");
assert.equal(Number(fallback?.priceUsd), 0.0005);

const quoteOnly = [pairs[0]];
assert.equal(pickPricePair(quoteOnly, HOOD10, CANON), null);

// Latent OURO trap: mmETH/OURO quote pair at $0 liq must not win over OURO/ETH.
const OURO = "0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc";
const OURO_CANON = "0x4abc526118181921d76bf184896938ae7c8fc0921abce79ebef3d36a622968a5";
const ouroPairs = [
  {
    pairAddress: "0xmmeth",
    priceUsd: "999",
    fdv: 1e12,
    liquidity: { usd: 0 },
    baseToken: { address: "0xmmETH" },
    quoteToken: { address: OURO },
  },
  {
    pairAddress: OURO_CANON,
    priceUsd: "0.000718",
    fdv: 718_000,
    liquidity: { usd: 50_000 },
    baseToken: { address: OURO },
    quoteToken: { address: "0xETH" },
  },
];
const ouro = pickPricePair(ouroPairs, OURO, OURO_CANON);
assert.equal(Number(ouro?.priceUsd), 0.000718);

// APR at Dex price (same formula as ouro-monitor impliedAprPct)
function aprAtPrice(paidUsdPerDay, eligibleTokens, priceUsd) {
  if (paidUsdPerDay == null || eligibleTokens == null || eligibleTokens <= 0 || priceUsd == null || priceUsd <= 0) {
    return null;
  }
  return (paidUsdPerDay / (eligibleTokens * priceUsd)) * 365 * 100;
}
assert.ok(Math.abs(aprAtPrice(100, 1_000_000, 0.001) - 3650) < 1e-9);
assert.equal(aprAtPrice(100, 1_000_000, null), null);

console.log("ok · dexscreener pair selection + aprAtPrice");

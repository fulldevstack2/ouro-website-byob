import { site } from "./site";

/**
 * The referral programme's parameters, in one place so the page, the docs and the parameters table
 * cannot drift apart. Same discipline as `COLLECT_THRESHOLD_USD` in protocol.ts.
 *
 * Both sides of a referred trade earn the same share of the ETH leg of the referee's buys. The pair
 * is funded from the ops leg, which is why the airdrop, the LP leg and the 80 / 20 fee split are
 * unaffected by it: ops goes from 0.7% to 0.5% on a referred trade and nothing else moves.
 */
export const REFERRAL_RATE_PCT = 0.1;

/** Ops keeps this much of a referred trade, after both rebate legs. Derived, so the copy holds. */
export const OPS_PCT = 0.7;
export const OPS_FLOOR_PCT = Number((OPS_PCT - REFERRAL_RATE_PCT * 2).toFixed(2));

/** The same rate expressed against the 5% tax, which is how a reader usually asks about it. */
export const TAX_PCT = 5;
export const REFERRAL_RATE_OF_TAX_PCT = Number(((REFERRAL_RATE_PCT / TAX_PCT) * 100).toFixed(0));

/**
 * Rebates are paid on BUYS only. Sells pay the tax too, so paying on them would be defensible on the
 * mechanics, but it points the incentive at the wrong behaviour and is harder to say out loud.
 */
export const PAYS_ON = "buys";

/**
 * Flip to true when the accrual engine, the epoch roots and the distributor are live. Until then the
 * page renders its pre-launch state: the mechanics in full, every figure a dash, and no wallet write
 * offered. The site already works this way everywhere else, and it is why nothing here invents a
 * number it cannot read from the chain.
 */
export const PROGRAM_LIVE = false;

/**
 * A referral code is derived from the referrer's own address rather than stored in a registry, so
 * there is no code table to keep, no collisions to resolve and nothing to look up before a link
 * works. It is deliberately NOT reversible to the address in the URL bar: the referee should not
 * learn who referred them from the link alone, which is the same reasoning `dex-backend`'s
 * `referral_codes.referralCode` was built on ("invitee must not learn inviter address").
 *
 * FNV-1a over the lowercased address, base36, padded. Collisions are resolved server side at bind
 * time by rejecting a code that does not resolve to exactly one address.
 */
export function codeForAddress(address: string): string {
  let h = 0x811c9dc5;
  const a = address.toLowerCase();
  for (let i = 0; i < a.length; i++) {
    h ^= a.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let g = 0x811c9dc5 ^ h;
  for (let i = a.length - 1; i >= 0; i--) {
    g ^= a.charCodeAt(i);
    g = Math.imul(g, 0x01000193) >>> 0;
  }
  return (h.toString(36) + g.toString(36)).slice(0, 10).padEnd(10, "0");
}

export function referralLink(address: string): string {
  return `${site.url}/referral/?ref=${codeForAddress(address)}`;
}

/**
 * EIP-712 domain and type for a binding. The referee signs it, so the signature is the referee's own
 * statement that this referrer sent them, and it stays verifiable by anyone after the fact even
 * though the binding itself lives off chain.
 *
 * `nonce` and `deadline` make a signature single use and short lived, so a leaked one cannot be
 * replayed to rebind a wallet later.
 */
export const BIND_DOMAIN = {
  name: "Ouro Referrals",
  version: "1",
  chainId: site.chain.id,
} as const;

export const BIND_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
  ],
  Bind: [
    { name: "referee", type: "address" },
    { name: "referrerCode", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function bindPayload(referee: string, referrerCode: string, nonce: number, deadline: number) {
  return {
    types: BIND_TYPES,
    primaryType: "Bind" as const,
    domain: BIND_DOMAIN,
    message: { referee, referrerCode, nonce, deadline },
  };
}

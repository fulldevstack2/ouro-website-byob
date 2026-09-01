import type { Address } from "viem";
import { zeroAddress } from "viem";

export const OURO: Address = "0x8A1f9526CC4f81091ABd666A28325b6668AEF271";
export const HOOK: Address = "0x59Faa56b2758e4ECbA17aAdD80cF66E1620Ee0cc";
export const UNIVERSAL_ROUTER: Address = "0x8876789976dEcBfCbBbe364623C63652db8C0904";
export const PERMIT2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const V4_QUOTER: Address = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";

/** The one pool. currency0 is native ETH, currency1 is OURO — the order the hook enforces. */
export const POOL_KEY = {
  currency0: zeroAddress as Address,
  currency1: OURO,
  fee: 10_000,
  tickSpacing: 200,
  hooks: HOOK,
} as const;

export const TAX_BPS = 500n;
export const LP_FEE_BPS = 100n;

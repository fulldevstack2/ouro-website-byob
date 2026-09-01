import { encodeAbiParameters, concatHex, zeroAddress, type Address, type Hex } from "viem";
import { EXACT_IN_SINGLE_ABI } from "./abis";
import { OURO, POOL_KEY } from "./addresses";

const V4_SWAP = 0x10;
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;

const byte = (n: number) => n.toString(16).padStart(2, "0");

export interface SwapPlan {
  commands: Hex;
  inputs: readonly Hex[];
  value: bigint;
}

/**
 * One exact-in swap through the UniversalRouter's v4 path.
 * buy  = ETH -> OURO (zeroForOne, ETH is msg.value)
 * sell = OURO -> ETH (needs a Permit2 allowance for the router first)
 */
export function buildSwap(side: "buy" | "sell", amountIn: bigint, minOut: bigint): SwapPlan {
  const zeroForOne = side === "buy";
  const currencyIn: Address = zeroForOne ? zeroAddress : OURO;
  const currencyOut: Address = zeroForOne ? zeroAddress : OURO;

  const swapParams = encodeAbiParameters([EXACT_IN_SINGLE_ABI], [
    { poolKey: POOL_KEY, zeroForOne, amountIn, amountOutMinimum: minOut, hookData: "0x" },
  ] as never);

  const settle = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [currencyIn, amountIn],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [zeroForOne ? OURO : zeroAddress, minOut],
  );
  void currencyOut;

  const actions = `0x${byte(SWAP_EXACT_IN_SINGLE)}${byte(SETTLE_ALL)}${byte(TAKE_ALL)}` as Hex;
  const v4Input = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [swapParams, settle, take]],
  );

  return {
    commands: `0x${byte(V4_SWAP)}` as Hex,
    inputs: [v4Input],
    value: zeroForOne ? amountIn : 0n,
  };
}

export const withSlippage = (out: bigint, bps: number) => (out * BigInt(10_000 - bps)) / 10_000n;

export function fmt(v: bigint, decimals = 18, places = 6): string {
  const neg = v < 0n;
  const s = (neg ? -v : v).toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals).slice(0, places).replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${frac ? "." + frac : ""}`;
}

export function parseAmount(input: string, decimals = 18): bigint {
  const t = input.trim();
  if (!t || !/^\d*\.?\d*$/.test(t)) return 0n;
  const [w = "0", f = ""] = t.split(".");
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
}

void concatHex;

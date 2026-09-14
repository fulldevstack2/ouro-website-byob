import { createPublicClient, encodeAbiParameters, keccak256 } from "viem";

import { RESERVE_ADDRESS, V4_POOL_MANAGER, V4_POSITION_MANAGER, type V4PositionEntry } from "~/content/protocol";
import { rpcTransport } from "./rpc";

/**
 * Reading a Uniswap v4 position straight from the chain.
 *
 * ouro-monitor indexes Uniswap v3 only, so the Reserve's v4 position is counted in `/v1/reserve`'s
 * `unindexed` list and valued nowhere. This is the site reading that one position itself: what it
 * holds, at what price, and whether it is in range. Everything here is a view call; nothing is
 * cached on a server, so what the page shows is the chain at the moment it asked.
 *
 * Three reads per position, and every one of them is also a check: the NFT's owner must still be the
 * Reserve, the pool key must still be the pair this site names, and the liquidity must be non-zero.
 * A position that fails any of them is dropped rather than drawn, because a row with a figure in it
 * is a claim that the protocol holds that position right now.
 */

const positionManagerAbi = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "getPositionLiquidity", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint128" }] },
  {
    name: "getPoolAndPositionInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "uint256" },
    ],
  },
] as const;

/** The PoolManager keeps its state behind `extsload` rather than getters, so a pool is read by slot. */
const poolManagerAbi = [{ name: "extsload", type: "function", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "bytes32" }] }] as const;

/** `StateLibrary.POOLS_SLOT`: the PoolManager's `mapping(PoolId => Pool.State)` lives at storage slot 6. */
const POOLS_SLOT = 6n;

/** `Pool.State.liquidity`, three words into the struct, after slot0 and the two fee growth globals. */
const LIQUIDITY_OFFSET = 3n;

export interface V4PositionState {
  entry: V4PositionEntry;
  /** Whole tokens, the constituent side and the quote side. */
  amountToken: number;
  amountQuote: number;
  /** The pool's own price for the constituent, in quote tokens, from its current tick. */
  priceInQuote: number;
  /** The pool's LP fee in hundredths of a bip, as the tier column reads it. */
  feeBps: number;
  /**
   * The v4 protocol fee, one direction of it, in the same units. Unlike the v3 skim this comes off
   * the input of a swap before the LP fee, so it does not reduce the tier the position earns.
   */
  protocolFeeBps: number;
  /** This position's share of the liquidity the pool is currently swapping against, or null if out of range. */
  shareOfActiveLiquidity: number | null;
  tick: number;
  tickLower: number;
  tickUpper: number;
  inRange: boolean;
}

/** A v4 `PositionInfo` word: 200 bits of pool id, then tickUpper, tickLower, and a subscriber flag. */
function ticksFromInfo(info: bigint) {
  const signed24 = (v: bigint) => (v >= 0x800000n ? Number(v - 0x1000000n) : Number(v));
  return { tickLower: signed24((info >> 8n) & 0xffffffn), tickUpper: signed24((info >> 32n) & 0xffffffn) };
}

/**
 * `Slot0` packs, from the low bits: sqrtPriceX96 (160), tick (24), protocolFee (24), lpFee (24).
 *
 * The protocol fee is itself two 12 bit halves, one per swap direction, in pips of the input. They
 * are the same on this pool, so the lower half is the figure the card shows.
 */
function slot0(word: bigint) {
  const signed24 = (v: bigint) => (v >= 0x800000n ? Number(v - 0x1000000n) : Number(v));
  const protocolFee = (word >> 184n) & 0xffffffn;
  return {
    sqrtPriceX96: word & ((1n << 160n) - 1n),
    tick: signed24((word >> 160n) & 0xffffffn),
    protocolFee: Number(protocolFee & 0xfffn),
    lpFee: Number((word >> 208n) & 0xffffffn),
  };
}

/**
 * What a position's liquidity is worth in its two tokens, by the Uniswap v3/v4 formula.
 *
 * Deliberately in doubles rather than the integer math the contracts use: the answer is a dollar
 * figure rounded to the nearest dollar, and a double carries ~15 significant digits, which is more
 * than a $3,000 position needs. `Math.pow(1.0001, tick / 2)` is `sqrt(1.0001^tick)`, the same square
 * root price the pool stores as a Q64.96.
 */
function amountsForLiquidity(liquidity: bigint, sqrtPriceX96: bigint, tickLower: number, tickUpper: number) {
  const p = Number(sqrtPriceX96) / 2 ** 96;
  const a = Math.pow(1.0001, tickLower / 2);
  const b = Math.pow(1.0001, tickUpper / 2);
  const l = Number(liquidity);
  if (p <= a) return { amount0: l * (1 / a - 1 / b), amount1: 0 };
  if (p >= b) return { amount0: 0, amount1: l * (b - a) };
  return { amount0: l * (1 / p - 1 / b), amount1: l * (p - a) };
}

/** A struct's later field: the slot of its first word, plus the field's offset, as a 32 byte value. */
function addSlot(slot: `0x${string}`, offset: bigint): `0x${string}` {
  return `0x${(BigInt(slot) + offset).toString(16).padStart(64, "0")}`;
}

export async function readV4Position(entry: V4PositionEntry): Promise<V4PositionState | null> {
  const client = createPublicClient({ transport: rpcTransport() });
  const [owner, liquidity, poolAndPosition] = await Promise.all([
    client.readContract({ address: V4_POSITION_MANAGER, abi: positionManagerAbi, functionName: "ownerOf", args: [entry.tokenId] }),
    client.readContract({ address: V4_POSITION_MANAGER, abi: positionManagerAbi, functionName: "getPositionLiquidity", args: [entry.tokenId] }),
    client.readContract({ address: V4_POSITION_MANAGER, abi: positionManagerAbi, functionName: "getPoolAndPositionInfo", args: [entry.tokenId] }),
  ]);
  if (owner.toLowerCase() !== RESERVE_ADDRESS.toLowerCase() || liquidity === 0n) return null;

  const [key, info] = poolAndPosition;
  // The pair this site names must be the pair the position is actually in, with the constituent as
  // currency1 (native ETH sorts first, as address zero).
  if (key.currency1.toLowerCase() !== entry.token.address.toLowerCase()) return null;

  const stateSlot = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [entry.poolId, POOLS_SLOT]));
  const [word, liquidityWord] = await Promise.all([
    client.readContract({ address: V4_POOL_MANAGER, abi: poolManagerAbi, functionName: "extsload", args: [stateSlot] }),
    client.readContract({ address: V4_POOL_MANAGER, abi: poolManagerAbi, functionName: "extsload", args: [addSlot(stateSlot, LIQUIDITY_OFFSET)] }),
  ]);
  const { sqrtPriceX96, tick, protocolFee, lpFee } = slot0(BigInt(word));
  if (sqrtPriceX96 === 0n) return null;

  const { tickLower, tickUpper } = ticksFromInfo(info);
  const { amount0, amount1 } = amountsForLiquidity(liquidity, sqrtPriceX96, tickLower, tickUpper);
  const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  const inRange = tick >= tickLower && tick < tickUpper;
  // The pool's `liquidity` is what it is swapping against right now, so a share of it only means
  // anything while this position is part of it.
  const active = BigInt(liquidityWord) & ((1n << 128n) - 1n);
  return {
    entry,
    amountQuote: amount0 / 10 ** entry.quote.decimals,
    amountToken: amount1 / 10 ** entry.token.decimals,
    // `price` is currency1 per currency0, so the constituent's price in ETH is its reciprocal.
    priceInQuote: price > 0 ? 1 / price : 0,
    feeBps: lpFee,
    protocolFeeBps: protocolFee,
    shareOfActiveLiquidity: inRange && active > 0n ? Number(liquidity) / Number(active) : null,
    tick,
    tickLower,
    tickUpper,
    inRange,
  };
}

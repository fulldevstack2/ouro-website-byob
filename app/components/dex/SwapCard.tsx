import { useEffect, useMemo, useState } from "react";
import { useAccount, useBalance, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { maxUint160, maxUint256, zeroAddress, type Address } from "viem";
import { ERC20_ABI, PERMIT2_ABI, QUOTER_ABI, UNIVERSAL_ROUTER_ABI } from "~/lib/dex/abis";
import { OURO, PERMIT2, POOL_KEY, UNIVERSAL_ROUTER, V4_QUOTER } from "~/lib/dex/addresses";
import { robinhood } from "~/lib/dex/chain";
import { buildSwap, fmt, parseAmount, withSlippage } from "~/lib/dex/swap";
import { Button, Callout } from "~/components/ds";
import { mono } from "~/components/site";
import { ConnectButton } from "./ConnectButton";

type Side = "buy" | "sell";
const DEADLINE_S = 600n;

const box: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-md)",
  padding: 16,
};
const label: React.CSSProperties = {
  ...mono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-faint)",
};

export function SwapCard() {
  const { address, isConnected, chainId } = useAccount();
  const pc = usePublicClient({ chainId: robinhood.id });
  const [side, setSide] = useState<Side>("buy");
  const [raw, setRaw] = useState("");
  const [slippageBps, setSlippageBps] = useState(300);
  const [err, setErr] = useState<string | null>(null);

  const amountIn = useMemo(() => parseAmount(raw), [raw]);

  function edit(next: string) {
    setRaw(next);
    if (hash) { setHash(undefined); setAction(null); }
    if (err) setErr(null);
  }
  const onRightChain = chainId === robinhood.id;

  const { data: ethBal } = useBalance({ address, query: { enabled: !!address, refetchInterval: 10_000 } });
  const { data: ouroBal } = useReadContract({
    address: OURO, abi: ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const balance = side === "buy" ? (ethBal?.value ?? 0n) : ((ouroBal as bigint | undefined) ?? 0n);
  const symIn = side === "buy" ? "ETH" : "OURO";
  const symOut = side === "buy" ? "OURO" : "ETH";

  const quote = useQuery({
    queryKey: ["quote", side, amountIn.toString()],
    enabled: !!pc && amountIn > 0n,
    refetchInterval: 12_000,
    queryFn: async () => {
      const { result } = await pc!.simulateContract({
        address: V4_QUOTER, abi: QUOTER_ABI, functionName: "quoteExactInputSingle",
        args: [{ poolKey: POOL_KEY, zeroForOne: side === "buy", exactAmount: amountIn, hookData: "0x" }],
      });
      return (result as readonly [bigint, bigint])[0];
    },
  });

  const amountOut = quote.data ?? 0n;
  const minOut = amountOut > 0n ? withSlippage(amountOut, slippageBps) : 0n;

  // ── sells go through Permit2: ERC20 -> Permit2, then Permit2 -> router ──
  const { data: erc20Allowance } = useReadContract({
    address: OURO, abi: ERC20_ABI, functionName: "allowance",
    args: address ? [address, PERMIT2] : undefined,
    query: { enabled: !!address && side === "sell" },
  });
  const { data: p2Allowance } = useReadContract({
    address: PERMIT2, abi: PERMIT2_ABI, functionName: "allowance",
    args: address ? [address, OURO, UNIVERSAL_ROUTER] : undefined,
    query: { enabled: !!address && side === "sell" },
  });

  const needsErc20 = side === "sell" && amountIn > 0n && ((erc20Allowance as bigint | undefined) ?? 0n) < amountIn;
  const p2Amount = (p2Allowance as readonly [bigint, number, number] | undefined)?.[0] ?? 0n;
  const p2Exp = (p2Allowance as readonly [bigint, number, number] | undefined)?.[1] ?? 0;
  const needsPermit2 =
    side === "sell" && amountIn > 0n && !needsErc20 &&
    (p2Amount < amountIn || p2Exp * 1000 < Date.now());

  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [action, setAction] = useState<"approve" | "swap" | null>(null);
  const receipt = useWaitForTransactionReceipt({ hash });
  const qc = useQueryClient();

  useEffect(() => {
    if (!receipt.isSuccess) return;
    // Invalidate rather than refetch: this reaches every wagmi query in the tree, so the header
    // balance in ConnectButton updates too, not just this card's copy.
    qc.invalidateQueries();
    if (action === "swap") setRaw("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  async function run() {
    setErr(null);
    try {
      if (needsErc20) {
        setAction("approve");
        setHash(await writeContractAsync({ address: OURO, abi: ERC20_ABI, functionName: "approve", args: [PERMIT2, maxUint256] }));
        return;
      }
      if (needsPermit2) {
        setAction("approve");
        const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
        setHash(await writeContractAsync({
          address: PERMIT2, abi: PERMIT2_ABI, functionName: "approve",
          args: [OURO, UNIVERSAL_ROUTER, maxUint160, exp],
        }));
        return;
      }
      const plan = buildSwap(side, amountIn, minOut);
      setAction("swap");
      setHash(await writeContractAsync({
        address: UNIVERSAL_ROUTER, abi: UNIVERSAL_ROUTER_ABI, functionName: "execute",
        args: [plan.commands, plan.inputs as readonly `0x${string}`[], BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_S],
        value: plan.value,
      }));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m.includes("User rejected") || m.includes("denied") ? "You rejected the transaction." : m.split("\n")[0]);
    }
  }

  const insufficient = amountIn > balance;
  const cta = !isConnected ? null
    : !onRightChain ? null
    : amountIn === 0n ? "Enter an amount"
    : insufficient ? `Not enough ${symIn}`
    : needsErc20 ? "Approve OURO"
    : needsPermit2 ? "Authorise the router"
    : quote.isFetching && !amountOut ? "Quoting…"
    : amountOut === 0n ? "No quote"
    : side === "buy" ? "Buy OURO" : "Sell OURO";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {(["buy", "sell"] as Side[]).map((s) => (
          <button key={s} onClick={() => { setSide(s); setRaw(""); setErr(null); setHash(undefined); setAction(null); }}
            style={{
              ...mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer",
              padding: "7px 16px", borderRadius: "var(--radius-sm)",
              border: `1px solid ${side === s ? "var(--border-strong)" : "var(--border-hairline)"}`,
              background: side === s ? "var(--surface-inverse)" : "transparent",
              color: side === s ? "var(--text-inverse)" : "var(--text-secondary)",
            }}>
            {s}
          </button>
        ))}
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={label}>You pay</span>
          <button onClick={() => edit(fmt(balance, 18, 18))}
            style={{ ...label, border: 0, background: "none", cursor: "pointer", color: "var(--text-accent)" }}>
            max {fmt(balance, 18, 4)} {symIn}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <input value={raw} onChange={(e) => edit(e.target.value)} inputMode="decimal" placeholder="0.0"
            style={{ ...mono, flex: 1, minWidth: 0, fontSize: 26, border: 0, outline: "none",
              background: "transparent", color: "var(--text-primary)" }} />
          <span style={{ ...mono, fontSize: 13, color: "var(--text-secondary)" }}>{symIn}</span>
        </div>
      </div>

      <div style={box}>
        <div style={label}>You receive (estimated)</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
          <span style={{ ...mono, flex: 1, fontSize: 26, color: amountOut ? "var(--text-primary)" : "var(--text-faint)" }}>
            {amountOut ? fmt(amountOut, 18, 6) : "0.0"}
          </span>
          <span style={{ ...mono, fontSize: 13, color: "var(--text-secondary)" }}>{symOut}</span>
        </div>
      </div>

      <div style={{ ...mono, fontSize: 11.5, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
        <Row k="Trade tax" v="5% of the ETH leg" />
        <Row k="Pool LP fee" v="1%" />
        <Row k="Minimum received" v={minOut ? `${fmt(minOut, 18, 6)} ${symOut}` : "—"} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Slippage</span>
          <span style={{ display: "flex", gap: 6 }}>
            {[100, 300, 1000].map((b) => (
              <button key={b} onClick={() => setSlippageBps(b)}
                style={{ ...mono, fontSize: 11, cursor: "pointer", padding: "2px 7px", borderRadius: 3,
                  border: `1px solid ${slippageBps === b ? "var(--border-accent)" : "var(--border-hairline)"}`,
                  background: "transparent", color: slippageBps === b ? "var(--text-accent)" : "var(--text-secondary)" }}>
                {b / 100}%
              </button>
            ))}
          </span>
        </div>
      </div>

      {!isConnected || !onRightChain ? (
        <ConnectButton />
      ) : (
        <Button onClick={run} disabled={isPending || receipt.isLoading || !cta || cta === "Enter an amount" || insufficient || (!needsErc20 && !needsPermit2 && amountOut === 0n)}>
          {isPending ? "Confirm in your wallet…" : receipt.isLoading ? "Confirming…" : cta}
        </Button>
      )}

      {quote.isError && amountIn > 0n && (
        <Callout tone="warning" title="No quote">
          The pool could not price this trade. Try a smaller amount.
        </Callout>
      )}
      {err && <Callout tone="warning" title="Transaction failed">{err}</Callout>}
      {hash && receipt.isSuccess && (
        <Callout title="Done">
          <a href={`${robinhood.blockExplorers.default.url}/tx/${hash}`} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </Callout>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{k}</span>
      <span style={{ color: "var(--text-primary)" }}>{v}</span>
    </div>
  );
}

void zeroAddress;
void ({} as Address);

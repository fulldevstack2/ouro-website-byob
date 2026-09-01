import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance } from "wagmi";
import { robinhood } from "~/lib/dex/chain";
import { Button } from "~/components/ds";
import { mono } from "~/components/site";
import { fmt } from "~/lib/dex/swap";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: bal } = useBalance({ address, query: { enabled: !!address } });

  const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];

  if (!isConnected) {
    return (
      <Button onClick={() => injectedConnector && connect({ connector: injectedConnector })} disabled={isPending || !injectedConnector}>
        {isPending ? "Check your wallet…" : injectedConnector ? "Connect wallet" : "No wallet found"}
      </Button>
    );
  }

  if (chainId !== robinhood.id) {
    return (
      <Button onClick={() => switchChain({ chainId: robinhood.id })} disabled={switching}>
        {switching ? "Switching…" : "Switch to Robinhood Chain"}
      </Button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ ...mono, fontSize: 12, color: "var(--text-secondary)" }}>
        {short(address)}
        {bal ? ` · ${fmt(bal.value, bal.decimals, 4)} ETH` : ""}
      </span>
      <Button variant="secondary" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";

import { site } from "~/content/site";

/**
 * A wallet connection over EIP-1193 directly, with no library.
 *
 * The site's dependency list is react, react-router and isbot, and this keeps it that way. wagmi +
 * a connector + a modal would add a large tree and a hydration surface to a site that is
 * `ssr:false, prerender:true`, for two calls we make once each: read the account, and sign one typed
 * message. If WalletConnect (so, mobile wallets without an in-app browser) is wanted later, that is
 * the moment to take the dependency, not before.
 *
 * Everything here is client only and guards `window`, because every route is prerendered to HTML at
 * build time and this module is imported during that build.
 */

const CHAIN_ID_HEX = `0x${site.chain.id.toString(16)}`;

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

function provider(): Eip1193Provider | null {
  return typeof window === "undefined" ? null : (window.ethereum ?? null);
}

/** EIP-1193 rejections are 4001; anything else is worth showing verbatim. */
function readableError(e: unknown): string {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return "You rejected the request in your wallet.";
  return err?.message ?? "Something went wrong talking to your wallet.";
}

export interface WalletState {
  /** null until connected. Always lowercased, because every address we compare against is. */
  address: string | null;
  chainId: number | null;
  /** True once the page has run on the client and knows whether a wallet is present. */
  ready: boolean;
  hasWallet: boolean;
  connecting: boolean;
  error: string | null;
  onRightChain: boolean;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  signTypedData: (payload: unknown) => Promise<string>;
  clearError: () => void;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume a connection the user already granted, without prompting. `eth_accounts` is the silent
  // read; `eth_requestAccounts` is the one that opens the wallet, and it belongs behind a click.
  useEffect(() => {
    const p = provider();
    setHasWallet(Boolean(p));
    if (!p) {
      setReady(true);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const [accounts, cid] = await Promise.all([
          p.request({ method: "eth_accounts" }) as Promise<string[]>,
          p.request({ method: "eth_chainId" }) as Promise<string>,
        ]);
        if (!alive) return;
        setAddress(accounts?.[0]?.toLowerCase() ?? null);
        setChainId(cid ? Number(cid) : null);
      } catch {
        /* a wallet that refuses a silent read is simply treated as not connected */
      } finally {
        if (alive) setReady(true);
      }
    })();

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[] | undefined;
      setAddress(accounts?.[0]?.toLowerCase() ?? null);
    };
    const onChain = (...args: never[]) => {
      const cid = args[0] as unknown as string | undefined;
      setChainId(cid ? Number(cid) : null);
    };
    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      alive = false;
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const p = provider();
    if (!p) {
      setError("No wallet found in this browser.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0]?.toLowerCase() ?? null);
      const cid = (await p.request({ method: "eth_chainId" })) as string;
      setChainId(cid ? Number(cid) : null);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Ask to switch, and offer to add the chain if the wallet has never seen it (error 4902). */
  const switchChain = useCallback(async () => {
    const p = provider();
    if (!p) return;
    setError(null);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if ((e as { code?: number }).code === 4902) {
        try {
          await p.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: site.chain.name,
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
              blockExplorerUrls: [site.links.explorer],
            }],
          });
          return;
        } catch (addErr) {
          setError(readableError(addErr));
          return;
        }
      }
      setError(readableError(e));
    }
  }, []);

  const signTypedData = useCallback(
    async (payload: unknown): Promise<string> => {
      const p = provider();
      if (!p || !address) throw new Error("Connect a wallet first.");
      // v4 takes the payload as a JSON *string*, which is the usual place this goes wrong.
      return (await p.request({ method: "eth_signTypedData_v4", params: [address, JSON.stringify(payload)] })) as string;
    },
    [address],
  );

  return {
    address,
    chainId,
    ready,
    hasWallet,
    connecting,
    error,
    onRightChain: chainId === site.chain.id,
    connect,
    switchChain,
    signTypedData,
    clearError: () => setError(null),
  };
}

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";

import { Button, type ButtonSize } from "@ouro/ds";
import { site } from "~/content/site";

/**
 * The wallet control, in the site's own buttons rather than RainbowKit's.
 *
 * Disconnected: one primary button that opens RainbowKit's connect modal. On the wrong chain: a
 * secondary button that opens its chain switcher. Connected: the address as a pill (pressing it opens
 * the account modal, where the wallet's own actions live) and a quiet Disconnect beside it. The modal
 * itself stays RainbowKit's, dressed in the bronze theme (WalletProvider).
 *
 * Client-only, like everything that imports wagmi: it is rendered from VaultsLive and PortfolioLive
 * and never reaches the prerender, which draws a disabled "Connect wallet" in its place.
 */
export function WalletButton({ size = "sm" }: { size?: ButtonSize }) {
  const { disconnect } = useDisconnect();
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const connected = mounted && account && chain;
        if (!connected) {
          return (
            <Button size={size} disabled={!mounted} onClick={openConnectModal}>
              Connect wallet
            </Button>
          );
        }
        if (chain.unsupported) {
          return (
            <Button size={size} variant="secondary" onClick={openChainModal}>
              Switch to {site.chain.name}
            </Button>
          );
        }
        return (
          <>
            <button type="button" className="wallet-chip" onClick={openAccountModal} title={account.address} aria-label={`Connected as ${account.address}. Open the account.`}>
              <span className="wallet-chip__dot" aria-hidden="true" />
              {account.displayName}
            </button>
            <Button size={size} variant="ghost" onClick={() => disconnect()}>
              Disconnect
            </Button>
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}

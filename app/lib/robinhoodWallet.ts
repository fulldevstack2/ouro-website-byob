import { type RainbowKitWalletConnectParameters, type Wallet, getWalletConnectConnector } from "@rainbow-me/rainbowkit";

type RobinhoodWalletOptions = {
  projectId: string;
  walletConnectParameters?: RainbowKitWalletConnectParameters;
};

/**
 * Robinhood Wallet (RH Wallet) is not in RainbowKit's built-in list, but it is a WalletConnect
 * listing (slug `robinhood-wallet`, native scheme `robinhood-wallet://`). This connector mirrors
 * how Trust / Bitget are wired: QR on desktop, deep-link open-in-app on phone.
 *
 * In-app Web3 browser users still connect via the injected provider EIP-6963 advertises as
 * `com.robinhood.wallet`; the rdns below lets RainbowKit match that when it is present.
 */
export const robinhoodWallet = ({
  projectId,
  walletConnectParameters,
}: RobinhoodWalletOptions): Wallet => ({
  id: "robinhood",
  name: "Robinhood Wallet",
  shortName: "RH Wallet",
  rdns: "com.robinhood.wallet",
  iconUrl: "/wallets/robinhood-wallet.png",
  iconBackground: "#CCFF00",
  iconAccent: "#000000",
  downloadUrls: {
    android: "https://play.google.com/store/apps/details?id=com.robinhood.gateway",
    ios: "https://robinhood.com/web3-wallet/",
    mobile: "https://robinhood.com/web3-wallet/",
    qrCode: "https://robinhood.com/web3-wallet/",
  },
  mobile: {
    getUri: (uri) => `robinhood-wallet://wc?uri=${encodeURIComponent(uri)}`,
  },
  qrCode: {
    getUri: (uri) => uri,
    instructions: {
      learnMoreUrl: "https://robinhood.com/us/en/support/articles/connect-to-dapps/",
      steps: [
        {
          step: "install",
          title: "Open Robinhood Wallet",
          description: "We recommend putting Robinhood Wallet on your home screen for faster access.",
        },
        {
          step: "create",
          title: "Create or import a wallet",
          description: "If you do not have a wallet yet, open the app and set one up.",
        },
        {
          step: "scan",
          title: "Tap the scan icon",
          description: "After you scan, approve the connection request in Robinhood Wallet.",
        },
      ],
    },
  },
  createConnector: getWalletConnectConnector({ projectId, walletConnectParameters }),
});

import { createConfig, http, WagmiProvider } from "wagmi";
import { base, degen, mainnet, optimism, unichain, celo } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { coinbaseWallet, metaMask } from "wagmi/connectors";
import { APP_NAME, APP_ICON_URL, APP_URL } from "~/lib/constants";
import { useEffect, useState } from "react";
import { useConnect, useAccount } from "wagmi";
import React from "react";

// Extend Window interface to include Farcaster-specific properties
declare global {
  interface Window {
    farcaster?: unknown;
    warpcast?: unknown;
  }
}

// Custom hook for wallet auto-connection
function useWalletAutoConnect() {
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    // Check if we're running in Coinbase Wallet
    const checkCoinbaseWallet = () => {
      const isInCoinbaseWallet =
        window.ethereum?.isCoinbaseWallet ||
        window.ethereum?.isCoinbaseWalletExtension ||
        window.ethereum?.isCoinbaseWalletBrowser;
      return !!isInCoinbaseWallet;
    };

    // Check if we're running in a mobile wallet environment
    const checkMobileWallet = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent
        );
      const hasEthereum = typeof window.ethereum !== "undefined";
      return isMobile && hasEthereum;
    };

    // Check if we're running in Warpcast/Farcaster environment
    const checkFarcasterEnvironment = () => {
      // Check for Farcaster-specific environment indicators
      const hasFarcasterContext =
        (typeof window !== "undefined" && window.farcaster) ||
        window.warpcast ||
        document.referrer.includes("warpcast.com") ||
        document.referrer.includes("farcaster.xyz");

      return !!hasFarcasterContext;
    };

    const attemptAutoConnect = async () => {
      if (isConnected || isAutoConnecting) return;

      setIsAutoConnecting(true);

      try {
        // Priority order for auto-connection:
        // 1. Farcaster Frame connector (for mobile wallets)
        // 2. Coinbase Wallet connector
        // 3. MetaMask connector

        if (checkFarcasterEnvironment() || checkMobileWallet()) {
          console.log(
            "Attempting to connect with Farcaster Frame connector..."
          );
          await connect({ connector: connectors[0] }); // Farcaster Frame
        } else if (checkCoinbaseWallet()) {
          console.log("Attempting to connect with Coinbase Wallet...");
          await connect({ connector: connectors[1] }); // Coinbase Wallet
        } else if (typeof window.ethereum !== "undefined") {
          console.log("Attempting to connect with MetaMask...");
          await connect({ connector: connectors[2] }); // MetaMask
        }
      } catch (error) {
        console.warn("Auto-connection failed:", error);
      } finally {
        setIsAutoConnecting(false);
      }
    };

    // Listen for ethereum initialization
    const handleEthereumInitialized = () => {
      setTimeout(attemptAutoConnect, 100); // Small delay to ensure everything is ready
    };

    window.addEventListener("ethereum#initialized", handleEthereumInitialized);

    // Also try to connect immediately if ethereum is already available
    if (typeof window.ethereum !== "undefined") {
      setTimeout(attemptAutoConnect, 500); // Delay to ensure connectors are ready
    }

    return () => {
      window.removeEventListener(
        "ethereum#initialized",
        handleEthereumInitialized
      );
    };
  }, [connect, connectors, isConnected, isAutoConnecting]);

  return { isAutoConnecting };
}

export const config = createConfig({
  chains: [base, optimism, mainnet, degen, unichain, celo],
  transports: {
    [base.id]: http(),
    [optimism.id]: http(),
    [mainnet.id]: http(),
    [degen.id]: http(),
    [unichain.id]: http(),
    [celo.id]: http(),
  },
  connectors: [
    farcasterFrame(),
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON_URL,
      preference: "all",
    }),
    metaMask({
      dappMetadata: {
        name: APP_NAME,
        url: APP_URL,
      },
    }),
  ],
});

const queryClient = new QueryClient();

// Wrapper component that provides wallet auto-connection
function WalletAutoConnect({ children }: { children: React.ReactNode }) {
  const { isAutoConnecting } = useWalletAutoConnect();

  // Optional: Show loading state during auto-connection
  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletAutoConnect>{children}</WalletAutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

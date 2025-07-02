/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, signOut, getCsrfToken } from "next-auth/react";
import sdk, { SignIn as SignInCore, type Haptics } from "@farcaster/frame-sdk";
import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from "wagmi";
import {
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { useHasSolanaProvider } from "./providers/SafeFarcasterSolanaProvider";
import { ShareButton } from "./ui/Share";

import { config } from "~/components/providers/WagmiProvider";
import { Button } from "~/components/ui/Button";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { BaseError, UserRejectedRequestError } from "viem";
import { useSession } from "next-auth/react";
import { useMiniApp } from "@neynar/react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Header } from "~/components/ui/Header";
import { Footer } from "~/components/ui/Footer";
import { USE_WALLET, APP_NAME } from "~/lib/constants";
import CreateBet from "~/components/CreateBet";
import {
  BET_MANAGEMENT_ENGINE_ABI,
  BET_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/contracts";
import { encodeFunctionData } from "viem";

export type Tab = "create" | "bets" | "arbitrate" | "wallet" | "leaderboard";

interface NeynarUser {
  fid: number;
  score: number;
}

interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

interface Bet {
  bet_number: number;
  maker_address: string;
  taker_address: string;
  arbiter_address: string | null;
  bet_token_address: string;
  bet_amount: number;
  timestamp: number;
  end_time: number;
  status: number;
  protocol_fee: number;
  arbiter_fee: number;
  bet_agreement: string;
  transaction_hash: string | null;
  maker_fid?: number | null;
  taker_fid?: number | null;
  arbiter_fid?: number | null;
  makerProfile?: UserProfile | null;
  takerProfile?: UserProfile | null;
  arbiterProfile?: UserProfile | null;
}

export default function Demo(
  { title }: { title?: string } = { title: "Neynar Starter Kit" }
) {
  const {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    actions,
    setInitialTab,
    setActiveTab,
    currentTab,
    haptics,
  } = useMiniApp();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendNotificationResult, setSendNotificationResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [neynarUser, setNeynarUser] = useState<NeynarUser | null>(null);
  const [hapticIntensity, setHapticIntensity] =
    useState<Haptics.ImpactOccurredType>("medium");
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [betsTab, setBetsTab] = useState<"you" | "open">("you");
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelTxHash, setCancelTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [isCancelling, setIsCancelling] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const hasSolanaProvider = useHasSolanaProvider();
  const solanaWallet = useSolanaWallet();
  const { publicKey: solanaPublicKey } = solanaWallet;

  // Set initial tab to bets (Pending Bets) on page load
  useEffect(() => {
    if (isSDKLoaded) {
      setInitialTab("bets");
    }
  }, [isSDKLoaded, setInitialTab]);

  useEffect(() => {
    console.log("isSDKLoaded", isSDKLoaded);
    console.log("context", context);
    console.log("address", address);
    console.log("isConnected", isConnected);
    console.log("chainId", chainId);
    console.log("connectionAttempts", connectionAttempts);
  }, [context, address, isConnected, chainId, isSDKLoaded, connectionAttempts]);

  // Enhanced wallet connection logic
  const { connect, connectors } = useConnect();

  // Auto-connect when context is available and wallet is not connected
  useEffect(() => {
    if (isSDKLoaded && context && !isConnected && connectionAttempts < 3) {
      const attemptConnection = async () => {
        try {
          console.log(
            "Attempting auto-connection with Farcaster Frame connector..."
          );
          await connect({ connector: connectors[0] });
          setConnectionAttempts((prev) => prev + 1);
        } catch (error) {
          console.warn("Auto-connection failed:", error);
          setConnectionAttempts((prev) => prev + 1);
        }
      };

      // Delay to ensure everything is properly initialized
      const timeoutId = setTimeout(attemptConnection, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [
    isSDKLoaded,
    context,
    isConnected,
    connect,
    connectors,
    connectionAttempts,
  ]);

  // Fetch Neynar user object when context is available
  useEffect(() => {
    const fetchNeynarUserObject = async () => {
      if (context?.user?.fid) {
        try {
          const response = await fetch(`/api/users?fids=${context.user.fid}`);
          const data = await response.json();
          if (data.users?.[0]) {
            setNeynarUser(data.users[0]);
          }
        } catch (error) {
          console.error("Failed to fetch Neynar user object:", error);
        }
      }
    };

    fetchNeynarUserObject();
  }, [context?.user?.fid]);

  // Fetch user bets when wallet is connected
  useEffect(() => {
    const fetchUserBets = async () => {
      if (!address) return;

      console.log("🔍 Fetching user bets for address:", address);
      setIsLoadingBets(true);
      try {
        const response = await fetch(`/api/bets?address=${address}`);
        if (response.ok) {
          const data = await response.json();
          const bets = data.bets || [];
          console.log("📊 Found bets:", bets.length, "bets:", bets);

          // Fetch profile data for each bet's maker and taker
          const betsWithProfiles = await Promise.all(
            bets.map(async (bet: Bet) => {
              let makerFid = bet.maker_fid;
              let takerFid = bet.taker_fid;
              let arbiterFid = bet.arbiter_fid;

              console.log(`🎯 Processing bet #${bet.bet_number}:`, {
                maker_address: bet.maker_address,
                taker_address: bet.taker_address,
                makerFid,
                takerFid,
                arbiterFid,
              });

              // If maker_fid doesn't exist, fetch it using the address
              if (!makerFid && bet.maker_address) {
                try {
                  console.log(
                    `🔍 Fetching maker FID for address: ${bet.maker_address}`
                  );
                  const makerFidResponse = await fetch(
                    `/api/users?address=${bet.maker_address}`
                  );
                  if (makerFidResponse.ok) {
                    const makerFidData = await makerFidResponse.json();
                    makerFid = makerFidData.users?.[0]?.fid || null;
                    console.log(`✅ Found maker FID: ${makerFid}`);
                  }
                } catch (error) {
                  console.error("❌ Failed to fetch maker FID:", error);
                }
              }

              // If taker_fid doesn't exist, fetch it using the address
              if (!takerFid && bet.taker_address) {
                try {
                  console.log(
                    `🔍 Fetching taker FID for address: ${bet.taker_address}`
                  );
                  const takerFidResponse = await fetch(
                    `/api/users?address=${bet.taker_address}`
                  );
                  if (takerFidResponse.ok) {
                    const takerFidData = await takerFidResponse.json();
                    takerFid = takerFidData.users?.[0]?.fid || null;
                    console.log(`✅ Found taker FID: ${takerFid}`);
                  }
                } catch (error) {
                  console.error("❌ Failed to fetch taker FID:", error);
                }
              }

              // If arbiter_fid doesn't exist, fetch it using the address
              if (!arbiterFid && bet.arbiter_address) {
                try {
                  console.log(
                    `🔍 Fetching arbiter FID for address: ${bet.arbiter_address}`
                  );
                  const arbiterFidResponse = await fetch(
                    `/api/users?address=${bet.arbiter_address}`
                  );
                  if (arbiterFidResponse.ok) {
                    const arbiterFidData = await arbiterFidResponse.json();
                    arbiterFid = arbiterFidData.users?.[0]?.fid || null;
                    console.log(`✅ Found arbiter FID: ${arbiterFid}`);
                  }
                } catch (error) {
                  console.error("❌ Failed to fetch arbiter FID:", error);
                }
              }

              let makerProfile = null;
              let takerProfile = null;
              let arbiterProfile = null;

              if (makerFid) {
                try {
                  console.log(`👤 Fetching maker profile for FID: ${makerFid}`);
                  const makerResponse = await fetch(
                    `/api/users?fids=${makerFid}`
                  );
                  const makerData = await makerResponse.json();
                  console.log("👤 Maker API response:", makerData);
                  makerProfile = makerData.users?.[0] || null;
                  console.log("👤 Maker profile:", makerProfile);
                } catch (error) {
                  console.error("❌ Failed to fetch maker profile:", error);
                }
              } else {
                console.log(
                  "⚠️ No maker FID available for bet #",
                  bet.bet_number
                );
              }

              if (takerFid) {
                try {
                  console.log(`👤 Fetching taker profile for FID: ${takerFid}`);
                  const takerResponse = await fetch(
                    `/api/users?fids=${takerFid}`
                  );
                  const takerData = await takerResponse.json();
                  console.log("👤 Taker API response:", takerData);
                  takerProfile = takerData.users?.[0] || null;
                  console.log("👤 Taker profile:", takerProfile);
                } catch (error) {
                  console.error("❌ Failed to fetch taker profile:", error);
                }
              } else {
                console.log(
                  "⚠️ No taker FID available for bet #",
                  bet.bet_number
                );
              }

              // Fetch arbiter profile if arbiter_fid exists
              if (arbiterFid) {
                try {
                  console.log(
                    `👤 Fetching arbiter profile for FID: ${arbiterFid}`
                  );
                  const arbiterResponse = await fetch(
                    `/api/users?fids=${arbiterFid}`
                  );
                  const arbiterData = await arbiterResponse.json();
                  console.log("👤 Arbiter API response:", arbiterData);
                  arbiterProfile = arbiterData.users?.[0] || null;
                  console.log("👤 Arbiter profile:", arbiterProfile);
                } catch (error) {
                  console.error("❌ Failed to fetch arbiter profile:", error);
                }
              }

              const betWithProfiles = {
                ...bet,
                makerProfile,
                takerProfile,
                arbiterProfile,
              };

              console.log(
                `✅ Final bet #${bet.bet_number} with profiles:`,
                betWithProfiles
              );
              return betWithProfiles;
            })
          );

          console.log("🎉 All bets processed:", betsWithProfiles);
          setUserBets(betsWithProfiles);
        } else {
          console.error(
            "❌ Failed to fetch user bets:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error("❌ Error fetching user bets:", error);
      } finally {
        setIsLoadingBets(false);
      }
    };

    fetchUserBets();
  }, [address]);

  const {
    sendTransaction,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData();

  const { disconnect } = useDisconnect();

  const {
    switchChain,
    error: switchChainError,
    isError: isSwitchChainError,
    isPending: isSwitchChainPending,
  } = useSwitchChain();

  const nextChain = useMemo(() => {
    if (chainId === base.id) {
      return optimism;
    } else if (chainId === optimism.id) {
      return degen;
    } else if (chainId === degen.id) {
      return mainnet;
    } else if (chainId === mainnet.id) {
      return unichain;
    } else {
      return base;
    }
  }, [chainId]);

  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: nextChain.id });
  }, [switchChain, nextChain.id]);

  const sendNotification = useCallback(async () => {
    setSendNotificationResult("");
    if (!notificationDetails || !context) {
      return;
    }

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        mode: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: context.user.fid,
          notificationDetails,
        }),
      });

      if (response.status === 200) {
        setSendNotificationResult("Success");
        return;
      } else if (response.status === 429) {
        setSendNotificationResult("Rate limited");
        return;
      }

      const data = await response.text();
      setSendNotificationResult(`Error: ${data}`);
    } catch (error) {
      setSendNotificationResult(`Error: ${error}`);
    }
  }, [context, notificationDetails]);

  const sendTx = useCallback(() => {
    sendTransaction(
      {
        // call yoink() on Yoink contract
        to: "0x4bBFD120d9f352A0BEd7a014bd67913a2007a878",
        data: "0x9846cd9efc000023c0",
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
        },
      }
    );
  }, [sendTransaction]);

  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: APP_NAME,
        version: "1",
        chainId,
      },
      types: {
        Message: [{ name: "content", type: "string" }],
      },
      message: {
        content: `Hello from ${APP_NAME}!`,
      },
      primaryType: "Message",
    });
  }, [chainId, signTypedData]);

  const toggleContext = useCallback(() => {
    setIsContextOpen((prev) => !prev);
  }, []);

  const handleManualConnect = useCallback(async () => {
    try {
      console.log("Manual connection attempt...");
      await connect({ connector: connectors[0] });
    } catch (error) {
      console.error("Manual connection failed:", error);
    }
  }, [connect, connectors]);

  // Function to get status text and styling
  const getStatusInfo = (
    status: number,
    endTime: number,
    makerProfile?: UserProfile | null,
    takerProfile?: UserProfile | null,
    arbiterProfile?: UserProfile | null
  ) => {
    const now = Math.floor(Date.now() / 1000);

    switch (status) {
      case 0:
        return {
          text: `Pending ${takerProfile?.username || "Taker"}`,
          bgColor:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        };
      case 1:
        return {
          text: `Pending ${arbiterProfile?.username || "Arbiter"}`,
          bgColor:
            "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
        };
      case 2:
        const isEndTimePassed = now > endTime;
        return {
          text: isEndTimePassed
            ? `Waiting ${arbiterProfile?.username || "Arbiter"}'s decision`
            : "End time not passed",
          bgColor: isEndTimePassed
            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      case 4:
        return {
          text: `${makerProfile?.username || "Maker"} Won - Claim Pending`,
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      case 5:
        return {
          text: `${takerProfile?.username || "Taker"} Won - Claim Pending`,
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      case 6:
        return {
          text: `${makerProfile?.username || "Maker"} Won`,
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
      case 7:
        return {
          text: `${takerProfile?.username || "Taker"} Won`,
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
      case 8:
        return {
          text: "Cancelled/Refunded",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      default:
        return {
          text: "Unknown",
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
    }
  };

  // Function to format end time
  const formatEndTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date
      .toLocaleString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  };

  // Function to handle bet selection
  const handleBetSelect = (bet: Bet) => {
    setSelectedBet(bet);
    setIsModalOpen(true);
  };

  // Function to close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBet(null);
  };

  // Function to cancel bet
  const handleCancelBet = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot cancel bet: not connected or no bet selected");
      return;
    }

    try {
      setIsCancelling(true);
      console.log("Cancelling bet #", selectedBet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "makerCancelBet",
        args: [BigInt(selectedBet.bet_number)],
      });

      console.log("Encoded cancel transaction data:", encodedData);

      // Create the transaction object
      const transaction = {
        to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
        data: encodedData as `0x${string}`,
      };

      console.log("Cancel transaction object:", transaction);

      // Send the transaction
      sendTransaction(transaction, {
        onSuccess: async (hash: `0x${string}`) => {
          console.log("Cancel transaction sent successfully:", hash);
          setCancelTxHash(hash);
          // Close modal after successful transaction
          setTimeout(async () => {
            closeModal();
            // Update database to mark bet as cancelled
            try {
              const updateResponse = await fetch(
                `/api/bets/${selectedBet.bet_number}`,
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    status: 8,
                    transaction_hash: hash,
                  }),
                }
              );

              if (!updateResponse.ok) {
                console.error("Failed to update bet status in database");
              } else {
                console.log("Bet status updated to cancelled in database");
              }
            } catch (error) {
              console.error("Error updating bet status:", error);
            }

            // Refresh bets list
            if (address) {
              const response = await fetch(`/api/bets?address=${address}`);
              if (response.ok) {
                const data = await response.json();
                setUserBets(data.bets || []);
              }
            }
          }, 2000);
        },
        onError: (error: Error) => {
          console.error("Cancel transaction failed:", error);
          setIsCancelling(false);
        },
      });
    } catch (error) {
      console.error("Error cancelling bet:", error);
      setIsCancelling(false);
    }
  };

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="mx-auto py-2 px-4 pb-20">
        <Header neynarUser={neynarUser} />

        <h1 className="text-2xl font-bold text-center mb-4">{title}</h1>

        {currentTab === "create" && (
          <CreateBet
            isConnected={isConnected}
            sendTransaction={sendTransaction}
            isTransactionPending={isSendTxPending}
            setActiveTab={setActiveTab}
          />
        )}

        {currentTab === "bets" && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            {/* Toggle Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setBetsTab("you")}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  betsTab === "you"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                You
              </button>
              <button
                onClick={() => setBetsTab("open")}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  betsTab === "open"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                Open
              </button>
            </div>

            {/* You Tab Content */}
            {betsTab === "you" && (
              <div className="space-y-3">
                {isLoadingBets ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Loading your bets...
                  </div>
                ) : userBets.length > 0 ? (
                  userBets.map((bet) => (
                    <div
                      key={bet.bet_number}
                      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleBetSelect(bet)}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Profile Pictures */}
                        <div className="flex -space-x-2">
                          {bet.makerProfile && (
                            <img
                              src={bet.makerProfile.pfp_url || ""}
                              alt={bet.makerProfile.display_name || "Maker"}
                              className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          )}
                          {bet.takerProfile && (
                            <img
                              src={bet.takerProfile.pfp_url || ""}
                              alt={bet.takerProfile.display_name || "Taker"}
                              className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          )}
                        </div>

                        {/* Bet Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Bet #{bet.bet_number}
                            </div>
                            <div
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                getStatusInfo(
                                  bet.status,
                                  bet.end_time,
                                  bet.makerProfile,
                                  bet.takerProfile,
                                  bet.arbiterProfile
                                ).bgColor
                              }`}
                            >
                              {
                                getStatusInfo(
                                  bet.status,
                                  bet.end_time,
                                  bet.makerProfile,
                                  bet.takerProfile,
                                  bet.arbiterProfile
                                ).text
                              }
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {bet.bet_agreement && bet.bet_agreement.length > 35
                              ? `${bet.bet_agreement.substring(0, 35)}...`
                              : bet.bet_agreement || "No description"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {bet.makerProfile?.display_name || "Unknown"} vs{" "}
                            {bet.takerProfile?.display_name || "Unknown"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No bets found for your wallet
                  </div>
                )}
              </div>
            )}

            {/* Open Tab Content */}
            {betsTab === "open" && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Open bets coming soon...
              </div>
            )}

            <ShareButton
              buttonText="Share Mini App"
              cast={{
                text: "Check out this awesome frame @1 @2 @3! 🚀🪐",
                bestFriends: true,
                embeds: [
                  `${process.env.NEXT_PUBLIC_URL}/share/${
                    context?.user?.fid || ""
                  }`,
                ],
              }}
              className="w-full"
            />
          </div>
        )}

        {currentTab === "arbitrate" && (
          <div className="mx-6">
            <h2 className="text-lg font-semibold mb-2">Context</h2>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <pre className="font-mono text-xs whitespace-pre-wrap break-words w-full">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {currentTab === "wallet" && USE_WALLET && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            {address && (
              <div className="text-xs w-full">
                Address:{" "}
                <pre className="inline w-full">{truncateAddress(address)}</pre>
              </div>
            )}

            {chainId && (
              <div className="text-xs w-full">
                Chain ID: <pre className="inline w-full">{chainId}</pre>
              </div>
            )}

            {/* Enhanced connection status display */}
            <div className="text-xs w-full p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <div>SDK Loaded: {isSDKLoaded ? "✅" : "❌"}</div>
              <div>Context Available: {context ? "✅" : "❌"}</div>
              <div>Wallet Connected: {isConnected ? "✅" : "❌"}</div>
              <div>Connection Attempts: {connectionAttempts}</div>
            </div>

            {isConnected ? (
              <Button onClick={() => disconnect()} className="w-full">
                Disconnect
              </Button>
            ) : context ? (
              <div className="space-y-2">
                <Button onClick={handleManualConnect} className="w-full">
                  Connect Wallet
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  If connection fails, try refreshing the page or check your
                  wallet settings.
                </p>
              </div>
            ) : (
              <div className="space-y-3 w-full">
                <Button
                  onClick={() => connect({ connector: connectors[1] })}
                  className="w-full"
                >
                  Connect Coinbase Wallet
                </Button>
                <Button
                  onClick={() => connect({ connector: connectors[2] })}
                  className="w-full"
                >
                  Connect MetaMask
                </Button>
              </div>
            )}

            {isConnected && (
              <>
                <Button
                  onClick={sendTx}
                  disabled={!isConnected || isSendTxPending}
                  isLoading={isSendTxPending}
                  className="w-full"
                >
                  Send Transaction (contract)
                </Button>
                {isSendTxError && renderError(sendTxError)}
                {txHash && (
                  <div className="text-xs w-full">
                    <div>Hash: {truncateAddress(txHash)}</div>
                    <div>
                      Status:{" "}
                      {isConfirming
                        ? "Confirming..."
                        : isConfirmed
                          ? "Confirmed!"
                          : "Pending"}
                    </div>
                  </div>
                )}
                <Button
                  onClick={signTyped}
                  disabled={!isConnected || isSignTypedPending}
                  isLoading={isSignTypedPending}
                  className="w-full"
                >
                  Sign Typed Data
                </Button>
                {isSignTypedError && renderError(signTypedError)}
                <Button
                  onClick={handleSwitchChain}
                  disabled={isSwitchChainPending}
                  isLoading={isSwitchChainPending}
                  className="w-full"
                >
                  Switch to {nextChain.name}
                </Button>
                {isSwitchChainError && renderError(switchChainError)}
              </>
            )}
          </div>
        )}

        <Footer
          activeTab={currentTab as Tab}
          setActiveTab={setActiveTab}
          showWallet={USE_WALLET}
        />

        {/* Bet Details Modal */}
        {isModalOpen && selectedBet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Bet #{selectedBet.bet_number}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <div
                    className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                      getStatusInfo(
                        selectedBet.status,
                        selectedBet.end_time,
                        selectedBet.makerProfile,
                        selectedBet.takerProfile,
                        selectedBet.arbiterProfile
                      ).bgColor
                    }`}
                  >
                    {
                      getStatusInfo(
                        selectedBet.status,
                        selectedBet.end_time,
                        selectedBet.makerProfile,
                        selectedBet.takerProfile,
                        selectedBet.arbiterProfile
                      ).text
                    }
                  </div>
                </div>

                {/* Maker Actions */}
                {address === selectedBet.maker_address &&
                  selectedBet.status === 0 && (
                    <div className="mb-4">
                      <div className="flex space-x-3">
                        <button
                          onClick={handleCancelBet}
                          disabled={isCancelling}
                          className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCancelling ? "Cancelling..." : "Cancel Bet"}
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement edit bet logic
                            console.log(
                              "Edit bet clicked for bet #",
                              selectedBet.bet_number
                            );
                          }}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Edit Bet
                        </button>
                      </div>
                    </div>
                  )}

                {/* Participants */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Participants
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Maker:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBet.makerProfile?.display_name ||
                          selectedBet.makerProfile?.username ||
                          "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Taker:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBet.takerProfile?.display_name ||
                          selectedBet.takerProfile?.username ||
                          "Unknown"}
                      </span>
                    </div>
                    {selectedBet.arbiterProfile && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Arbiter:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {selectedBet.arbiterProfile.display_name ||
                            selectedBet.arbiterProfile.username}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bet Details */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bet Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Amount:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBet.bet_amount}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        End Time:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatEndTime(selectedBet.end_time)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bet Agreement */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bet Agreement
                  </h3>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedBet.bet_agreement || "No description provided"}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signInResult, setSignInResult] = useState<SignInCore.SignInResult>();
  const [signInFailure, setSignInFailure] = useState<string>();
  const { data: session, status } = useSession();

  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken();
    if (!nonce) throw new Error("Unable to generate nonce");
    return nonce;
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      setSigningIn(true);
      setSignInFailure(undefined);
      const nonce = await getNonce();
      const result = await sdk.actions.signIn({ nonce });
      setSignInResult(result);

      await signIn("credentials", {
        message: result.message,
        signature: result.signature,
        redirect: false,
      });
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure("Rejected by user");
        return;
      }

      setSignInFailure("Unknown error");
    } finally {
      setSigningIn(false);
    }
  }, [getNonce]);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      await signOut({ redirect: false });
      setSignInResult(undefined);
    } finally {
      setSigningOut(false);
    }
  }, []);

  return (
    <>
      {status !== "authenticated" && (
        <Button onClick={handleSignIn} disabled={signingIn}>
          Sign In with Farcaster
        </Button>
      )}
      {status === "authenticated" && (
        <Button onClick={handleSignOut} disabled={signingOut}>
          Sign out
        </Button>
      )}
      {session && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">Session</div>
          <div className="whitespace-pre">
            {JSON.stringify(session, null, 2)}
          </div>
        </div>
      )}
      {signInFailure && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">SIWF Result</div>
          <div className="whitespace-pre">{signInFailure}</div>
        </div>
      )}
      {signInResult && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">SIWF Result</div>
          <div className="whitespace-pre">
            {JSON.stringify(signInResult, null, 2)}
          </div>
        </div>
      )}
    </>
  );
}

const renderError = (error: Error | null) => {
  if (!error) return null;
  if (error instanceof BaseError) {
    const isUserRejection = error.walk(
      (e) => e instanceof UserRejectedRequestError
    );

    if (isUserRejection) {
      return <div className="text-red-500 text-xs mt-1">Rejected by user.</div>;
    }
  }

  return <div className="text-red-500 text-xs mt-1">{error.message}</div>;
};

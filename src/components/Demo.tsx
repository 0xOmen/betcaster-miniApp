/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import { useHasSolanaProvider } from "./providers/SafeFarcasterSolanaProvider";
import { ShareButton } from "./ui/Share";

import { config } from "~/components/providers/WagmiProvider";
import { Button } from "~/components/ui/Button";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { BaseError, UserRejectedRequestError } from "viem";
import { useSession } from "next-auth/react";
import { useMiniApp } from "@neynar/react";
import { Header } from "~/components/ui/Header";
import { Footer } from "~/components/ui/Footer";
import { USE_WALLET, APP_NAME } from "~/lib/constants";
import CreateBet from "~/components/CreateBet";
import {
  BET_MANAGEMENT_ENGINE_ABI,
  BET_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/contracts";
import {
  ARBITER_MANAGEMENT_ENGINE_ABI,
  ARBITER_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/arbiterAbi";
import { encodeFunctionData } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { amountToWei, getTokenByAddress } from "~/lib/tokens";
import { getTimeRemaining } from "~/lib/utils";
import UserSearchDropdown from "~/components/UserSearchDropdown";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { ShareModal } from "~/components/ShareModal";
import { Explore } from "~/components/Explore";
import { BETCASTER_ADDRESS } from "~/lib/betcasterAbi";
import { ERC20_ABI } from "~/lib/erc20Abi";
import {
  notifyBetRejected,
  notifyInviteArbiter,
  notifyArbiterAccepted,
  notifyBetForfeited,
  notifyWinnerSelected,
  notifyBetCancelled,
  notifyBetCancelledByTaker,
  notifyArbiterRejected,
} from "~/lib/notificationUtils";

export type Tab = "create" | "bets" | "explore" | "wallet" | "leaderboard";

interface NeynarUser {
  fid: number;
  score: number; // Make score required, not optional
  username?: string;
  display_name?: string;
  pfp_url?: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
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

// Add this interface near the top with other interfaces
interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const globalUserCache = new Map<
  number,
  { promise: Promise<UserProfile | null>; timestamp: number }
>();

const fetchUserWithCache = async (fid: number): Promise<UserProfile | null> => {
  const now = Date.now();
  const cached = globalUserCache.get(fid);

  // Return cached data if it exists and hasn't expired
  if (cached && now - cached.timestamp < CACHE_EXPIRY) {
    console.log(`📋 Using cached promise for FID: ${fid}`);
    return cached.promise;
  }

  // Remove expired cache entry if it exists
  if (cached) {
    globalUserCache.delete(fid);
  }

  const fetchPromise = (async () => {
    try {
      console.log(`🔍 Fetching user data for FID: ${fid}`);
      const response = await fetch(`/api/users?fids=${fid}`);
      if (response.ok) {
        const data = await response.json();
        const user = data.users?.[0];
        if (user) {
          console.log(`✅ Cached user data for FID: ${fid}`);
          return user;
        }
      }
      return null;
    } catch (error) {
      console.error(`❌ Failed to fetch user data for FID: ${fid}:`, error);
      globalUserCache.delete(fid);
      return null;
    }
  })();

  // Store the promise and timestamp in the cache
  globalUserCache.set(fid, { promise: fetchPromise, timestamp: now });

  return fetchPromise;
};

export default function Demo(
  { title }: { title?: string } = { title: "Betcaster" }
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
  const [acceptTxHash, setAcceptTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [isAccepting, setIsAccepting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [acceptArbiterTxHash, setAcceptArbiterTxHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [isAcceptingArbiter, setIsAcceptingArbiter] = useState(false);
  const [forfeitTxHash, setForfeitTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [isClaiming, setIsClaiming] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTxHash, setEditTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );

  // Edit form state - update these variable names
  const [editTakerUser, setEditTakerUser] = useState<User | null>(null);
  const [editArbiterUser, setEditArbiterUser] = useState<User | null>(null);
  const [editTakerFid, setEditTakerFid] = useState<number | null>(null);
  const [editArbiterFid, setEditArbiterFid] = useState<number | null>(null);
  const [editEndTime, setEditEndTime] = useState<string>("");
  const [editBetAgreement, setEditBetAgreement] = useState<string>("");
  const [editTimeOption, setEditTimeOption] = useState<string>("");
  const [editCustomTimeValue, setEditCustomTimeValue] = useState("");
  const [editCustomTimeUnit, setEditCustomTimeUnit] = useState<
    "hours" | "days"
  >("days");

  // Select Winner state
  const [isSelectWinnerModalOpen, setIsSelectWinnerModalOpen] = useState(false);
  const [isSelectingWinner, setIsSelectingWinner] = useState(false);
  const [selectWinnerTxHash, setSelectWinnerTxHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [selectedWinner, setSelectedWinner] = useState<
    "maker" | "taker" | null
  >(null);

  // Add state near other state declarations
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareBetDetails, setShareBetDetails] = useState<{
    amount: string;
    token: string;
    taker: string;
    arbiter?: string;
  } | null>(null);
  const [initialParamsHandled, setInitialParamsHandled] = useState(false);
  const [isLoadingSpecificBet, setIsLoadingSpecificBet] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  // Function to fetch and display a specific bet
  const fetchAndDisplayBet = async (betNumber: string) => {
    console.log("Demo: Fetching bet", betNumber);
    setIsLoadingSpecificBet(true);
    try {
      // First try database
      const response = await fetch(`/api/bets?betNumber=${betNumber}`);
      console.log("Demo: Bet API response status", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Demo: Bet data", data);
        if (data.bets && data.bets.length > 0) {
          const dbBet = data.bets[0];

          // Fetch profiles for maker, taker, and arbiter
          const [makerRes, takerRes, arbiterRes] = await Promise.all([
            fetch(`/api/users?address=${dbBet.maker_address}`),
            dbBet.taker_address
              ? fetch(`/api/users?address=${dbBet.taker_address}`)
              : Promise.resolve(null),
            dbBet.arbiter_address
              ? fetch(`/api/users?address=${dbBet.arbiter_address}`)
              : Promise.resolve(null),
          ]);

          let makerProfile = null,
            takerProfile = null,
            arbiterProfile = null;

          if (makerRes?.ok) {
            const makerData = await makerRes.json();
            makerProfile = makerData.users?.[0] || null;
          }
          if (takerRes?.ok) {
            const takerData = await takerRes.json();
            takerProfile = takerData.users?.[0] || null;
          }
          if (arbiterRes?.ok) {
            const arbiterData = await arbiterRes.json();
            arbiterProfile = arbiterData.users?.[0] || null;
          }

          const betWithProfiles = {
            ...dbBet,
            makerProfile,
            takerProfile,
            arbiterProfile,
          };

          console.log("Demo: Setting bet and opening modal", betWithProfiles);
          setSelectedBet(betWithProfiles);
          setIsModalOpen(true);
        } else {
          console.log("Demo: No bet found");
        }
      } else {
        console.error("Demo: Failed to fetch bet", response.statusText);
      }
    } catch (error) {
      console.error("Demo: Error fetching specific bet:", error);
    } finally {
      setIsLoadingSpecificBet(false);
    }
  };

  // Read allowance for the selected bet's token
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedBet?.bet_token_address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, BETCASTER_ADDRESS],
    query: {
      enabled:
        !!selectedBet?.bet_token_address &&
        !!address &&
        selectedBet.bet_token_address !==
          "0x0000000000000000000000000000000000000000",
    },
  });

  // Handle URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const betNumber = urlParams.get("betNumber");

    console.log("Demo: URL params", { betNumber });
    if (betNumber) {
      fetchAndDisplayBet(betNumber);
      // Clean URL without waiting for SDK
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []); // Run once on mount

  // Set initial tab based on URL parameter
  useEffect(() => {
    if (isSDKLoaded && !initialParamsHandled) {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");

      // Set initial tab based on URL parameter
      if (tabParam === "explore") {
        setInitialTab("explore");
        setActiveTab("explore");
      } else {
        setInitialTab("bets"); // Default tab
      }

      setInitialParamsHandled(true);
    }
  }, [isSDKLoaded, initialParamsHandled, setInitialTab, setActiveTab]);

  useEffect(() => {
    console.log("isSDKLoaded", isSDKLoaded);
    console.log("context", context);
    console.log("address", address);
    console.log("isConnected", isConnected);
    console.log("chainId", chainId);
    console.log("connectionAttempts", connectionAttempts);
  }, [context, address, isConnected, chainId, isSDKLoaded, connectionAttempts]);

  // Enhanced wallet connection logic
  const { connectors } = useConnect();

  // Auto-connect when context is available and wallet is not connected
  useEffect(() => {
    if (isSDKLoaded && context && !isConnected && connectionAttempts < 3) {
      const attemptConnection = async () => {
        try {
          console.log("Attempting auto-connection...");
          await connectors[0].connect();
          setConnectionAttempts((prev) => prev + 1);
        } catch (error) {
          console.warn("Auto-connection failed:", error);
          setConnectionAttempts((prev) => prev + 1);
        }
      };

      const timeoutId = setTimeout(attemptConnection, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isSDKLoaded, context, isConnected, connectors, connectionAttempts]);

  // Fetch Neynar user object when context is available
  useEffect(() => {
    const fetchNeynarUserObject = async () => {
      if (context?.user?.fid) {
        const user = await fetchUserWithCache(context.user.fid);
        if (user) {
          setNeynarUser({
            ...user,
            score: 0, // Add default score
          });
        }
      }
    };

    fetchNeynarUserObject();
  }, [context?.user?.fid]);

  // Fetch user bets when wallet is connected OR when Farcaster context is available
  useEffect(() => {
    const fetchUserBets = async () => {
      // Only fetch if we have either an address or a Farcaster FID
      if (!address && !context?.user?.fid) return;

      console.log("🔍 Fetching user bets for:", {
        address,
        fid: context?.user?.fid,
      });
      setIsLoadingBets(true);
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (address) params.append("address", address);
        if (context?.user?.fid)
          params.append("fid", context.user.fid.toString());

        const response = await fetch(`/api/bets?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const bets = data.bets || [];
          console.log("📊 Found bets:", bets.length, "bets:", bets);

          // Filter out old cancelled bets (status 8) that are more than a day old
          const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
          const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
          const filteredBets = bets.filter((bet: Bet) => {
            if (bet.status === 6 || bet.status === 7) {
              // Check if bet is more than 3 days old (using end_time or could use last database update time)
              const betAge = bet.end_time || 0;
              return betAge > threeDaysAgo;
            }
            if (bet.status === 8) {
              // Check if bet is more than a day old (using end_time or updated_at)
              const betAge = bet.end_time || bet.timestamp || 0;
              return betAge > oneDayAgo;
            }
            return true; // Keep all non-cancelled bets
          });

          console.log(
            "📊 Filtered bets:",
            filteredBets.length,
            "bets after filtering"
          );

          // Debug: Log user's role in each bet
          filteredBets.forEach((bet: Bet) => {
            const isMaker =
              address?.toLowerCase() === bet.maker_address.toLowerCase() ||
              context?.user?.fid === bet.maker_fid;
            const isTaker =
              address?.toLowerCase() === bet.taker_address.toLowerCase() ||
              context?.user?.fid === bet.taker_fid;
            const isArbiter =
              address?.toLowerCase() === bet.arbiter_address?.toLowerCase() ||
              context?.user?.fid === bet.arbiter_fid;
            console.log(`🎯 Bet #${bet.bet_number} - User role:`, {
              isMaker,
              isTaker,
              isArbiter,
              userAddress: address,
              userFid: context?.user?.fid,
              makerAddress: bet.maker_address,
              makerFid: bet.maker_fid,
              takerAddress: bet.taker_address,
              takerFid: bet.taker_fid,
              arbiterAddress: bet.arbiter_address,
              arbiterFid: bet.arbiter_fid,
            });
          });

          // Fetch profile data for each bet's maker and taker (only for non-filtered bets)
          const betsWithProfiles = await Promise.all(
            filteredBets.map(async (bet: Bet) => {
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
                makerProfile = await fetchUserWithCache(makerFid);
              }

              if (takerFid) {
                takerProfile = await fetchUserWithCache(takerFid);
              }

              if (arbiterFid) {
                arbiterProfile = await fetchUserWithCache(arbiterFid);
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
  }, [address, context?.user?.fid]);

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

  // Wait for approval transaction receipt
  const { data: approvalReceipt, isSuccess: isApprovalReceiptSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalTxHash,
    });

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData();

  // Handle approval transaction receipt
  useEffect(() => {
    if (approvalReceipt && isApprovalReceiptSuccess) {
      console.log("=== APPROVAL TRANSACTION RECEIPT ===");
      console.log("Transaction Hash:", approvalReceipt.transactionHash);
      console.log(
        "Status:",
        approvalReceipt.status === "success" ? "Success" : "Failed"
      );

      if (approvalReceipt.status === "success") {
        console.log("Token approval successful!");
        setIsApproving(false);
        setShowApprovalSuccess(true);

        // Hide success message after 5 seconds
        setTimeout(() => {
          setShowApprovalSuccess(false);
        }, 5000);

        // Refetch allowance after successful approval
        setTimeout(() => {
          refetchAllowance();
        }, 1000);
      }
    }
  }, [approvalReceipt, isApprovalReceiptSuccess, refetchAllowance]);

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
      // Use the first connector directly
      await connectors[0].connect();
    } catch (error) {
      console.error("Manual connection failed:", error);
    }
  }, [connectors]);

  // Function to get status text and styling
  const getStatusInfo = (
    bet: Bet,
    currentUserAddress?: string,
    currentUserFid?: number
  ) => {
    const now = Math.floor(Date.now() / 1000);
    const { status, end_time, makerProfile, takerProfile, arbiterProfile } =
      bet;

    // Check if current user is the maker or taker
    const isMaker =
      (currentUserAddress &&
        currentUserAddress.toLowerCase() === bet.maker_address.toLowerCase()) ||
      (currentUserFid && currentUserFid === bet.maker_fid);
    const isTaker =
      (currentUserAddress &&
        currentUserAddress.toLowerCase() === bet.taker_address.toLowerCase()) ||
      (currentUserFid && currentUserFid === bet.taker_fid);

    switch (status) {
      case 0:
        // Check if end time has passed and current user is the maker or taker
        if (now > end_time && (isMaker || isTaker)) {
          return {
            text: "Bet timed out",
            bgColor:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
        }

        // Check if current user is the taker (by address OR FID)
        if (isTaker) {
          return {
            text: "Accept Bet?",
            bgColor:
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          };
        }
        return {
          text: `${takerProfile?.username || "Taker"} hasn't accepted`,
          bgColor:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        };
      case 9:
        // Rejected bet - show who rejected it
        if (isMaker) {
          return {
            text: `${takerProfile?.username || "Taker"} Rejected Bet`,
            bgColor:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
        }
        return {
          text: "Bet Rejected",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      case 1:
        // Check if current user is the arbiter (by address OR FID)
        const isArbiter =
          (currentUserAddress &&
            currentUserAddress.toLowerCase() ===
              bet.arbiter_address?.toLowerCase()) ||
          (currentUserFid && currentUserFid === bet.arbiter_fid);

        if (isArbiter) {
          return {
            text: "Accept Arbiter Role?",
            bgColor:
              "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
          };
        }
        return {
          text: `${arbiterProfile?.username || "Arbiter"} needs to accept`,
          bgColor:
            "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
        };
      case 2:
        const isEndTimePassed = now > end_time;
        if (isEndTimePassed) {
          return {
            text: `Awaiting ${arbiterProfile?.username || "Arbiter"}'s ruling`,
            bgColor:
              "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
          };
        } else {
          const timeRemaining = getTimeRemaining(end_time);
          return {
            text: `${timeRemaining} left`,
            bgColor:
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          };
        }
      case 4:
        // Maker won - check if current user is the maker
        if (isMaker) {
          return {
            text: "You Won!",
            bgColor:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          };
        } else if (isTaker) {
          return {
            text: "You Lost",
            bgColor:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
        } else {
          return {
            text: `${makerProfile?.username || "Maker"} Won`,
            bgColor:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          };
        }
      case 5:
        // Taker won - check if current user is the taker
        if (isTaker) {
          return {
            text: "You Won!",
            bgColor:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          };
        } else if (isMaker) {
          return {
            text: "You Lost",
            bgColor:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
        } else {
          return {
            text: `${takerProfile?.username || "Taker"} Won`,
            bgColor:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          };
        }
      case 6:
        // Maker claimed winnings - check if current user is the maker
        if (isMaker) {
          return {
            text: "You Won!",
            bgColor:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          };
        } else if (isTaker) {
          return {
            text: "You Lost",
            bgColor:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
        } else {
          return {
            text: `${makerProfile?.username || "Maker"} Won`,
            bgColor:
              "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
          };
        }
      case 7:
        // Taker claimed winnings - check if current user is the taker
        if (isTaker) {
          return {
            text: "You Won!",
            bgColor:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          };
        } else if (isMaker) {
          return {
            text: "You Lost",
            bgColor:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
        } else {
          return {
            text: `${takerProfile?.username || "Taker"} Won`,
            bgColor:
              "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
          };
        }
      case 8:
        return {
          text: "Cancelled/Refunded",
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
      case 10:
        return {
          text: "Arbiter Declined Bet",
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
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

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
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

      // Use a more direct approach to avoid connector issues
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Cancel transaction sent successfully:", hash);
            setCancelTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeModal();
              // Update database to mark bet as cancelled
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
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
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
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
        }
      );
    } catch (error) {
      console.error("Error cancelling bet:", error);
      setIsCancelling(false);
    }
  };

  // Function to accept bet
  const handleAcceptBet = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot accept bet: not connected or no bet selected");
      return;
    }

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }

    // Check token allowance for ERC20 tokens (skip for native ETH)
    if (
      selectedBet.bet_token_address !==
      "0x0000000000000000000000000000000000000000"
    ) {
      const betAmountWei = amountToWei(
        selectedBet.bet_amount,
        selectedBet.bet_token_address
      );

      if (!allowance || allowance < betAmountWei) {
        console.log("Insufficient token allowance. Requesting approval...");

        try {
          setIsApproving(true);
          const hash = await writeApproveAsync({
            address: selectedBet.bet_token_address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BETCASTER_ADDRESS, betAmountWei],
          });

          if (hash) {
            console.log("Approval transaction sent:", hash);
            setApprovalTxHash(hash);
          }

          return;
        } catch (error) {
          console.error("Failed to approve token allowance:", error);
          setIsApproving(false);
          return;
        }
      }
    }

    try {
      setIsAccepting(true);
      console.log("Accepting bet #", selectedBet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "acceptBet",
        args: [BigInt(selectedBet.bet_number)],
      });

      console.log("Encoded accept transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Accept transaction sent successfully:", hash);
            setAcceptTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeModal();
              // Update database to mark bet as accepted
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: 1,
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  console.log("Bet status updated to accepted in database");

                  // Send notification to arbiter about being invited
                  if (selectedBet.arbiter_fid) {
                    try {
                      const notificationResult = await notifyInviteArbiter(
                        selectedBet.arbiter_fid,
                        {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        }
                      );

                      if (notificationResult.success) {
                        console.log(
                          "Notification sent to arbiter about invitation"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to arbiter:",
                          notificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification:",
                        notificationError
                      );
                    }
                  }
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }

              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
                if (response.ok) {
                  const data = await response.json();
                  setUserBets(data.bets || []);
                }
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Accept transaction failed:", error);
            setIsAccepting(false);
          },
        }
      );
    } catch (error) {
      console.error("Error accepting bet:", error);
      setIsAccepting(false);
    }
  };

  // Function to accept arbiter role
  const handleAcceptArbiterRole = async () => {
    if (!selectedBet || !isConnected) {
      console.error(
        "Cannot accept arbiter role: not connected or no bet selected"
      );
      return;
    }

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }

    try {
      setIsAcceptingArbiter(true);
      console.log("Accepting arbiter role for bet #", selectedBet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: ARBITER_MANAGEMENT_ENGINE_ABI,
        functionName: "ArbiterAcceptRole",
        args: [BigInt(selectedBet.bet_number)],
      });

      console.log("Encoded accept arbiter transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: ARBITER_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Accept arbiter transaction sent successfully:", hash);
            setAcceptArbiterTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeModal();
              // Update database to mark bet as arbiter accepted
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: 2,
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  console.log(
                    "Bet status updated to arbiter accepted in database"
                  );

                  // Send notification to maker about arbiter acceptance
                  if (selectedBet.maker_fid) {
                    try {
                      const makerNotificationResult =
                        await notifyArbiterAccepted(selectedBet.maker_fid, {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        });

                      if (makerNotificationResult.success) {
                        console.log(
                          "Notification sent to maker about arbiter acceptance"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to maker:",
                          makerNotificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification to maker:",
                        notificationError
                      );
                    }
                  }

                  // Send notification to taker about arbiter acceptance
                  if (selectedBet.taker_fid) {
                    try {
                      const takerNotificationResult =
                        await notifyArbiterAccepted(selectedBet.taker_fid, {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        });

                      if (takerNotificationResult.success) {
                        console.log(
                          "Notification sent to taker about arbiter acceptance"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to taker:",
                          takerNotificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification to taker:",
                        notificationError
                      );
                    }
                  }
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }

              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
                if (response.ok) {
                  const data = await response.json();
                  setUserBets(data.bets || []);
                }
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Accept arbiter transaction failed:", error);
            setIsAcceptingArbiter(false);
          },
        }
      );
    } catch (error) {
      console.error("Error accepting arbiter role:", error);
      setIsAcceptingArbiter(false);
    }
  };

  // Function to handle bet forfeiture
  const handleForfeitBet = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot forfeit bet: not connected or no bet selected");
      return;
    }

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }

    // Determine who is forfeiting the bet
    const isMaker =
      address?.toLowerCase() === selectedBet.maker_address.toLowerCase() ||
      context?.user?.fid === selectedBet.maker_fid;

    const isTaker =
      address?.toLowerCase() === selectedBet.taker_address.toLowerCase() ||
      context?.user?.fid === selectedBet.taker_fid;

    // Set the appropriate status based on who is forfeiting
    let forfeitStatus: number;
    if (isMaker) {
      forfeitStatus = 5; // Taker wins (status 5)
      console.log("Maker is forfeiting - Taker wins");
    } else if (isTaker) {
      forfeitStatus = 4; // Maker wins (status 4)
      console.log("Taker is forfeiting - Maker wins");
    } else {
      console.error("User is neither maker nor taker - cannot forfeit");
      return;
    }

    try {
      setIsForfeiting(true);
      console.log("Forfeiting bet #", selectedBet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "forfeitBet",
        args: [BigInt(selectedBet.bet_number)],
      });

      console.log("Encoded forfeit transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Forfeit transaction sent successfully:", hash);
            setForfeitTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeModal();
              // Update database with the correct status based on who forfeited
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: forfeitStatus,
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  console.log(
                    `Bet status updated to ${forfeitStatus} in database`
                  );

                  // Send notification to the other party about bet forfeiture
                  let targetFid: number | null = null;
                  let forfeiterName: string = "";

                  if (isMaker) {
                    // Maker forfeited, notify taker
                    targetFid = selectedBet.taker_fid || null;
                    forfeiterName =
                      selectedBet.makerProfile?.display_name ||
                      selectedBet.makerProfile?.username ||
                      "The maker";
                  } else if (isTaker) {
                    // Taker forfeited, notify maker
                    targetFid = selectedBet.maker_fid || null;
                    forfeiterName =
                      selectedBet.takerProfile?.display_name ||
                      selectedBet.takerProfile?.username ||
                      "The taker";
                  }

                  if (targetFid) {
                    try {
                      const notificationResult = await notifyBetForfeited(
                        targetFid,
                        {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        }
                      );

                      if (notificationResult.success) {
                        console.log(
                          `Notification sent to other party about bet forfeiture by ${forfeiterName}`
                        );
                      } else {
                        console.error(
                          "Failed to send notification to other party:",
                          notificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification:",
                        notificationError
                      );
                    }
                  }
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }

              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
                if (response.ok) {
                  const data = await response.json();
                  setUserBets(data.bets || []);
                }
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Forfeit transaction failed:", error);
            setIsForfeiting(false);
          },
        }
      );
    } catch (error) {
      console.error("Error forfeiting bet:", error);
      setIsForfeiting(false);
    }
  };

  // Function to handle claiming winnings
  const handleClaimWinnings = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot claim winnings: not connected or no bet selected");
      return;
    }

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }

    // Determine the new status based on current status
    let newStatus: number;
    if (selectedBet.status === 4) {
      newStatus = 6; // Maker claimed winnings
      console.log("Maker claiming winnings - updating to status 6");
    } else if (selectedBet.status === 5) {
      newStatus = 7; // Taker claimed winnings
      console.log("Taker claiming winnings - updating to status 7");
    } else {
      console.error("Invalid bet status for claiming:", selectedBet.status);
      return;
    }

    try {
      setIsClaiming(true);
      console.log("Claiming winnings for bet #", selectedBet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "claimBet",
        args: [BigInt(selectedBet.bet_number)],
      });

      console.log("Encoded claim transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Claim transaction sent successfully:", hash);
            setClaimTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeModal();
              // Update database with the new status
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: newStatus,
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  console.log(`Bet status updated to ${newStatus} in database`);

                  // Set up share details for winning bet
                  const token = getTokenByAddress(
                    selectedBet.bet_token_address
                  );
                  const tokenEmoji = token?.image
                    ? `${token.name} 🪙`
                    : token?.name || "tokens";

                  // Create share text based on bet details
                  const shareText = `I just won ${selectedBet.bet_amount} ${tokenEmoji} betting on "${selectedBet.bet_agreement}" on @betcaster! 🎯💰`;

                  // Open Warpcast with pre-filled cast
                  window.open(
                    `https://warpcast.com/~/compose?text=${encodeURIComponent(
                      shareText
                    )}&embeds[]=${encodeURIComponent(
                      `${process.env.NEXT_PUBLIC_URL}/share/${
                        context?.user?.fid || ""
                      }`
                    )}`,
                    "_blank"
                  );
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }

              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
                if (response.ok) {
                  const data = await response.json();
                  setUserBets(data.bets || []);
                }
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Claim transaction failed:", error);
            setIsClaiming(false);
          },
        }
      );
    } catch (error) {
      console.error("Error claiming winnings:", error);
      setIsClaiming(false);
    }
  };

  // Helper function to get token name from address
  const getTokenName = (tokenAddress: string): string => {
    const token = getTokenByAddress(tokenAddress);
    return token ? token.name : "Unknown Token";
  };

  // Function to handle bet editing
  const handleEditBet = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot edit bet: not connected or no bet selected");
      return;
    }

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }

    try {
      setIsEditing(true);
      console.log("Editing bet #", selectedBet.bet_number);

      // Calculate new end time
      let newEndTime: number;
      if (editTimeOption === "custom" && editCustomTimeValue) {
        const value = parseInt(editCustomTimeValue);
        const totalSeconds =
          value * (editCustomTimeUnit === "hours" ? 60 * 60 : 24 * 60 * 60);
        if (value > 0 && totalSeconds <= 365 * 24 * 60 * 60) {
          newEndTime = Math.floor(Date.now() / 1000) + totalSeconds;
        } else {
          newEndTime = selectedBet.end_time; // Keep original if invalid
        }
      } else if (editTimeOption) {
        const now = Math.floor(Date.now() / 1000);
        switch (editTimeOption) {
          case "24h":
            newEndTime = now + 24 * 60 * 60;
            break;
          case "1week":
            newEndTime = now + 7 * 24 * 60 * 60;
            break;
          case "1month":
            newEndTime = now + 30 * 24 * 60 * 60;
            break;
          default:
            newEndTime = selectedBet.end_time;
        }
      } else {
        newEndTime = selectedBet.end_time; // Keep original if no change
      }

      // Use provided values or fall back to original values
      const newTaker =
        editTakerUser?.primaryEthAddress || selectedBet.taker_address;
      const newArbiter =
        editArbiterUser?.primaryEthAddress ||
        selectedBet.arbiter_address ||
        "0x0000000000000000000000000000000000000000";
      const newBetAgreement = editBetAgreement || selectedBet.bet_agreement;

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "changeBetParameters",
        args: [
          BigInt(selectedBet.bet_number),
          newTaker as `0x${string}`,
          newArbiter as `0x${string}`,
          BigInt(newEndTime),
          newBetAgreement,
        ],
      });

      console.log("Encoded edit transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Edit transaction sent successfully:", hash);
            setEditTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              setIsEditModalOpen(false);
              setIsModalOpen(false);
              // Update database with new parameters and reset status to 0
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      taker_address: newTaker,
                      arbiter_address:
                        newArbiter ===
                        "0x0000000000000000000000000000000000000000"
                          ? null
                          : newArbiter,
                      end_time: newEndTime,
                      bet_agreement: newBetAgreement,
                      status: 0, // Reset status to 0 after edit
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet parameters in database");
                } else {
                  console.log(
                    "Bet parameters updated and status reset to 0 in database"
                  );

                  // Send notification to taker about bet edit
                  if (selectedBet.taker_fid) {
                    try {
                      const notificationResponse = await fetch(
                        "/api/send-notification",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            type: "bet_edited",
                            targetFid: selectedBet.taker_fid,
                            data: {
                              betNumber: selectedBet.bet_number,
                              betAmount: selectedBet.bet_amount.toString(),
                              tokenName: getTokenName(
                                selectedBet.bet_token_address
                              ),
                              makerName:
                                selectedBet.makerProfile?.display_name ||
                                selectedBet.makerProfile?.username,
                              takerName:
                                selectedBet.takerProfile?.display_name ||
                                selectedBet.takerProfile?.username,
                              arbiterName:
                                selectedBet.arbiterProfile?.display_name ||
                                selectedBet.arbiterProfile?.username,
                              betAgreement: newBetAgreement,
                              endTime: new Date(
                                newEndTime * 1000
                              ).toLocaleString(),
                            },
                          }),
                        }
                      );

                      if (notificationResponse.ok) {
                        console.log(
                          "Notification sent to taker about bet edit"
                        );
                      } else {
                        console.error("Failed to send notification to taker");
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification:",
                        notificationError
                      );
                    }
                  }

                  // Set share details and show modal
                  setShareBetDetails({
                    amount: selectedBet.bet_amount.toString(),
                    token: getTokenName(selectedBet.bet_token_address),
                    taker: selectedBet.takerProfile?.display_name || "Unknown",
                    arbiter: selectedBet.arbiterProfile?.display_name,
                  });
                  setShowShareModal(true);
                }
              } catch (error) {
                console.error("Error updating bet parameters:", error);
              }

              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
                if (response.ok) {
                  const data = await response.json();
                  setUserBets(data.bets || []);
                }
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Edit transaction failed:", error);
            setIsEditing(false);
          },
        }
      );
    } catch (error) {
      console.error("Error editing bet:", error);
      setIsEditing(false);
    }
  };

  // Function to open edit modal and populate fields
  const openEditModal = (bet: Bet) => {
    setSelectedBet(bet);

    // Pre-populate with current users if available
    if (bet.takerProfile) {
      setEditTakerUser({
        fid: bet.takerProfile.fid,
        username: bet.takerProfile.username,
        displayName: bet.takerProfile.display_name,
        pfpUrl: bet.takerProfile.pfp_url,
        primaryEthAddress: bet.takerProfile.primaryEthAddress,
        primarySolanaAddress: bet.takerProfile.primarySolanaAddress,
      });
      setEditTakerFid(bet.takerProfile.fid);
    }

    if (bet.arbiterProfile) {
      setEditArbiterUser({
        fid: bet.arbiterProfile.fid,
        username: bet.arbiterProfile.username,
        displayName: bet.arbiterProfile.display_name,
        pfpUrl: bet.arbiterProfile.pfp_url,
        primaryEthAddress: bet.arbiterProfile.primaryEthAddress,
        primarySolanaAddress: bet.arbiterProfile.primarySolanaAddress,
      });
      setEditArbiterFid(bet.arbiterProfile.fid);
    }

    setEditBetAgreement(bet.bet_agreement);
    setEditTimeOption("");
    setEditCustomTimeValue("");
    setEditCustomTimeUnit("days");
    setIsEditModalOpen(true);
  };

  // Function to close edit modal
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditTakerUser(null);
    setEditArbiterUser(null);
    setEditTakerFid(null);
    setEditArbiterFid(null);
    setEditBetAgreement("");
    setEditTimeOption("");
    setEditCustomTimeValue("");
    setEditCustomTimeUnit("days");
  };

  // Function to open select winner modal
  const openSelectWinnerModal = (bet: Bet) => {
    setSelectedBet(bet);
    setSelectedWinner(null);
    setIsSelectWinnerModalOpen(true);
  };

  // Function to close select winner modal
  const closeSelectWinnerModal = () => {
    setIsSelectWinnerModalOpen(false);
    setSelectedWinner(null);
  };

  // Function to handle winner selection
  const handleSelectWinner = async () => {
    if (!selectedBet || !isConnected || !selectedWinner) {
      console.error(
        "Cannot select winner: not connected, no bet selected, or no winner selected"
      );
      return;
    }

    // Check if we're on the correct chain (Base)
    if (chainId !== base.id) {
      console.log("Switching to Base network...");
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }

    try {
      setIsSelectingWinner(true);
      console.log(
        "Selecting winner for bet #",
        selectedBet.bet_number,
        "Winner:",
        selectedWinner
      );

      // Determine the winner address
      const winnerAddress =
        selectedWinner === "maker"
          ? selectedBet.maker_address
          : selectedBet.taker_address;

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: ARBITER_MANAGEMENT_ENGINE_ABI,
        functionName: "selectWinner",
        args: [BigInt(selectedBet.bet_number), winnerAddress as `0x${string}`],
      });

      console.log("Encoded select winner transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: ARBITER_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Select winner transaction sent successfully:", hash);
            setSelectWinnerTxHash(hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeSelectWinnerModal();
              // Update database with the winner status
              try {
                const winnerStatus = selectedWinner === "maker" ? 4 : 5; // 4 = maker wins, 5 = taker wins
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: winnerStatus,
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  console.log(
                    `Bet status updated to ${winnerStatus} in database`
                  );

                  // Send notification to maker about winner selection
                  if (selectedBet.maker_fid) {
                    try {
                      const makerNotificationResult =
                        await notifyWinnerSelected(selectedBet.maker_fid, {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        });

                      if (makerNotificationResult.success) {
                        console.log(
                          "Notification sent to maker about winner selection"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to maker:",
                          makerNotificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification to maker:",
                        notificationError
                      );
                    }
                  }

                  // Send notification to taker about winner selection
                  if (selectedBet.taker_fid) {
                    try {
                      const takerNotificationResult =
                        await notifyWinnerSelected(selectedBet.taker_fid, {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        });

                      if (takerNotificationResult.success) {
                        console.log(
                          "Notification sent to taker about winner selection"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to taker:",
                          takerNotificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification to taker:",
                        notificationError
                      );
                    }
                  }
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }

              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());

                const response = await fetch(`/api/bets?${params.toString()}`);
                if (response.ok) {
                  const data = await response.json();
                  setUserBets(data.bets || []);
                }
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Select winner transaction failed:", error);
            setIsSelectingWinner(false);
          },
        }
      );
    } catch (error) {
      console.error("Error selecting winner:", error);
      setIsSelectingWinner(false);
    }
  };

  // Add a new function to handle bet rejection
  const handleRejectBet = async (bet: Bet) => {
    try {
      console.log("Rejecting bet #", bet.bet_number);

      // Update database to mark bet as rejected
      const updateResponse = await fetch(
        `/api/bets?betNumber=${bet.bet_number}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: 9,
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error("Failed to update bet status in database");
      } else {
        console.log("Bet status updated to rejected in database");

        // Send notification to maker about bet rejection
        if (bet.maker_fid) {
          try {
            const notificationResult = await notifyBetRejected(bet.maker_fid, {
              betNumber: bet.bet_number,
              betAmount: bet.bet_amount.toString(),
              tokenName: getTokenName(bet.bet_token_address),
              makerName:
                bet.makerProfile?.display_name || bet.makerProfile?.username,
              takerName:
                bet.takerProfile?.display_name || bet.takerProfile?.username,
              arbiterName:
                bet.arbiterProfile?.display_name ||
                bet.arbiterProfile?.username,
              betAgreement: bet.bet_agreement,
              endTime: new Date(bet.end_time * 1000).toLocaleString(),
            });

            if (notificationResult.success) {
              console.log("Notification sent to maker about bet rejection");
            } else {
              console.error(
                "Failed to send notification to maker:",
                notificationResult.error
              );
            }
          } catch (notificationError) {
            console.error("Error sending notification:", notificationError);
          }
        }

        // Refresh bets list
        if (address || context?.user?.fid) {
          const params = new URLSearchParams();
          if (address) params.append("address", address);
          if (context?.user?.fid)
            params.append("fid", context.user.fid.toString());

          const response = await fetch(`/api/bets?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            setUserBets(data.bets || []);
          }
        }
      }
    } catch (error) {
      console.error("Error rejecting bet:", error);
    }
  };

  // Add this function near other state management functions
  const handleShareBet = (bet: Bet) => {
    setShareBetDetails({
      amount: bet.bet_amount.toString(),
      token: getTokenName(bet.bet_token_address),
      taker:
        bet.takerProfile?.display_name ||
        bet.takerProfile?.username ||
        "Unknown",
      arbiter: bet.arbiterProfile?.display_name || bet.arbiterProfile?.username,
    });
    setShowShareModal(true);
    closeModal();
  };

  const handleNoArbiterCancelBet = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot cancel bet: not connected or no bet selected");
      return;
    }
    if (chainId !== base.id) {
      try {
        await switchChain({ chainId: base.id });
        return;
      } catch (error) {
        console.error("Failed to switch to Base network:", error);
        return;
      }
    }
    try {
      setIsCancelling(true);
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "noArbiterCancelBet",
        args: [BigInt(selectedBet.bet_number)],
      });
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            setCancelTxHash(hash);
            setTimeout(async () => {
              closeModal();
              try {
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: 8, transaction_hash: hash }),
                  }
                );
                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  // Notify both Maker and Taker
                  const notify = async (fid: number | null | undefined) => {
                    if (fid) {
                      // If connected user is taker send bet_cancelled_by_taker notification
                      if (context?.user?.fid === selectedBet.taker_fid) {
                        try {
                          await notifyBetCancelledByTaker(fid, {
                            betNumber: selectedBet.bet_number,
                            betAmount: selectedBet.bet_amount.toString(),
                            tokenName: getTokenName(
                              selectedBet.bet_token_address
                            ),
                            makerName:
                              selectedBet.makerProfile?.display_name ||
                              selectedBet.makerProfile?.username,
                            takerName:
                              selectedBet.takerProfile?.display_name ||
                              selectedBet.takerProfile?.username,
                            arbiterName:
                              selectedBet.arbiterProfile?.display_name ||
                              selectedBet.arbiterProfile?.username,
                            betAgreement: selectedBet.bet_agreement,
                            endTime: new Date(
                              selectedBet.end_time * 1000
                            ).toLocaleString(),
                          });
                        } catch (e) {
                          console.error("Notification error", e);
                        }
                      } else if (context?.user?.fid === selectedBet.maker_fid) {
                        try {
                          await notifyBetCancelled(fid, {
                            betNumber: selectedBet.bet_number,
                            betAmount: selectedBet.bet_amount.toString(),
                            tokenName: getTokenName(
                              selectedBet.bet_token_address
                            ),
                            makerName:
                              selectedBet.makerProfile?.display_name ||
                              selectedBet.makerProfile?.username,
                            takerName:
                              selectedBet.takerProfile?.display_name ||
                              selectedBet.takerProfile?.username,
                            arbiterName:
                              selectedBet.arbiterProfile?.display_name ||
                              selectedBet.arbiterProfile?.username,
                            betAgreement: selectedBet.bet_agreement,
                            endTime: new Date(
                              selectedBet.end_time * 1000
                            ).toLocaleString(),
                          });
                        } catch (e) {
                          console.error("Notification error", e);
                        }
                      }
                    }
                  };
                  await Promise.all([
                    notify(selectedBet.maker_fid),
                    notify(selectedBet.taker_fid),
                  ]);
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }
              // Refresh bets list
              if (address || context?.user?.fid) {
                const params = new URLSearchParams();
                if (address) params.append("address", address);
                if (context?.user?.fid)
                  params.append("fid", context.user.fid.toString());
                const response = await fetch(`/api/bets?${params.toString()}`);
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
        }
      );
    } catch (error) {
      console.error("Error cancelling bet:", error);
      setIsCancelling(false);
    }
  };

  const handleRejectArbiterRole = async (bet: Bet) => {
    try {
      // Update database to mark bet as arbiter rejected (status 10)
      const updateResponse = await fetch(
        `/api/bets?betNumber=${bet.bet_number}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: 10 }),
        }
      );

      if (!updateResponse.ok) {
        console.error("Failed to update bet status in database");
      } else {
        console.log("Bet status updated to arbiter rejected in database");
        // Notify both Maker and Taker
        const notify = async (fid: number | null | undefined) => {
          if (fid) {
            try {
              await notifyArbiterRejected(fid, {
                betNumber: bet.bet_number,
                betAmount: bet.bet_amount.toString(),
                tokenName: getTokenName(bet.bet_token_address),
                makerName:
                  bet.makerProfile?.display_name || bet.makerProfile?.username,
                takerName:
                  bet.takerProfile?.display_name || bet.takerProfile?.username,
                arbiterName:
                  bet.arbiterProfile?.display_name ||
                  bet.arbiterProfile?.username,
                betAgreement: bet.bet_agreement,
                endTime: new Date(bet.end_time * 1000).toLocaleString(),
              });
            } catch (e) {
              console.error("Notification error", e);
            }
          }
        };
        // Optionally refresh bets list
        if (address || context?.user?.fid) {
          const params = new URLSearchParams();
          if (address) params.append("address", address);
          if (context?.user?.fid)
            params.append("fid", context.user.fid.toString());
          const response = await fetch(`/api/bets?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            setUserBets(data.bets || []);
          }
        }
        // Optionally close modal if in modal
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Error rejecting arbiter role:", error);
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
            userFid={context?.user?.fid || null}
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
                                getStatusInfo(bet, address, context?.user?.fid)
                                  .bgColor
                              }`}
                            >
                              {
                                getStatusInfo(bet, address, context?.user?.fid)
                                  .text
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

                          {/* Forfeit Actions for Status 2 */}
                          {bet.status === 2 &&
                            (address?.toLowerCase() ===
                              bet.maker_address.toLowerCase() ||
                              context?.user?.fid === bet.maker_fid ||
                              address?.toLowerCase() ===
                                bet.taker_address.toLowerCase() ||
                              context?.user?.fid === bet.taker_fid) && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                >
                                  Forfeit Bet
                                </button>
                              </div>
                            )}

                          {/* Maker Actions for Status 0 */}
                          {address === bet.maker_address &&
                            bet.status === 0 && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(bet);
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            )}

                          {/* Maker Actions for Status 9 (Rejected) */}
                          {address === bet.maker_address &&
                            bet.status === 9 && (
                              <div className="mb-4">
                                <div className="flex space-x-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBet(bet);
                                      setIsModalOpen(true);
                                    }}
                                    className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(bet);
                                    }}
                                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            )}

                          {/* Taker Actions for Status 0 */}
                          {(address?.toLowerCase() ===
                            bet.taker_address.toLowerCase() ||
                            context?.user?.fid === bet.taker_fid) &&
                            bet.status === 0 &&
                            Math.floor(Date.now() / 1000) <= bet.end_time && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                >
                                  Accept Bet
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectBet(bet);
                                  }}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                          {/* Arbiter Actions for Status 1 */}
                          {(address?.toLowerCase() ===
                            bet.arbiter_address?.toLowerCase() ||
                            context?.user?.fid === bet.arbiter_fid) &&
                            bet.status === 1 && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
                                >
                                  Accept Arbiter Role
                                </button>
                                {/* Reject Arbiter Role Button */}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleRejectArbiterRole(bet);
                                  }}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                >
                                  Reject Arbiter Role
                                </button>
                              </div>
                            )}

                          {/* Arbiter Select Winner Actions for Status 2 */}
                          {(address?.toLowerCase() ===
                            bet.arbiter_address?.toLowerCase() ||
                            context?.user?.fid === bet.arbiter_fid) &&
                            bet.status === 2 &&
                            Math.floor(Date.now() / 1000) > bet.end_time && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSelectWinnerModal(bet);
                                  }}
                                  className="px-2 py-1 text-xs bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
                                >
                                  Select Winner
                                </button>
                              </div>
                            )}

                          {/* Claim Winnings Actions for Status 4 and 5 */}
                          {bet.status === 4 &&
                            (address?.toLowerCase() ===
                              bet.maker_address.toLowerCase() ||
                              context?.user?.fid === bet.maker_fid) && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                >
                                  Claim Winnings!
                                </button>
                              </div>
                            )}

                          {bet.status === 5 &&
                            (address?.toLowerCase() ===
                              bet.taker_address.toLowerCase() ||
                              context?.user?.fid === bet.taker_fid) && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                >
                                  Claim Winnings!
                                </button>
                              </div>
                            )}

                          {/* Arbiter Declined - Cancel option for maker/taker after 24h */}
                          {bet.status === 10 &&
                            (address?.toLowerCase() ===
                              bet.maker_address.toLowerCase() ||
                              context?.user?.fid === bet.maker_fid ||
                              address?.toLowerCase() ===
                                bet.taker_address.toLowerCase() ||
                              context?.user?.fid === bet.taker_fid) &&
                            Math.floor(Date.now() / 1000) - bet.timestamp >
                              24 * 60 * 60 && (
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBet(bet);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
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

        {currentTab === "explore" && <Explore />}

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
                  onClick={() => connectors[0].connect()}
                  className="w-full"
                >
                  Connect Coinbase Wallet
                </Button>
                <Button
                  onClick={() => connectors[1].connect()}
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
                {/* Approval Success Message */}
                {showApprovalSuccess && (
                  <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
                    ✅ Token approval successful! You can now accept the bet.
                  </div>
                )}

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
                      getStatusInfo(selectedBet, address, context?.user?.fid)
                        .bgColor
                    }`}
                  >
                    {
                      getStatusInfo(selectedBet, address, context?.user?.fid)
                        .text
                    }
                  </div>
                </div>

                {/* Cancel button for status 10 */}
                {selectedBet.status === 10 &&
                  (address?.toLowerCase() ===
                    selectedBet.maker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.maker_fid ||
                    address?.toLowerCase() ===
                      selectedBet.taker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.taker_fid) &&
                  Math.floor(Date.now() / 1000) - selectedBet.timestamp >
                    24 * 60 * 60 && (
                    <div className="mb-4">
                      <button
                        onClick={handleNoArbiterCancelBet}
                        disabled={isCancelling}
                        className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCancelling ? "Cancelling..." : "Cancel Bet"}
                      </button>
                    </div>
                  )}

                {/* Forfeit Actions for Status 2 */}
                {selectedBet.status === 2 &&
                  (address?.toLowerCase() ===
                    selectedBet.maker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.maker_fid ||
                    address?.toLowerCase() ===
                      selectedBet.taker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.taker_fid) && (
                    <div className="mb-4">
                      {/* Warning Message */}
                      <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-red-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                              Warning: You will lose your tokens
                            </h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                              <p>
                                By forfeiting this bet, you will permanently
                                lose the tokens you wagered. This action cannot
                                be undone.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Maker Actions */}
                {address === selectedBet.maker_address &&
                  (selectedBet.status === 0 || selectedBet.status === 9) && (
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
                          onClick={() => openEditModal(selectedBet)}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Edit Bet
                        </button>
                      </div>
                    </div>
                  )}

                {/* Taker Actions */}
                {(address?.toLowerCase() ===
                  selectedBet.taker_address.toLowerCase() ||
                  context?.user?.fid === selectedBet.taker_fid) &&
                  selectedBet.status === 0 && (
                    <div className="mb-4">
                      {/* Warning Message for Accepting Bet */}
                      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-blue-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Important: You will win if the bet agreement below
                              resolves to false.
                            </h3>
                            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                              <p>
                                By accepting this bet, you agree that you will
                                lose your tokens if the bet agreement is
                                determined to be true by the arbiter. Make sure
                                you understand the bet conditions before
                                proceeding.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Only show Accept Bet button if end time has not passed */}
                      {Math.floor(Date.now() / 1000) <=
                        selectedBet.end_time && (
                        <div className="flex space-x-3">
                          <button
                            onClick={handleAcceptBet}
                            disabled={isAccepting || isApproving}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isApproving
                              ? "Approving..."
                              : isAccepting
                                ? "Accepting..."
                                : "Accept Bet"}
                          </button>
                        </div>
                      )}

                      {/* Show message if end time has passed */}
                      {Math.floor(Date.now() / 1000) > selectedBet.end_time && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <svg
                              className="w-5 h-5 text-red-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-sm font-medium text-red-800 dark:text-red-200">
                              Bet acceptance period has expired
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                            This bet can no longer be accepted as the end time
                            has passed.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {/* Bet Agreement */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maker wins if:
                  </h3>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedBet.bet_agreement || "No description provided"}
                    </p>
                  </div>
                </div>

                {/* Arbiter Actions */}
                {(address?.toLowerCase() ===
                  selectedBet.arbiter_address?.toLowerCase() ||
                  context?.user?.fid === selectedBet.arbiter_fid) &&
                  selectedBet.status === 1 && (
                    <div className="mb-4">
                      <div className="flex space-x-3">
                        <button
                          onClick={handleAcceptArbiterRole}
                          disabled={isAcceptingArbiter}
                          className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAcceptingArbiter
                            ? "Accepting..."
                            : "Accept Arbiter Role"}
                        </button>
                        {/* Reject Arbiter Role Button */}
                        <button
                          onClick={() => handleRejectArbiterRole(selectedBet)}
                          className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Reject Arbiter Role
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
                        Wager:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBet.bet_amount}
                      </span>
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const token = getTokenByAddress(
                            selectedBet.bet_token_address
                          );
                          return (
                            <>
                              {token && (
                                <img
                                  src={token.image}
                                  alt={token.name}
                                  className="w-5 h-5 rounded-full"
                                />
                              )}
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {getTokenName(selectedBet.bet_token_address)}
                              </span>
                            </>
                          );
                        })()}
                      </div>
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

                {/* Forfeit Actions for Status 2 */}
                {selectedBet.status === 2 &&
                  (address?.toLowerCase() ===
                    selectedBet.maker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.maker_fid ||
                    address?.toLowerCase() ===
                      selectedBet.taker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.taker_fid) && (
                    <div className="mb-4">
                      <div className="flex space-x-3">
                        <button
                          onClick={handleForfeitBet}
                          disabled={isForfeiting}
                          className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isForfeiting ? "Forfeiting..." : "Forfeit Bet"}
                        </button>
                        {/* Cancel button if 24h since timestamp */}
                        {Math.floor(Date.now() / 1000) - selectedBet.timestamp >
                          24 * 60 * 60 && (
                          <button
                            onClick={handleNoArbiterCancelBet}
                            disabled={isCancelling}
                            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCancelling ? "Cancelling..." : "Cancel Bet"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                {/* Claim Winnings Actions for Status 4 and 5 */}
                {selectedBet.status === 4 &&
                  (address?.toLowerCase() ===
                    selectedBet.maker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.maker_fid) && (
                    <div className="mb-4">
                      <div className="flex space-x-3">
                        <button
                          onClick={handleClaimWinnings}
                          disabled={isClaiming}
                          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isClaiming ? "Claiming..." : "Claim Winnings!"}
                        </button>
                      </div>
                    </div>
                  )}

                {selectedBet.status === 5 &&
                  (address?.toLowerCase() ===
                    selectedBet.taker_address.toLowerCase() ||
                    context?.user?.fid === selectedBet.taker_fid) && (
                    <div className="mb-4">
                      <div className="flex space-x-3">
                        <button
                          onClick={handleClaimWinnings}
                          disabled={isClaiming}
                          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isClaiming ? "Claiming..." : "Claim Winnings!"}
                        </button>
                      </div>
                    </div>
                  )}

                {/* Close Button */}
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </div>

                {/* Add Share Button */}
                <div className="mt-4">
                  <button
                    onClick={() => handleShareBet(selectedBet)}
                    className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Share on Farcaster
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isEditModalOpen && selectedBet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Edit Bet #{selectedBet.bet_number}
                  </h2>
                  <button
                    onClick={closeEditModal}
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

                <div className="space-y-4">
                  {/* Taker Selection */}
                  <UserSearchDropdown
                    label="Taker"
                    placeholder="Search for a taker..."
                    selectedUser={editTakerUser}
                    onUserSelect={setEditTakerUser}
                    onFidChange={setEditTakerFid}
                    currentUserFid={context?.user?.fid || null}
                  />

                  {/* Arbiter Selection */}
                  <UserSearchDropdown
                    label="Arbiter (Optional)"
                    placeholder="Search for an arbiter (optional)..."
                    selectedUser={editArbiterUser}
                    onUserSelect={setEditArbiterUser}
                    onFidChange={setEditArbiterFid}
                    currentUserFid={context?.user?.fid || null}
                  />

                  {/* End Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New End Time
                    </label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditTimeOption("24h")}
                          className={`py-2 px-3 text-sm ${
                            editTimeOption === "24h"
                              ? "bg-purple-500 text-white"
                              : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          24 hours
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTimeOption("1week")}
                          className={`py-2 px-3 text-sm ${
                            editTimeOption === "1week"
                              ? "bg-purple-500 text-white"
                              : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          1 week
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTimeOption("1month")}
                          className={`py-2 px-3 text-sm ${
                            editTimeOption === "1month"
                              ? "bg-purple-500 text-white"
                              : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          1 month
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTimeOption("custom")}
                          className={`py-2 px-3 text-sm ${
                            editTimeOption === "custom"
                              ? "bg-purple-500 text-white"
                              : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          Custom
                        </button>
                      </div>

                      {editTimeOption === "custom" && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            max={
                              editCustomTimeUnit === "hours" ? "8760" : "365"
                            }
                            placeholder={`Enter time value (1-${
                              editCustomTimeUnit === "hours" ? "8760" : "365"
                            })`}
                            value={editCustomTimeValue}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              const maxValue =
                                editCustomTimeUnit === "hours" ? 8760 : 365;
                              if (value <= maxValue) {
                                setEditCustomTimeValue(e.target.value);
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <select
                            value={editCustomTimeUnit}
                            onChange={(e) => {
                              setEditCustomTimeUnit(
                                e.target.value as "hours" | "days"
                              );
                              // Reset value when switching units to ensure it's within the new unit's limits
                              setEditCustomTimeValue("");
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bet Agreement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Maker wins if:
                    </label>
                    <textarea
                      value={editBetAgreement}
                      onChange={(e) => setEditBetAgreement(e.target.value)}
                      placeholder="Describe what you're betting on..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={handleEditBet}
                      disabled={isEditing}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEditing ? "Updating..." : "Update Bet"}
                    </button>
                    <button
                      onClick={closeEditModal}
                      className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isSelectWinnerModalOpen && selectedBet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Select Winner for Bet #{selectedBet.bet_number}
                  </h2>
                  <button
                    onClick={closeSelectWinnerModal}
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

                {/* Arbiter Instructions */}
                <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-lg">
                  <strong>Arbiter Instructions:</strong>
                  <div className="mt-1 text-sm">
                    Select whether the bet agreement is <b>True</b> or{" "}
                    <b>False</b>.
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
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Wager:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBet.bet_amount}
                      </span>
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const token = getTokenByAddress(
                            selectedBet.bet_token_address
                          );
                          return (
                            <>
                              {token && (
                                <img
                                  src={token.image}
                                  alt={token.name}
                                  className="w-5 h-5 rounded-full"
                                />
                              )}
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {getTokenName(selectedBet.bet_token_address)}
                              </span>
                            </>
                          );
                        })()}
                      </div>
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
                    Maker wins if:
                  </h3>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedBet.bet_agreement || "No description provided"}
                    </p>
                  </div>
                </div>

                {/* Winner Selection */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Result
                  </h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedWinner("maker")}
                      className={`flex-1 px-4 py-2 rounded-lg border ${
                        selectedWinner === "maker"
                          ? "bg-green-500 text-white border-green-600"
                          : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <div className="text-center">
                        <div>True</div>
                        <div className="text-xs opacity-75">
                          (
                          {selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username ||
                            "Maker"}{" "}
                          wins)
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedWinner("taker")}
                      className={`flex-1 px-4 py-2 rounded-lg border ${
                        selectedWinner === "taker"
                          ? "bg-blue-500 text-white border-blue-600"
                          : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <div className="text-center">
                        <div>False</div>
                        <div className="text-xs opacity-75">
                          (
                          {selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username ||
                            "Taker"}{" "}
                          wins)
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleSelectWinner}
                    disabled={isSelectingWinner || !selectedWinner}
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSelectingWinner ? "Submitting..." : "Submit Winner"}
                  </button>
                  <button
                    onClick={closeSelectWinnerModal}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {selectWinnerTxHash && (
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Transaction Hash: {truncateAddress(selectWinnerTxHash)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showShareModal && shareBetDetails && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => {
              console.log("Closing share modal");
              setShowShareModal(false);
            }}
            betDetails={shareBetDetails}
            userFid={context?.user?.fid || null}
          />
        )}
      </div>
    </div>
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

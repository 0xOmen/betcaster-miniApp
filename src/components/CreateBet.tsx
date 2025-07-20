/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { encodeFunctionData, parseEventLogs } from "viem";
import {
  BET_MANAGEMENT_ENGINE_ABI,
  BET_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/contracts";
import {
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
} from "wagmi";
import { base } from "wagmi/chains";
import { supabase } from "~/lib/supabase";
import { BASE_TOKENS, Token, amountToWei } from "~/lib/tokens";
import UserSearchDropdown from "~/components/UserSearchDropdown";
import { ShareModal } from "~/components/ShareModal";
import { notifyBetCreated } from "~/lib/notificationUtils";

interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

function TokenSelectDropdown({
  token,
  setToken,
  options,
}: {
  token: Token | null;
  setToken: (token: Token) => void;
  options: Token[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          {token ? (
            <>
              <img
                src={token.image}
                alt={token.name}
                className="w-6 h-6 rounded-full"
              />
              <span className="font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-gray-500">Select a token</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.symbol}
              onClick={() => {
                setToken(option);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
            >
              <img
                src={option.image}
                alt={option.name}
                className="w-6 h-6 rounded-full"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {option.symbol}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {option.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CreateBetProps {
  isConnected: boolean;
  sendTransaction: (
    variables: { to: `0x${string}`; data: `0x${string}` },
    callbacks?: {
      onSuccess?: (hash: `0x${string}`) => void;
      onError?: (error: Error) => void;
    }
  ) => void;
  isTransactionPending: boolean;
  setActiveTab: (
    tab: "create" | "bets" | "arbitrate" | "wallet" | "leaderboard"
  ) => void;
  userFid?: number | null;
}

// Add ERC20 ABI for allowance and approve functions
const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const SPENDER_ADDRESS =
  "0xEA358a9670a4f2113AA17e8d6C9A0dE68c2a0aEa" as `0x${string}`; //Betcaster contract on Base

export default function CreateBet({
  isConnected,
  sendTransaction,
  isTransactionPending,
  setActiveTab,
  userFid,
}: CreateBetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(
    BASE_TOKENS[0]
  );
  const [betAmount, setBetAmount] = useState("");
  const [betDescription, setBetDescription] = useState("");
  const [selectedTimeOption, setSelectedTimeOption] = useState<string>("");
  const [customTimeValue, setCustomTimeValue] = useState("");
  const [customTimeUnit, setCustomTimeUnit] = useState<"hours" | "days">(
    "days"
  );
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Add arbiter selection state
  const [arbiterSearchTerm, setArbiterSearchTerm] = useState("");
  const [arbiterUsers, setArbiterUsers] = useState<User[]>([]);
  const [isArbiterSearching, setIsArbiterSearching] = useState(false);
  const [selectedArbiter, setSelectedArbiter] = useState<User | null>(null);
  const [showArbiterDropdown, setShowArbiterDropdown] = useState(false);

  // Add arbiter fee state
  const [arbiterFeePercent, setArbiterFeePercent] = useState<number>(1);
  const [showCustomArbiterFee, setShowCustomArbiterFee] =
    useState<boolean>(false);
  const [customArbiterFee, setCustomArbiterFee] = useState<string>("");

  // Protocol fee percentage
  const PROTOCOL_FEE_PERCENT = 0.5;

  // Store FIDs for maker, taker, and arbiter
  const [makerFid, setMakerFid] = useState<number | null>(null);
  const [takerFid, setTakerFid] = useState<number | null>(null);
  const [arbiterFid, setArbiterFid] = useState<number | null>(null);

  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  // Read allowance for the selected token
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedToken?.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, SPENDER_ADDRESS],
    query: {
      enabled:
        !!selectedToken?.address && !!address && selectedToken.address !== "",
    },
  });

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [approvalTxHash, setApprovalTxHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);

  // Wait for transaction receipt and parse events
  const { data: receipt, isSuccess: isReceiptSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Wait for approval transaction receipt
  const { data: approvalReceipt, isSuccess: isApprovalReceiptSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalTxHash,
    });

  // Add state for share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareBetDetails, setShareBetDetails] = useState<{
    amount: string;
    token: string;
    taker: string;
    arbiter?: string;
  } | null>(null);

  // Modify handleTransactionReceipt to show share modal
  useEffect(() => {
    const handleTransactionReceipt = async () => {
      console.log("Receipt status:", {
        receipt,
        isReceiptSuccess,
        selectedUser,
        selectedToken,
      });

      if (receipt && isReceiptSuccess && selectedUser && selectedToken) {
        try {
          // Parse all events from the transaction receipt
          const parsedEvents = parseEventLogs({
            abi: BET_MANAGEMENT_ENGINE_ABI,
            logs: receipt.logs,
          });

          console.log("=== TRANSACTION RECEIPT ===");
          console.log("Transaction Hash:", receipt.transactionHash);
          console.log("Block Number:", receipt.blockNumber);
          console.log("Gas Used:", receipt.gasUsed.toString());
          console.log(
            "Status:",
            receipt.status === "success" ? "Success" : "Failed"
          );
          console.log("All Parsed Events:", parsedEvents);

          // Find the BetCreated event specifically
          const betCreatedEvent = parsedEvents.find(
            (event) => event.eventName === "BetCreated"
          );

          console.log("Bet created event:", betCreatedEvent);

          if (betCreatedEvent) {
            console.log("=== BET CREATED EVENT ===");
            console.log("Event Name:", betCreatedEvent.eventName);
            const betNumber = betCreatedEvent.args.betNumber?.toString();
            console.log("Bet Number:", betNumber);

            // Extract all the bet data from the event
            const betData = betCreatedEvent.args.bet;
            console.log("Complete Bet Data from Event:", betData);

            // Store bet data in Supabase using the actual blockchain data
            if (betNumber && betData) {
              try {
                // Use stored FIDs instead of making additional API calls
                console.log("Using stored FIDs:", {
                  makerFid,
                  takerFid,
                  arbiterFid,
                });

                // Convert BigInt values to appropriate formats
                const betAmountInWei = betData.betAmount;
                const betAmountInTokens = parseFloat(betAmount); // Keep original for display

                // Convert protocol fee from basis points to percentage
                const protocolFeeBasisPoints = Number(betData.protocolFee);
                const protocolFeePercent = protocolFeeBasisPoints / 100;

                // Convert arbiter fee from basis points to percentage
                const arbiterFeeBasisPoints = Number(betData.arbiterFee);
                const arbiterFeePercent = arbiterFeeBasisPoints / 100;

                const supabaseBetData = {
                  bet_number: parseInt(betNumber),
                  maker_address: betData.maker as string,
                  taker_address: betData.taker as string,
                  arbiter_address: betData.arbiter as string,
                  bet_token_address: betData.betTokenAddress as string,
                  bet_amount: betAmountInTokens, // Keep original amount for display
                  bet_amount_wei: betAmountInWei.toString(), // Store wei amount
                  timestamp: Number(betData.timestamp),
                  end_time: Number(betData.endTime),
                  protocol_fee: protocolFeePercent,
                  arbiter_fee: arbiterFeePercent,
                  bet_agreement: betData.betAgreement as string,
                  transaction_hash: receipt.transactionHash,
                  maker_fid: makerFid,
                  taker_fid: takerFid,
                  arbiter_fid: arbiterFid,
                  status: Number(betData.status), // Store the bet status from blockchain
                };

                console.log(
                  "Storing bet data with blockchain values:",
                  supabaseBetData
                );

                const response = await fetch("/api/bets", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(supabaseBetData),
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log("Bet stored successfully:", result);

                  // Send notification to taker about bet creation
                  if (takerFid) {
                    try {
                      const notificationResult = await notifyBetCreated(
                        takerFid,
                        {
                          betNumber: parseInt(betNumber),
                          makerName: selectedUser.displayName,
                        }
                      );

                      if (notificationResult.success) {
                        console.log(
                          "Notification sent to taker about bet creation"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to taker:",
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

                  // Set share details and show modal BEFORE changing tabs
                  const shareDetails = {
                    amount: betAmount,
                    token: selectedToken.symbol,
                    taker: selectedUser.displayName,
                    arbiter: selectedArbiter?.displayName,
                  };
                  console.log("Setting share details:", shareDetails);

                  setShareBetDetails(shareDetails);
                  setShowShareModal(true);

                  console.log("Share modal state:", {
                    showShareModal: true,
                    shareBetDetails: shareDetails,
                  });
                } else {
                  console.error("Failed to store bet data");
                  const errorData = await response.json();
                  console.error("Error details:", errorData);
                }
              } catch (error) {
                console.error("Error storing bet data:", error);
              }
            }
          } else {
            console.log("No BetCreated event found in transaction");
          }

          console.log("================================");
        } catch (error) {
          console.error("Error parsing transaction events:", error);
        }
      }
    };

    handleTransactionReceipt();
  }, [
    receipt,
    isReceiptSuccess,
    selectedUser,
    selectedToken,
    betAmount,
    selectedArbiter,
  ]);

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
        setShowApprovalSuccess(true);

        // Hide success message after 3 seconds
        setTimeout(() => {
          setShowApprovalSuccess(false);
        }, 3000);

        // Refetch allowance after successful approval
        setTimeout(() => {
          refetchAllowance();
          setIsApproving(false);
        }, 1000);
      } else {
        console.log("Token approval failed!");
        setIsApproving(false);
      }
    }
  }, [approvalReceipt, isApprovalReceiptSuccess, refetchAllowance]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/search-users?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log("API response:", data);
        setUsers(data.users || []);
        setShowDropdown(true);
      } else {
        setUsers([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setUsers([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchUserDetails = async (fid: number) => {
    setIsLoadingUserDetails(true);
    try {
      const response = await fetch(`/api/users?fids=${fid}`);
      if (response.ok) {
        const data = await response.json();
        console.log("User details fetched:", data);

        const user = data.users?.[0];
        if (!user) {
          return null;
        }

        // Transform the user data to match our User interface
        const transformedUser: User = {
          fid: user.fid,
          username: user.username,
          displayName: user.display_name || user.username,
          pfpUrl: user.pfp_url || "",
          primaryEthAddress:
            user.verified_addresses?.primary?.eth_address || null,
          primarySolanaAddress:
            user.verified_addresses?.primary?.sol_address || null,
        };

        console.log("Transformed user:", transformedUser);
        return transformedUser;
      } else {
        console.error("Users API returned error status:", response.status);
        const errorData = await response.json();
        console.error("Error data:", errorData);
        return null;
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      return null;
    } finally {
      setIsLoadingUserDetails(false);
    }
  };

  const searchArbiterUsers = async (query: string) => {
    if (!query.trim()) {
      setArbiterUsers([]);
      setShowArbiterDropdown(false);
      return;
    }

    setIsArbiterSearching(true);
    try {
      const response = await fetch(
        `/api/search-users?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log("Arbiter API response:", data);
        setArbiterUsers(data.users || []);
        setShowArbiterDropdown(true);
      } else {
        setArbiterUsers([]);
        setShowArbiterDropdown(false);
      }
    } catch (error) {
      console.error("Error searching arbiter users:", error);
      setArbiterUsers([]);
      setShowArbiterDropdown(false);
    } finally {
      setIsArbiterSearching(false);
    }
  };

  const handleUserSelect = async (user: User) => {
    setSearchTerm(user.displayName);
    setShowDropdown(false);

    // Store the taker FID immediately
    setTakerFid(user.fid);
    console.log("Taker FID set:", user.fid);

    // Fetch detailed user information including wallet addresses
    const detailedUser = await fetchUserDetails(user.fid);
    if (detailedUser) {
      setSelectedUser(detailedUser);
    } else {
      // Fallback to the basic user info if detailed fetch fails
      setSelectedUser(user);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!e.target.value.trim()) {
      setSelectedUser(null);
      setTakerFid(null); // Reset taker FID when user is cleared
    }
  };

  const handleInputFocus = () => {
    if (users.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => setShowDropdown(false), 300);
  };

  const handleArbiterSelect = async (user: User) => {
    setArbiterSearchTerm(user.displayName);
    setShowArbiterDropdown(false);

    // Store the arbiter FID immediately
    setArbiterFid(user.fid);
    console.log("Arbiter FID set:", user.fid);

    // Fetch detailed user information including wallet addresses
    const detailedUser = await fetchUserDetails(user.fid);
    if (detailedUser) {
      setSelectedArbiter(detailedUser);
    } else {
      // Fallback to the basic user info if detailed fetch fails
      setSelectedArbiter(user);
    }
  };

  const handleArbiterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArbiterSearchTerm(e.target.value);
    if (!e.target.value.trim()) {
      setSelectedArbiter(null);
      setArbiterFid(null); // Reset arbiter FID when arbiter is cleared
    }
  };

  const handleArbiterInputFocus = () => {
    if (arbiterUsers.length > 0) {
      setShowArbiterDropdown(true);
    }
  };

  const handleArbiterInputBlur = () => {
    setTimeout(() => setShowArbiterDropdown(false), 300);
  };

  useEffect(() => {
    if (searchTerm.length > 0) {
      searchUsers(searchTerm);
    } else {
      setUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

  // Add useEffect for arbiter search
  useEffect(() => {
    if (arbiterSearchTerm.length > 0) {
      searchArbiterUsers(arbiterSearchTerm);
    } else {
      setArbiterUsers([]);
      setShowArbiterDropdown(false);
    }
  }, [arbiterSearchTerm]);

  const handleTimeOptionSelect = (option: string) => {
    setSelectedTimeOption(option);
    setShowCustomInput(option === "custom");
    if (option !== "custom") {
      setCustomTimeValue("");
      setCustomTimeUnit("days");
    }
  };

  const getEndDateTimestamp = (): number => {
    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds

    switch (selectedTimeOption) {
      case "24h":
        return now + 24 * 60 * 60; // 24 hours in seconds
      case "1week":
        return now + 7 * 24 * 60 * 60; // 1 week in seconds
      case "1month":
        return now + 30 * 24 * 60 * 60; // 30 days in seconds
      case "custom":
        const value = parseInt(customTimeValue) || 0;
        const totalSeconds =
          value * (customTimeUnit === "hours" ? 60 * 60 : 24 * 60 * 60);
        if (totalSeconds > 0 && totalSeconds <= 365 * 24 * 60 * 60) {
          return now + totalSeconds; // Custom hours and days in seconds
        }
        return 0;
      default:
        return 0;
    }
  };

  const formatEndDate = (timestamp: number): string => {
    if (timestamp === 0) return "Invalid date";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const handleArbiterFeeSelect = (fee: number) => {
    setArbiterFeePercent(fee);
    setShowCustomArbiterFee(false);
    setCustomArbiterFee("");
  };

  const handleCustomArbiterFee = () => {
    setShowCustomArbiterFee(true);
    setArbiterFeePercent(0);
  };

  const handleCreateBet = async () => {
    if (!isConnected) {
      console.error("Wallet not connected");
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

    if (!selectedUser || !selectedToken || !betAmount || !selectedTimeOption) {
      console.error("Missing required fields for bet creation");
      return;
    }

    // Check token allowance for ERC20 tokens (skip for native ETH)
    if (selectedToken.address !== "") {
      const betAmountWei = amountToWei(
        parseFloat(betAmount),
        selectedToken.address
      );

      if (!allowance || allowance < betAmountWei) {
        console.log("Insufficient token allowance. Requesting approval...");

        try {
          setIsApproving(true);
          const hash = await writeApproveAsync({
            address: selectedToken.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [SPENDER_ADDRESS, betAmountWei],
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

    const endTimestamp = getEndDateTimestamp();

    console.log("=== CREATE BET SUBMISSION ===");
    console.log(
      "Selected User Primary ETH Address:",
      selectedUser.primaryEthAddress || "Not available"
    );
    console.log(
      "Selected Arbiter Primary ETH Address:",
      selectedArbiter?.primaryEthAddress || "Not available"
    );
    console.log(
      "Bet Token Contract Address:",
      selectedToken.address || "Native ETH"
    );
    console.log("Number of Tokens Wagered:", betAmount);
    console.log("Bet Description:", betDescription);
    console.log("Bet End Time (Unix Timestamp):", endTimestamp);
    console.log("Bet End Time (Human Readable):", formatEndDate(endTimestamp));
    console.log("================================");

    try {
      // Check if user has an ETH address
      if (!selectedUser.primaryEthAddress) {
        console.error("Selected user does not have a primary ETH address");
        return;
      }

      // Check if arbiter has an ETH address (if selected)
      if (selectedArbiter && !selectedArbiter.primaryEthAddress) {
        console.error("Selected arbiter does not have a primary ETH address");
        return;
      }

      // Convert bet amount to wei (using token decimals)
      const betAmountWei = amountToWei(
        parseFloat(betAmount),
        selectedToken.address
      );

      // Prepare the transaction parameters for createBet function
      const createBetParams = [
        selectedUser.primaryEthAddress as `0x${string}`, // _taker
        (selectedArbiter?.primaryEthAddress as `0x${string}`) ||
          ("0x0000000000000000000000000000000000000000" as `0x${string}`), // _arbiter
        selectedToken.address as `0x${string}`, // _betTokenAddress (zero address for native ETH)
        betAmountWei, // _betAmount
        BigInt(endTimestamp), // _endTime
        BigInt(PROTOCOL_FEE_PERCENT * 100), // _protocolFee
        BigInt(arbiterFeePercent * 100), // _arbiterFee
        betDescription, // _betAgreement
      ] as const;

      console.log("Transaction parameters:", createBetParams);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "createBet",
        args: createBetParams,
      });

      console.log("Encoded transaction data:", encodedData);

      // Create the transaction object
      const transaction = {
        to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
        data: encodedData as `0x${string}`,
      };

      console.log("Transaction object:", transaction);

      // Send the transaction
      sendTransaction(transaction, {
        onSuccess: async (hash: `0x${string}`) => {
          console.log("Transaction sent successfully:", hash);
          setTxHash(hash); // Store the transaction hash for receipt tracking

          // Don't store bet data here anymore - wait for the event to get bet_number
        },
        onError: (error: Error) => {
          console.error("Transaction failed:", error);
        },
      });
    } catch (error) {
      console.error("Error creating bet:", error);
    }
  };

  const endDateTimestamp = getEndDateTimestamp();

  useEffect(() => {
    if (userFid) {
      setMakerFid(userFid);
      console.log("Maker FID set from context:", userFid);
    }
  }, [userFid]);

  return (
    <div className="space-y-6 px-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-center">Create New Bet</h2>

      {/* Approval Success Message */}
      {showApprovalSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          ✅ Token approval successful!
        </div>
      )}

      <div className="space-y-4">
        {/* Taker Selection */}
        <UserSearchDropdown
          label="Search for a user to bet with"
          placeholder="Enter username or display name..."
          selectedUser={selectedUser}
          onUserSelect={setSelectedUser}
          onFidChange={setTakerFid}
          currentUserFid={userFid}
        />

        {/* Token Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Token
          </label>
          <TokenSelectDropdown
            token={selectedToken}
            setToken={setSelectedToken}
            options={BASE_TOKENS}
          />
        </div>

        {/* Bet Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bet Amount {selectedToken && `(${selectedToken.symbol})`}
          </label>
          <input
            type="number"
            step={
              selectedToken
                ? `0.${"0".repeat(selectedToken.decimals - 1)}1`
                : "0.01"
            }
            min="0"
            placeholder={
              selectedToken
                ? `0.${"0".repeat(selectedToken.decimals - 1)}1`
                : "0.01"
            }
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Bet Description */}
        <div>
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start space-x-2">
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
                  Bet Condition
                </h3>
                <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  You will win if the following is true. Be specific!
                </div>
              </div>
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bet Description
          </label>
          <textarea
            placeholder="The Eagles will not win the next Super Bowl..."
            rows={3}
            value={betDescription}
            onChange={(e) => setBetDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Arbiter Selection */}
        <UserSearchDropdown
          label="Select Arbiter (Optional)"
          placeholder="Search for an arbiter (optional)..."
          selectedUser={selectedArbiter}
          onUserSelect={setSelectedArbiter}
          onFidChange={setArbiterFid}
          currentUserFid={userFid}
        />

        {/* Arbiter Fee Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Arbiter Fee
          </label>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleArbiterFeeSelect(0.5)}
                className={`py-2 px-3 text-sm ${
                  arbiterFeePercent === 0.5 && !showCustomArbiterFee
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                0.5%
              </button>
              <button
                type="button"
                onClick={() => handleArbiterFeeSelect(1)}
                className={`py-2 px-3 text-sm ${
                  arbiterFeePercent === 1 && !showCustomArbiterFee
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                1%
              </button>
              <button
                type="button"
                onClick={() => handleArbiterFeeSelect(2)}
                className={`py-2 px-3 text-sm ${
                  arbiterFeePercent === 2 && !showCustomArbiterFee
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                2%
              </button>
            </div>
            <button
              type="button"
              onClick={handleCustomArbiterFee}
              className={`w-full py-2 px-3 text-sm ${
                showCustomArbiterFee
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              Custom Fee
            </button>
            {showCustomArbiterFee && (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  placeholder="Enter fee % (0.1-10)"
                  value={customArbiterFee}
                  onChange={(e) => setCustomArbiterFee(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  %
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Protocol Fee Information */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Protocol fee is {PROTOCOL_FEE_PERCENT}% on all completed bets
        </div>

        {/* End Time Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bet End Time
          </label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTimeOptionSelect("24h")}
                className={`py-2 px-3 text-sm ${
                  selectedTimeOption === "24h"
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                24 hours
              </button>
              <button
                type="button"
                onClick={() => handleTimeOptionSelect("1week")}
                className={`py-2 px-3 text-sm ${
                  selectedTimeOption === "1week"
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                1 week
              </button>
              <button
                type="button"
                onClick={() => handleTimeOptionSelect("1month")}
                className={`py-2 px-3 text-sm ${
                  selectedTimeOption === "1month"
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                1 month
              </button>
              <button
                type="button"
                onClick={() => handleTimeOptionSelect("custom")}
                className={`py-2 px-3 text-sm ${
                  selectedTimeOption === "custom"
                    ? "bg-purple-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                Custom
              </button>
            </div>

            {showCustomInput && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={customTimeUnit === "hours" ? "8760" : "365"}
                    placeholder={`Enter time value (1-${
                      customTimeUnit === "hours" ? "8760" : "365"
                    })`}
                    value={customTimeValue}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      const maxValue = customTimeUnit === "hours" ? 8760 : 365;
                      if (value <= maxValue) {
                        setCustomTimeValue(e.target.value);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <select
                    value={customTimeUnit}
                    onChange={(e) => {
                      setCustomTimeUnit(e.target.value as "hours" | "days");
                      // Reset value when switching units to ensure it's within the new unit's limits
                      setCustomTimeValue("");
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
            )}

            {selectedTimeOption && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                End time: {formatEndDate(endDateTimestamp)}
              </div>
            )}
          </div>
        </div>

        {/* Create Bet Button */}
        <Button
          onClick={handleCreateBet}
          disabled={
            !isConnected ||
            !selectedUser ||
            !selectedToken ||
            !betAmount ||
            !selectedTimeOption ||
            isTransactionPending ||
            isApproving
          }
          isLoading={isTransactionPending || isApproving}
          className="w-full"
        >
          {isApproving
            ? "Approving..."
            : isTransactionPending
              ? "Creating Bet..."
              : "Create Bet"}
        </Button>

        {/* Transaction Status */}
        {txHash && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Transaction Hash: {txHash}
          </div>
        )}
      </div>

      {/* Add ShareModal */}
      {/* Debug info */}
      <div className="hidden">
        Modal State: {JSON.stringify({ showShareModal, shareBetDetails })}
      </div>

      {/* ShareModal */}
      {showShareModal && shareBetDetails && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            console.log("Closing share modal");
            setShowShareModal(false);
            // Change tab only after modal is closed
            setActiveTab("bets");
          }}
          betDetails={shareBetDetails}
          userFid={userFid}
        />
      )}
    </div>
  );
}

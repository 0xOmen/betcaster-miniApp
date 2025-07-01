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

interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

interface Token {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  image: string;
  chainId: number;
}

const tokenOptions: Token[] = [
  {
    name: "Bracky",
    address: "0x06f71fb90f84b35302d132322a3c90e4477333b0",
    symbol: "BRACKY",
    decimals: 18,
    image:
      "https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/c58cb239-9e92-4fb5-d982-50fd5b903800/anim=false,fit=contain,f=auto,w=576",
    chainId: 8453,
  },
  {
    name: "USDC",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    symbol: "USDC",
    decimals: 6,
    image:
      "https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/44/2b/442b80bd16af0c0d9b22e03a16753823fe826e5bfd457292b55fa0ba8c1ba213-ZWUzYjJmZGUtMDYxNy00NDcyLTg0NjQtMWI4OGEwYjBiODE2",
    chainId: 8453,
  },
  {
    name: "Degen",
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    symbol: "DEGEN",
    decimals: 18,
    image:
      "https://assets.coingecko.com/coins/images/34515/standard/android-chrome-512x512.png?1706198225",
    chainId: 8453,
  },
  {
    name: "Clanker",
    address: "0x1bc0c42215582d5a085795f4badbac3ff36d1bcb",
    symbol: "CLANKER",
    decimals: 18,
    image:
      "https://assets.coingecko.com/coins/images/51440/standard/CLANKER.png?1731232869",
    chainId: 8453,
  },
  {
    name: "Ethereum",
    address: "",
    symbol: "ETH",
    decimals: 18,
    image:
      "https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png",
    chainId: 8453,
  },
];

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
}: CreateBetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [betDescription, setBetDescription] = useState("");
  const [selectedTimeOption, setSelectedTimeOption] = useState<string>("");
  const [customDays, setCustomDays] = useState("");
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

  // Parse BetCreated event when receipt is available
  useEffect(() => {
    const handleTransactionReceipt = async () => {
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

          if (betCreatedEvent) {
            console.log("=== BET CREATED EVENT ===");
            console.log("Event Name:", betCreatedEvent.eventName);
            const betNumber = betCreatedEvent.args.betNumber?.toString();
            console.log("Bet Number:", betNumber);

            // Since the bet struct is indexed, we can't access its components directly
            // We'll use the form data we already have, but log what we can from the event
            console.log("Bet Details from Event:", {
              betNumber: betNumber,
              betStructHash: betCreatedEvent.args.bet, // This is the hash of the struct
            });

            // Store bet data in Supabase using our form data and the bet_number from the event
            if (betNumber) {
              try {
                // Use stored FIDs instead of making additional API calls
                console.log("Using stored FIDs:", {
                  makerFid,
                  takerFid,
                  arbiterFid,
                });

                const supabaseBetData = {
                  bet_number: parseInt(betNumber),
                  maker_address: address as string,
                  taker_address: selectedUser.primaryEthAddress as string,
                  arbiter_address: selectedArbiter?.primaryEthAddress || null,
                  bet_token_address:
                    selectedToken.address ||
                    "0x0000000000000000000000000000000000000000",
                  bet_amount: parseFloat(betAmount),
                  timestamp: Math.floor(Date.now() / 1000),
                  end_time: getEndDateTimestamp(),
                  protocol_fee: 100,
                  arbiter_fee: arbiterFeePercent,
                  bet_agreement: betDescription,
                  transaction_hash: receipt.transactionHash,
                  maker_fid: makerFid,
                  taker_fid: takerFid,
                  arbiter_fid: arbiterFid,
                };

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

                  // Switch to the Pending Bets tab after successful bet creation
                  setActiveTab("bets");
                } else {
                  console.error("Failed to store bet data");
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
    address,
    selectedUser,
    selectedArbiter,
    selectedToken,
    betAmount,
    betDescription,
    arbiterFeePercent,
    setActiveTab,
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
      setCustomDays("");
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
        const days = parseInt(customDays);
        if (days > 0 && days <= 365) {
          return now + days * 24 * 60 * 60; // Custom days in seconds
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
      const decimals = selectedToken.decimals || 18;
      const betAmountWei = BigInt(
        Math.floor(parseFloat(betAmount) * Math.pow(10, decimals))
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
      const decimals = selectedToken.decimals || 18;
      const betAmountWei = BigInt(
        Math.floor(parseFloat(betAmount) * Math.pow(10, decimals))
      );

      // Prepare the transaction parameters for createBet function
      const createBetParams = [
        selectedUser.primaryEthAddress as `0x${string}`, // _taker
        (selectedArbiter?.primaryEthAddress as `0x${string}`) ||
          ("0x0000000000000000000000000000000000000000" as `0x${string}`), // _arbiter
        selectedToken.address as `0x${string}`, // _betTokenAddress (zero address for native ETH)
        betAmountWei, // _betAmount
        BigInt(endTimestamp), // _endTime
        BigInt(100), // _protocolFee
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

  // Fetch maker FID when wallet is connected
  useEffect(() => {
    const fetchMakerFid = async () => {
      if (address) {
        try {
          const response = await fetch(`/api/users?address=${address}`);
          if (response.ok) {
            const data = await response.json();
            const fid = data.users?.[0]?.fid || null;
            setMakerFid(fid);
            console.log("Maker FID set:", fid);
          }
        } catch (error) {
          console.error("Failed to fetch maker FID:", error);
        }
      }
    };

    fetchMakerFid();
  }, [address]);

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
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search for a user to bet with
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Enter username or display name..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />

          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
            </div>
          )}

          {showDropdown && users.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.fid}
                  onClick={(e) => {
                    e.preventDefault();
                    handleUserSelect(user);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                >
                  <div className="flex-shrink-0">
                    {user.pfpUrl ? (
                      <img
                        src={user.pfpUrl}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          console.log("Image failed to load:", user.pfpUrl);
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    {!user.pfpUrl && (
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.displayName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{user.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {selectedUser.pfpUrl ? (
                  <img
                    src={selectedUser.pfpUrl}
                    alt={selectedUser.displayName}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      console.log(
                        "Selected user image failed to load:",
                        selectedUser.pfpUrl
                      );
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      target.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                {!selectedUser.pfpUrl && (
                  <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {selectedUser.displayName}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  @{selectedUser.username}
                </div>
                {isLoadingUserDetails && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Loading wallet addresses...
                  </div>
                )}
                {!isLoadingUserDetails && selectedUser.primaryEthAddress && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    ETH: {selectedUser.primaryEthAddress}
                  </div>
                )}
                {!isLoadingUserDetails && selectedUser.primarySolanaAddress && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    SOL: {selectedUser.primarySolanaAddress}
                  </div>
                )}
                {!isLoadingUserDetails &&
                  !selectedUser.primaryEthAddress &&
                  !selectedUser.primarySolanaAddress && (
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      No wallet addresses found
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Token
          </label>
          <TokenSelectDropdown
            token={selectedToken}
            setToken={setSelectedToken}
            options={tokenOptions}
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bet Description
          </label>
          <textarea
            placeholder="Describe what you're betting on..."
            rows={3}
            value={betDescription}
            onChange={(e) => setBetDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Arbiter (Optional)
          </label>
          <input
            type="text"
            value={arbiterSearchTerm}
            onChange={handleArbiterInputChange}
            onFocus={handleArbiterInputFocus}
            onBlur={handleArbiterInputBlur}
            placeholder="Search for an arbiter (optional)..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />

          {isArbiterSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
            </div>
          )}

          {showArbiterDropdown && arbiterUsers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {arbiterUsers.map((user) => (
                <button
                  key={user.fid}
                  onClick={(e) => {
                    e.preventDefault();
                    handleArbiterSelect(user);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                >
                  <div className="flex-shrink-0">
                    {user.pfpUrl ? (
                      <img
                        src={user.pfpUrl}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          console.log(
                            "Arbiter image failed to load:",
                            user.pfpUrl
                          );
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    {!user.pfpUrl && (
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.displayName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{user.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedArbiter && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {selectedArbiter.pfpUrl ? (
                  <img
                    src={selectedArbiter.pfpUrl}
                    alt={selectedArbiter.displayName}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      console.log(
                        "Selected arbiter image failed to load:",
                        selectedArbiter.pfpUrl
                      );
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      target.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                {!selectedArbiter.pfpUrl && (
                  <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                      {selectedArbiter.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {selectedArbiter.displayName} (Arbiter)
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  @{selectedArbiter.username}
                </div>
                {selectedArbiter.primaryEthAddress && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    ETH: {selectedArbiter.primaryEthAddress}
                  </div>
                )}
                {selectedArbiter.primarySolanaAddress && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    SOL: {selectedArbiter.primarySolanaAddress}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Arbiter Fee
          </label>
          <div className="flex space-x-2">
            <Button
              type="button"
              onClick={() => handleArbiterFeeSelect(1)}
              className={`flex-1 py-2 px-3 text-sm ${
                arbiterFeePercent === 1 && !showCustomArbiterFee
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              1%
            </Button>
            <Button
              type="button"
              onClick={handleCustomArbiterFee}
              className={`flex-1 py-2 px-3 text-sm ${
                showCustomArbiterFee
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              Custom %
            </Button>
          </div>

          {showCustomArbiterFee && (
            <div className="mt-2 flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Enter percentage (0-100)"
                value={customArbiterFee}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (value >= 0 && value <= 100) {
                    setCustomArbiterFee(e.target.value);
                    setArbiterFeePercent(value);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                %
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Bet End Date
        </label>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => handleTimeOptionSelect("24h")}
              className={`py-2 px-3 text-sm ${
                selectedTimeOption === "24h"
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              24 hours
            </Button>
            <Button
              type="button"
              onClick={() => handleTimeOptionSelect("1week")}
              className={`py-2 px-3 text-sm ${
                selectedTimeOption === "1week"
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              1 week
            </Button>
            <Button
              type="button"
              onClick={() => handleTimeOptionSelect("1month")}
              className={`py-2 px-3 text-sm ${
                selectedTimeOption === "1month"
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              1 month
            </Button>
            <Button
              type="button"
              onClick={() => handleTimeOptionSelect("custom")}
              className={`py-2 px-3 text-sm ${
                selectedTimeOption === "custom"
                  ? "bg-purple-500 text-white"
                  : "bg-blue-100 dark:bg-blue-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              Custom
            </Button>
          </div>

          {showCustomInput && (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="365"
                placeholder="Enter days (1-365)"
                value={customDays}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value <= 365) {
                    setCustomDays(e.target.value);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                days
              </span>
            </div>
          )}

          {selectedTimeOption && endDateTimestamp > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Bet ends: {formatEndDate(endDateTimestamp)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Timestamp: {endDateTimestamp}
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        disabled={
          !isConnected ||
          !selectedUser ||
          !selectedToken ||
          !betAmount ||
          !selectedTimeOption ||
          (selectedTimeOption === "custom" && !customDays) ||
          isTransactionPending ||
          isApproving
        }
        onClick={handleCreateBet}
        isLoading={isTransactionPending || isApproving}
        className="w-full"
      >
        {!isConnected
          ? "Connect Wallet"
          : isApproving
            ? "Approving Tokens..."
            : isTransactionPending
              ? "Creating Bet..."
              : "Create Bet"}
      </Button>
    </div>
  );
}

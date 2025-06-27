"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { useSendTransaction, useAccount } from "wagmi";
import { encodeFunctionData } from "viem";
import {
  BET_MANAGEMENT_ENGINE_ABI,
  BET_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/contracts";

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

export default function CreateBet() {
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

  const { address, isConnected } = useAccount();
  const { sendTransaction, isPending: isTransactionPending } =
    useSendTransaction();

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

  useEffect(() => {
    if (searchTerm.length > 0) {
      searchUsers(searchTerm);
    } else {
      setUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

  const handleUserSelect = async (user: User) => {
    setSearchTerm(user.displayName);
    setShowDropdown(false);

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
    }
  };

  const handleInputFocus = () => {
    if (users.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => setShowDropdown(false), 200);
  };

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

  const handleCreateBet = async () => {
    if (!isConnected) {
      console.error("Wallet not connected");
      return;
    }

    if (!selectedUser || !selectedToken || !betAmount || !selectedTimeOption) {
      console.error("Missing required fields for bet creation");
      return;
    }

    const endTimestamp = getEndDateTimestamp();

    console.log("=== CREATE BET SUBMISSION ===");
    console.log(
      "Selected User Primary ETH Address:",
      selectedUser.primaryEthAddress || "Not available"
    );
    console.log(
      "Selected User Primary Solana Address:",
      selectedUser.primarySolanaAddress || "Not available"
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

      // Convert bet amount to wei (using token decimals)
      const decimals = selectedToken.decimals || 18;
      const betAmountWei = BigInt(
        Math.floor(parseFloat(betAmount) * Math.pow(10, decimals))
      );

      // Prepare the transaction parameters for createBet function
      const createBetParams = [
        selectedUser.primaryEthAddress as `0x${string}`, // _taker
        "0x0000000000000000000000000000000000000000" as `0x${string}`, // _arbiter (zero address)
        selectedToken.address as `0x${string}`, // _betTokenAddress (zero address for native ETH)
        betAmountWei, // _betAmount
        BigInt(endTimestamp), // _endTime
        BigInt(100), // _protocolFee
        BigInt(0), // _arbiterFee
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
        to: BET_MANAGEMENT_ENGINE_ADDRESS,
        data: encodedData,
      };

      console.log("Transaction object:", transaction);

      // Send the transaction
      sendTransaction(transaction, {
        onSuccess: (hash) => {
          console.log("Transaction sent successfully:", hash);
          // You can add success notification here
          // For example: toast.success(`Bet created! Transaction: ${hash}`);
        },
        onError: (error) => {
          console.error("Transaction failed:", error);
          // You can add error notification here
          // For example: toast.error(`Transaction failed: ${error.message}`);
        },
      });
    } catch (error) {
      console.error("Error creating bet:", error);
    }
  };

  const endDateTimestamp = getEndDateTimestamp();

  return (
    <div className="space-y-6 px-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-center">Create New Bet</h2>

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
                  onClick={() => handleUserSelect(user)}
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
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
            isTransactionPending
          }
          onClick={handleCreateBet}
          isLoading={isTransactionPending}
          className="w-full"
        >
          {!isConnected
            ? "Connect Wallet"
            : isTransactionPending
              ? "Creating Bet..."
              : "Create Bet"}
        </Button>
      </div>
    </div>
  );
}

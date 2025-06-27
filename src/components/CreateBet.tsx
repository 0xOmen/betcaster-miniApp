"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";

interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
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

  useEffect(() => {
    if (searchTerm.length > 0) {
      searchUsers(searchTerm);
    } else {
      setUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSearchTerm(user.displayName);
    setShowDropdown(false);
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
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>

        <Button
          disabled={!selectedUser || !selectedToken || !betAmount}
          className="w-full"
        >
          Create Bet
        </Button>
      </div>
    </div>
  );
}

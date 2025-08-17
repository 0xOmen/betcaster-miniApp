"use client";

import { useState, useEffect } from "react";
import { isAddress } from "viem";

interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
  verifiedEthAddresses?: string[];
}

interface UserOrAddressInputProps {
  label: string;
  placeholder: string;
  selectedUser: User | null;
  onUserSelect: (user: User | null) => void;
  onAddressSelect?: (address: string | null) => void;
  onFidChange?: (fid: number | null) => void;
  className?: string;
  disabled?: boolean;
  currentUserFid?: number | null;
}

export default function UserOrAddressInput({
  label,
  placeholder,
  selectedUser,
  onUserSelect,
  onAddressSelect,
  onFidChange,
  className = "",
  disabled = false,
  currentUserFid = null,
}: UserOrAddressInputProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);
  const [isUserSelected, setIsUserSelected] = useState(false);
  const [isAddressInput, setIsAddressInput] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Initialize search term with selected user's display name
  useEffect(() => {
    if (selectedUser) {
      setSearchTerm(selectedUser.displayName);
      setIsUserSelected(true);
      setIsAddressInput(false);
    } else {
      setIsUserSelected(false);
    }
  }, [selectedUser]);

  const validateEthereumAddress = (address: string): boolean => {
    return isAddress(address);
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      setShowDropdown(false);
      return;
    }

    // Check if input looks like an Ethereum address
    if (query.startsWith("0x") && query.length >= 42) {
      setIsAddressInput(true);
      setShowDropdown(false);

      if (validateEthereumAddress(query)) {
        setAddressError(null);
        if (onAddressSelect) {
          onAddressSelect(query);
        }
        if (onFidChange) {
          onFidChange(null); // Clear FID when using address
        }
      } else {
        setAddressError("Invalid Ethereum address");
        if (onAddressSelect) {
          onAddressSelect(null);
        }
      }
      return;
    } else {
      setIsAddressInput(false);
      setAddressError(null);
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/search-users?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log("API response:", data);

        // Filter out the current user from search results
        const filteredUsers = (data.users || []).filter(
          (user: User) => user.fid !== currentUserFid
        );

        setUsers(filteredUsers);
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

        // Extract all verified eth addresses
        const verifiedEthAddresses: string[] = [];

        // Add primary eth address first if it exists
        if (user.verified_addresses?.primary?.eth_address) {
          verifiedEthAddresses.push(
            user.verified_addresses.primary.eth_address
          );
        }

        // Add all other verified eth addresses (excluding the primary if it's already included)
        if (user.verified_addresses?.eth_addresses) {
          user.verified_addresses.eth_addresses.forEach((address: string) => {
            if (!verifiedEthAddresses.includes(address)) {
              verifiedEthAddresses.push(address);
            }
          });
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
          verifiedEthAddresses: verifiedEthAddresses,
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

  const handleUserSelect = async (user: User) => {
    setShowDropdown(false);
    setIsUserSelected(true);
    setIsAddressInput(false);
    setAddressError(null);

    // Call onFidChange if provided
    if (onFidChange) {
      onFidChange(user.fid);
    }

    // Clear address selection
    if (onAddressSelect) {
      onAddressSelect(null);
    }

    // Fetch detailed user information including wallet addresses
    const detailedUser = await fetchUserDetails(user.fid);
    if (detailedUser) {
      onUserSelect(detailedUser);
    } else {
      // Fallback to the basic user info if detailed fetch fails
      onUserSelect(user);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsUserSelected(false);

    if (!value.trim()) {
      onUserSelect(null);
      if (onFidChange) {
        onFidChange(null);
      }
      if (onAddressSelect) {
        onAddressSelect(null);
      }
      setIsAddressInput(false);
      setAddressError(null);
    }
  };

  const handleInputFocus = () => {
    if (users.length > 0 && !isUserSelected) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => setShowDropdown(false), 300);
  };

  useEffect(() => {
    // Only search if user is actively typing (not when a user was just selected)
    if (searchTerm.length > 0 && !isUserSelected) {
      searchUsers(searchTerm);
    } else if (searchTerm.length === 0) {
      setUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm, isUserSelected]);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
          addressError
            ? "border-red-500 dark:border-red-500"
            : isAddressInput
              ? "border-green-500 dark:border-green-500"
              : "border-gray-300 dark:border-gray-600"
        }`}
      />

      {isSearching && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
        </div>
      )}

      {addressError && (
        <div className="mt-1 text-sm text-red-500 dark:text-red-400">
          {addressError}
        </div>
      )}

      {isAddressInput && !addressError && (
        <div className="mt-1 text-sm text-green-500 dark:text-green-400">
          ✓ Valid Ethereum address
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

      {selectedUser && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
              {!isLoadingUserDetails && !selectedUser.primaryEthAddress && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  No Ethereum address found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddressInput && !addressError && searchTerm && (
        <div className="mt-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center border-2 border-green-200 dark:border-green-600">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-green-900 dark:text-green-100 truncate">
                Ethereum Address
              </div>
              <div className="text-sm text-green-700 dark:text-green-300 truncate font-mono">
                {searchTerm}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

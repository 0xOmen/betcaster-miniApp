"use client";

import { useState, useEffect } from "react";

interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

interface UserSearchDropdownProps {
  label: string;
  placeholder: string;
  selectedUser: User | null;
  onUserSelect: (user: User | null) => void;
  onFidChange?: (fid: number | null) => void;
  className?: string;
  disabled?: boolean;
}

export default function UserSearchDropdown({
  label,
  placeholder,
  selectedUser,
  onUserSelect,
  onFidChange,
  className = "",
  disabled = false,
}: UserSearchDropdownProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);

  // Initialize search term with selected user's display name
  useEffect(() => {
    if (selectedUser) {
      setSearchTerm(selectedUser.displayName);
    }
  }, [selectedUser]);

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

  const handleUserSelect = async (user: User) => {
    setSearchTerm(user.displayName);
    setShowDropdown(false);

    // Call onFidChange if provided
    if (onFidChange) {
      onFidChange(user.fid);
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
    setSearchTerm(e.target.value);
    if (!e.target.value.trim()) {
      onUserSelect(null);
      if (onFidChange) {
        onFidChange(null);
      }
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

  useEffect(() => {
    if (searchTerm.length > 0) {
      searchUsers(searchTerm);
    } else {
      setUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

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
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}

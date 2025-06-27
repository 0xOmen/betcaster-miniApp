"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";

interface User {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
}

export default function CreateBet() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

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
    setSearchTerm(user.display_name || user.username);
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
    // Delay hiding dropdown to allow for clicks
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
                    {user.pfp_url ? (
                      <img
                        src={user.pfp_url}
                        alt={user.display_name || user.username}
                        className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          // Fallback to a default avatar if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    {!user.pfp_url && (
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.display_name || user.username}
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
                {selectedUser.pfp_url ? (
                  <img
                    src={selectedUser.pfp_url}
                    alt={selectedUser.display_name || selectedUser.username}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      target.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                {!selectedUser.pfp_url && (
                  <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {selectedUser.display_name || selectedUser.username}
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
            Bet Amount (ETH)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.01"
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

        <Button disabled={!selectedUser} className="w-full">
          Create Bet
        </Button>
      </div>
    </div>
  );
}

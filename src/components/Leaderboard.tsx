/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";

interface LeaderboardEntry {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  total_bets: number;
  wins: number;
  losses: number;
  total_volume: number;
  pnl?: number;
  created_at?: string;
  updated_at?: string;
}

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    "total_bets" | "wins" | "total_volume" | "pnl"
  >("total_bets");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchLeaderboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leaderboard");
      if (response.ok) {
        const data = await response.json();
        setLeaderboardData(data.leaderboard || []);
      } else {
        setError("Failed to fetch leaderboard data");
      }
    } catch (err) {
      setError("Error fetching leaderboard data");
      console.error("Error fetching leaderboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const handleSort = (
    column: "total_bets" | "wins" | "total_volume" | "pnl"
  ) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const sortedData = [...leaderboardData].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case "total_bets":
        aValue = a.total_bets;
        bValue = b.total_bets;
        break;
      case "wins":
        aValue = a.wins;
        bValue = b.wins;
        break;
      case "total_volume":
        aValue = a.total_volume;
        bValue = b.total_volume;
        break;
      case "pnl":
        aValue = a.pnl || 0;
        bValue = b.pnl || 0;
        break;
      default:
        aValue = a.total_bets;
        bValue = b.total_bets;
    }

    if (sortOrder === "asc") {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return "↕️";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500 dark:text-gray-400">
          Loading leaderboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No leaderboard data available
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 w-full max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Leaderboard
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Top bettors ranked by performance
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort("total_bets")}
                >
                  Total Bets {getSortIcon("total_bets")}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort("wins")}
                >
                  Wins {getSortIcon("total_wins")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Losses
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort("pnl")}
                >
                  PNL {getSortIcon("pnl")}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort("total_volume")}
                >
                  Total Volume {getSortIcon("total_volume")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedData.map((entry, index) => (
                <tr
                  key={entry.fid}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {entry.pfp_url && (
                        <img
                          src={entry.pfp_url}
                          alt={entry.display_name || entry.username || "User"}
                          className="w-8 h-8 rounded-full mr-3"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.display_name ||
                            entry.username ||
                            `User ${entry.fid}`}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          FID: {entry.fid}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {entry.total_bets}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                    {entry.wins}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                    {entry.losses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {entry.pnl !== undefined && entry.pnl !== null ? (
                      <span
                        className={
                          entry.pnl >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        ${entry.pnl.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        N/A
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {entry.total_volume !== undefined &&
                    entry.total_volume !== null ? (
                      <span className="text-gray-900 dark:text-gray-100">
                        ${entry.total_volume.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        N/A
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Click column headers to sort by different metrics</p>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

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
  can_settle_early: boolean;
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

interface OpenBetsProps {
  onBetSelect: (bet: Bet) => void;
}

export default function OpenBets({ onBetSelect }: OpenBetsProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();

  const getTokenName = (tokenAddress: string): string => {
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      return "ETH";
    }
    // Add more token mappings as needed
    return "Token";
  };

  const formatEndTime = (timestamp: number): string => {
    if (timestamp === 0) return "Invalid date";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const fetchOpenBets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bets?status=0");
      if (response.ok) {
        const data = await response.json();

        // Filter for bets with null taker address and end time not passed
        const currentTime = Math.floor(Date.now() / 1000);
        const openBets = data.bets.filter(
          (bet: Bet) =>
            bet.taker_address ===
              "0x0000000000000000000000000000000000000000" &&
            bet.end_time > currentTime
        );

        // Sort by newest first (highest timestamp)
        const sortedBets = openBets.sort(
          (a: Bet, b: Bet) => b.timestamp - a.timestamp
        );

        setBets(sortedBets);
      } else {
        setError("Failed to fetch open bets");
      }
    } catch (err) {
      setError("Error fetching open bets");
      console.error("Error fetching open bets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenBets();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500 dark:text-gray-400">
          Loading open bets...
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

  if (bets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No open bets available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Open Bets ({bets.length})
      </div>

      <div className="grid gap-4">
        {bets.map((bet) => (
          <div
            key={bet.bet_number}
            onClick={() => onBetSelect(bet)}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Bet #{bet.bet_number}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatEndTime(bet.end_time)}
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {bet.bet_agreement && bet.bet_agreement.length > 50
                ? `${bet.bet_agreement.substring(0, 50)}...`
                : bet.bet_agreement || "No description"}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">Maker:</span>{" "}
                {bet.makerProfile?.display_name ||
                  bet.makerProfile?.username ||
                  "Unknown"}
              </div>
              <div>
                <span className="font-medium">Amount:</span> {bet.bet_amount}{" "}
                {getTokenName(bet.bet_token_address)}
              </div>
            </div>

            {bet.arbiterProfile && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-medium">Arbiter:</span>{" "}
                {bet.arbiterProfile.display_name ||
                  bet.arbiterProfile.username ||
                  "Unknown"}
              </div>
            )}

            <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">Protocol Fee:</span>{" "}
                {bet.protocol_fee}%
              </div>
              <div>
                <span className="font-medium">Arbiter Fee:</span>{" "}
                {bet.arbiter_fee}%
              </div>
            </div>

            {bet.can_settle_early && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Early Settlement Enabled
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

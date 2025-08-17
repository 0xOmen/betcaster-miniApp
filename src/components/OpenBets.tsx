/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { amountToWei, getTokenByAddress } from "~/lib/tokens";
import { fetchUserWithCache } from "./Demo";
import { useBetActions } from "~/hooks/useBetActions";
import { type Bet } from "~/types/bet";
import { notifyInviteArbiter } from "~/lib/notificationUtils";

interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
  verifiedEthAddresses?: string[]; // Add this new field
}

interface BetWithProfiles extends Bet {
  makerProfile?: UserProfile | null;
  takerProfile?: UserProfile | null;
  arbiterProfile?: UserProfile | null;
}

interface OpenBetsProps {
  onBetSelect: (bet: BetWithProfiles) => void;
}

export default function OpenBets({ onBetSelect }: OpenBetsProps) {
  const [bets, setBets] = useState<BetWithProfiles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBet, setSelectedBet] = useState<BetWithProfiles | null>(null);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);

  const { address, isConnected } = useAccount();

  const { isApproving, isAccepting, handleAcceptBet, acceptTxHash } =
    useBetActions({
      onSuccess: async () => {
        console.log("Bet accepted successfully!");
        setShowApprovalSuccess(true);

        // Update database to mark bet as accepted
        if (selectedBet && acceptTxHash) {
          try {
            // Look up taker's FID using their address
            let takerFid = null;
            if (address) {
              try {
                const takerRes = await fetch(`/api/users?address=${address}`);
                if (takerRes?.ok) {
                  const takerData = await takerRes.json();
                  takerFid = takerData.users?.[0]?.fid || null;
                  console.log("Found taker FID:", takerFid);
                }
              } catch (error) {
                console.error("Error looking up taker FID:", error);
              }
            }

            const updateResponse = await fetch(
              `/api/bets?betNumber=${selectedBet.bet_number}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  status: 1,
                  transaction_hash: acceptTxHash,
                  taker_address: [address],
                  taker_fid: takerFid,
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
                      tokenName: getTokenName(selectedBet.bet_token_address),
                      makerName:
                        selectedBet.makerProfile?.display_name ||
                        selectedBet.makerProfile?.username,
                      takerName: "You", // Since the current user is the taker
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
        }

        setTimeout(() => {
          setShowApprovalSuccess(false);
          fetchOpenBets(); // Refresh the bets list
        }, 3000);
      },
      onError: (error) => {
        console.error("Error accepting bet:", error);
      },
    });

  const getTokenName = (tokenAddress: string): string => {
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      return "ETH";
    }
    const token = getTokenByAddress(tokenAddress);
    return token?.symbol || "Token";
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
          (bet: BetWithProfiles) =>
            (bet.taker_address.length === 0 ||
              (bet.taker_address.length === 1 &&
                bet.taker_address[0] ===
                  "0x0000000000000000000000000000000000000000")) &&
            bet.end_time > currentTime
        );

        // Sort by newest first (highest timestamp)
        const sortedBets = openBets.sort(
          (a: BetWithProfiles, b: BetWithProfiles) => b.timestamp - a.timestamp
        );

        // Fetch user profiles for all bets
        const betsWithProfiles = await Promise.all(
          sortedBets.map(async (bet: BetWithProfiles) => {
            const [makerProfile, arbiterProfile] = await Promise.all([
              bet.maker_fid
                ? fetchUserWithCache(bet.maker_fid)
                : Promise.resolve(null),
              bet.arbiter_fid
                ? fetchUserWithCache(bet.arbiter_fid)
                : Promise.resolve(null),
            ]);
            return { ...bet, makerProfile, arbiterProfile };
          })
        );

        setBets(betsWithProfiles);
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

  const handleAcceptBetClick = async (bet: BetWithProfiles) => {
    setSelectedBet(bet);
    await handleAcceptBet(bet);
  };

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
    <div className="space-y-2">
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Open Bets ({bets.length})
      </div>

      <div className="grid gap-2">
        {bets.map((bet) => (
          <div
            key={bet.bet_number}
            className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Bet #{bet.bet_number}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatEndTime(bet.end_time)}
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {bet.bet_agreement && bet.bet_agreement.length > 100
                ? `${bet.bet_agreement.substring(0, 100)}...`
                : bet.bet_agreement || "No description"}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
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
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span className="font-medium">Arbiter:</span>{" "}
                {bet.arbiterProfile.display_name ||
                  bet.arbiterProfile.username ||
                  "Unknown"}
              </div>
            )}

            <div className="flex items-center justify-between mb-1 text-xs text-gray-500 dark:text-gray-400">
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
              <div className="mb-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Early Settlement Enabled
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-2">
              <button
                onClick={() => onBetSelect(bet)}
                className="flex-1 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                View Details
              </button>
              <button
                onClick={() => handleAcceptBetClick(bet)}
                disabled={!isConnected || isApproving || isAccepting}
                className="flex-1 px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving && selectedBet?.bet_number === bet.bet_number
                  ? "Approving..."
                  : isAccepting && selectedBet?.bet_number === bet.bet_number
                    ? "Accepting..."
                    : "Accept Bet"}
              </button>
            </div>

            {/* Approval Success Message */}
            {showApprovalSuccess &&
              selectedBet?.bet_number === bet.bet_number && (
                <div className="mt-1 p-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                  ✅ Token approval successful!
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

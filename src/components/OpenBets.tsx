/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { base } from "wagmi/chains";
import { encodeFunctionData } from "viem";
import {
  BET_MANAGEMENT_ENGINE_ABI,
  BET_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/contracts";
import { BETCASTER_ADDRESS } from "~/lib/betcasterAbi";
import { ERC20_ABI } from "~/lib/erc20Abi";
import { amountToWei } from "~/lib/tokens";

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
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [acceptTxHash, setAcceptTxHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  // Read allowance for the selected bet's token
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedBet?.bet_token_address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, BETCASTER_ADDRESS],
    query: {
      enabled:
        !!selectedBet?.bet_token_address &&
        !!address &&
        selectedBet.bet_token_address !==
          "0x0000000000000000000000000000000000000000",
    },
  });

  // Wait for approval transaction receipt
  const { data: approvalReceipt, isSuccess: isApprovalReceiptSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalTxHash,
    });

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
        setIsApproving(false);
        setShowApprovalSuccess(true);

        // Hide success message after 3 seconds
        setTimeout(() => {
          setShowApprovalSuccess(false);
        }, 3000);

        // Refetch allowance after successful approval
        setTimeout(() => {
          refetchAllowance();

          // Automatically trigger bet acceptance after approval
          if (selectedBet) {
            console.log("Auto-triggering bet acceptance after approval");
            handleAcceptBetAfterApproval();
          }
        }, 1000);
      }
    }
  }, [
    approvalReceipt,
    isApprovalReceiptSuccess,
    refetchAllowance,
    selectedBet,
  ]);

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

  const handleAcceptBet = async (bet: Bet) => {
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

    setSelectedBet(bet);

    // Check token allowance for ERC20 tokens (skip for native ETH)
    if (
      bet.bet_token_address !== "0x0000000000000000000000000000000000000000"
    ) {
      const betAmountWei = amountToWei(bet.bet_amount, bet.bet_token_address);

      if (!allowance || allowance < betAmountWei) {
        console.log("Insufficient token allowance. Requesting approval...");

        try {
          setIsApproving(true);
          const hash = await writeApproveAsync({
            address: bet.bet_token_address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BETCASTER_ADDRESS, betAmountWei],
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

    // If no approval needed, proceed directly to bet acceptance
    await handleAcceptBetAfterApproval();
  };

  const handleAcceptBetAfterApproval = async () => {
    if (!selectedBet || !isConnected) {
      console.error("Cannot accept bet: not connected or no bet selected");
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

    try {
      setIsAccepting(true);
      console.log("Accepting bet #", selectedBet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "acceptBet",
        args: [BigInt(selectedBet.bet_number)],
      });

      console.log("Encoded accept transaction data:", encodedData);

      // For now, we'll just show a success message since we don't have sendTransaction here
      // In a real implementation, you'd use sendTransaction from the parent component
      console.log("Bet acceptance transaction prepared");
      setIsAccepting(false);

      // You might want to trigger a callback to the parent component here
      // to handle the actual transaction sending
    } catch (error) {
      console.error("Error accepting bet:", error);
      setIsAccepting(false);
    }
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
                onClick={() => handleAcceptBet(bet)}
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

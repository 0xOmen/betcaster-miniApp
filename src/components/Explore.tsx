/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { BETCASTER_ABI, BETCASTER_ADDRESS } from "~/lib/betcasterAbi";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

interface ExploreProps {
  userFid: number | null;
}

// Using the same Bet interface from Demo.tsx
interface Bet {
  bet_number: number;
  maker_address: string;
  taker_address: string;
  arbiter_address: string | null;
  bet_token_address: string;
  bet_amount: number;
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

// Using the same UserProfile interface from Demo.tsx
interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

// Create a public client for Base blockchain
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export default function Explore({ userFid }: ExploreProps) {
  const [betNumber, setBetNumber] = useState<string>("");
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBetFromBlockchain = async (betNumber: number) => {
    console.log("🔍 Fetching bet from blockchain:", betNumber);
    try {
      const blockchainBet = await publicClient.readContract({
        address: BETCASTER_ADDRESS,
        abi: BETCASTER_ABI,
        functionName: "getBet",
        args: [BigInt(betNumber)],
      });

      console.log("📦 Blockchain bet data:", blockchainBet);

      // Convert blockchain data to our Bet interface format
      const bet: Bet = {
        bet_number: betNumber,
        maker_address: blockchainBet.maker.toLowerCase(),
        taker_address: blockchainBet.taker.toLowerCase(),
        arbiter_address: blockchainBet.arbiter.toLowerCase(),
        bet_token_address: blockchainBet.betTokenAddress.toLowerCase(),
        bet_amount: Number(blockchainBet.betAmount),
        timestamp: Number(blockchainBet.timestamp),
        end_time: Number(blockchainBet.endTime),
        status: blockchainBet.status,
        protocol_fee: Number(blockchainBet.protocolFee),
        arbiter_fee: Number(blockchainBet.arbiterFee),
        bet_agreement: blockchainBet.betAgreement,
        transaction_hash: null,
      };

      // Store bet in database
      const storeResponse = await fetch("/api/bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bet }),
      });

      if (!storeResponse.ok) {
        console.error("Failed to store bet in database");
      }

      return bet;
    } catch (error) {
      console.error("Error fetching bet from blockchain:", error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    console.log("🔍 Searching for bet number:", betNumber);

    try {
      // Try to get bet from database
      const apiUrl = `/api/bets?betNumber=${betNumber}`;
      console.log("📡 Making API request to:", apiUrl);

      const response = await fetch(apiUrl);
      const data = await response.json();

      let foundBet = data.bets?.find(
        (bet: Bet) => bet.bet_number === parseInt(betNumber)
      );

      if (!foundBet) {
        console.log("🔗 Bet not found in database, checking blockchain...");
        foundBet = await fetchBetFromBlockchain(parseInt(betNumber));
      }

      if (foundBet) {
        console.log("✅ Found bet:", foundBet);
        setSelectedBet(foundBet);
        setIsModalOpen(true);
      } else {
        setError("Bet not found");
      }
    } catch (error) {
      console.error("❌ Error in handleSubmit:", error);
      setError(
        error instanceof Error ? error.message : "Error fetching bet details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBet(null);
  };

  // Helper function to format end time
  const formatEndTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date
      .toLocaleString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  };

  // Helper function to get status info
  const getStatusInfo = (bet: Bet) => {
    const now = Math.floor(Date.now() / 1000);

    switch (bet.status) {
      case 0:
        return {
          text: "Pending Acceptance",
          bgColor:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        };
      case 1:
        return {
          text: "Pending Arbiter",
          bgColor:
            "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
        };
      case 2:
        return {
          text: now > bet.end_time ? "Awaiting Arbiter" : "Active",
          bgColor:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      case 4:
        return {
          text: "Maker Won",
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      case 7:
        return {
          text: "Taker Won",
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      case 8:
        return {
          text: "Cancelled/Refunded",
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
      case 9:
        return {
          text: "Rejected",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      default:
        return {
          text: "Unknown",
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
    }
  };

  return (
    <div className="space-y-6 px-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-center">Explore Bets</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter Bet Number
          </label>
          <input
            type="number"
            value={betNumber}
            onChange={(e) => setBetNumber(e.target.value)}
            placeholder="Enter bet number..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <Button
          type="submit"
          disabled={!betNumber || isLoading}
          className="w-full"
        >
          {isLoading ? "Searching..." : "Explore Bet"}
        </Button>
      </form>

      {/* Bet Details Modal */}
      {isModalOpen && selectedBet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Bet #{selectedBet.bet_number}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                <div
                  className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                    getStatusInfo(selectedBet).bgColor
                  }`}
                >
                  {getStatusInfo(selectedBet).text}
                </div>
              </div>

              {/* Bet Agreement */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bet Agreement
                </h3>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedBet.bet_agreement || "No description provided"}
                  </p>
                </div>
              </div>

              {/* Participants */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Participants
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Maker:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedBet.makerProfile?.display_name ||
                        selectedBet.makerProfile?.username ||
                        "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Taker:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedBet.takerProfile?.display_name ||
                        selectedBet.takerProfile?.username ||
                        "Unknown"}
                    </span>
                  </div>
                  {selectedBet.arbiterProfile && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Arbiter:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedBet.arbiterProfile.display_name ||
                          selectedBet.arbiterProfile.username}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bet Details */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bet Details
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Wager:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedBet.bet_amount}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      End Time:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatEndTime(selectedBet.end_time)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

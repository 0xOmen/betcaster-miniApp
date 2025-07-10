/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FC } from "react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";
import { type Bet } from "~/types/bet";
import { BetCard } from "./BetCard";
import { BetDetailsModal } from "./BetDetailsModal";
import { useBets } from "~/hooks/useBets";
import { useBetActions } from "~/hooks/useBetActions";

export const Explore: FC = () => {
  const [searchBetNumber, setSearchBetNumber] = useState("");
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const { address } = useAccount();
  const { context } = useMiniApp();
  const { userBets, isLoadingBets, refreshBets, updateBetStatus } = useBets();
  const {
    isApproving,
    isAccepting,
    isCancelling,
    isForfeiting,
    isClaiming,
    isAcceptingArbiter,
    approvalTxHash,
    acceptTxHash,
    cancelTxHash,
    forfeitTxHash,
    claimTxHash,
    acceptArbiterTxHash,
    handleAcceptBet,
    handleCancelBet,
    handleForfeitBet,
    handleClaimWinnings,
    handleAcceptArbiterRole,
    handleSelectWinner,
  } = useBetActions({
    onSuccess: refreshBets,
  });

  const handleSearch = async () => {
    if (!searchBetNumber) return;

    try {
      const response = await fetch(`/api/bets?betNumber=${searchBetNumber}`);
      if (response.ok) {
        const data = await response.json();
        if (data.bets && data.bets.length > 0) {
          setSelectedBet(data.bets[0]);
        } else {
          console.log("No bet found with that number");
        }
      }
    } catch (error) {
      console.error("Error searching for bet:", error);
    }
  };

  const handleBetSelect = (bet: Bet) => {
    setSelectedBet(bet);
  };

  const handleModalClose = () => {
    setSelectedBet(null);
    setShowApprovalSuccess(false);
  };

  const handleShare = async (bet: Bet) => {
    if (!context?.client) return;

    console.log("🔍 Sharing bet:", bet);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Explore Bets
        </h1>
        <div className="flex gap-4">
          <input
            type="number"
            value={searchBetNumber}
            onChange={(e) => setSearchBetNumber(e.target.value)}
            placeholder="Enter bet number"
            className="w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {selectedBet && (
        <BetDetailsModal
          bet={selectedBet}
          currentUserAddress={address}
          currentUserFid={context?.user?.fid}
          isOpen={true}
          onClose={handleModalClose}
          onShare={() => handleShare(selectedBet)}
          onCancel={() => handleCancelBet(selectedBet)}
          onAccept={() => handleAcceptBet(selectedBet)}
          onForfeit={() => handleForfeitBet(selectedBet)}
          onClaimWinnings={() => handleClaimWinnings(selectedBet)}
          onAcceptArbiter={() => handleAcceptArbiterRole(selectedBet)}
          isApproving={isApproving}
          isAccepting={isAccepting}
          isCancelling={isCancelling}
          isForfeiting={isForfeiting}
          isClaiming={isClaiming}
          isAcceptingArbiter={isAcceptingArbiter}
          showApprovalSuccess={showApprovalSuccess}
        />
      )}
    </div>
  );
};

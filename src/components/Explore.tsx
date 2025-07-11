/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FC } from "react";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";
import { type Bet } from "~/types/bet";
import { BetCard } from "./BetCard";
import { BetDetailsModal } from "./BetDetailsModal";
import { useBets } from "~/hooks/useBets";
import { useBetActions } from "~/hooks/useBetActions";
import { BETCASTER_ABI, BETCASTER_ADDRESS } from "~/lib/betcasterAbi";
import { useContractRead } from "wagmi";
import { getTokenByAddress, weiToAmount } from "~/lib/tokens";

export const Explore: FC = () => {
  const [searchBetNumber, setSearchBetNumber] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
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

  // Add useEffect to check for bet number in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const betNumberFromUrl = urlParams.get("betNumber");
    if (betNumberFromUrl) {
      setSearchBetNumber(betNumberFromUrl);
      // Trigger search automatically
      handleSearch(betNumberFromUrl);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Setup contract read for getBet
  const { data: betFromChain, refetch: refetchBet } = useContractRead({
    address: BETCASTER_ADDRESS,
    abi: BETCASTER_ABI,
    functionName: "getBet",
    args: searchBetNumber ? [BigInt(searchBetNumber)] : undefined,
    query: {
      enabled: false, // Move enabled into query object
    },
  });

  // Modify handleSearch to optionally accept a bet number parameter
  const handleSearch = async (forcedBetNumber?: string) => {
    const betNumberToSearch = forcedBetNumber || searchBetNumber;
    if (!betNumberToSearch) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      // First try database
      const response = await fetch(`/api/bets?betNumber=${betNumberToSearch}`);
      if (response.ok) {
        const data = await response.json();
        if (data.bets && data.bets.length > 0) {
          const dbBet = data.bets[0];

          // Fetch profiles for maker, taker, and arbiter
          const [makerRes, takerRes, arbiterRes] = await Promise.all([
            fetch(`/api/users?address=${dbBet.maker_address}`),
            dbBet.taker_address
              ? fetch(`/api/users?address=${dbBet.taker_address}`)
              : Promise.resolve(null),
            dbBet.arbiter_address
              ? fetch(`/api/users?address=${dbBet.arbiter_address}`)
              : Promise.resolve(null),
          ]);

          let makerProfile = null,
            takerProfile = null,
            arbiterProfile = null;

          if (makerRes?.ok) {
            const makerData = await makerRes.json();
            makerProfile = makerData.users?.[0] || null;
          }
          if (takerRes?.ok) {
            const takerData = await takerRes.json();
            takerProfile = takerData.users?.[0] || null;
          }
          if (arbiterRes?.ok) {
            const arbiterData = await arbiterRes.json();
            arbiterProfile = arbiterData.users?.[0] || null;
          }

          setSelectedBet({
            ...dbBet,
            makerProfile,
            takerProfile,
            arbiterProfile,
          });
          setIsSearching(false);
          return;
        }
      }

      // If not found in database, try blockchain
      const { data: chainBet } = await refetchBet();
      console.log("Blockchain bet data:", chainBet);

      if (
        chainBet &&
        chainBet.maker !== "0x0000000000000000000000000000000000000000"
      ) {
        // Try to fetch FIDs for addresses
        let makerFid = null,
          takerFid = null,
          arbiterFid = null;
        let makerProfile = null,
          takerProfile = null,
          arbiterProfile = null;

        try {
          // Fetch FIDs for all addresses in parallel
          const [makerRes, takerRes, arbiterRes] = await Promise.all([
            fetch(`/api/users?address=${chainBet.maker}`),
            chainBet.taker !== "0x0000000000000000000000000000000000000000"
              ? fetch(`/api/users?address=${chainBet.taker}`)
              : Promise.resolve(null),
            chainBet.arbiter !== "0x0000000000000000000000000000000000000000"
              ? fetch(`/api/users?address=${chainBet.arbiter}`)
              : Promise.resolve(null),
          ]);

          if (makerRes?.ok) {
            const makerData = await makerRes.json();
            makerFid = makerData.users?.[0]?.fid || null;
            // Add the profile information
            makerProfile = makerData.users?.[0] || null;
            console.log("Maker profile:", makerProfile);
          }
          if (takerRes?.ok) {
            const takerData = await takerRes.json();
            takerFid = takerData.users?.[0]?.fid || null;
            // Add the profile information
            takerProfile = takerData.users?.[0] || null;
          }
          if (arbiterRes?.ok) {
            const arbiterData = await arbiterRes.json();
            arbiterFid = arbiterData.users?.[0]?.fid || null;
            // Add the profile information
            arbiterProfile = arbiterData.users?.[0] || null;
          }

          console.log("Found FIDs:", {
            maker: makerFid || chainBet.maker,
            taker: takerFid || chainBet.taker,
            arbiter: arbiterFid || chainBet.arbiter,
          });
        } catch (error) {
          console.error("Error fetching FIDs:", error);
        }

        // Convert bet amount using token decimals
        const betAmountFormatted = weiToAmount(
          BigInt(chainBet.betAmount.toString()),
          chainBet.betTokenAddress
        );

        // Transform blockchain data to match our Bet type
        const transformedBet = {
          bet_number: parseInt(betNumberToSearch),
          maker_address: chainBet.maker,
          taker_address: chainBet.taker,
          arbiter_address: chainBet.arbiter,
          bet_token_address: chainBet.betTokenAddress,
          bet_amount: betAmountFormatted, // This is the only change we keep
          timestamp: Number(chainBet.timestamp),
          end_time: Number(chainBet.endTime),
          status: Number(chainBet.status),
          protocol_fee: Number(chainBet.protocolFee),
          arbiter_fee: Number(chainBet.arbiterFee),
          bet_agreement: chainBet.betAgreement,
          transaction_hash: null,
          maker_fid: makerFid,
          taker_fid: takerFid,
          arbiter_fid: arbiterFid,
          makerProfile: makerProfile,
          takerProfile: takerProfile,
          arbiterProfile: arbiterProfile,
        } as Bet;

        setSelectedBet(transformedBet);
      } else {
        setSearchError(`No bet found with number ${betNumberToSearch}`);
      }
    } catch (error) {
      console.error("Error searching for bet:", error);
      setSearchError("Error occurred while searching");
    } finally {
      setIsSearching(false);
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
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?betNumber=${bet.bet_number}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Betcaster - Bet #${bet.bet_number}`,
          text: `Check out this bet on Betcaster!`,
          url: shareUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Share link copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Explore Bets
        </h1>
        <div className="flex w-full gap-4">
          <div className="flex-grow">
            <input
              type="number"
              value={searchBetNumber}
              onChange={(e) => setSearchBetNumber(e.target.value)}
              placeholder="Enter bet number"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className={`px-6 py-2 bg-purple-500 text-white rounded-lg transition-colors ${
              isSearching
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-purple-600"
            }`}
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
        {searchError && <p className="mt-2 text-red-500">{searchError}</p>}
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

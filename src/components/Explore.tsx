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
import { calculateUSDValue, useTokenPrice } from "~/lib/prices";
import { useContractRead } from "wagmi";
import { getTokenByAddress, weiToAmount } from "~/lib/tokens";

export const Explore: FC = () => {
  const [searchBetNumber, setSearchBetNumber] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [recentBets, setRecentBets] = useState<Bet[]>([]);
  const [isLoadingRecentBets, setIsLoadingRecentBets] = useState(false);
  const [blockchainBet, setBlockchainBet] = useState<{
    maker: string;
    taker: string[];
    arbiter: string[] | null;
    betTokenAddress: string;
    betAmount: bigint;
    timestamp: bigint;
    endTime: bigint;
    status: number;
    protocolFee: bigint;
    arbiterFee: bigint;
    betAgreement: string;
  } | null>(null); // Add state for blockchain bet
  const [isAddingToDb, setIsAddingToDb] = useState(false); // Add loading state
  const [isRefreshingFromChain, setIsRefreshingFromChain] = useState(false); // Add loading state for refresh
  const { address } = useAccount();

  // Get token price for selected bet
  const { data: tokenPriceData } = useTokenPrice(
    selectedBet?.bet_token_address
  );
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
    handleAcceptArbiterRole: originalHandleAcceptArbiterRole,
    handleSelectWinner,
  } = useBetActions({
    onSuccess: refreshBets,
  });

  // Custom handler for accepting arbiter role that includes leaderboard update
  const handleAcceptArbiterRole = async (bet: Bet) => {
    try {
      // Call the original handler from the hook
      await originalHandleAcceptArbiterRole(bet);

      // After successful transaction, update database and leaderboard
      setTimeout(async () => {
        try {
          // Update database to mark bet as arbiter accepted
          const updateResponse = await fetch(
            `/api/bets?betNumber=${bet.bet_number}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                status: 2,
                transaction_hash: acceptArbiterTxHash,
              }),
            }
          );

          if (!updateResponse.ok) {
            console.error("Failed to update bet status in database");
          } else {
            console.log("Bet status updated to arbiter accepted in database");

            // Calculate USD volume for leaderboard update
            const usdVolume = tokenPriceData?.[0]
              ? calculateUSDValue(bet.bet_amount, Number(tokenPriceData[0]))
              : 0;

            // Update leaderboard for maker and taker
            try {
              const leaderboardUpdateResponse = await fetch(
                "/api/leaderboard",
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    maker_fid: bet.maker_fid,
                    taker_fid: bet.taker_fid,
                    usd_volume: usdVolume,
                  }),
                }
              );

              if (leaderboardUpdateResponse.ok) {
                console.log(
                  "Leaderboard updated successfully for maker and taker in Explore"
                );
              } else {
                console.error("Failed to update leaderboard in Explore");
              }
            } catch (leaderboardError) {
              console.error(
                "Error updating leaderboard in Explore:",
                leaderboardError
              );
            }
          }
        } catch (error) {
          console.error("Error updating database and leaderboard:", error);
        }
      }, 2000); // Wait 2 seconds for transaction to be processed
    } catch (error) {
      console.error("Error in custom handleAcceptArbiterRole:", error);
    }
  };

  // Add useEffect to check for bet number in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const betNumberFromUrl = urlParams.get("betNumber");
    if (betNumberFromUrl) {
      setSearchBetNumber(betNumberFromUrl);
      // Trigger search automatically with a small delay to ensure component is fully mounted
      setTimeout(() => {
        handleSearch(betNumberFromUrl);
      }, 100);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Fetch recent bets on component mount
  useEffect(() => {
    fetchRecentBets();
  }, []);

  // Function to fetch recent bets
  const fetchRecentBets = async () => {
    setIsLoadingRecentBets(true);
    try {
      const response = await fetch("/api/bets?limit=5&exclude=1000000");
      if (response.ok) {
        const data = await response.json();
        if (data.bets) {
          // Fetch profiles for all bets in parallel
          const betsWithProfiles = await Promise.all(
            data.bets.map(async (bet: Bet) => {
              const [makerRes, takerRes, arbiterRes] = await Promise.all([
                fetch(`/api/users?address=${bet.maker_address}`),
                bet.taker_address
                  ? fetch(`/api/users?address=${bet.taker_address}`)
                  : Promise.resolve(null),
                bet.arbiter_address
                  ? fetch(`/api/users?address=${bet.arbiter_address}`)
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

              return {
                ...bet,
                makerProfile,
                takerProfile,
                arbiterProfile,
              };
            })
          );
          setRecentBets(betsWithProfiles);
        }
      } else {
        console.error("Failed to fetch recent bets");
      }
    } catch (error) {
      console.error("Error fetching recent bets:", error);
    } finally {
      setIsLoadingRecentBets(false);
    }
  };

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

  // Add function to refresh bet from blockchain
  const handleRefreshFromChain = async () => {
    if (!selectedBet) return;

    setIsRefreshingFromChain(true);
    try {
      // Fetch latest data from blockchain
      const { data: chainBet } = await refetchBet();
      console.log("Refreshed blockchain bet data:", chainBet);

      if (
        chainBet &&
        chainBet.maker !== "0x0000000000000000000000000000000000000000"
      ) {
        // Convert bet amount using token decimals
        const betAmountFormatted = weiToAmount(
          BigInt(chainBet.betAmount.toString()),
          chainBet.betTokenAddress
        );

        // Prepare updated bet data for database
        const updatedBetData = {
          bet_number: selectedBet.bet_number,
          maker_address: chainBet.maker,
          taker_address: Array.isArray(chainBet.taker)
            ? chainBet.taker
            : [chainBet.taker], // Ensure it's an array
          arbiter_address: chainBet.arbiter
            ? Array.isArray(chainBet.arbiter)
              ? chainBet.arbiter
              : [chainBet.arbiter]
            : null, // Ensure it's an array or null
          bet_token_address: chainBet.betTokenAddress,
          bet_amount: betAmountFormatted,
          timestamp: Number(chainBet.timestamp),
          end_time: Number(chainBet.endTime),
          status: Number(chainBet.status),
          protocol_fee: Number(chainBet.protocolFee) / 100, // Convert from basis points
          arbiter_fee: Number(chainBet.arbiterFee) / 100, // Convert from basis points
          bet_agreement: chainBet.betAgreement,
          can_settle_early: chainBet.canSettleEarly,
        };

        // Update the bet in the database
        const response = await fetch(
          `/api/bets?betNumber=${selectedBet.bet_number}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedBetData),
          }
        );

        if (response.ok) {
          // Refresh the search to show the updated bet
          await handleSearch(selectedBet.bet_number.toString());
          console.log("Bet refreshed from blockchain successfully");
        } else {
          const errorData = await response.json();
          console.error("Failed to refresh bet from blockchain:", errorData);
          alert("Failed to refresh bet from blockchain");
        }
      } else {
        alert("No valid bet found on blockchain");
      }
    } catch (error) {
      console.error("Error refreshing bet from blockchain:", error);
      alert("Error refreshing bet from blockchain");
    } finally {
      setIsRefreshingFromChain(false);
    }
  };

  // Add function to add blockchain bet to database
  const handleAddToDatabase = async () => {
    if (!blockchainBet) return;

    setIsAddingToDb(true);
    try {
      // Convert bet amount using token decimals
      const betAmountFormatted = weiToAmount(
        BigInt(blockchainBet.betAmount.toString()),
        blockchainBet.betTokenAddress
      );

      // Prepare bet data for database
      const betData = {
        bet_number: parseInt(searchBetNumber),
        maker_address: blockchainBet.maker,
        taker_address: Array.isArray(blockchainBet.taker)
          ? blockchainBet.taker
          : [blockchainBet.taker], // Ensure it's an array
        arbiter_address: blockchainBet.arbiter
          ? Array.isArray(blockchainBet.arbiter)
            ? blockchainBet.arbiter
            : [blockchainBet.arbiter]
          : null, // Ensure it's an array or null
        bet_token_address: blockchainBet.betTokenAddress,
        bet_amount: betAmountFormatted,
        timestamp: Number(blockchainBet.timestamp),
        end_time: Number(blockchainBet.endTime),
        status: Number(blockchainBet.status),
        protocol_fee: Number(blockchainBet.protocolFee) / 100, // Convert from basis points
        arbiter_fee: Number(blockchainBet.arbiterFee) / 100, // Convert from basis points
        bet_agreement: blockchainBet.betAgreement,
        transaction_hash: null,
        maker_fid: null,
        taker_fid: null,
        arbiter_fid: null,
      };

      const response = await fetch("/api/bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(betData),
      });

      if (response.ok) {
        // Refresh the search to show the newly added bet
        await handleSearch();
        setBlockchainBet(null); // Clear blockchain bet state
      } else {
        const errorData = await response.json();
        console.error("Failed to add bet to database:", errorData);
        alert("Failed to add bet to database");
      }
    } catch (error) {
      console.error("Error adding bet to database:", error);
      alert("Error adding bet to database");
    } finally {
      setIsAddingToDb(false);
    }
  };

  // Modify handleSearch to store blockchain bet data
  const handleSearch = async (forcedBetNumber?: string) => {
    const betNumberToSearch = forcedBetNumber || searchBetNumber;
    if (!betNumberToSearch) return;

    setIsSearching(true);
    setSearchError(null);
    setBlockchainBet(null); // Reset blockchain bet state

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
        // Store blockchain bet data for potential database addition
        setBlockchainBet({
          ...chainBet,
          taker: [...chainBet.taker],
          arbiter: chainBet.arbiter ? [...chainBet.arbiter] : null,
        });

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
            chainBet.taker &&
            chainBet.taker.length > 0 &&
            chainBet.taker[0] !== "0x0000000000000000000000000000000000000000"
              ? fetch(`/api/users?address=${chainBet.taker[0]}`)
              : Promise.resolve(null),
            chainBet.arbiter &&
            chainBet.arbiter.length > 0 &&
            chainBet.arbiter[0] !== "0x0000000000000000000000000000000000000000"
              ? fetch(`/api/users?address=${chainBet.arbiter[0]}`)
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
            taker:
              takerFid ||
              (chainBet.taker && chainBet.taker.length > 0
                ? chainBet.taker[0]
                : null),
            arbiter:
              arbiterFid ||
              (chainBet.arbiter && chainBet.arbiter.length > 0
                ? chainBet.arbiter[0]
                : null),
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
          taker_address: Array.isArray(chainBet.taker)
            ? chainBet.taker
            : [chainBet.taker],
          arbiter_address: chainBet.arbiter
            ? Array.isArray(chainBet.arbiter)
              ? chainBet.arbiter
              : [chainBet.arbiter]
            : null,
          bet_token_address: chainBet.betTokenAddress,
          bet_amount: betAmountFormatted, // This is the only change we keep
          timestamp: Number(chainBet.timestamp),
          end_time: Number(chainBet.endTime),
          can_settle_early: chainBet.canSettleEarly,
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
    const baseUrl = window.location.origin;
    // Change the URL format to use 'B' prefix for bet numbers
    const shareUrl = `${baseUrl}/share/B${bet.bet_number}`;
    const shareText = `Check out this bet on Betcaster!\nBet #${bet.bet_number}`;
    const betAmount = bet.bet_amount.toString();
    const tokenName = getTokenByAddress(bet.bet_token_address)?.symbol || "ETH";

    // Create frame metadata
    const frameMetadata = {
      buttons: [{ label: "View Bet", action: "link" }],
      image: {
        src: `${baseUrl}/api/og?betNumber=${bet.bet_number}&amount=${betAmount}&token=${tokenName}`,
        aspectRatio: "1.91:1",
      },
      post: {
        title: `Betcaster Bet #${bet.bet_number}`,
        description: `${betAmount} ${tokenName} bet. Click to view details!`,
      },
    };

    if (context?.client) {
      try {
        const frameUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
          shareText
        )}&embeds[]=${encodeURIComponent(shareUrl)}&frames=${encodeURIComponent(
          JSON.stringify(frameMetadata)
        )}`;
        window.open(frameUrl);
      } catch (error) {
        console.error("Error casting:", error);
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert("Share link copied to clipboard!");
        } catch (clipError) {
          console.error("Error copying to clipboard:", clipError);
        }
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

        {/* Admin button to add blockchain bet to database */}
        {blockchainBet && context?.user?.fid === 212074 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Admin Action Required
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Bet found on blockchain but not in database. Add to database?
                </p>
              </div>
              <button
                onClick={handleAddToDatabase}
                disabled={isAddingToDb}
                className={`px-4 py-2 bg-yellow-500 text-white rounded-lg transition-colors ${
                  isAddingToDb
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-yellow-600"
                }`}
              >
                {isAddingToDb ? "Adding..." : "Add to Database"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Bets Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Recent Bets
        </h2>
        {isLoadingRecentBets ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : recentBets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentBets.map((bet) => (
              <BetCard
                key={bet.bet_number}
                bet={bet}
                currentUserAddress={address}
                currentUserFid={context?.user?.fid}
                onBetSelect={handleBetSelect}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No recent bets found
          </div>
        )}
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
          onRefreshFromChain={handleRefreshFromChain}
          isApproving={isApproving}
          isAccepting={isAccepting}
          isRefreshingFromChain={isRefreshingFromChain}
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

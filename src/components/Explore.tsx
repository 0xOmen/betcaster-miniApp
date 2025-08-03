/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FC } from "react";
import { useState, useEffect } from "react";
import {
  useAccount,
  useSendTransaction,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { useMiniApp } from "@neynar/react";
import { type Bet } from "~/types/bet";
import { BetTile } from "./BetTile";
import { BetDetailsModal } from "./BetDetailsModal";
import { useBets } from "~/hooks/useBets";
import { useBetActions } from "~/hooks/useBetActions";
import { BETCASTER_ABI, BETCASTER_ADDRESS } from "~/lib/betcasterAbi";
import { calculateUSDValue, useTokenPrice } from "~/lib/prices";
import { useContractRead } from "wagmi";
import { getTokenByAddress, weiToAmount } from "~/lib/tokens";
import { base } from "wagmi/chains";
import { encodeFunctionData } from "viem";
import {
  ARBITER_MANAGEMENT_ENGINE_ABI,
  ARBITER_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/arbiterAbi";
import { notifyWinnerSelected } from "~/lib/notificationUtils";
import { fetchUserWithCache, globalUserCache } from "./Demo";

interface ExploreProps {
  userCache?: Map<number, any>;
}

export const Explore: FC<ExploreProps> = ({ userCache }) => {
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
  const [isSelectingWinner, setIsSelectingWinner] = useState(false); // Add loading state for winner selection
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null); // Add state for winner selection
  const [isSelectWinnerModalOpen, setIsSelectWinnerModalOpen] = useState(false); // Add state for winner selection modal
  const { address } = useAccount();
  const { sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

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
    handleForfeitBet: originalHandleForfeitBet,
    handleClaimWinnings,
    handleAcceptArbiterRole: originalHandleAcceptArbiterRole,
    handleSelectWinner,
  } = useBetActions({
    onSuccess: refreshBets,
  });

  // Custom handler for forfeiting bet that includes leaderboard update
  const handleForfeitBet = async (bet: Bet) => {
    try {
      // Call the original handler from the hook
      await originalHandleForfeitBet(bet);

      // After successful transaction, update database and leaderboard
      setTimeout(async () => {
        try {
          // Determine who forfeited and who wins
          let forfeiterFid: number | null = null;
          let winnerFid: number | null = null;
          let forfeitStatus: number;

          if (address === bet.maker_address) {
            // Maker forfeited, taker wins
            forfeiterFid = bet.maker_fid || null;
            winnerFid = bet.taker_fid || null;
            forfeitStatus = 5; // Taker wins
          } else if (bet.taker_address.includes(address || "")) {
            // Taker forfeited, maker wins
            forfeiterFid = bet.taker_fid || null;
            winnerFid = bet.maker_fid || null;
            forfeitStatus = 4; // Maker wins
          } else {
            console.error("Current user is not a participant in this bet");
            return;
          }

          // Update database to mark bet as forfeited
          const updateResponse = await fetch(
            `/api/bets?betNumber=${bet.bet_number}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                status: forfeitStatus,
                transaction_hash: forfeitTxHash,
              }),
            }
          );

          if (!updateResponse.ok) {
            console.error("Failed to update bet status in database");
          } else {
            console.log("Bet status updated to forfeited in database");

            // Calculate PnL amount for leaderboard update
            const pnlAmount = tokenPriceData?.[0]
              ? calculateUSDValue(bet.bet_amount, Number(tokenPriceData[0]))
              : 0;

            // Update leaderboard for winner and loser
            try {
              const leaderboardUpdateResponse = await fetch(
                "/api/leaderboard",
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    winner_fid: winnerFid,
                    loser_fid: forfeiterFid,
                    pnl_amount: pnlAmount,
                  }),
                }
              );

              if (leaderboardUpdateResponse.ok) {
                console.log(
                  "Leaderboard updated successfully for forfeit in Explore"
                );
              } else {
                console.error(
                  "Failed to update leaderboard for forfeit in Explore"
                );
              }
            } catch (leaderboardError) {
              console.error(
                "Error updating leaderboard for forfeit in Explore:",
                leaderboardError
              );
            }
          }
        } catch (error) {
          console.error("Error updating database and leaderboard:", error);
        }
      }, 2000); // Wait 2 seconds for transaction to be processed
    } catch (error) {
      console.error("Error in custom handleForfeitBet:", error);
    }
  };

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
    // Wait a bit for Demo to potentially populate the cache first
    const timer = setTimeout(() => {
      fetchRecentBets();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Function to fetch recent bets
  const fetchRecentBets = async () => {
    setIsLoadingRecentBets(true);
    try {
      const effectiveCache = userCache || globalUserCache;
      console.log(
        "Explore: Fetching recent bets, cache size:",
        effectiveCache.size
      );

      // Log cache contents for debugging
      console.log(
        "Explore: Cache contents:",
        Array.from(effectiveCache.keys())
      );

      const response = await fetch("/api/bets?limit=5&exclude=1000000");
      if (response.ok) {
        const data = await response.json();
        if (data.bets) {
          // Check which FIDs we need to fetch vs which are already cached
          const fidsToFetch = new Set<number>();
          data.bets.forEach((bet: Bet) => {
            if (bet.maker_fid && !effectiveCache.has(bet.maker_fid)) {
              fidsToFetch.add(bet.maker_fid);
            }
            if (bet.taker_fid && !effectiveCache.has(bet.taker_fid)) {
              fidsToFetch.add(bet.taker_fid);
            }
            if (bet.arbiter_fid && !effectiveCache.has(bet.arbiter_fid)) {
              fidsToFetch.add(bet.arbiter_fid);
            }
          });

          console.log("Explore: FIDs to fetch:", Array.from(fidsToFetch));
          console.log(
            "Explore: FIDs already cached:",
            Array.from(effectiveCache.keys())
          );

          // Fetch profiles for all bets in parallel using cache
          const betsWithProfiles = await Promise.all(
            data.bets.map(async (bet: Bet) => {
              const [makerProfile, takerProfile, arbiterProfile] =
                await Promise.all([
                  bet.maker_fid
                    ? fetchUserWithCache(bet.maker_fid)
                    : Promise.resolve(null),
                  bet.taker_fid
                    ? fetchUserWithCache(bet.taker_fid)
                    : Promise.resolve(null),
                  bet.arbiter_fid
                    ? fetchUserWithCache(bet.arbiter_fid)
                    : Promise.resolve(null),
                ]);

              return {
                ...bet,
                makerProfile,
                takerProfile,
                arbiterProfile,
              };
            })
          );
          setRecentBets(betsWithProfiles);
          console.log(
            "Explore: Finished fetching recent bets, cache size:",
            effectiveCache.size
          );
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
      // Temporarily set searchBetNumber to the selected bet's number for the contract read
      const originalSearchBetNumber = searchBetNumber;
      setSearchBetNumber(selectedBet.bet_number.toString());

      // Wait a moment for state to update, then fetch
      setTimeout(async () => {
        const { data: chainBet } = await refetchBet();
        console.log("Refreshed blockchain bet data:", chainBet);

        // Restore original search bet number
        setSearchBetNumber(originalSearchBetNumber);

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

        setIsRefreshingFromChain(false);
      }, 100);

      return; // Exit early since we're handling the rest in setTimeout
    } catch (error) {
      console.error("Error refreshing bet from blockchain:", error);
      alert("Error refreshing bet from blockchain");
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

          // Fetch profiles for maker, taker, and arbiter using cache
          const [makerProfile, takerProfile, arbiterProfile] =
            await Promise.all([
              dbBet.maker_fid
                ? fetchUserWithCache(dbBet.maker_fid)
                : Promise.resolve(null),
              dbBet.taker_fid
                ? fetchUserWithCache(dbBet.taker_fid)
                : Promise.resolve(null),
              dbBet.arbiter_fid
                ? fetchUserWithCache(dbBet.arbiter_fid)
                : Promise.resolve(null),
            ]);

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

          // If we have FIDs, use the cache to get profiles
          if (makerFid) {
            makerProfile = await fetchUserWithCache(makerFid);
          }
          if (takerFid) {
            takerProfile = await fetchUserWithCache(takerFid);
          }
          if (arbiterFid) {
            arbiterProfile = await fetchUserWithCache(arbiterFid);
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

  // Helper function to get token name
  const getTokenName = (tokenAddress: string): string => {
    const token = getTokenByAddress(tokenAddress);
    return token ? token.symbol : "Unknown Token";
  };

  // Function to open select winner modal
  const openSelectWinnerModal = (bet: Bet) => {
    setSelectedBet(bet);
    setSelectedWinner(null);
    setIsSelectWinnerModalOpen(true);
  };

  // Function to close select winner modal
  const closeSelectWinnerModal = () => {
    setIsSelectWinnerModalOpen(false);
    setSelectedWinner(null);
  };

  // Function to handle winner selection
  const handleSelectWinnerAction = async () => {
    if (!selectedBet || !selectedWinner) {
      console.error(
        "Cannot select winner: no bet selected or no winner selected"
      );
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
      setIsSelectingWinner(true);
      console.log(
        "Selecting winner for bet #",
        selectedBet.bet_number,
        "Bet Parameters True:",
        selectedWinner
      );

      // Convert string to boolean
      const betParamsTrue = selectedWinner === "true";

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: ARBITER_MANAGEMENT_ENGINE_ABI,
        functionName: "selectWinner",
        args: [BigInt(selectedBet.bet_number), betParamsTrue],
      });

      console.log("Encoded select winner transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: ARBITER_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: async (hash: `0x${string}`) => {
            console.log("Select winner transaction sent successfully:", hash);

            // Close modal after successful transaction
            setTimeout(async () => {
              closeSelectWinnerModal();
              // Update database with the winner status
              try {
                const winnerStatus = betParamsTrue ? 4 : 5; // 4 = maker wins (true), 5 = taker wins (false)
                const updateResponse = await fetch(
                  `/api/bets?betNumber=${selectedBet.bet_number}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: winnerStatus,
                      transaction_hash: hash,
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  console.error("Failed to update bet status in database");
                } else {
                  console.log(
                    `Bet status updated to ${winnerStatus} in database`
                  );

                  // Send notification to maker about winner selection
                  if (selectedBet.maker_fid) {
                    try {
                      const makerNotificationResult =
                        await notifyWinnerSelected(selectedBet.maker_fid, {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        });

                      if (makerNotificationResult.success) {
                        console.log(
                          "Notification sent to maker about winner selection"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to maker:",
                          makerNotificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification to maker:",
                        notificationError
                      );
                    }
                  }

                  // Send notification to taker about winner selection
                  if (selectedBet.taker_fid) {
                    try {
                      const takerNotificationResult =
                        await notifyWinnerSelected(selectedBet.taker_fid, {
                          betNumber: selectedBet.bet_number,
                          betAmount: selectedBet.bet_amount.toString(),
                          tokenName: getTokenName(
                            selectedBet.bet_token_address
                          ),
                          makerName:
                            selectedBet.makerProfile?.display_name ||
                            selectedBet.makerProfile?.username,
                          takerName:
                            selectedBet.takerProfile?.display_name ||
                            selectedBet.takerProfile?.username,
                          arbiterName:
                            selectedBet.arbiterProfile?.display_name ||
                            selectedBet.arbiterProfile?.username,
                          betAgreement: selectedBet.bet_agreement,
                          endTime: new Date(
                            selectedBet.end_time * 1000
                          ).toLocaleString(),
                        });

                      if (takerNotificationResult.success) {
                        console.log(
                          "Notification sent to taker about winner selection"
                        );
                      } else {
                        console.error(
                          "Failed to send notification to taker:",
                          takerNotificationResult.error
                        );
                      }
                    } catch (notificationError) {
                      console.error(
                        "Error sending notification to taker:",
                        notificationError
                      );
                    }
                  }

                  // Update leaderboard for winner selection
                  try {
                    let winnerFid: number | null = null;
                    let loserFid: number | null = null;

                    if (betParamsTrue) {
                      // Maker wins (true)
                      winnerFid = selectedBet.maker_fid || null;
                      loserFid = selectedBet.taker_fid || null;
                    } else {
                      // Taker wins (false)
                      winnerFid = selectedBet.taker_fid || null;
                      loserFid = selectedBet.maker_fid || null;
                    }

                    console.log("Leaderboard update data:", {
                      winnerFid,
                      loserFid,
                      pnlAmount: tokenPriceData?.[0]
                        ? calculateUSDValue(
                            selectedBet.bet_amount,
                            Number(tokenPriceData[0])
                          )
                        : 0,
                      selectedBet: {
                        maker_fid: selectedBet.maker_fid,
                        taker_fid: selectedBet.taker_fid,
                        bet_amount: selectedBet.bet_amount,
                      },
                    });

                    if (
                      winnerFid &&
                      loserFid &&
                      winnerFid !== null &&
                      loserFid !== null
                    ) {
                      // Calculate PnL amount (bet amount × token price)
                      const pnlAmount = tokenPriceData?.[0]
                        ? calculateUSDValue(
                            selectedBet.bet_amount,
                            Number(tokenPriceData[0])
                          )
                        : 0;

                      const leaderboardUpdateResponse = await fetch(
                        "/api/leaderboard",
                        {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            winner_fid: winnerFid,
                            loser_fid: loserFid,
                            pnl_amount: pnlAmount,
                          }),
                        }
                      );

                      if (leaderboardUpdateResponse.ok) {
                        console.log(
                          "Leaderboard updated successfully for winner selection"
                        );
                      } else {
                        console.error(
                          "Failed to update leaderboard for winner selection"
                        );
                      }
                    } else {
                      console.warn("Cannot update leaderboard: missing FIDs", {
                        winnerFid,
                        loserFid,
                        maker_fid: selectedBet.maker_fid,
                        taker_fid: selectedBet.taker_fid,
                      });
                    }
                  } catch (leaderboardError) {
                    console.error(
                      "Error updating leaderboard for winner selection:",
                      leaderboardError
                    );
                  }

                  // Refresh the bets list to show updated data
                  await refreshBets();
                }
              } catch (error) {
                console.error("Error updating bet status:", error);
              }
            }, 2000);
          },
          onError: (error: Error) => {
            console.error("Select winner transaction failed:", error);
            setIsSelectingWinner(false);
          },
        }
      );
    } catch (error) {
      console.error("Error selecting winner:", error);
      setIsSelectingWinner(false);
    }
  };

  // Wrapper function to handle select winner action
  const handleSelectWinnerWrapper = (bet: Bet) => {
    openSelectWinnerModal(bet);
  };

  // Handler functions for BetTile actions
  const handleRejectBet = async (bet: Bet) => {
    // For Explore, we might want to show a modal or handle rejection differently
    console.log("Reject bet:", bet.bet_number);
  };

  const openEditModal = (bet: Bet) => {
    // For Explore, we might want to show a read-only view or handle editing differently
    console.log("Edit bet:", bet.bet_number);
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
          <div className="space-y-3">
            {recentBets.map((bet) => (
              <BetTile
                key={bet.bet_number}
                bet={bet}
                currentUserAddress={address}
                currentUserFid={context?.user?.fid}
                onBetSelect={handleBetSelect}
                onRejectBet={handleRejectBet}
                onEditBet={openEditModal}
                onSelectWinner={handleSelectWinnerWrapper}
                onForfeit={handleForfeitBet}
                onCancel={handleCancelBet}
                onAccept={handleAcceptBet}
                onAcceptArbiter={handleAcceptArbiterRole}
                onClaimWinnings={handleClaimWinnings}
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
          onSelectWinner={() => handleSelectWinnerWrapper(selectedBet)}
          onRefreshFromChain={handleRefreshFromChain}
          isApproving={isApproving}
          isAccepting={isAccepting}
          isRefreshingFromChain={isRefreshingFromChain}
          isCancelling={isCancelling}
          isForfeiting={isForfeiting}
          isClaiming={isClaiming}
          isAcceptingArbiter={isAcceptingArbiter}
          isSelectingWinner={isSelectingWinner}
          showApprovalSuccess={showApprovalSuccess}
        />
      )}

      {/* Winner Selection Modal */}
      {isSelectWinnerModalOpen && selectedBet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Select Winner
                </h2>
                <button
                  onClick={closeSelectWinnerModal}
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

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Bet #{selectedBet.bet_number}: {selectedBet.bet_agreement}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Select the winner based on whether the bet agreement is true
                  or false:
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setSelectedWinner("true")}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    selectedWinner === "true"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-purple-300"
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedBet.makerProfile?.display_name ||
                      selectedBet.makerProfile?.username ||
                      "Maker"}{" "}
                    Wins
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Bet agreement is TRUE
                  </div>
                </button>

                <button
                  onClick={() => setSelectedWinner("false")}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    selectedWinner === "false"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-purple-300"
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedBet.takerProfile?.display_name ||
                      selectedBet.takerProfile?.username ||
                      "Taker"}{" "}
                    Wins
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Bet agreement is FALSE
                  </div>
                </button>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={closeSelectWinnerModal}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelectWinnerAction}
                  disabled={!selectedWinner || isSelectingWinner}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSelectingWinner
                    ? "Selecting Winner..."
                    : "Confirm Selection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

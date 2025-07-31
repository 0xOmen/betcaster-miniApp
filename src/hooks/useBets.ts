/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import { type Bet } from "~/types/bet";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";

// Helper function to check if an address is in an array
function isAddressInArray(
  address: string,
  addressArray: string[] | null
): boolean {
  if (!addressArray || addressArray.length === 0) return false;
  return addressArray.some(
    (addr) => addr.toLowerCase() === address.toLowerCase()
  );
}

export function useBets() {
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  const { address } = useAccount();
  const { context } = useMiniApp();

  // Fetch user bets when wallet is connected OR when Farcaster context is available
  useEffect(() => {
    const fetchUserBets = async () => {
      // Only fetch if we have either an address or a Farcaster FID
      if (!address && !context?.user?.fid) return;

      console.log("🔍 Fetching user bets for:", {
        address,
        fid: context?.user?.fid,
      });
      setIsLoadingBets(true);
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (address) params.append("address", address);
        if (context?.user?.fid)
          params.append("fid", context.user.fid.toString());

        const response = await fetch(`/api/bets?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const bets = data.bets || [];
          console.log("📊 Found bets:", bets.length, "bets:", bets);

          // Filter out old cancelled bets (status 8) that are more than a day old
          const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
          const filteredBets = bets.filter((bet: Bet) => {
            if (bet.status === 8) {
              // Check if bet is more than a day old (using end_time or updated_at)
              const betAge = bet.end_time || bet.timestamp || 0;
              return betAge > oneDayAgo;
            }
            return true; // Keep all non-cancelled bets
          });

          console.log(
            "📊 Filtered bets:",
            filteredBets.length,
            "bets after filtering"
          );

          // Debug: Log user's role in each bet
          filteredBets.forEach((bet: Bet) => {
            const isMaker =
              address?.toLowerCase() === bet.maker_address.toLowerCase() ||
              context?.user?.fid === bet.maker_fid;
            const isTaker =
              (address && isAddressInArray(address, bet.taker_address)) ||
              context?.user?.fid === bet.taker_fid;
            const isArbiter =
              (address && isAddressInArray(address, bet.arbiter_address)) ||
              context?.user?.fid === bet.arbiter_fid;
            console.log(`🎯 Bet #${bet.bet_number} - User role:`, {
              isMaker,
              isTaker,
              isArbiter,
              userAddress: address,
              userFid: context?.user?.fid,
              makerAddress: bet.maker_address,
              makerFid: bet.maker_fid,
              takerAddress: bet.taker_address,
              takerFid: bet.taker_fid,
              arbiterAddress: bet.arbiter_address,
              arbiterFid: bet.arbiter_fid,
            });
          });

          // Fetch profile data for each bet's maker and taker (only for non-filtered bets)
          const betsWithProfiles = await Promise.all(
            filteredBets.map(async (bet: Bet) => {
              let makerFid = bet.maker_fid;
              let takerFid = bet.taker_fid;
              let arbiterFid = bet.arbiter_fid;

              console.log(`🎯 Processing bet #${bet.bet_number}:`, {
                maker_address: bet.maker_address,
                taker_address: bet.taker_address,
                makerFid,
                takerFid,
                arbiterFid,
              });

              // If maker_fid doesn't exist, fetch it using the address
              if (!makerFid && bet.maker_address) {
                try {
                  console.log(
                    `🔍 Fetching maker FID for address: ${bet.maker_address}`
                  );
                  const makerFidResponse = await fetch(
                    `/api/users?address=${bet.maker_address}`
                  );
                  if (makerFidResponse.ok) {
                    const makerFidData = await makerFidResponse.json();
                    makerFid = makerFidData.users?.[0]?.fid || null;
                    console.log(`✅ Found maker FID: ${makerFid}`);
                  }
                } catch (error) {
                  console.error("❌ Failed to fetch maker FID:", error);
                }
              }

              // If taker_fid doesn't exist, fetch it using the first taker address
              if (
                !takerFid &&
                bet.taker_address &&
                bet.taker_address.length > 0
              ) {
                try {
                  const firstTakerAddress = bet.taker_address[0];
                  console.log(
                    `🔍 Fetching taker FID for address: ${firstTakerAddress}`
                  );
                  const takerFidResponse = await fetch(
                    `/api/users?address=${firstTakerAddress}`
                  );
                  if (takerFidResponse.ok) {
                    const takerFidData = await takerFidResponse.json();
                    takerFid = takerFidData.users?.[0]?.fid || null;
                    console.log(`✅ Found taker FID: ${takerFid}`);
                  }
                } catch (error) {
                  console.error("❌ Failed to fetch taker FID:", error);
                }
              }

              // If arbiter_fid doesn't exist, fetch it using the first arbiter address
              if (
                !arbiterFid &&
                bet.arbiter_address &&
                bet.arbiter_address.length > 0
              ) {
                try {
                  const firstArbiterAddress = bet.arbiter_address[0];
                  console.log(
                    `🔍 Fetching arbiter FID for address: ${firstArbiterAddress}`
                  );
                  const arbiterFidResponse = await fetch(
                    `/api/users?address=${firstArbiterAddress}`
                  );
                  if (arbiterFidResponse.ok) {
                    const arbiterFidData = await arbiterFidResponse.json();
                    arbiterFid = arbiterFidData.users?.[0]?.fid || null;
                    console.log(`✅ Found arbiter FID: ${arbiterFid}`);
                  }
                } catch (error) {
                  console.error("❌ Failed to fetch arbiter FID:", error);
                }
              }

              let makerProfile = null;
              let takerProfile = null;
              let arbiterProfile = null;

              if (makerFid) {
                try {
                  const makerResponse = await fetch(
                    `/api/users?fids=${makerFid}`
                  );
                  if (makerResponse.ok) {
                    const makerData = await makerResponse.json();
                    makerProfile = makerData.users?.[0] || null;
                  }
                } catch (error) {
                  console.error("Failed to fetch maker profile:", error);
                }
              }

              if (takerFid) {
                try {
                  const takerResponse = await fetch(
                    `/api/users?fids=${takerFid}`
                  );
                  if (takerResponse.ok) {
                    const takerData = await takerResponse.json();
                    takerProfile = takerData.users?.[0] || null;
                  }
                } catch (error) {
                  console.error("Failed to fetch taker profile:", error);
                }
              }

              if (arbiterFid) {
                try {
                  const arbiterResponse = await fetch(
                    `/api/users?fids=${arbiterFid}`
                  );
                  if (arbiterResponse.ok) {
                    const arbiterData = await arbiterResponse.json();
                    arbiterProfile = arbiterData.users?.[0] || null;
                  }
                } catch (error) {
                  console.error("Failed to fetch arbiter profile:", error);
                }
              }

              const betWithProfiles = {
                ...bet,
                makerProfile,
                takerProfile,
                arbiterProfile,
              };

              console.log(
                `✅ Final bet #${bet.bet_number} with profiles:`,
                betWithProfiles
              );
              return betWithProfiles;
            })
          );

          console.log("🎉 All bets processed:", betsWithProfiles);
          setUserBets(betsWithProfiles);
        } else {
          console.error(
            "❌ Failed to fetch user bets:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error("❌ Error fetching user bets:", error);
      } finally {
        setIsLoadingBets(false);
      }
    };

    fetchUserBets();
  }, [address, context?.user?.fid]);

  const refreshBets = async () => {
    if (address || context?.user?.fid) {
      const params = new URLSearchParams();
      if (address) params.append("address", address);
      if (context?.user?.fid) params.append("fid", context.user.fid.toString());

      const response = await fetch(`/api/bets?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setUserBets(data.bets || []);
      }
    }
  };

  const updateBetStatus = async (
    betNumber: number,
    status: number,
    transactionHash?: string
  ) => {
    try {
      const updateResponse = await fetch(`/api/bets?betNumber=${betNumber}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          transaction_hash: transactionHash,
        }),
      });

      if (!updateResponse.ok) {
        console.error("Failed to update bet status in database");
      } else {
        console.log(`Bet status updated to ${status} in database`);
        await refreshBets();
      }
    } catch (error) {
      console.error("Error updating bet status:", error);
    }
  };

  return {
    userBets,
    isLoadingBets,
    refreshBets,
    updateBetStatus,
  };
}

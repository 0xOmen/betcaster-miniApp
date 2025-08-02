/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "~/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 API: Fetching leaderboard data");

    // Fetch leaderboard data from Supabase
    const { data, error } = await supabaseAdmin
      .from("leaderboard")
      .select("*")
      .order("total_bets", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch leaderboard data" },
        { status: 500 }
      );
    }

    console.log(
      "✅ API: Leaderboard data fetched successfully",
      data?.length,
      "entries"
    );

    return NextResponse.json({
      success: true,
      leaderboard: data || [],
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    console.log("🔍 API: Updating leaderboard data");

    const body = await request.json();
    console.log("🔍 API: Received body:", body);

    const {
      maker_fid,
      taker_fid,
      forfeiter_fid,
      winner_fid,
      loser_fid,
      usd_volume,
      pnl_amount,
    } = body;

    // Handle bet acceptance (increment total_bets)
    console.log(
      "🔍 API: Bet acceptance check - maker_fid:",
      maker_fid,
      "taker_fid:",
      taker_fid,
      "winner_fid:",
      winner_fid,
      "loser_fid:",
      loser_fid
    );
    if ((maker_fid || taker_fid) && !winner_fid && !loser_fid) {
      if (!maker_fid && !taker_fid) {
        return NextResponse.json(
          { error: "No maker_fid or taker_fid provided" },
          { status: 400 }
        );
      }

      // First, check if maker exists in leaderboard
      if (maker_fid) {
        const { data: makerData, error: makerCheckError } = await supabaseAdmin
          .from("leaderboard")
          .select("total_bets, total_volume")
          .eq("fid", maker_fid)
          .single();

        if (makerCheckError && makerCheckError.code !== "PGRST116") {
          console.error("Error checking maker leaderboard:", makerCheckError);
          return NextResponse.json(
            { error: "Failed to check maker leaderboard" },
            { status: 500 }
          );
        }

        // Update or insert maker's total_bets and total_volume
        const makerTotalBets = makerData?.total_bets || 0;
        const makerTotalVolume = makerData?.total_volume || 0;
        const { error: makerError } = await supabaseAdmin
          .from("leaderboard")
          .upsert(
            {
              fid: maker_fid,
              total_bets: makerTotalBets + 1,
              total_volume: makerTotalVolume + (usd_volume || 0),
            },
            {
              onConflict: "fid",
            }
          );

        if (makerError) {
          console.error("Error updating maker leaderboard:", makerError);
          return NextResponse.json(
            { error: "Failed to update maker leaderboard" },
            { status: 500 }
          );
        }
      }

      // Check if taker exists in leaderboard
      if (taker_fid) {
        const { data: takerData, error: takerCheckError } = await supabaseAdmin
          .from("leaderboard")
          .select("total_bets, total_volume")
          .eq("fid", taker_fid)
          .single();

        if (takerCheckError && takerCheckError.code !== "PGRST116") {
          console.error("Error checking taker leaderboard:", takerCheckError);
          return NextResponse.json(
            { error: "Failed to check taker leaderboard" },
            { status: 500 }
          );
        }

        // Update or insert taker's total_bets and total_volume
        const takerTotalBets = takerData?.total_bets || 0;
        const takerTotalVolume = takerData?.total_volume || 0;
        const { error: takerError } = await supabaseAdmin
          .from("leaderboard")
          .upsert(
            {
              fid: taker_fid,
              total_bets: takerTotalBets + 1,
              total_volume: takerTotalVolume + (usd_volume || 0),
            },
            {
              onConflict: "fid",
            }
          );

        if (takerError) {
          console.error("Error updating taker leaderboard:", takerError);
          return NextResponse.json(
            { error: "Failed to update taker leaderboard" },
            { status: 500 }
          );
        }
      }

      console.log(
        "✅ API: Leaderboard updated successfully for maker and taker"
      );

      return NextResponse.json({
        success: true,
        message: "Leaderboard updated successfully",
      });
    }

    // Handle bet forfeit (increment losses for forfeiter, wins for winner)
    if (forfeiter_fid && winner_fid) {
      // Update forfeiter's losses and pnl
      const { data: forfeiterData, error: forfeiterCheckError } =
        await supabaseAdmin
          .from("leaderboard")
          .select("losses, pnl")
          .eq("fid", forfeiter_fid)
          .single();

      if (forfeiterCheckError && forfeiterCheckError.code !== "PGRST116") {
        console.error(
          "Error checking forfeiter leaderboard:",
          forfeiterCheckError
        );
        return NextResponse.json(
          { error: "Failed to check forfeiter leaderboard" },
          { status: 500 }
        );
      }

      const forfeiterLosses = forfeiterData?.losses || 0;
      const forfeiterPnl = forfeiterData?.pnl || 0;
      const { error: forfeiterError } = await supabaseAdmin
        .from("leaderboard")
        .upsert(
          {
            fid: forfeiter_fid,
            losses: forfeiterLosses + 1,
            pnl: forfeiterPnl - (pnl_amount || 0),
          },
          {
            onConflict: "fid",
          }
        );

      if (forfeiterError) {
        console.error("Error updating forfeiter leaderboard:", forfeiterError);
        return NextResponse.json(
          { error: "Failed to update forfeiter leaderboard" },
          { status: 500 }
        );
      }

      // Update winner's wins and pnl
      const { data: winnerData, error: winnerCheckError } = await supabaseAdmin
        .from("leaderboard")
        .select("wins, pnl")
        .eq("fid", winner_fid)
        .single();

      if (winnerCheckError && winnerCheckError.code !== "PGRST116") {
        console.error("Error checking winner leaderboard:", winnerCheckError);
        return NextResponse.json(
          { error: "Failed to check winner leaderboard" },
          { status: 500 }
        );
      }

      const winnerWins = winnerData?.wins || 0;
      const winnerPnl = winnerData?.pnl || 0;
      const { error: winnerError } = await supabaseAdmin
        .from("leaderboard")
        .upsert(
          {
            fid: winner_fid,
            wins: winnerWins + 1,
            pnl: winnerPnl + (pnl_amount || 0),
          },
          {
            onConflict: "fid",
          }
        );

      if (winnerError) {
        console.error("Error updating winner leaderboard:", winnerError);
        return NextResponse.json(
          { error: "Failed to update winner leaderboard" },
          { status: 500 }
        );
      }

      console.log("✅ API: Leaderboard updated successfully for forfeit");

      return NextResponse.json({
        success: true,
        message: "Leaderboard updated successfully for forfeit",
      });
    }

    // Handle winner selection (increment wins for winner, losses for loser)
    console.log(
      "🔍 API: Winner selection logic - winner_fid:",
      winner_fid,
      "loser_fid:",
      loser_fid
    );
    if (winner_fid || loser_fid) {
      let updateCount = 0;

      // Update winner's wins and pnl if present
      if (winner_fid) {
        try {
          const { data: winnerData, error: winnerCheckError } =
            await supabaseAdmin
              .from("leaderboard")
              .select("wins, pnl")
              .eq("fid", winner_fid)
              .single();

          if (winnerCheckError && winnerCheckError.code !== "PGRST116") {
            console.error(
              "Error checking winner leaderboard:",
              winnerCheckError
            );
          } else {
            const winnerWins = winnerData?.wins || 0;
            const winnerPnl = winnerData?.pnl || 0;
            const { error: winnerError } = await supabaseAdmin
              .from("leaderboard")
              .upsert(
                {
                  fid: winner_fid,
                  wins: winnerWins + 1,
                  pnl: winnerPnl + (pnl_amount || 0),
                },
                {
                  onConflict: "fid",
                }
              );

            if (winnerError) {
              console.error("Error updating winner leaderboard:", winnerError);
            } else {
              updateCount++;
            }
          }
        } catch (error) {
          console.error("Error updating winner:", error);
        }
      }

      // Update loser's losses and pnl if present
      if (loser_fid) {
        try {
          const { data: loserData, error: loserCheckError } =
            await supabaseAdmin
              .from("leaderboard")
              .select("losses, pnl")
              .eq("fid", loser_fid)
              .single();

          if (loserCheckError && loserCheckError.code !== "PGRST116") {
            console.error("Error checking loser leaderboard:", loserCheckError);
          } else {
            const loserLosses = loserData?.losses || 0;
            const loserPnl = loserData?.pnl || 0;
            const { error: loserError } = await supabaseAdmin
              .from("leaderboard")
              .upsert(
                {
                  fid: loser_fid,
                  losses: loserLosses + 1,
                  pnl: loserPnl - (pnl_amount || 0),
                },
                {
                  onConflict: "fid",
                }
              );

            if (loserError) {
              console.error("Error updating loser leaderboard:", loserError);
            } else {
              updateCount++;
            }
          }
        } catch (error) {
          console.error("Error updating loser:", error);
        }
      }

      console.log(
        `✅ API: Leaderboard updated successfully for winner selection (${updateCount} updates)`
      );

      return NextResponse.json({
        success: true,
        message: `Leaderboard updated successfully for winner selection (${updateCount} updates)`,
      });
    }

    console.log("🔍 API: No valid parameters provided - returning 400 error");
    return NextResponse.json(
      { error: "No valid parameters provided" },
      { status: 400 }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

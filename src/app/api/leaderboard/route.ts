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

/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "~/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      maker_address,
      taker_address,
      arbiter_address,
      bet_token_address,
      bet_amount,
      timestamp,
      end_time,
      protocol_fee,
      arbiter_fee,
      bet_agreement,
      transaction_hash,
      bet_number,
      maker_fid,
      taker_fid,
      arbiter_fid,
    } = body;

    // Validate required fields including bet_number since it's now the primary key
    if (
      !maker_address ||
      !taker_address ||
      !bet_token_address ||
      !bet_amount ||
      !timestamp ||
      !end_time ||
      !protocol_fee ||
      arbiter_fee === undefined || // Changed from !arbiter_fee to allow 0
      !bet_agreement ||
      !bet_number
    ) {
      return NextResponse.json(
        { error: "Missing required fields including bet_number" },
        { status: 400 }
      );
    }

    // Insert the bet into the database
    const { data, error } = await supabase
      .from("bets")
      .insert([
        {
          bet_number: body.bet_number, // Now required as primary key
          maker_address: body.maker_address,
          taker_address: body.taker_address,
          arbiter_address: body.arbiter_address || null,
          bet_token_address: body.bet_token_address,
          bet_amount: body.bet_amount,
          timestamp: body.timestamp,
          end_time: body.end_time,
          status: 0,
          protocol_fee: body.protocol_fee,
          arbiter_fee: body.arbiter_fee,
          bet_agreement: body.bet_agreement,
          transaction_hash: body.transaction_hash || null,
          maker_fid: body.maker_fid || null,
          taker_fid: body.taker_fid || null,
          arbiter_fid: body.arbiter_fid || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to store bet" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, bet: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const fid = searchParams.get("fid");
    const status = searchParams.get("status");
    const betNumber = searchParams.get("betNumber");

    console.log("🔍 API: Fetching bets with params:", {
      address,
      fid,
      status,
      betNumber,
    });

    let query = supabase
      .from("bets")
      .select("*")
      .order("created_at", { ascending: false });

    // If betNumber is provided, search by exact bet number
    if (betNumber) {
      query = query.eq("bet_number", parseInt(betNumber));
    } else if (address || fid) {
      const conditions = [];

      if (address) {
        conditions.push(
          `maker_address.eq.${address},taker_address.eq.${address},arbiter_address.eq.${address}`
        );
      }

      if (fid) {
        conditions.push(
          `maker_fid.eq.${fid},taker_fid.eq.${fid},arbiter_fid.eq.${fid}`
        );
      }

      // Combine conditions with OR
      query = query.or(conditions.join(","));
    }

    if (status !== null) {
      query = query.eq("status", parseInt(status));
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch bets" },
        { status: 500 }
      );
    }

    console.log("📊 API: Found bets from database:", data?.length || 0);
    return NextResponse.json({ bets: data || [] });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const betNumber = searchParams.get("betNumber");
    const body = await request.json();

    if (!betNumber) {
      return NextResponse.json(
        { error: "Missing bet number" },
        { status: 400 }
      );
    }

    // Build update object with proper typing
    const updateData: {
      status?: number;
      transaction_hash?: string | null;
      taker_address?: string;
      arbiter_address?: string | null;
      end_time?: number;
      bet_agreement?: string;
    } = {};

    // Handle status updates (existing functionality)
    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Handle transaction hash updates (existing functionality)
    if (body.transaction_hash !== undefined) {
      updateData.transaction_hash = body.transaction_hash;
    }

    // Handle bet parameter updates (new functionality)
    if (body.taker_address !== undefined) {
      updateData.taker_address = body.taker_address;
    }

    if (body.arbiter_address !== undefined) {
      updateData.arbiter_address = body.arbiter_address;
    }

    if (body.end_time !== undefined) {
      updateData.end_time = body.end_time;
    }

    if (body.bet_agreement !== undefined) {
      updateData.bet_agreement = body.bet_agreement;
    }

    // Check if we have any fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    console.log("🔄 API: Updating bet #", betNumber, "with data:", updateData);

    // Update the bet in the database
    const { data, error } = await supabase
      .from("bets")
      .update(updateData)
      .eq("bet_number", parseInt(betNumber))
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to update bet" },
        { status: 500 }
      );
    }

    console.log("✅ API: Bet updated successfully:", data);
    return NextResponse.json({ success: true, bet: data });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

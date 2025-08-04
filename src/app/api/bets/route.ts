/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "~/lib/supabase";

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
      can_settle_early,
    } = body;

    // Validate required fields including bet_number since it's now the primary key
    if (
      !maker_address ||
      !taker_address ||
      !Array.isArray(taker_address) ||
      taker_address.length === 0 ||
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
        {
          error:
            "Missing required fields including bet_number and valid taker_address array",
        },
        { status: 400 }
      );
    }

    // Validate arbiter_address if provided
    if (arbiter_address && !Array.isArray(arbiter_address)) {
      return NextResponse.json(
        { error: "arbiter_address must be an array" },
        { status: 400 }
      );
    }

    // Insert the bet into the database using admin client
    const { data, error } = await supabaseAdmin
      .from("bets")
      .insert([
        {
          bet_number: body.bet_number, // Now required as primary key
          maker_address: body.maker_address,
          taker_address: body.taker_address, // Now an array
          arbiter_address: body.arbiter_address || null, // Now an array or null
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
          can_settle_early: body.can_settle_early || false,
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
    const limit = searchParams.get("limit");
    const exclude = searchParams.get("exclude");

    console.log("🔍 API: Fetching bets with params:", {
      address,
      fid,
      status,
      betNumber,
      limit,
      exclude,
    });

    let query = supabase
      .from("bets")
      .select("*")
      .order("bet_number", { ascending: false });

    // If betNumber is provided, search by exact bet number
    if (betNumber) {
      query = query.eq("bet_number", parseInt(betNumber));
    } else if (address || fid) {
      const conditions = [];

      if (address) {
        // Updated to handle array fields - check if address is in any of the arrays
        conditions.push(
          `maker_address.eq.${address},taker_address.cs.{${address}},arbiter_address.cs.{${address}}`
        );
      }

      if (fid) {
        // FIDs are single values, not arrays
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

    // Exclude specific bet number if provided
    if (exclude) {
      query = query.neq("bet_number", parseInt(exclude));
    }

    // Apply limit if provided
    if (limit) {
      query = query.limit(parseInt(limit));
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
      taker_address?: string[];
      arbiter_address?: string[] | null;
      end_time?: number;
      bet_agreement?: string;
      can_settle_early?: boolean;
      maker_fid?: number | null;
      taker_fid?: number | null;
      arbiter_fid?: number | null;
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
      if (!Array.isArray(body.taker_address)) {
        return NextResponse.json(
          { error: "taker_address must be an array" },
          { status: 400 }
        );
      }
      updateData.taker_address = body.taker_address;
    }

    if (body.arbiter_address !== undefined) {
      if (
        body.arbiter_address !== null &&
        !Array.isArray(body.arbiter_address)
      ) {
        return NextResponse.json(
          { error: "arbiter_address must be an array or null" },
          { status: 400 }
        );
      }
      updateData.arbiter_address = body.arbiter_address;
    }

    if (body.end_time !== undefined) {
      updateData.end_time = body.end_time;
    }

    if (body.bet_agreement !== undefined) {
      updateData.bet_agreement = body.bet_agreement;
    }

    // Handle can_settle_early updates
    if (body.can_settle_early !== undefined) {
      updateData.can_settle_early = body.can_settle_early;
    }

    // Handle FID updates
    if (body.maker_fid !== undefined) {
      updateData.maker_fid = body.maker_fid;
    }

    if (body.taker_fid !== undefined) {
      updateData.taker_fid = body.taker_fid;
    }

    if (body.arbiter_fid !== undefined) {
      updateData.arbiter_fid = body.arbiter_fid;
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
    const { data, error } = await supabaseAdmin
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

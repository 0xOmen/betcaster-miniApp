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
    } = body;

    // Validate required fields
    if (!maker_address || !taker_address || !bet_token_address || !bet_amount || !timestamp || !end_time || !protocol_fee || !arbiter_fee || !bet_agreement) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert the bet into the database
    const { data, error } = await supabase
      .from('bets')
      .insert([{
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
        bet_number: body.bet_number || null,
      }])
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
    const address = searchParams.get('address');
    const status = searchParams.get('status');

    let query = supabase.from('bets').select('*').order('created_at', { ascending: false });

    if (address) {
      query = query.or(`maker_address.eq.${address},taker_address.eq.${address},arbiter_address.eq.${address}`);
    }

    if (status !== null) {
      query = query.eq('status', parseInt(status));
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch bets" },
        { status: 500 }
      );
    }

    return NextResponse.json({ bets: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
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
    } = body;

    // Validate required fields including bet_number since it's now the primary key
    if (!maker_address || !taker_address || !bet_token_address || !bet_amount || !timestamp || !end_time || !protocol_fee || !arbiter_fee || !bet_agreement || !bet_number) {
      return NextResponse.json(
        { error: "Missing required fields including bet_number" },
        { status: 400 }
      );
    }

    // Insert the bet into the database
    const { data, error } = await supabase
      .from('bets')
      .insert([{
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

    // Add FID information for maker and taker addresses
    const betsWithFids = await Promise.all(
      (data || []).map(async (bet) => {
        let makerFid = null;
        let takerFid = null;

        // Fetch FID for maker address
        if (bet.maker_address) {
          try {
            const makerResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/users?address=${bet.maker_address}`);
            if (makerResponse.ok) {
              const makerData = await makerResponse.json();
              makerFid = makerData.users?.[0]?.fid || null;
            }
          } catch (error) {
            console.error("Failed to fetch maker FID:", error);
          }
        }

        // Fetch FID for taker address
        if (bet.taker_address) {
          try {
            const takerResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/users?address=${bet.taker_address}`);
            if (takerResponse.ok) {
              const takerData = await takerResponse.json();
              takerFid = takerData.users?.[0]?.fid || null;
            }
          } catch (error) {
            console.error("Failed to fetch taker FID:", error);
          }
        }

        return {
          ...bet,
          maker_fid: makerFid,
          taker_fid: takerFid,
        };
      })
    );

    return NextResponse.json({ bets: betsWithFids });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
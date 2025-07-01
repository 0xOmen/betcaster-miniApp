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
        maker_fid: body.maker_fid || null,
        taker_fid: body.taker_fid || null,
        arbiter_fid: body.arbiter_fid || null,
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

    console.log("🔍 API: Fetching bets with params:", { address, status });

    let query = supabase.from('bets').select('*').order('created_at', { ascending: false });

    if (address) {
      query = query.or(`maker_address.eq.${address},taker_address.eq.${address},arbiter_address.eq.${address}`);
    }

    if (status !== null) {
      query = query.eq('status', parseInt(status));
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

    // Add FID information for maker and taker addresses
    const betsWithFids = await Promise.all(
      (data || []).map(async (bet) => {
        console.log(`🎯 API: Processing bet #${bet.bet_number}:`, {
          maker_address: bet.maker_address,
          taker_address: bet.taker_address,
        });

        let makerFid = null;
        let takerFid = null;

        // Fetch FID for maker address
        if (bet.maker_address) {
          try {
            console.log(`👤 API: Fetching maker FID for address: ${bet.maker_address}`);
            const makerResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/users?address=${bet.maker_address}`);
            console.log("👤 API: Maker response status:", makerResponse.status);
            
            if (makerResponse.ok) {
              const makerData = await makerResponse.json();
              console.log("👤 API: Maker data:", makerData);
              makerFid = makerData.users?.[0]?.fid || null;
              console.log("👤 API: Maker FID:", makerFid);
            } else {
              console.log("❌ API: Maker response not ok:", makerResponse.statusText);
            }
          } catch (error) {
            console.error("❌ API: Failed to fetch maker FID:", error);
          }
        }

        // Fetch FID for taker address
        if (bet.taker_address) {
          try {
            console.log(`👤 API: Fetching taker FID for address: ${bet.taker_address}`);
            const takerResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/users?address=${bet.taker_address}`);
            console.log("👤 API: Taker response status:", takerResponse.status);
            
            if (takerResponse.ok) {
              const takerData = await takerResponse.json();
              console.log("👤 API: Taker data:", takerData);
              takerFid = takerData.users?.[0]?.fid || null;
              console.log("👤 API: Taker FID:", takerFid);
            } else {
              console.log("❌ API: Taker response not ok:", takerResponse.statusText);
            }
          } catch (error) {
            console.error("❌ API: Failed to fetch taker FID:", error);
          }
        }

        const betWithFid = {
          ...bet,
          maker_fid: makerFid,
          taker_fid: takerFid,
        };

        console.log(`✅ API: Final bet #${bet.bet_number} with FIDs:`, betWithFid);
        return betWithFid;
      })
    );

    console.log("🎉 API: All bets processed with FIDs");
    return NextResponse.json({ bets: betsWithFids });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
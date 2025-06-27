import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY!,
});

const client = new NeynarAPIClient(config);

interface NeynarUserResponse {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  pfpUrl?: string;
  primary_eth_address?: string;
  primary_solana_address?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ users: [] });
  }

  try {
    const data = await client.searchUser({ q: query, limit: 10 });
    
    // Log the response to see the actual structure
    console.log("Neynar API response:", JSON.stringify(data, null, 2));
    
    // Transform the response to match our User interface
    const users = data.result.users?.map((user: NeynarUserResponse) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name || user.username,
      pfpUrl: user.pfp_url || user.pfpUrl || "",
      primaryEthAddress: user.primary_eth_address,
      primarySolanaAddress: user.primary_solana_address,
    })) || [];

    console.log("Transformed users:", JSON.stringify(users, null, 2));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
} 
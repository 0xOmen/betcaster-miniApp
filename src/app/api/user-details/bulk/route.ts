import { NextRequest, NextResponse } from "next/server";

interface NeynarUserResponse {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  pfpUrl?: string;
  primary_eth_address?: string;
  primary_solana_address?: string;
}

interface NeynarBulkResponse {
  users: NeynarUserResponse[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fids = searchParams.get('fids');

  if (!fids) {
    return NextResponse.json({ error: "Missing fids parameter" }, { status: 400 });
  }

  // Validate that fids are numbers
  const fidArray = fids.split(',').map(fid => Number(fid));
  if (fidArray.some(isNaN)) {
    return NextResponse.json({ error: "Invalid FID format" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk/?fids=${fids}`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.NEYNAR_API_KEY!,
      }
    });

    const data: NeynarBulkResponse = await response.json();
    console.log("Bulk user details API response:", JSON.stringify(data, null, 2));
    
    if (!data.users || data.users.length === 0) {
      return NextResponse.json({ error: "No users found" }, { status: 404 });
    }

    const users = data.users.map((user: NeynarUserResponse) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name || user.username,
      pfpUrl: user.pfp_url || user.pfpUrl || "",
      primaryEthAddress: user.primary_eth_address,
      primarySolanaAddress: user.primary_solana_address,
    }));

    console.log("Transformed bulk user details:", JSON.stringify(users, null, 2));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching bulk user details:", error);
    return NextResponse.json(
      { error: "Failed to fetch user details" },
      { status: 500 }
    );
  }
} 
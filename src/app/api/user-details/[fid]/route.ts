import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { fid: string } }
) {
  const { fid } = params;

  if (!fid || isNaN(Number(fid))) {
    return NextResponse.json({ error: "Invalid FID" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk/?fids=${fid}`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.NEYNAR_API_KEY!,
      }
    });

    const data = await response.json();
    console.log("User details API response:", JSON.stringify(data, null, 2));
    
    const user = data.users?.[0];
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userDetails = {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name || user.username,
      pfpUrl: user.pfp_url || "",
      primaryEthAddress: user.primary_eth_address,
      primarySolanaAddress: user.primary_solana_address,
    };

    console.log("Transformed user details:", JSON.stringify(userDetails, null, 2));

    return NextResponse.json({ user: userDetails });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return NextResponse.json(
      { error: "Failed to fetch user details" },
      { status: 500 }
    );
  }
} 
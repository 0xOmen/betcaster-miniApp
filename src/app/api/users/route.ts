import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fids = searchParams.get("fids");
    const address = searchParams.get("address");

    console.log("👤 Users API: Request params:", { fids, address });

    if (!fids && !address) {
      console.log("❌ Users API: Missing fids or address parameter");
      return NextResponse.json(
        { error: "Missing fids or address parameter" },
        { status: 400 }
      );
    }

    // Handle zero address case
    if (address === "0x0000000000000000000000000000000000000000") {
      console.log("👤 Users API: Returning default user for zero address");
      const defaultUser = {
        fid: 0,
        username: "anyone",
        display_name: "anyone",
        pfp_url: "/unknownEntity.png",
        verified_addresses: {
          primary: {
            eth_address: "0x0000000000000000000000000000000000000000",
          },
        },
      };
      return NextResponse.json({ users: [defaultUser] });
    }

    let url = "https://api.neynar.com/v2/farcaster/user";

    if (fids && fids.trim() !== "") {
      url += `/bulk?fids=${fids}`;
    } else if (address) {
      url =
        "https://api.neynar.com/v2/farcaster/user/bulk-by-address?" +
        new URLSearchParams({
          addresses: address,
        }).toString();
    }

    console.log("🌐 Users API: Calling Neynar URL:", url);

    const response = await fetch(url, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY || "",
      },
    });

    console.log("🌐 Users API: Neynar response status:", response.status);

    if (!response.ok) {
      console.error(
        "❌ Users API: Neynar API error:",
        response.status,
        response.statusText
      );
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✅ Users API: Neynar response data:", data);

    // Transform the response structure
    const users = address ? Object.values(data).flat() : data.users;

    return NextResponse.json({ users });
  } catch (error) {
    console.error("❌ Users API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fids = searchParams.get('fids');
    const address = searchParams.get('address');

    if (!fids && !address) {
      return NextResponse.json(
        { error: "Missing fids or address parameter" },
        { status: 400 }
      );
    }

    let url = 'https://api.neynar.com/v2/farcaster/user/bulk';
    
    if (fids) {
      url += `?fids=${fids}`;
    } else if (address) {
      url += `?addresses=${address}`;
    }

    const response = await fetch(url, {
      headers: {
        'api_key': process.env.NEYNAR_API_KEY || '',
      },
    });

    if (!response.ok) {
      console.error('Neynar API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

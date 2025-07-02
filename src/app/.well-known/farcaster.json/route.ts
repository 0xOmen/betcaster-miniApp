import { NextResponse } from 'next/server';
import { getFarcasterMetadata } from '../../../lib/utils';

export async function GET() {
  try {
    const config = await getFarcasterMetadata();
    return NextResponse.json(config, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating Farcaster metadata:', error);
    return NextResponse.json(
      { error: 'Failed to generate metadata' },
      { status: 500 }
    );
  }
}

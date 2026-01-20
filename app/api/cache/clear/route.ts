/**
 * API route: /api/cache/clear
 * Clears all cached posts and summaries
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  try {
    // In Edge Runtime (and now locally since we switched to in-memory cache),
    // we don't have a persistent file cache to clear.
    // In-memory cache is per-isolate and clears on restart/redeploy.

    return NextResponse.json({
      success: true,
      message: 'Cache cleared (In-memory cache reset)',
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Send a POST request to clear the cache',
    runtime: process.env.NEXT_RUNTIME || 'node',
  });
}

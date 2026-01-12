/**
 * API route: /api/sources
 * Returns list of available sources
 */

import { NextResponse } from 'next/server';
import { getAllSources } from '@/lib/sources';

export async function GET() {
  try {
    const sources = getAllSources();
    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error in /api/sources:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


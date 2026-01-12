/**
 * API route: /api/cache/clear
 * Clears all cached posts and summaries
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const POSTS_CACHE_FILE = path.join(CACHE_DIR, 'posts.json');
const SUMMARIES_CACHE_FILE = path.join(CACHE_DIR, 'summaries.json');
const FETCH_TIMESTAMPS_FILE = path.join(CACHE_DIR, 'fetch-timestamps.json');

export async function POST() {
  try {
    // Clear posts cache
    try {
      await fs.writeFile(POSTS_CACHE_FILE, JSON.stringify({}), 'utf-8');
    } catch (error) {
      // File might not exist, that's okay
    }

    // Clear summaries cache
    try {
      await fs.writeFile(SUMMARIES_CACHE_FILE, JSON.stringify({}), 'utf-8');
    } catch (error) {
      // File might not exist, that's okay
    }

    // Clear fetch timestamps
    try {
      await fs.writeFile(FETCH_TIMESTAMPS_FILE, JSON.stringify({}), 'utf-8');
    } catch (error) {
      // File might not exist, that's okay
    }

    return NextResponse.json({ 
      success: true,
      message: 'Cache cleared successfully',
      cacheLocation: CACHE_DIR,
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
  try {
    // Return cache info
    const cacheInfo = {
      cacheLocation: CACHE_DIR,
      files: [
        { name: 'posts.json', path: POSTS_CACHE_FILE },
        { name: 'summaries.json', path: SUMMARIES_CACHE_FILE },
        { name: 'fetch-timestamps.json', path: FETCH_TIMESTAMPS_FILE },
      ],
      instructions: {
        clearViaAPI: 'POST /api/cache/clear',
        clearViaCLI: 'rm -rf .cache/',
        clearViaCode: 'Delete the .cache/ directory in your project root',
      },
    };

    return NextResponse.json(cacheInfo);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get cache info' },
      { status: 500 }
    );
  }
}


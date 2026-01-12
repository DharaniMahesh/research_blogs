/**
 * API route: /api/fetch
 * Fetches latest posts from a source with lazy pagination support
 * Query params: sourceId (required), page (optional, default: 1), maxPosts (optional, default: 70)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSourceById } from '@/lib/sources';
import { fetchPostsFromSource } from '@/lib/scraper';
import { getCachedPosts, appendCachedPosts, setCachedPosts, setLastFetchTime, shouldRefresh } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceId = searchParams.get('sourceId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const maxPosts = parseInt(searchParams.get('maxPosts') || '70', 10);

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId query parameter is required' },
        { status: 400 }
      );
    }

    const source = getSourceById(sourceId);
    if (!source) {
      return NextResponse.json(
        { error: `Source not found: ${sourceId}` },
        { status: 404 }
      );
    }

    // For page 1, check if we need to refresh (default: 6 hours)
    // For subsequent pages, always fetch fresh
    const refreshIntervalHours = parseInt(
      searchParams.get('refreshIntervalHours') || '6',
      10
    );
    const needsRefresh = page === 1 ? await shouldRefresh(sourceId, refreshIntervalHours) : true;

    if (!needsRefresh && page === 1) {
      // Return cached posts for page 1 only
      const cachedPosts = await getCachedPosts(sourceId);
      return NextResponse.json({
        posts: cachedPosts,
        sourceId,
        page: 1,
        hasMore: cachedPosts.length >= maxPosts,
        fetchedAt: new Date().toISOString(),
        cached: true,
      });
    }

    // Get detected pattern from query param (if available from previous page)
    const detectedPattern = searchParams.get('detectedPattern') || undefined;
    
    // Fetch new posts with pagination
    const result = await fetchPostsFromSource(source, { 
      page, 
      maxPosts,
      detectedPattern: detectedPattern || undefined
    });

    // Update cache
    if (page === 1) {
      // Replace cache for first page
      await setCachedPosts(sourceId, result.posts);
      await setLastFetchTime(sourceId, Date.now());
    } else {
      // Append to cache for subsequent pages
      await appendCachedPosts(sourceId, result.posts);
    }

    return NextResponse.json({
      posts: result.posts,
      sourceId,
      page,
      hasMore: result.hasMore,
      nextPageUrl: result.nextPageUrl,
      detectedPattern: result.detectedPattern,
      fetchedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Error in /api/fetch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


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

    // Generate cache key based on sourceId and filters
    const researchArea = searchParams.get('researchArea') || undefined;
    const category = searchParams.get('category') || undefined;
    // Use underscores for cleaner filenames in the new cache system
    const cacheKey = `${sourceId}${category && category !== 'all' ? `_${category}` : ''}${researchArea ? `_${researchArea}` : ''}`;

    // For page 1, check if we need to refresh (default: 6 hours)
    const refreshIntervalHours = parseInt(
      searchParams.get('refreshIntervalHours') || '6',
      10
    );

    // Check cache
    let posts = await getCachedPosts(cacheKey);
    const needsRefresh = await shouldRefresh(cacheKey, refreshIntervalHours);

    // Force refresh if cache is empty, even if timestamp is recent
    // This prevents getting stuck with an empty cache if a previous fetch failed
    const isCacheEmpty = posts.length === 0;
    const shouldFetch = (page === 1 && (needsRefresh || isCacheEmpty)) || (page > 1);

    console.log(`[API] ${sourceId}: page=${page}, category=${category || 'all'}, cacheKey=${cacheKey}`);
    console.log(`[API] ${sourceId}: cachedPosts=${posts.length}, needsRefresh=${needsRefresh}, isCacheEmpty=${isCacheEmpty} -> shouldFetch=${shouldFetch}`);

    let hasMore = false;
    let nextPageUrl: string | undefined;
    let detectedPattern: string | undefined;

    if (shouldFetch) {
      console.log(`[API] ${sourceId}: Fetching fresh posts...`);

      // Get detected pattern from query param (if available from previous page)
      const prevPattern = searchParams.get('detectedPattern') || undefined;

      try {
        const result = await fetchPostsFromSource(source, {
          page,
          maxPosts,
          detectedPattern: prevPattern,
          category,
          researchArea
        });

        const fetchedPosts = result.posts;
        hasMore = result.hasMore;
        nextPageUrl = result.nextPageUrl;
        detectedPattern = result.detectedPattern;

        console.log(`[API] ${sourceId}: Fetched ${fetchedPosts.length} posts`);

        if (fetchedPosts.length > 0) {
          // Always merge with existing cache to build up the full dataset
          // This ensures that if we fetch Page 2, it gets added to the cache
          // and subsequent "Page 1" requests (from cache) return the full set.
          await appendCachedPosts(cacheKey, fetchedPosts);

          // If it was a Page 1 fetch, we also update the timestamp
          if (page === 1) {
            await setLastFetchTime(cacheKey, Date.now());
          }

          // Return the fresh posts for this request
          posts = fetchedPosts;
        } else {
          console.warn(`[API] ${sourceId}: Fetched 0 posts!`);
          if (page === 1 && posts.length > 0) {
            console.log(`[API] ${sourceId}: Keeping existing cache of ${posts.length} posts.`);
            // Don't overwrite valid cache with empty unless we're sure
          } else {
            posts = [];
          }
        }
      } catch (error) {
        console.error(`[API] ${sourceId}: Fetch error:`, error);
        // If fetch fails, fall back to cache if available
        if (posts.length === 0) {
          throw error;
        }
        // If we have cache, use it (and maybe signal error in headers?)
        console.log(`[API] ${sourceId}: Falling back to cache due to error`);
      }
    } else {
      console.log(`[API] ${sourceId}: Serving from cache`);
      // Optimistic hasMore: If we are serving from cache, we assume there might be more.
      // The client will ask for the next page, which will trigger a fresh fetch (since page > 1).
      // If that fresh fetch returns nothing, the client will stop then.
      // This fixes the issue where a small cache (e.g. 10 posts) prevents fetching more.
      hasMore = true;
    }

    return NextResponse.json({
      posts,
      sourceId,
      page,
      hasMore,
      nextPageUrl,
      detectedPattern,
      fetchedAt: new Date().toISOString(),
      cached: !shouldFetch,
    });

  } catch (error) {
    console.error('Error in /api/fetch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


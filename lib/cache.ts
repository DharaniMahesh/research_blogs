/**
 * Simple cache for posts and summaries
 * Uses in-memory Map for Edge compatibility (Cloudflare Workers)
 * Note: File-system persistence is currently disabled to ensure Edge compatibility.
 */

import { Post, SummarizationResult } from '@/types';

// In-memory cache
const memoryCache = {
  posts: new Map<string, Post[]>(),
  summaries: new Map<string, SummarizationResult>(),
  timestamps: new Map<string, number>(),
};

/**
 * Get cached posts for a source
 */
export async function getCachedPosts(sourceId: string): Promise<Post[]> {
  return memoryCache.posts.get(sourceId) || [];
}

/**
 * Set cached posts for a source
 */
export async function setCachedPosts(sourceId: string, posts: Post[]): Promise<void> {
  memoryCache.posts.set(sourceId, posts);
}

/**
 * Append posts to cached posts for a source (for pagination)
 */
export async function appendCachedPosts(sourceId: string, newPosts: Post[]): Promise<void> {
  const existingPosts = await getCachedPosts(sourceId);

  // Deduplicate by URL
  const existingUrls = new Set(existingPosts.map(p => p.url));
  const uniqueNewPosts = newPosts.filter(p => !existingUrls.has(p.url));

  if (uniqueNewPosts.length > 0) {
    await setCachedPosts(sourceId, [...existingPosts, ...uniqueNewPosts]);
  }
}

/**
 * Get all cached posts
 */
export async function getAllCachedPosts(): Promise<Post[]> {
  const allPosts: Post[] = [];
  for (const posts of memoryCache.posts.values()) {
    allPosts.push(...posts);
  }
  return allPosts;
}

/**
 * Get cached summary for a URL
 */
export async function getCachedSummary(url: string): Promise<SummarizationResult | null> {
  return memoryCache.summaries.get(url) || null;
}

/**
 * Set cached summary for a URL
 */
export async function setCachedSummary(url: string, summary: SummarizationResult): Promise<void> {
  memoryCache.summaries.set(url, summary);
}

/**
 * Get last fetch timestamp for a source
 */
export async function getLastFetchTime(sourceId: string): Promise<number | null> {
  return memoryCache.timestamps.get(sourceId) || null;
}

/**
 * Set last fetch timestamp for a source
 */
export async function setLastFetchTime(sourceId: string, timestamp: number): Promise<void> {
  memoryCache.timestamps.set(sourceId, timestamp);
}

/**
 * Check if source needs refresh (default: 6 hours)
 */
export async function shouldRefresh(sourceId: string, refreshIntervalHours: number = 6): Promise<boolean> {
  const lastFetch = await getLastFetchTime(sourceId);
  if (!lastFetch) return true;

  const now = Date.now();
  const intervalMs = refreshIntervalHours * 60 * 60 * 1000;
  return (now - lastFetch) > intervalMs;
}

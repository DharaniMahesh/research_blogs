/**
 * Simple filesystem-based cache for posts and summaries
 * Uses JSON files stored in .cache directory
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Post, SummarizationResult } from '@/types';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const POSTS_CACHE_FILE = path.join(CACHE_DIR, 'posts.json');
const SUMMARIES_CACHE_FILE = path.join(CACHE_DIR, 'summaries.json');
const FETCH_TIMESTAMPS_FILE = path.join(CACHE_DIR, 'fetch-timestamps.json');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PostsCache {
  [sourceId: string]: Post[];
}

interface SummariesCache {
  [url: string]: SummarizationResult;
}

interface FetchTimestamps {
  [sourceId: string]: number;
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Read JSON file or return default
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Write JSON file
 */
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get cached posts for a source
 */
export async function getCachedPosts(sourceId: string): Promise<Post[]> {
  const cache = await readJsonFile<PostsCache>(POSTS_CACHE_FILE, {});
  return cache[sourceId] || [];
}

/**
 * Set cached posts for a source
 */
export async function setCachedPosts(sourceId: string, posts: Post[]): Promise<void> {
  const cache = await readJsonFile<PostsCache>(POSTS_CACHE_FILE, {});
  cache[sourceId] = posts;
  await writeJsonFile(POSTS_CACHE_FILE, cache);
}

/**
 * Append posts to cached posts for a source (for pagination)
 */
export async function appendCachedPosts(sourceId: string, newPosts: Post[]): Promise<void> {
  const cache = await readJsonFile<PostsCache>(POSTS_CACHE_FILE, {});
  const existingPosts = cache[sourceId] || [];
  
  // Deduplicate by URL
  const existingUrls = new Set(existingPosts.map(p => p.url));
  const uniqueNewPosts = newPosts.filter(p => !existingUrls.has(p.url));
  
  cache[sourceId] = [...existingPosts, ...uniqueNewPosts];
  await writeJsonFile(POSTS_CACHE_FILE, cache);
}

/**
 * Get all cached posts
 */
export async function getAllCachedPosts(): Promise<Post[]> {
  const cache = await readJsonFile<PostsCache>(POSTS_CACHE_FILE, {});
  return Object.values(cache).flat();
}

/**
 * Get cached summary for a URL
 */
export async function getCachedSummary(url: string): Promise<SummarizationResult | null> {
  const cache = await readJsonFile<SummariesCache>(SUMMARIES_CACHE_FILE, {});
  return cache[url] || null;
}

/**
 * Set cached summary for a URL
 */
export async function setCachedSummary(url: string, summary: SummarizationResult): Promise<void> {
  const cache = await readJsonFile<SummariesCache>(SUMMARIES_CACHE_FILE, {});
  cache[url] = summary;
  await writeJsonFile(SUMMARIES_CACHE_FILE, cache);
}

/**
 * Get last fetch timestamp for a source
 */
export async function getLastFetchTime(sourceId: string): Promise<number | null> {
  const timestamps = await readJsonFile<FetchTimestamps>(FETCH_TIMESTAMPS_FILE, {});
  return timestamps[sourceId] || null;
}

/**
 * Set last fetch timestamp for a source
 */
export async function setLastFetchTime(sourceId: string, timestamp: number): Promise<void> {
  const timestamps = await readJsonFile<FetchTimestamps>(FETCH_TIMESTAMPS_FILE, {});
  timestamps[sourceId] = timestamp;
  await writeJsonFile(FETCH_TIMESTAMPS_FILE, timestamps);
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


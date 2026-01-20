/**
 * Simple filesystem-based cache for posts and summaries
 * Uses JSON files stored in .cache directory
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Post, SummarizationResult } from '@/types';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const POSTS_DIR = path.join(CACHE_DIR, 'posts'); // New directory for individual post files
const SUMMARIES_CACHE_FILE = path.join(CACHE_DIR, 'summaries.json');
const FETCH_TIMESTAMPS_FILE = path.join(CACHE_DIR, 'fetch-timestamps.json');

interface FetchTimestamps {
  [sourceId: string]: number;
}

interface SummariesCache {
  [url: string]: SummarizationResult;
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.mkdir(POSTS_DIR, { recursive: true });
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
 * Now reads from individual file: .cache/posts/{sourceId}.json
 */
export async function getCachedPosts(sourceId: string): Promise<Post[]> {
  // Sanitize sourceId to be safe for filename
  const safeId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(POSTS_DIR, `${safeId}.json`);
  return readJsonFile<Post[]>(filePath, []);
}

/**
 * Set cached posts for a source
 */
export async function setCachedPosts(sourceId: string, posts: Post[]): Promise<void> {
  const safeId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(POSTS_DIR, `${safeId}.json`);
  await writeJsonFile(filePath, posts);
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
 * Iterates through all files in posts directory
 */
export async function getAllCachedPosts(): Promise<Post[]> {
  await ensureCacheDir();
  try {
    const files = await fs.readdir(POSTS_DIR);
    const allPosts: Post[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const posts = await readJsonFile<Post[]>(path.join(POSTS_DIR, file), []);
        allPosts.push(...posts);
      }
    }
    return allPosts;
  } catch (error) {
    return [];
  }
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


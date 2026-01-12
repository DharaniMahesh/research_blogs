/**
 * Unit tests for scraper functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPostsFromSource } from '@/lib/scraper';
import { Source } from '@/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('Scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch posts from RSS feed', async () => {
    const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <item>
      <title>Test Post 1</title>
      <link>https://example.com/post1</link>
      <description>Test description</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRssXml),
    });

    const source: Source = {
      id: 'test-source',
      name: 'Test Source',
      homepage: 'https://example.com',
      rss: 'https://example.com/feed.xml',
      allowScrape: false,
    };

    const posts = await fetchPostsFromSource(source);
    
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('Test Post 1');
    expect(posts[0].url).toBe('https://example.com/post1');
  });

  it('should handle RSS fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const source: Source = {
      id: 'test-source',
      name: 'Test Source',
      homepage: 'https://example.com',
      rss: 'https://example.com/feed.xml',
      allowScrape: false,
    };

    await expect(fetchPostsFromSource(source)).rejects.toThrow();
  });

  it('should require RSS or blogListUrl', async () => {
    const source: Source = {
      id: 'test-source',
      name: 'Test Source',
      homepage: 'https://example.com',
      allowScrape: false,
    };

    await expect(fetchPostsFromSource(source)).rejects.toThrow();
  });
});


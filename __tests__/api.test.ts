/**
 * API route tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getPosts } from '@/app/api/posts/route';
import { GET as getSources } from '@/app/api/sources/route';
import { NextRequest } from 'next/server';
import { setCachedPosts } from '@/lib/cache';
import { Post } from '@/types';

// Mock cache
vi.mock('@/lib/cache', () => ({
  getAllCachedPosts: vi.fn(),
  getCachedPosts: vi.fn(),
  setCachedPosts: vi.fn(),
  getCachedSummary: vi.fn(),
  setCachedSummary: vi.fn(),
  getLastFetchTime: vi.fn(),
  setLastFetchTime: vi.fn(),
  shouldRefresh: vi.fn(),
}));

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/posts', () => {
    it('should return paginated posts', async () => {
      const mockPosts: Post[] = [
        {
          id: '1',
          sourceId: 'test-source',
          title: 'Test Post 1',
          url: 'https://example.com/post1',
          fetchedAt: new Date().toISOString(),
        },
        {
          id: '2',
          sourceId: 'test-source',
          title: 'Test Post 2',
          url: 'https://example.com/post2',
          fetchedAt: new Date().toISOString(),
        },
      ];

      const { getAllCachedPosts } = await import('@/lib/cache');
      (getAllCachedPosts as any).mockResolvedValue(mockPosts);

      const request = new NextRequest('http://localhost:3000/api/posts?limit=1&offset=0');
      const response = await getPosts(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(1);
      expect(data.pagination.total).toBe(2);
      expect(data.pagination.hasMore).toBe(true);
    });

    it('should filter by sourceId', async () => {
      const mockPosts: Post[] = [
        {
          id: '1',
          sourceId: 'source-1',
          title: 'Post 1',
          url: 'https://example.com/post1',
          fetchedAt: new Date().toISOString(),
        },
        {
          id: '2',
          sourceId: 'source-2',
          title: 'Post 2',
          url: 'https://example.com/post2',
          fetchedAt: new Date().toISOString(),
        },
      ];

      const { getAllCachedPosts } = await import('@/lib/cache');
      (getAllCachedPosts as any).mockResolvedValue(mockPosts);

      const request = new NextRequest('http://localhost:3000/api/posts?sourceId=source-1');
      const response = await getPosts(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].sourceId).toBe('source-1');
    });

    it('should filter by keyword', async () => {
      const mockPosts: Post[] = [
        {
          id: '1',
          sourceId: 'test',
          title: 'Machine Learning Post',
          url: 'https://example.com/post1',
          summary: 'About ML',
          fetchedAt: new Date().toISOString(),
        },
        {
          id: '2',
          sourceId: 'test',
          title: 'Web Development Post',
          url: 'https://example.com/post2',
          summary: 'About web dev',
          fetchedAt: new Date().toISOString(),
        },
      ];

      const { getAllCachedPosts } = await import('@/lib/cache');
      (getAllCachedPosts as any).mockResolvedValue(mockPosts);

      const request = new NextRequest('http://localhost:3000/api/posts?keyword=machine');
      const response = await getPosts(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].title).toContain('Machine Learning');
    });
  });

  describe('GET /api/sources', () => {
    it('should return list of sources', async () => {
      const response = await getSources();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sources).toBeDefined();
      expect(Array.isArray(data.sources)).toBe(true);
    });
  });
});


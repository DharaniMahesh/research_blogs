/**
 * API route: /api/posts
 * Returns paginated posts with optional filtering
 * Query params: sourceId?, limit?, offset?, keyword?, dateFrom?, dateTo?
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllCachedPosts } from '@/lib/cache';
import { PostsQueryParams } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10) || 20;
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
    const params: PostsQueryParams = {
      sourceId: searchParams.get('sourceId') || undefined,
      limit,
      offset,
      keyword: searchParams.get('keyword') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    };

    // Get all cached posts
    let posts = await getAllCachedPosts();

    // Filter by sourceId
    if (params.sourceId) {
      posts = posts.filter(p => p.sourceId === params.sourceId);
    }

    // Filter by keyword (search in title, summary, bullets)
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      posts = posts.filter(p => {
        const searchableText = [
          p.title,
          p.summary,
          ...(p.bullets || []),
        ].join(' ').toLowerCase();
        return searchableText.includes(keyword);
      });
    }

    // Filter by date range
    if (params.dateFrom) {
      const dateFrom = new Date(params.dateFrom);
      posts = posts.filter(p => {
        if (!p.publishedAt) return false;
        return new Date(p.publishedAt) >= dateFrom;
      });
    }

    if (params.dateTo) {
      const dateTo = new Date(params.dateTo);
      posts = posts.filter(p => {
        if (!p.publishedAt) return true; // Include posts without dates
        return new Date(p.publishedAt) <= dateTo;
      });
    }

    // Sort by publishedAt (newest first) or fetchedAt
    posts.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.fetchedAt).getTime();
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.fetchedAt).getTime();
      return dateB - dateA;
    });

    // Paginate
    const total = posts.length;
    const paginatedPosts = posts.slice(offset, offset + limit);

    return NextResponse.json({
      posts: paginatedPosts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error in /api/posts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


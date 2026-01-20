/**
 * API route: /api/summarize
 * Summarizes a blog post using LLM
 * Body: { url, title, content } or { url }
 */

import { NextRequest, NextResponse } from 'next/server';
import { summarizePost } from '@/lib/summarize';
import { getCachedSummary, setCachedSummary } from '@/lib/cache';
import { fetchUrl } from '@/lib/scraper';
import * as cheerio from 'cheerio';

export const runtime = 'edge';

/**
 * Extract text content from HTML (reuse scraper logic)
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, .sidebar, .navigation').remove();

  const contentSelectors = [
    'article',
    '.post-content',
    '.entry-content',
    '#main',
    '.article-body',
    '.content',
    'main',
  ];

  let content = '';
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  if (!content) {
    content = $('body').text();
  }

  return content
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100 * 1024); // Limit to 100KB
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, content, author, publishedAt } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = await getCachedSummary(url);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // If content not provided, fetch from URL
    let postContent = content;
    let postTitle = title;

    if (!postContent) {
      try {
        const html = await fetchUrl(url);
        postContent = extractTextFromHtml(html);

        // Try to extract title if not provided
        if (!postTitle) {
          const $ = cheerio.load(html);
          postTitle = $('title').text() || $('h1').first().text() || 'Untitled';
        }
      } catch (error) {
        return NextResponse.json(
          { error: `Failed to fetch content from URL: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    if (!postTitle) {
      postTitle = 'Untitled';
    }

    // Summarize using LLM
    const summary = await summarizePost(postContent, {
      title: postTitle,
      url,
      author,
      publishedAt,
    });

    // Cache the result
    await setCachedSummary(url, summary);

    return NextResponse.json({
      ...summary,
      cached: false,
    });
  } catch (error) {
    console.error('Error in /api/summarize:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


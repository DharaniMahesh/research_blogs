/**
 * Robust RSS and HTML scraping service
 * Tries RSS first, falls back to HTML scraping with multiple extraction strategies
 * Supports lazy pagination for better performance
 */

import * as cheerio from 'cheerio';
import { Source, Post } from '@/types';

import {
  fetchAppleMLPosts,
  fetchAmazonSciencePosts,
  fetchDeepMindPosts,
  fetchAWSArchitecturePosts,
  fetchCloudflarePosts,
  fetchMetaPosts,
  fetchGoogleResearchPosts,
  fetchHuggingFacePosts,
  fetchLinkedInEngineeringPosts,
  fetchMicrosoftResearchPosts,
  fetchMetaResearchPosts,
  fetchNetflixResearchPosts,
  fetchNvidiaDeveloperPosts,
  fetchOpenAIPosts,
  fetchSpotifyEngineeringPosts,
  fetchStripeEngineeringPosts,
  fetchUberEngineeringPosts,
} from './custom-scrapers';

// Use a realistic browser user agent to avoid blocking
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Retry wrapper for async functions
 */
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }

  throw lastError!;
}

/**
 * Fetch URL with proper headers and retry logic
 * Handles SSL certificate issues gracefully
 */
export async function fetchUrl(url: string, retries: number = MAX_RETRIES): Promise<string> {
  return retry(async () => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      return response.text();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorMessage.includes('UNABLE_TO_VERIFY')) {
        console.warn(`SSL issue detected for ${url}, retrying with minimal headers...`);
        try {
          const simpleResponse = await fetch(url, {
            headers: {
              'User-Agent': USER_AGENT,
            },
          });

          if (!simpleResponse.ok) {
            throw new Error(`Failed to fetch ${url}: ${simpleResponse.status} ${simpleResponse.statusText}`);
          }

          return simpleResponse.text();
        } catch (retryError) {
          throw new Error(
            `SSL certificate verification failed for ${url}. ` +
            `This may be a temporary network issue. Please try again later. ` +
            `Original error: ${errorMessage}`
          );
        }
      }

      throw error;
    }
  }, retries);
}

/**
 * Check robots.txt (simplified - just checks if domain allows scraping)
 */
async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    const robotsTxt = await fetchUrl(robotsUrl, 1); // Only 1 retry for robots.txt

    // Simple check: if robots.txt contains "Disallow: /" for our user agent, disallow
    if (robotsTxt.includes('Disallow: /') && !robotsTxt.includes('Allow:')) {
      return false;
    }
    return true;
  } catch (error) {
    // If robots.txt doesn't exist or can't be fetched, allow scraping
    return true;
  }
}

/**
 * Extract structured data (JSON-LD) from HTML
 */
function extractStructuredData(html: string): any[] {
  const $ = cheerio.load(html);
  const structuredData: any[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonText = $(element).html();
      if (jsonText) {
        const data = JSON.parse(jsonText);
        structuredData.push(data);
      }
    } catch (error) {
      // Invalid JSON, skip
    }
  });

  return structuredData;
}

/**
 * Extract posts from structured data (JSON-LD)
 */
function extractPostsFromStructuredData(structuredData: any[], baseUrl: string, sourceId: string): Post[] {
  const posts: Post[] = [];

  for (const data of structuredData) {
    // Handle BlogPosting schema
    if (data['@type'] === 'BlogPosting' || data['@type'] === 'Article') {
      if (data.url || data.mainEntityOfPage?.['@id']) {
        const url = data.url || data.mainEntityOfPage?.['@id'] || data.mainEntityOfPage;
        const title = data.headline || data.name || '';
        const publishedAt = data.datePublished || data.dateCreated;
        const author = data.author?.name || data.author?.['@name'] || data.author;
        const imageUrl = data.image?.url || data.image?.['@url'] || data.image;

        if (url && title) {
          try {
            const absoluteUrl = new URL(url, baseUrl).toString();
            const urlPath = new URL(absoluteUrl).pathname;
            const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
            const postId = `${sourceId}-${urlSlug}`;

            posts.push({
              id: postId,
              sourceId,
              title: String(title),
              url: absoluteUrl,
              author: author ? String(author) : undefined,
              publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
              imageUrl: imageUrl ? String(imageUrl) : undefined,
              fetchedAt: new Date().toISOString(),
            });
          } catch {
            // Invalid URL, skip
          }
        }
      }
    }

    // Handle Blog or ItemList schema
    if (data['@type'] === 'Blog' && Array.isArray(data.blogPost)) {
      for (const post of data.blogPost) {
        if (post['@type'] === 'BlogPosting' || post['@type'] === 'Article') {
          const url = post.url || post.mainEntityOfPage?.['@id'];
          const title = post.headline || post.name || '';
          if (url && title) {
            try {
              const absoluteUrl = new URL(url, baseUrl).toString();
              const urlPath = new URL(absoluteUrl).pathname;
              const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
              const postId = `${sourceId}-${urlSlug}`;

              posts.push({
                id: postId,
                sourceId,
                title: String(title),
                url: absoluteUrl,
                author: post.author?.name ? String(post.author.name) : undefined,
                publishedAt: post.datePublished ? new Date(post.datePublished).toISOString() : undefined,
                imageUrl: post.image?.url ? String(post.image.url) : undefined,
                fetchedAt: new Date().toISOString(),
              });
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }
    }

    // Handle ItemList schema
    if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
      for (const item of data.itemListElement) {
        if (item.item?.['@type'] === 'BlogPosting' || item.item?.['@type'] === 'Article') {
          const url = item.item.url || item.item.mainEntityOfPage?.['@id'] || item.url;
          const title = item.item.headline || item.item.name || item.name || '';
          if (url && title) {
            try {
              const absoluteUrl = new URL(url, baseUrl).toString();
              const urlPath = new URL(absoluteUrl).pathname;
              const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
              const postId = `${sourceId}-${urlSlug}`;

              posts.push({
                id: postId,
                sourceId,
                title: String(title),
                url: absoluteUrl,
                author: item.item.author?.name ? String(item.item.author.name) : undefined,
                publishedAt: item.item.datePublished ? new Date(item.item.datePublished).toISOString() : undefined,
                imageUrl: item.item.image?.url ? String(item.item.image.url) : undefined,
                fetchedAt: new Date().toISOString(),
              });
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }
    }
  }

  return posts;
}

/**
 * Extract image URL from HTML (header/featured image)
 */
function extractImageUrl(html: string, baseUrl: string): string | undefined {
  const $ = cheerio.load(html);

  // Try common image selectors (in priority order)
  const imageSelectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="og:image:secure_url"]',
    'article img:first',
    '.featured-image img',
    '.post-image img',
    '.header-image img',
    'img[class*="hero"]',
    'img[class*="featured"]',
    'img[class*="header"]',
    'main img:first',
    'article img',
  ];

  for (const selector of imageSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      let imageUrl = element.attr('content') || element.attr('src') || element.attr('data-src');
      if (imageUrl) {
        // Resolve relative URLs
        try {
          const absoluteUrl = new URL(imageUrl, baseUrl).toString();
          // Filter out small icons/logos
          if (!absoluteUrl.includes('icon') && !absoluteUrl.includes('logo') && !absoluteUrl.includes('avatar')) {
            return absoluteUrl;
          }
        } catch {
          // Invalid URL, continue
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html: string, url: string): string {
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, aside, .sidebar, .navigation, .menu, .header, .footer').remove();

  // Try common content selectors
  const contentSelectors = [
    'article',
    '.post-content',
    '.entry-content',
    '#main',
    '.article-body',
    '.content',
    'main',
    '[role="main"]',
    '.post-body',
    '.article-content',
  ];

  let content = '';
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content = element.text();
      if (content.trim().length > 100) {
        break; // Found substantial content
      }
    }
  }

  // Fallback: use body if no specific content found
  if (!content || content.trim().length < 100) {
    content = $('body').text();
  }

  // Clean up: remove extra whitespace, limit to 100KB
  content = content
    .replace(/\s+/g, ' ')
    .trim();

  const maxLength = 100 * 1024; // 100KB
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '...';
  }

  return content;
}

/**
 * Extract title from HTML page
 */
function extractTitleFromHtml(html: string, fallbackTitle: string): string {
  const $ = cheerio.load(html);

  // Try common title selectors
  const titleSelectors = [
    'h1',
    '.post-title',
    '.entry-title',
    '.article-title',
    'title',
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    '[itemprop="headline"]',
    'article h1',
  ];

  for (const selector of titleSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const title = element.attr('content') || element.attr('itemprop') || element.text().trim();
      if (title && title.length > 5 && title !== fallbackTitle) {
        return title;
      }
    }
  }

  return fallbackTitle;
}

/**
 * Parse RSS content using cheerio (Edge compatible)
 */
function parseRssWithCheerio(xml: string): any {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: any[] = [];

  $('item, entry').each((_, elem) => {
    const $item = $(elem);

    // Extract basic fields
    const title = $item.find('title').text().trim();
    const link = $item.find('link').text().trim() || $item.find('link').attr('href');
    const pubDate = $item.find('pubDate').text().trim() || $item.find('published').text().trim() || $item.find('updated').text().trim();
    const author = $item.find('author name').text().trim() || $item.find('dc\\:creator').text().trim() || $item.find('creator').text().trim();
    const content = $item.find('content\\:encoded').text().trim() || $item.find('content').text().trim();
    const contentSnippet = $item.find('description').text().trim() || $item.find('summary').text().trim();

    // Extract media
    const mediaThumbnail = {
      url: $item.find('media\\:thumbnail').attr('url') || $item.find('thumbnail').attr('url')
    };

    const mediaContent = {
      url: $item.find('media\\:content').attr('url'),
      medium: $item.find('media\\:content').attr('medium')
    };

    const enclosure = {
      url: $item.find('enclosure').attr('url'),
      type: $item.find('enclosure').attr('type')
    };

    items.push({
      title,
      link,
      pubDate,
      author,
      content,
      contentSnippet,
      mediaThumbnail,
      mediaContent,
      enclosure
    });
  });

  return { items };
}

/**
 * Fetch posts from RSS feed
 */
export async function fetchFromRss(rssUrl: string, sourceId: string): Promise<Post[]> {
  try {
    let rssContent: string | null = null;

    try {
      rssContent = await fetchUrl(rssUrl);
    } catch (fetchError) {
      console.error(`Error fetching RSS from ${rssUrl}:`, fetchError);
      throw fetchError;
    }

    if (!rssContent) {
      throw new Error(`Failed to fetch RSS content from ${rssUrl}`);
    }

    const feed = parseRssWithCheerio(rssContent);
    return processRssFeed(feed, sourceId);
  } catch (error) {
    console.error(`Error fetching RSS from ${rssUrl}:`, error);
    throw error;
  }
}

/**
 * Process RSS feed items into Post objects
 */
function processRssFeed(feed: any, sourceId: string): Post[] {
  const posts: Post[] = [];

  // Limit to 70 posts max
  const items = feed.items.slice(0, 70);

  for (const item of items) {
    if (!item.link || !item.title) continue;

    // Generate unique ID from URL
    let urlPath = '';
    try {
      urlPath = new URL(item.link).pathname;
    } catch {
      urlPath = item.link;
    }

    const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
    const postId = `${sourceId}-${urlSlug}`;

    const post: Post = {
      id: postId,
      sourceId,
      title: item.title,
      url: item.link,
      author: item.author || undefined,
      publishedAt: item.pubDate || undefined,
      fetchedAt: new Date().toISOString(),
    };

    // Try to extract content from description or content
    if (item.contentSnippet || item.content) {
      post.summary = (item.contentSnippet || item.content || '').substring(0, 200);
    }

    // Try to extract image from RSS item
    const thumbnailUrl = item.mediaThumbnail?.url;
    const contentUrl = item.mediaContent?.url;

    if (thumbnailUrl) {
      post.imageUrl = thumbnailUrl;
    } else if (contentUrl && (item.mediaContent?.medium === 'image')) {
      post.imageUrl = contentUrl;
    } else if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      post.imageUrl = item.enclosure.url;
    } else {
      // Try to extract image from HTML content if available
      const content = item.content || item.contentSnippet;
      if (content && typeof content === 'string') {
        const $ = cheerio.load(content);
        const img = $('img').first();
        if (img.length > 0) {
          const imgSrc = img.attr('src');
          if (imgSrc) {
            try {
              post.imageUrl = new URL(imgSrc, item.link).toString();
            } catch {
              post.imageUrl = imgSrc;
            }
          }
        }
      }
    }

    posts.push(post);
  }

  return posts;
}

/**
 * Extract post links from a blog listing page HTML using multiple strategies
 */
function extractPostLinksFromPage(html: string, baseUrl: string): { url: string; title: string }[] {
  const $ = cheerio.load(html);
  const postLinks: { url: string; title: string }[] = [];
  const seenUrls = new Set<string>();

  // Strategy 1: Try structured data (JSON-LD) first
  const structuredData = extractStructuredData(html);
  if (structuredData.length > 0) {
    // This will be handled separately in fetchFromHtml
  }

  // Strategy 2: Try semantic HTML5 article elements
  const articleSelectors = [
    'article',
    '[role="article"]',
    '.post',
    '.blog-post',
    '.entry',
    '[class*="post"]',
    '[class*="article"]',
    '[class*="blog"]',
    '.card',
    '.item',
  ];

  for (const articleSelector of articleSelectors) {
    $(articleSelector).each((_, articleElement) => {
      const $article = $(articleElement);

      // Find link within article - try multiple strategies
      let $link = $article.find('a[href*="/blog/"], a[href*="/post/"], a[href*="/article/"]').first();
      if ($link.length === 0) {
        $link = $article.find('a').first();
      }

      if ($link.length === 0) return;

      const href = $link.attr('href');
      if (!href) return;

      // Try multiple title sources
      let title = '';
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4',
        '.title', '.post-title', '.entry-title', '.article-title',
        '[class*="title"]',
        '[itemprop="headline"]',
      ];

      for (const titleSel of titleSelectors) {
        const $title = $article.find(titleSel).first();
        if ($title.length > 0) {
          title = $title.text().trim();
          if (title && title.length >= 5) break;
        }
      }

      // Fallback to link text
      if (!title || title.length < 5) {
        title = $link.text().trim();
      }

      // Also try getting title from attributes
      if ((!title || title.length < 5) && $link.attr('aria-label')) {
        title = $link.attr('aria-label') || '';
      }
      if ((!title || title.length < 5) && $link.attr('title')) {
        title = $link.attr('title') || '';
      }
      if ((!title || title.length < 5) && $article.attr('aria-label')) {
        title = $article.attr('aria-label') || '';
      }

      // Accept titles with at least 5 characters
      if (href && title && title.length >= 5) {
        try {
          // Validate href before creating URL object
          const hrefLower = href.toLowerCase().trim();

          // Filter out invalid URLs
          if (hrefLower.startsWith('javascript:') ||
            hrefLower.startsWith('mailto:') ||
            hrefLower.startsWith('tel:') ||
            hrefLower.startsWith('data:') ||
            hrefLower === '#' ||
            hrefLower === '' ||
            hrefLower.includes('javascript(') ||
            hrefLower.includes('void(') ||
            hrefLower.includes('javascript:void')) {
            return; // Skip invalid URLs
          }

          const absoluteUrl = new URL(href, baseUrl).toString();

          // Additional validation on absolute URL
          if (absoluteUrl.includes('javascript:') ||
            absoluteUrl.includes('javascript(') ||
            absoluteUrl.includes('void(') ||
            absoluteUrl.includes('mailto:') ||
            absoluteUrl.includes('tel:') ||
            absoluteUrl.includes('data:')) {
            return; // Skip invalid absolute URLs
          }

          // More flexible URL pattern matching
          if (!seenUrls.has(absoluteUrl) &&
            !absoluteUrl.endsWith('/') &&
            !absoluteUrl.includes('#') &&
            (absoluteUrl.includes('/blog/') ||
              absoluteUrl.includes('/post/') ||
              absoluteUrl.includes('/article/') ||
              absoluteUrl.includes('/research/') ||
              absoluteUrl.match(/\d{4}\/\d{2}/) ||
              absoluteUrl.match(/\/\d{4}\//))) {
            seenUrls.add(absoluteUrl);
            postLinks.push({ url: absoluteUrl, title });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });
  }

  // Strategy 3: Fallback to direct link selectors
  if (postLinks.length === 0) {
    const linkSelectors = [
      'article a',
      '.post a',
      '.entry-title a',
      'a[href*="/blog/"]',
      'a[href*="/post/"]',
      'a[href*="/article/"]',
      '.article-link',
      'h2 a',
      'h3 a',
      '[class*="post"] a',
    ];

    for (const selector of linkSelectors) {
      $(selector).each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        if (!href) return;

        let title = $link.text().trim();

        // Try to get title from parent or nearby elements
        if (!title || title.length < 5) {
          title = $link.closest('article, .post, .entry, .card').find('h1, h2, h3, h4').first().text().trim() || title;
        }

        // Accept titles with at least 5 characters
        if (href && title && title.length >= 5) {
          try {
            // Validate href before creating URL object
            const hrefLower = href.toLowerCase().trim();

            // Filter out invalid URLs
            if (hrefLower.startsWith('javascript:') ||
              hrefLower.startsWith('mailto:') ||
              hrefLower.startsWith('tel:') ||
              hrefLower.startsWith('data:') ||
              hrefLower === '#' ||
              hrefLower === '' ||
              hrefLower.includes('javascript(') ||
              hrefLower.includes('void(') ||
              hrefLower.includes('javascript:void')) {
              return; // Skip invalid URLs
            }

            const absoluteUrl = new URL(href, baseUrl).toString();

            // Additional validation on absolute URL
            if (absoluteUrl.includes('javascript:') ||
              absoluteUrl.includes('javascript(') ||
              absoluteUrl.includes('void(') ||
              absoluteUrl.includes('mailto:') ||
              absoluteUrl.includes('tel:') ||
              absoluteUrl.includes('data:')) {
              return; // Skip invalid absolute URLs
            }

            if (!seenUrls.has(absoluteUrl) &&
              !absoluteUrl.endsWith('/') &&
              !absoluteUrl.includes('#') &&
              (absoluteUrl.includes('/blog/') ||
                absoluteUrl.includes('/post/') ||
                absoluteUrl.includes('/article/') ||
                absoluteUrl.includes('/research/') ||
                absoluteUrl.match(/\d{4}\/\d{2}/) ||
                absoluteUrl.match(/\/\d{4}\//))) {
              seenUrls.add(absoluteUrl);
              postLinks.push({ url: absoluteUrl, title });
            }
          } catch {
            // Invalid URL, skip
          }
        }
      });
    }
  }

  return postLinks;
}

/**
 * Find pagination links (next page, page 2, etc.)
 */
function findPaginationLinks(html: string, currentUrl: string): string[] {
  const $ = cheerio.load(html);
  const paginationUrls: string[] = [];
  const seenUrls = new Set<string>();

  // Common pagination selectors
  const paginationSelectors = [
    'a[rel="next"]',
    '.pagination a[href*="page"]',
    '.pagination a[href*="p="]',
    '.pagination-next',
    '.next-page',
    'a:contains("Next")',
    'a:contains("Older")',
    'a:contains("More")',
    '[class*="pagination"] a',
    '[class*="next"] a',
    '[aria-label*="next" i]',
    '[aria-label*="Next" i]',
  ];

  // Try to find next page link
  for (const selector of paginationSelectors) {
    const $link = $(selector).first();
    if ($link.length > 0) {
      const href = $link.attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, currentUrl).toString();
          if (!seenUrls.has(absoluteUrl) && absoluteUrl !== currentUrl) {
            seenUrls.add(absoluteUrl);
            paginationUrls.push(absoluteUrl);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  // Also try to find numbered page links (page 2, 3, etc.)
  const pageNumberPatterns = [
    'a[href*="/page/"]',
    'a[href*="?page="]',
    'a[href*="&page="]',
    'a[href*="/p/"]',
    'a[href*="?p="]',
    'a[href*="&p="]',
  ];

  for (const pattern of pageNumberPatterns) {
    $(pattern).each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();

      const isPageNumber = /^\d+$/.test(text) && parseInt(text) <= 10;
      const hrefHasPageNumber = href && (
        /[?&]p=\d+/.test(href) ||
        /[?&]page=\d+/.test(href) ||
        /\/page\/\d+/.test(href) ||
        /\/p\/\d+/.test(href)
      );

      if (href && (isPageNumber || hrefHasPageNumber)) {
        try {
          const absoluteUrl = new URL(href, currentUrl).toString();
          if (!seenUrls.has(absoluteUrl) && absoluteUrl !== currentUrl) {
            seenUrls.add(absoluteUrl);
            paginationUrls.push(absoluteUrl);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });
  }

  return paginationUrls;
}

/**
 * Detect pagination pattern from HTML (from first page)
 */
function detectPaginationPattern(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  let detectedUrl: string | null = null;

  // Look for pagination links
  const paginationSelectors = [
    'a[rel="next"]',
    '.pagination a',
    '.pagination-next',
    '.next-page',
    'a:contains("Next")',
    'a:contains("2")', // Page 2 link
    '[class*="pagination"] a',
  ];

  for (const selector of paginationSelectors) {
    $(selector).each((_, element) => {
      if (detectedUrl) return false; // Stop iteration if we found one

      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();

      // Check if it's a page 2 link
      if (href && (text === '2' || /^2$/.test(text) || href.includes('page=2') || href.includes('p=2') || href.includes('/page/2') || href.includes('/p/2'))) {
        try {
          const absoluteUrl = new URL(href, currentUrl).toString();
          detectedUrl = absoluteUrl;
          return false; // Stop iteration
        } catch {
          // Invalid URL, continue
        }
      }
    });

    if (detectedUrl) break; // Found a pattern, stop searching
  }

  return detectedUrl;
}

/**
 * Construct page URL based on detected pattern
 */
function constructPageUrl(blogListUrl: string, page: number, detectedPatternUrl: string | null): string {
  if (page === 1) {
    return blogListUrl;
  }

  // If we have a detected pattern, use it as template
  if (detectedPatternUrl) {
    try {
      const patternUrl = new URL(detectedPatternUrl);
      const baseUrl = new URL(blogListUrl);

      // Replace page number in the detected pattern
      let constructedUrl = detectedPatternUrl;

      // Replace ?page=2 or &page=2 with new page number
      constructedUrl = constructedUrl.replace(/[?&]page=\d+/, (match) => {
        return match.startsWith('?') ? `?page=${page}` : `&page=${page}`;
      });

      // Replace ?p=2 or &p=2 with new page number
      constructedUrl = constructedUrl.replace(/[?&]p=\d+/, (match) => {
        return match.startsWith('?') ? `?p=${page}` : `&p=${page}`;
      });

      // Replace /page/2 or /p/2 with new page number
      constructedUrl = constructedUrl.replace(/\/page\/\d+/, `/page/${page}`);
      constructedUrl = constructedUrl.replace(/\/p\/\d+/, `/p/${page}`);

      // If URL changed, return it
      if (constructedUrl !== detectedPatternUrl) {
        return constructedUrl;
      }
    } catch {
      // Fall through to default pattern
    }
  }

  // Default: Use ?page=2& pattern (Google Research style)
  const urlObj = new URL(blogListUrl);
  const basePath = urlObj.pathname;
  const baseSearch = urlObj.search;

  if (baseSearch) {
    if (baseSearch.includes('page=')) {
      const searchWithPage = baseSearch.replace(/[?&]page=\d+/, (match) => {
        return match.startsWith('?') ? `?page=${page}&` : `&page=${page}&`;
      });
      return `${urlObj.origin}${basePath}${searchWithPage}`;
    } else {
      return `${urlObj.origin}${basePath}${baseSearch}&page=${page}&`;
    }
  } else {
    return `${urlObj.origin}${basePath}?page=${page}&`;
  }
}

/**
 * Fetch posts by scraping HTML (lazy pagination - only first page by default)
 */
export async function fetchFromHtml(
  blogListUrl: string,
  sourceId: string,
  baseUrl: string,
  options: { page?: number; maxPosts?: number; detectedPattern?: string | null } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
  const { page = 1, maxPosts = 70, detectedPattern } = options;

  // Check robots.txt first
  const canScrape = await checkRobotsTxt(baseUrl);
  if (!canScrape) {
    throw new Error(`Scraping disallowed by robots.txt for ${baseUrl}`);
  }

  // Determine URL to fetch - use detected pattern or default
  let urlToFetch: string;

  if (page > 1) {
    urlToFetch = constructPageUrl(blogListUrl, page, detectedPattern || null);
  } else {
    urlToFetch = blogListUrl;
  }

  try {
    console.log(`[${sourceId}] Fetching page ${page}: ${urlToFetch}`);
    const html = await fetchUrl(urlToFetch);

    // Detect pagination pattern from first page
    let detectedPatternUrl: string | null = detectedPattern || null;
    if (page === 1) {
      detectedPatternUrl = detectPaginationPattern(html, urlToFetch);
      if (detectedPatternUrl) {
        console.log(`[${sourceId}] Detected pagination pattern: ${detectedPatternUrl}`);
      }
    }

    // Strategy 1: Try structured data first
    const structuredData = extractStructuredData(html);
    let posts: Post[] = [];

    if (structuredData.length > 0) {
      posts = extractPostsFromStructuredData(structuredData, baseUrl, sourceId);
      console.log(`[${sourceId}] Found ${posts.length} posts from structured data`);
    }

    // Strategy 2: Fallback to HTML parsing
    if (posts.length === 0) {
      const postLinks = extractPostLinksFromPage(html, urlToFetch);
      console.log(`[${sourceId}] Found ${postLinks.length} post links on page ${page}`);

      // Limit to maxPosts
      const linksToFetch = postLinks.slice(0, maxPosts - posts.length);

      // Fetch each post (with retry)
      for (let i = 0; i < linksToFetch.length && posts.length < maxPosts; i++) {
        const { url, title: linkTitle } = linksToFetch[i];
        try {
          const postHtml = await fetchUrl(url);
          const content = extractTextFromHtml(postHtml, url);
          const actualTitle = extractTitleFromHtml(postHtml, linkTitle);
          const imageUrl = extractImageUrl(postHtml, url);

          // Extract published date
          const $ = cheerio.load(postHtml);
          let publishedAt: string | undefined;
          const dateSelectors = [
            'time[datetime]',
            'meta[property="article:published_time"]',
            'meta[name="publish_date"]',
            '.published-date',
            '[class*="date"]',
            '[itemprop="datePublished"]',
          ];

          for (const selector of dateSelectors) {
            const element = $(selector).first();
            if (element.length > 0) {
              const dateStr = element.attr('datetime') || element.attr('content') || element.text().trim();
              if (dateStr) {
                try {
                  const date = new Date(dateStr);
                  if (!isNaN(date.getTime())) {
                    publishedAt = date.toISOString();
                    break;
                  }
                } catch {
                  // Invalid date, continue
                }
              }
            }
          }

          // Generate unique ID from URL
          const urlPath = new URL(url).pathname;
          const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
          const postId = `${sourceId}-${urlSlug}`;

          const post: Post = {
            id: postId,
            sourceId,
            title: actualTitle,
            url,
            publishedAt,
            fetchedAt: new Date().toISOString(),
            rawHtml: content.substring(0, 5000),
            imageUrl,
          };

          posts.push(post);
          console.log(`[${sourceId}] Fetched post ${posts.length}/${maxPosts}: ${actualTitle.substring(0, 50)}...`);

          // Add small delay to be polite
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`[${sourceId}] Error fetching post ${i + 1} (${url}):`, error);
          // Continue with other posts
        }
      }
    }

    // Find next page URL
    const paginationLinks = findPaginationLinks(html, urlToFetch);
    const nextPageUrl = paginationLinks.length > 0 ? paginationLinks[0] : undefined;
    const hasMore = posts.length < maxPosts && (nextPageUrl !== undefined || page < 10);

    console.log(`[${sourceId}] Page ${page} complete: ${posts.length} posts, hasMore: ${hasMore}`);

    return { posts, hasMore, nextPageUrl, detectedPattern: detectedPatternUrl };
  } catch (error) {
    console.error(`[${sourceId}] Error fetching page ${page} from ${urlToFetch}:`, error);
    throw error;
  }
}

/**
 * Custom scraper for Anthropic Research
 * Scrapes publications from main research page and team pages
 * Publications are in a table format with Date, Category, and Title columns
 */
async function fetchAnthropicPosts(
  sourceId: string,
  options: { page?: number; maxPosts?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
  const { maxPosts = 70 } = options;
  const posts: Post[] = [];
  const seenUrls = new Set<string>();

  // URLs to scrape - Anthropic has publications on multiple pages
  const anthropicUrls = [
    'https://www.anthropic.com/research',
    'https://www.anthropic.com/research/team/alignment',
    'https://www.anthropic.com/research/team/interpretability',
  ];

  console.log(`[${sourceId}] Using custom Anthropic scraper for ${anthropicUrls.length} pages`);

  for (const url of anthropicUrls) {
    const postsBefore = posts.length;
    try {
      console.log(`[${sourceId}] Fetching: ${url}`);
      const html = await fetchUrl(url);
      const $ = cheerio.load(html);

      // Find the Publications list - Anthropic uses a <ul> structure, not a table
      // Look for list items with the specific Anthropic class structure
      let foundPublications = false;

      // Strategy 1: Find list items with Anthropic's specific class structure
      // Structure: <ul class="...PublicationList...__list"> <li> <a class="...listItem">
      // More specific: target the exact class pattern
      const publicationListItems = $('ul[class*="PublicationList"] li a[class*="listItem"], ul[class*="PublicationList"] li a[href*="/research/"], ul[class*="PublicationList"] li a[href*="/news/"]');

      if (publicationListItems.length > 0) {
        console.log(`[${sourceId}] Found ${publicationListItems.length} publication list items on ${url}`);
        foundPublications = true;

        publicationListItems.each((_, linkElement) => {
          if (posts.length >= maxPosts) return false; // Stop if we've reached max

          const $link = $(linkElement);
          const href = $link.attr('href');
          const linkText = $link.text().trim();

          // Skip if no href or invalid
          if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
            return;
          }

          // Extract date from <time> element
          const $time = $link.find('time[class*="date"], time');
          let dateText = '';
          if ($time.length > 0) {
            dateText = $time.text().trim() || $time.attr('datetime') || '';
          }

          // Extract category from <span> with class containing "subject"
          const $category = $link.find('span[class*="subject"], span[class*="category"]');
          let categoryText = '';
          if ($category.length > 0) {
            categoryText = $category.text().trim();
          }

          // Extract title from <span> with class containing "title" or use link text
          const $title = $link.find('span[class*="title"]');
          let titleText = '';
          if ($title.length > 0) {
            titleText = $title.text().trim();
          } else {
            // Fallback: use link text, but filter out date and category
            titleText = linkText
              .replace(/[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4}/g, '') // Remove date
              .replace(/\b(Alignment|Interpretability|Societal Impacts|Economic Research|Policy|Product|Announcements|Evaluations)\b/gi, '') // Remove category
              .trim();
          }

          // If we still don't have a title, try extracting from the link's parent structure
          if (!titleText || titleText.length < 5) {
            // Look for title in the link's text content, excluding meta info
            const allText = $link.text();
            const parts = allText.split(/\s{2,}|\n/).map(p => p.trim()).filter(p => p.length > 5);
            // Find the longest part that's not a date or category
            titleText = parts.find(p =>
              !p.match(/^[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4}$/) &&
              !p.match(/^(Alignment|Interpretability|Societal Impacts|Economic Research|Policy|Product|Announcements|Evaluations)$/i) &&
              p.length > 10
            ) || parts[parts.length - 1] || linkText;
          }

          // If still no date, try to extract from text content
          if (!dateText) {
            const linkParentText = $link.parent().text();
            const dateMatch = linkParentText.match(/([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})/);
            if (dateMatch) {
              dateText = dateMatch[1];
            }
          }

          // If still no category, try to extract from text content
          if (!categoryText) {
            const linkParentText = $link.parent().text();
            const categoryMatch = linkParentText.match(/\b(Alignment|Interpretability|Societal Impacts|Economic Research|Policy|Product|Announcements|Evaluations)\b/i);
            if (categoryMatch) {
              categoryText = categoryMatch[1];
            }
          }

          // Validate we have required fields
          if (titleText && titleText.length > 5 && href) {
            try {
              const postUrl = new URL(href, url).toString();

              // Skip duplicates
              if (seenUrls.has(postUrl)) {
                return;
              }

              // Parse date
              let publishedAt: string | undefined;
              if (dateText) {
                try {
                  // Handle formats: "Dec 19, 2025", "Dec 19,2025", "Dec 19 2025"
                  const cleanDate = dateText.replace(/,/g, ', ').trim();
                  const parsedDate = new Date(cleanDate);
                  if (!isNaN(parsedDate.getTime())) {
                    publishedAt = parsedDate.toISOString();
                  }
                } catch {
                  // Invalid date format
                }
              }

              // Generate post ID
              const urlPath = new URL(postUrl).pathname;
              const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
              const postId = `${sourceId}-${urlSlug}`;

              const post: Post = {
                id: postId,
                sourceId,
                title: titleText,
                url: postUrl,
                publishedAt,
                fetchedAt: new Date().toISOString(),
              };

              posts.push(post);
              seenUrls.add(postUrl);
            } catch {
              // Invalid URL, skip
            }
          }
        });
      }

      // Strategy 2: Fallback - look for any links in list items that might be publications
      if (!foundPublications) {
        console.log(`[${sourceId}] Trying alternative extraction method for ${url}`);

        // Alternative: Look for publication entries in any structure
        // Find elements that contain date patterns and category keywords
        $('tr, li, div, article').each((_, element) => {
          if (posts.length >= maxPosts) return false;

          const $elem = $(element);
          const text = $elem.text().trim();

          // Look for date pattern
          const dateMatch = text.match(/([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})/);
          const categoryMatch = text.match(/\b(Alignment|Interpretability|Societal Impacts|Economic Research|Policy|Product)\b/);

          if (dateMatch && categoryMatch) {
            // Find link in this element
            const link = $elem.find('a').first();
            if (link.length > 0) {
              const titleText = link.text().trim();
              const href = link.attr('href');

              if (titleText && titleText.length > 10 && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                  const postUrl = new URL(href, url).toString();

                  if (!seenUrls.has(postUrl) && postUrl.includes('anthropic.com')) {
                    let publishedAt: string | undefined;
                    try {
                      const cleanDate = dateMatch[1].replace(/,/g, ', ').trim();
                      const parsedDate = new Date(cleanDate);
                      if (!isNaN(parsedDate.getTime())) {
                        publishedAt = parsedDate.toISOString();
                      }
                    } catch {
                      // Invalid date
                    }

                    const urlPath = new URL(postUrl).pathname;
                    const urlSlug = urlPath.split('/').filter(Boolean).join('-') || 'post';
                    const postId = `${sourceId}-${urlSlug}`;

                    const post: Post = {
                      id: postId,
                      sourceId,
                      title: titleText,
                      url: postUrl,
                      publishedAt,
                      fetchedAt: new Date().toISOString(),
                    };

                    posts.push(post);
                    seenUrls.add(postUrl);
                  }
                } catch {
                  // Invalid URL, skip
                }
              }
            }
          }
        });
      }

      const postsAfter = posts.length;
      const pagePosts = postsAfter - postsBefore;
      console.log(`[${sourceId}] Extracted ${pagePosts} new posts from ${url} (${postsAfter} total so far)`);

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[${sourceId}] Error fetching ${url}:`, error);
      // Continue with other URLs
    }
  }

  // Sort by date (newest first)
  posts.sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.fetchedAt).getTime();
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.fetchedAt).getTime();
    return dateB - dateA;
  });

  // Limit to maxPosts
  const limitedPosts = posts.slice(0, maxPosts);

  console.log(`[${sourceId}] Anthropic scraper completed: ${limitedPosts.length} total posts`);

  return {
    posts: limitedPosts,
    hasMore: false, // Anthropic doesn't have pagination on these pages
    detectedPattern: null,
  };
}

/**
 * Fetch posts from a source (RSS preferred, HTML fallback, custom scrapers)
 * Now supports lazy pagination - only fetches first page by default
 */
export async function fetchPostsFromSource(
  source: Source,
  options: { page?: number; maxPosts?: number; detectedPattern?: string | null; category?: string; researchArea?: string } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
  console.log(`[${source.id}] Starting fetch for source: ${source.name}`);
  try {
    // Check for custom scrapers first
    if (source.id === 'anthropic') {
      return await fetchAnthropicPosts(source.id, options);
    }

    // Custom Apple ML scraper - extracts from __NEXT_DATA__ JSON
    if (source.id === 'apple-ml') {
      return await fetchAppleMLPosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom Amazon Science scraper - uses RSS with client-side pagination
    if (source.id === 'amazon-science' && source.rss) {
      return await fetchAmazonSciencePosts(source.id, source.rss, fetchFromRss, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom DeepMind scraper - uses RSS with client-side pagination
    if (source.id === 'deepmind' && source.rss) {
      return await fetchDeepMindPosts(source.id, source.rss, fetchFromRss, {
        page: options.page || 1,
        maxPostsPerPage: 10,
        category: options.category
      });
    }

    // Custom AWS Architecture Blog scraper - uses HTML with /page/N/ pagination
    if (source.id === 'aws-architecture') {
      return await fetchAWSArchitecturePosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom Cloudflare Blog scraper - uses HTML with /page/N/ pagination
    if (source.id === 'cloudflare') {
      return await fetchCloudflarePosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom Meta Engineering Blog scraper - uses HTML with /page/N/ pagination
    // Custom Meta Engineering Hub (Custom Scraper)
    if (source.id === 'meta-engineering') {
      const result = await fetchMetaPosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10,
        category: options.category
      });
      return {
        posts: result.posts,
        hasMore: result.hasMore,
        nextPageUrl: result.nextPageUrl,
        detectedPattern: result.detectedPattern,
      };
    }

    // Custom Google Research Hub (Custom Scraper)
    if (source.id === 'google-research') {
      const result = await fetchGoogleResearchPosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10,
        category: options.category,
        researchArea: options.researchArea
      });
      return {
        posts: result.posts,
        hasMore: result.hasMore,
        nextPageUrl: result.nextPageUrl,
        detectedPattern: result.detectedPattern,
      };
    }

    // Custom Hugging Face Scraper
    if (source.id === 'huggingface') {
      return await fetchHuggingFacePosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom LinkedIn Engineering Scraper
    if (source.id === 'linkedin-engineering') {
      // Find the category URL if a category is specified
      let categoryUrl: string | undefined;
      if (options.category && options.category !== 'all' && source.categories) {
        const cat = source.categories.find(c => c.id === options.category);
        if (cat) {
          categoryUrl = cat.url;
        }
      }
      return await fetchLinkedInEngineeringPosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10,
        category: options.category,
        categoryUrl,
      });
    }

    // Custom Microsoft Research Scraper
    if (source.id === 'microsoft-research') {
      return await fetchMicrosoftResearchPosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom Netflix Research Scraper
    if (source.id === 'netflix-research') {
      return await fetchNetflixResearchPosts(source.id, fetchUrl, {
        page: options.page || 1,
        maxPostsPerPage: 10
      });
    }

    // Custom NVIDIA Developer Scraper
    if (source.id === 'nvidia-developer') {
      return await fetchNvidiaDeveloperPosts(source.id, fetchUrl, options);
    }

    // Custom OpenAI Scraper
    if (source.id === 'openai') {
      return await fetchOpenAIPosts(source.id, fetchUrl, options);
    }

    // Custom Meta Research Scraper
    if (source.id === 'meta-research') {
      return await fetchMetaResearchPosts(source.id, fetchUrl, options);
    }

    // Custom Spotify Engineering Scraper
    if (source.id === 'spotify-engineering') {
      return await fetchSpotifyEngineeringPosts(source.id, fetchUrl, options);
    }

    // Custom Stripe Engineering Scraper
    if (source.id === 'stripe-engineering') {
      return await fetchStripeEngineeringPosts(source.id, fetchUrl, options);
    }

    // Custom Uber Engineering Scraper
    if (source.id === 'uber-engineering') {
      return await fetchUberEngineeringPosts(source.id, fetchUrl, options);
    }

    // Try RSS first
    if (source.rss) {
      console.log(`[${source.id}] Using RSS feed: ${source.rss}`);
      const posts = await fetchFromRss(source.rss, source.id);
      console.log(`[${source.id}] RSS fetch completed: ${posts.length} posts`);
      return { posts, hasMore: false };
    }

    // Fallback to HTML scraping if allowed
    if (source.allowScrape && source.blogListUrl) {
      console.log(`[${source.id}] Using HTML scraping: ${source.blogListUrl}`);
      const result = await fetchFromHtml(source.blogListUrl, source.id, source.homepage, options);
      console.log(`[${source.id}] HTML scraping completed: ${result.posts.length} posts`);
      return result;
    }

    throw new Error(`No RSS feed or scrapeable URL for source ${source.id}`);
  } catch (error) {
    console.error(`[${source.id}] Error fetching posts:`, error);
    throw error;
  }
}

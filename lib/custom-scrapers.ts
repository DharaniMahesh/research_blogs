/**
 * Custom scrapers for specific blog sources
 * These scrapers handle sites that require special pagination or extraction logic
 */

import * as cheerio from 'cheerio';
import { Post } from '@/types';

// Export fetchUrl so it can be passed in from scraper.ts
export type FetchUrlFn = (url: string) => Promise<string>;
export type FetchFromRssFn = (rssUrl: string, sourceId: string) => Promise<Post[]>;

// ============================================================================
// APPLE ML RESEARCH SCRAPER
// ============================================================================

// Cache for Apple ML posts to avoid re-fetching the full list on every page request
let appleMLPostsCache: { posts: Post[]; fetchedAt: number } | null = null;
const APPLE_ML_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Custom scraper for Apple Machine Learning Research
 * Apple's website uses client-side JavaScript for pagination, so we extract ALL posts
 * from the embedded __NEXT_DATA__ JSON (which contains the full list) and paginate client-side.
 */
export async function fetchAppleMLPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const baseUrl = 'https://machinelearning.apple.com';
    const researchUrl = `${baseUrl}/research`;

    console.log(`[${sourceId}] Fetching Apple ML page ${page} (${maxPostsPerPage} per page)`);

    try {
        let allPosts: Post[] = [];

        // Check if we have cached posts
        if (appleMLPostsCache && (Date.now() - appleMLPostsCache.fetchedAt) < APPLE_ML_CACHE_TTL) {
            console.log(`[${sourceId}] Using cached Apple ML posts (${appleMLPostsCache.posts.length} total)`);
            allPosts = appleMLPostsCache.posts;
        } else {
            // Fetch the research page and extract __NEXT_DATA__ JSON
            const html = await fetchUrl(researchUrl);

            // Extract __NEXT_DATA__ script content
            const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
            if (!nextDataMatch) {
                console.error(`[${sourceId}] Could not find __NEXT_DATA__ in Apple ML page`);
                throw new Error('Apple ML: __NEXT_DATA__ not found');
            }

            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                const postsData = nextData?.props?.pageProps?.posts || [];

                console.log(`[${sourceId}] Found ${postsData.length} posts in __NEXT_DATA__`);

                // Convert to our Post format
                allPosts = postsData.map((p: {
                    documentId?: string;
                    slug?: string;
                    title?: string;
                    body?: string;
                    published?: string;
                    authors?: string[];
                    authorsOrdered?: string;
                }) => {
                    const slug = p.slug || p.documentId || 'unknown';
                    const postUrl = `${baseUrl}/research/${slug}`;
                    const postId = `${sourceId}-${slug}`;

                    // Parse the published date
                    let publishedAt: string | undefined;
                    if (p.published) {
                        try {
                            const date = new Date(p.published);
                            if (!isNaN(date.getTime())) {
                                publishedAt = date.toISOString();
                            }
                        } catch {
                            // Invalid date, skip
                        }
                    }

                    // Get authors
                    let author = p.authorsOrdered || '';
                    if (!author && p.authors && Array.isArray(p.authors)) {
                        author = p.authors.join(', ');
                    }

                    const post: Post = {
                        id: postId,
                        sourceId,
                        title: p.title || 'Untitled',
                        url: postUrl,
                        author: author || undefined,
                        publishedAt,
                        fetchedAt: new Date().toISOString(),
                        rawHtml: p.body?.substring(0, 1000),
                        imageUrl: 'https://mlr.cdn-apple.com/media/Home_1200x630_48225d82e9.png',
                    };

                    return post;
                });

                // Sort by published date (newest first)
                allPosts.sort((a, b) => {
                    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                    return dateB - dateA;
                });

                // Cache the posts
                appleMLPostsCache = { posts: allPosts, fetchedAt: Date.now() };

            } catch (parseError) {
                console.error(`[${sourceId}] Error parsing __NEXT_DATA__:`, parseError);
                throw new Error('Apple ML: Failed to parse __NEXT_DATA__');
            }
        }

        // Paginate: return only the requested page
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pagePosts = allPosts.slice(startIndex, endIndex);

        const hasMore = endIndex < allPosts.length;
        const totalPages = Math.ceil(allPosts.length / maxPostsPerPage);

        console.log(`[${sourceId}] Apple ML page ${page}/${totalPages}: Returning ${pagePosts.length} posts (${startIndex}-${endIndex} of ${allPosts.length}), hasMore: ${hasMore}`);

        if (pagePosts.length > 0) {
            console.log(`[${sourceId}] First post: "${pagePosts[0].title}" (${pagePosts[0].url})`);
        }

        return {
            posts: pagePosts,
            hasMore,
            nextPageUrl: hasMore ? `${researchUrl}?page=${page + 1}` : undefined,
            detectedPattern: 'client-side-pagination',
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Apple ML:`, error);
        throw error;
    }
}

// ============================================================================
// AMAZON SCIENCE SCRAPER
// ============================================================================

// Cache for Amazon Science posts (from RSS feed)
let amazonSciencePostsCache: { posts: Post[]; fetchedAt: number } | null = null;
const AMAZON_SCIENCE_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Custom scraper for Amazon Science
 * Amazon Science has an RSS feed with 1000+ posts. We fetch all from RSS once,
 * cache them, and paginate client-side for consistent results.
 */
export async function fetchAmazonSciencePosts(
    sourceId: string,
    rssUrl: string,
    fetchFromRss: FetchFromRssFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;

    console.log(`[${sourceId}] Fetching Amazon Science page ${page} (${maxPostsPerPage} per page)`);

    try {
        let allPosts: Post[] = [];

        // Check if we have cached posts
        if (amazonSciencePostsCache && (Date.now() - amazonSciencePostsCache.fetchedAt) < AMAZON_SCIENCE_CACHE_TTL) {
            console.log(`[${sourceId}] Using cached Amazon Science posts (${amazonSciencePostsCache.posts.length} total)`);
            allPosts = amazonSciencePostsCache.posts;
        } else {
            // Fetch from RSS feed
            console.log(`[${sourceId}] Fetching fresh posts from RSS: ${rssUrl}`);
            allPosts = await fetchFromRss(rssUrl, sourceId);

            // Sort by published date (newest first)
            allPosts.sort((a, b) => {
                const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                return dateB - dateA;
            });

            // Cache the posts
            amazonSciencePostsCache = { posts: allPosts, fetchedAt: Date.now() };
            console.log(`[${sourceId}] Cached ${allPosts.length} posts from Amazon Science RSS`);
        }

        // Paginate: return only the requested page
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pagePosts = allPosts.slice(startIndex, endIndex);

        const hasMore = endIndex < allPosts.length;
        const totalPages = Math.ceil(allPosts.length / maxPostsPerPage);

        console.log(`[${sourceId}] Amazon Science page ${page}/${totalPages}: Returning ${pagePosts.length} posts (${startIndex}-${endIndex} of ${allPosts.length}), hasMore: ${hasMore}`);

        if (pagePosts.length > 0) {
            console.log(`[${sourceId}] First post: "${pagePosts[0].title}" (${pagePosts[0].url})`);
        }

        return {
            posts: pagePosts,
            hasMore,
            nextPageUrl: hasMore ? `https://www.amazon.science/blog?page=${page + 1}` : undefined,
            detectedPattern: 'client-side-pagination',
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Amazon Science:`, error);
        throw error;
    }
}

// ============================================================================
// DEEPMIND RESEARCH SCRAPER
// ============================================================================

// Cache for DeepMind posts (blog + publications)
let deepMindPostsCache: { posts: Post[]; fetchedAt: number } | null = null;
const DEEPMIND_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetch a single publication's title from its page
 */
async function fetchPublicationTitle(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
        });
        if (!response.ok) return null;

        const html = await response.text();
        const $ = cheerio.load(html);

        // DeepMind uses h1 with class "section-title__title" for publication titles
        let title = $('h1.section-title__title').text().trim();
        if (!title) {
            title = $('h1').first().text().trim();
        }

        return title || null;
    } catch {
        return null;
    }
}

/**
 * Fetch DeepMind publications from HTML page
 */
async function fetchDeepMindPublications(): Promise<Post[]> {
    const publicationsUrl = 'https://deepmind.google/research/publications/';
    console.log(`[deepmind] Fetching publications from: ${publicationsUrl}`);

    try {
        const response = await fetch(publicationsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`[deepmind] Failed to fetch publications page: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract unique publication URLs and create posts
        const publications: Post[] = [];
        const seenIds = new Set<string>();

        $('a[href*="/research/publications/"]').each((i, elem) => {
            // Removed limit: if (publications.length >= 15) return false;

            const href = $(elem).attr('href');
            if (!href) return;

            const match = href.match(/\/research\/publications\/(\d+)/);
            if (!match) return;

            const pubId = match[1];
            if (seenIds.has(pubId)) return;
            seenIds.add(pubId);

            const fullUrl = `https://deepmind.google/research/publications/${pubId}/`;

            publications.push({
                id: `deepmind-pub-${pubId}`,
                sourceId: 'deepmind',
                title: `Research Publication #${pubId}`,
                url: fullUrl,
                category: 'publication',
                fetchedAt: new Date().toISOString(),
                imageUrl: 'https://storage.googleapis.com/gdm-deepmind-com-prod-public/icons/google_deepmind_2x_96dp.png',
            });
        });

        console.log(`[deepmind] Found ${publications.length} publications, fetching titles...`);

        // Fetch titles for ALL publications in batches
        // We limit concurrency to 5 to avoid overwhelming the server
        const batchSize = 5;
        let successCount = 0;

        for (let i = 0; i < publications.length; i += batchSize) {
            const batch = publications.slice(i, i + batchSize);
            const promises = batch.map(async (pub) => {
                try {
                    const pubResponse = await fetch(pub.url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        },
                        cache: 'no-store',
                    });

                    if (pubResponse.ok) {
                        const pubHtml = await pubResponse.text();
                        const $pub = cheerio.load(pubHtml);

                        // Try multiple selectors for the title
                        let title = $pub('h1.section-title__title').text().trim();
                        if (!title) title = $pub('h1.heading-1').text().trim();
                        if (!title) title = $pub('h1').first().text().trim();

                        if (title && title.length > 5) {
                            pub.title = title;
                            return true;
                        }
                    }
                } catch (e) {
                    console.error(`[deepmind] Failed to fetch title for ${pub.url}:`, e);
                }
                return false;
            });

            const results = await Promise.all(promises);
            successCount += results.filter(Boolean).length;

            // Small delay between batches to be nice
            if (i + batchSize < publications.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`[deepmind] Successfully prepared ${publications.length} publications`);
        return publications;
    } catch (error) {
        console.error(`[deepmind] Error fetching publications:`, error);
        return [];
    }
}

/**
 * Fetch DeepMind Science breakthroughs
 */
async function fetchDeepMindScience(): Promise<Post[]> {
    const scienceUrl = 'https://deepmind.google/science/';
    console.log(`[deepmind] Fetching science content from: ${scienceUrl}`);

    try {
        const response = await fetch(scienceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`[deepmind] Failed to fetch science page: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const posts: Post[] = [];
        const seenUrls = new Set<string>();

        // Map tab indices to categories
        const categoryMap: Record<number, string> = {
            0: 'Biology',
            1: 'Climate & Sustainability',
            2: 'Mathematics & Computer Science',
            3: 'Physics & Chemistry'
        };

        // Find all tab panels
        $('div[role="tabpanel"]').each((index, panel) => {
            const subCategory = categoryMap[index] || 'General Science';

            // Find cards within the panel
            $(panel).find('a').each((i, link) => {
                const href = $(link).attr('href');
                // Allow both /science/ and /blog/ links as they appear in the science tabs
                if (!href || (!href.includes('/science/') && !href.includes('/blog/'))) return;

                const fullUrl = href.startsWith('http') ? href : `https://deepmind.google${href}`;
                if (seenUrls.has(fullUrl)) return;
                seenUrls.add(fullUrl);

                // Extract title from data-event-content-name attribute (most reliable)
                // Format is usually "Title - Learn more"
                let title = $(link).attr('data-event-content-name');
                if (title) {
                    title = title.replace(/\s*-\s*Learn more$/i, '').trim();
                }

                // Fallback: try to find a heading
                if (!title) {
                    title = $(link).find('h3, h4, h5, .heading').first().text().trim();
                }

                // Fallback: try to find text that is NOT "Learn more"
                if (!title) {
                    const text = $(link).text().trim();
                    if (text && !text.toLowerCase().includes('learn more') && !text.toLowerCase().includes('read more')) {
                        title = text;
                    }
                }

                // Skip if title is too short or generic
                if (!title || title.length < 5 || title.toLowerCase() === 'read more' || title.toLowerCase() === 'learn more') return;

                const imageUrl = $(link).find('img').attr('src');
                const fullImageUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://deepmind.google${imageUrl}`) : undefined;

                const summary = $(link).find('p, .description').first().text().trim();

                posts.push({
                    id: `deepmind-science-${posts.length}`,
                    sourceId: 'deepmind',
                    title,
                    url: fullUrl,
                    category: 'science',
                    subCategory,
                    summary,
                    imageUrl: fullImageUrl,
                    fetchedAt: new Date().toISOString(),
                });
            });
        });

        console.log(`[deepmind] Found ${posts.length} science breakthroughs`);
        return posts;
    } catch (error) {
        console.error(`[deepmind] Error fetching science content:`, error);
        return [];
    }
}

/**
 * Custom scraper for DeepMind Research
 * Fetches from blog RSS + publications page + science page, categorizes content, and paginates client-side.
 */
export async function fetchDeepMindPosts(
    sourceId: string,
    rssUrl: string,
    fetchFromRss: FetchFromRssFn,
    options: { page?: number; maxPostsPerPage?: number; category?: string } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null; categories?: string[] }> {
    const { page = 1, maxPostsPerPage = 10, category } = options;

    console.log(`[${sourceId}] Fetching DeepMind page ${page} (${maxPostsPerPage} per page, category: ${category || 'all'})`);

    try {
        let allPosts: Post[] = [];

        // Check if we have cached posts
        if (deepMindPostsCache && (Date.now() - deepMindPostsCache.fetchedAt) < DEEPMIND_CACHE_TTL) {
            console.log(`[${sourceId}] Using cached DeepMind posts (${deepMindPostsCache.posts.length} total)`);
            allPosts = deepMindPostsCache.posts;
        } else {
            // Fetch blog posts from RSS
            console.log(`[${sourceId}] Fetching fresh posts from RSS: ${rssUrl}`);
            const blogPosts = await fetchFromRss(rssUrl, sourceId);

            // Add category to blog posts
            blogPosts.forEach(post => {
                post.category = 'blog';
            });

            // Fetch publications
            const publications = await fetchDeepMindPublications();

            // Fetch science content
            const sciencePosts = await fetchDeepMindScience();

            console.log(`[${sourceId}] Got ${blogPosts.length} blog, ${publications.length} pubs, ${sciencePosts.length} science`);

            // Merge: Science first (featured), then Blog, then Publications
            // We want to ensure we don't lose content, so we'll increase the limit
            allPosts = [...sciencePosts, ...blogPosts, ...publications];

            // Sort by date where possible, but keep Science at top if no date
            allPosts.sort((a, b) => {
                // Science posts usually don't have dates, keep them at top or interleave?
                // For now, let's keep Science at top as "Featured"
                if (a.category === 'science' && b.category !== 'science') return -1;
                if (a.category !== 'science' && b.category === 'science') return 1;

                const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                return dateB - dateA;
            });

            // Limit to 100 posts total (increased from 70)
            allPosts = allPosts.slice(0, 100);

            // Cache the posts
            deepMindPostsCache = { posts: allPosts, fetchedAt: Date.now() };
            console.log(`[${sourceId}] Cached ${allPosts.length} posts from DeepMind`);
        }

        // Filter by category if specified
        let filteredPosts = allPosts;
        if (category && category !== 'all') {
            filteredPosts = allPosts.filter(p => p.category === category || p.subCategory === category);
        }

        // Paginate: return only the requested page
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pagePosts = filteredPosts.slice(startIndex, endIndex);

        const hasMore = endIndex < filteredPosts.length;
        const totalPages = Math.ceil(filteredPosts.length / maxPostsPerPage);

        // Get available categories
        const categories = [...new Set(allPosts.map(p => p.category).filter(Boolean))];

        console.log(`[${sourceId}] DeepMind page ${page}/${totalPages}: Returning ${pagePosts.length} posts (${startIndex}-${endIndex} of ${filteredPosts.length}), hasMore: ${hasMore}`);

        if (pagePosts.length > 0) {
            console.log(`[${sourceId}] First post: "${pagePosts[0].title}" (${pagePosts[0].url})`);
        }

        return {
            posts: pagePosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'custom-deepmind',
            categories: categories as string[],
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching DeepMind:`, error);
        throw error;
    }
}

// Helper function to fetch publications HTML
async function fetchDeepMindPublicationsHelper(url: string): Promise<string> {
    // Use native fetch with proper headers
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.text();
}

// ============================================================================
// AWS ARCHITECTURE BLOG SCRAPER
// ============================================================================

/**
 * Custom scraper for AWS Architecture Blog
 * AWS RSS feed only contains ~20 posts. HTML pages use /page/N/ pagination.
 * We scrape HTML pages directly for better pagination support.
 */
export async function fetchAWSArchitecturePosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const baseUrl = 'https://aws.amazon.com/blogs/architecture/';

    // Construct URL for the requested page
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;

    console.log(`[${sourceId}] Fetching AWS Architecture page ${page}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const posts: Post[] = [];

        // Extract blog posts from the page
        $('article.blog-post, .blog-post-item, article[class*="post"]').each((i, elem) => {
            if (posts.length >= maxPostsPerPage) return false;

            const $article = $(elem);

            // Find the title link
            let $titleLink = $article.find('h2 a, .blog-post-title a, h3 a').first();
            if ($titleLink.length === 0) {
                $titleLink = $article.find('a[href*="/blogs/architecture/"]').first();
            }

            const href = $titleLink.attr('href');
            const title = $titleLink.text().trim();

            // Skip if no link or title
            if (!href || !title || title.length < 5) return;

            // Skip category/tag/author links
            if (href.includes('/category/') || href.includes('/tag/') || href.includes('/author/') || href.includes('/page/')) return;

            // Skip the main blogs/architecture/ page itself
            if (href === baseUrl || href === 'https://aws.amazon.com/blogs/architecture/') return;

            // Get publish date
            let publishedAt: string | undefined;
            const $date = $article.find('time, [class*="date"], [class*="Date"]').first();
            if ($date.length > 0) {
                const dateStr = $date.attr('datetime') || $date.text().trim();
                if (dateStr) {
                    try {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                            publishedAt = date.toISOString();
                        }
                    } catch {
                        // Invalid date
                    }
                }
            }

            // Build absolute URL
            const postUrl = href.startsWith('http') ? href : `https://aws.amazon.com${href}`;

            // Generate post ID from URL slug
            const urlSlug = postUrl.split('/').filter(s => s && !s.includes('.')).pop() || 'post';
            const postId = `${sourceId}-${urlSlug}`;

            // Extract image
            let imageUrl: string | undefined;
            const $img = $article.find('img[src*="cloudfront"], img.featured-image, img[class*="post-image"], img').first();
            if ($img.length > 0) {
                const imgSrc = $img.attr('src') || $img.attr('data-src');
                if (imgSrc && imgSrc.includes('cloudfront')) {
                    imageUrl = imgSrc;
                }
            }

            const post: Post = {
                id: postId,
                sourceId,
                title,
                url: postUrl,
                publishedAt,
                fetchedAt: new Date().toISOString(),
                imageUrl,
            };

            posts.push(post);
        });

        // Check for next page link
        const hasNextLink = $('a.pagination-next, a[rel="next"], .pagination a:contains("Next"), a:contains("Older posts")').length > 0;
        const hasMore = posts.length >= maxPostsPerPage && (hasNextLink || page < 50);

        console.log(`[${sourceId}] AWS Architecture page ${page}: Found ${posts.length} posts, hasMore: ${hasMore}`);

        if (posts.length > 0) {
            console.log(`[${sourceId}] First post: "${posts[0].title}" (${posts[0].url})`);
        }

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `${baseUrl}page/${page + 1}/` : undefined,
            detectedPattern: '/page/',
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching AWS Architecture page ${page}:`, error);
        throw error;
    }
}

// ============================================================================
// CLOUDFLARE BLOG SCRAPER
// ============================================================================

/**
 * Custom scraper for Cloudflare Blog
 * Cloudflare RSS feed only contains ~20 posts. HTML pages use /page/N/ pagination.
 * We scrape HTML pages directly for better pagination support.
 */
export async function fetchCloudflarePosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const baseUrl = 'https://blog.cloudflare.com/';

    // Construct URL for the requested page
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;

    console.log(`[${sourceId}] Fetching Cloudflare Blog page ${page}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const posts: Post[] = [];
        const seenUrls = new Set<string>();

        // Extract blog posts from article elements
        $('article').each((i, elem) => {
            if (posts.length >= maxPostsPerPage) return false;

            const $article = $(elem);

            // Find the title link - Cloudflare uses h2 with links
            let $titleLink = $article.find('h2 a, h3 a').first();
            if ($titleLink.length === 0) {
                // Fallback: find any link that looks like a post
                $titleLink = $article.find('a[href^="/"]').filter((_, el) => {
                    const href = $(el).attr('href') || '';
                    return !!(href.match(/^\/[a-z0-9-]+\/?$/) && !href.includes('/page/') && !href.includes('/tag/'));
                }).first();
            }

            let href = $titleLink.attr('href');
            let title = $titleLink.text().trim();

            // If no title from link, try h2/h3 directly
            if (!title) {
                title = $article.find('h2, h3').first().text().trim();
            }

            // Skip if no link or title
            if (!href || !title || title.length < 5) return;

            // Make URL absolute
            if (href.startsWith('/')) {
                href = `https://blog.cloudflare.com${href}`;
            }

            // Skip already seen URLs, pagination, tags, authors, and language variants
            if (seenUrls.has(href)) return;
            if (href.includes('/page/') || href.includes('/tag/') || href.includes('/author/')) return;
            if (href.match(/\/[a-z]{2}-[a-z]{2}\//)) return; // Skip language variants like /de-de/

            seenUrls.add(href);

            // Get publish date
            let publishedAt: string | undefined;
            const $time = $article.find('time').first();
            if ($time.length > 0) {
                const dateStr = $time.attr('datetime') || $time.text().trim();
                if (dateStr) {
                    try {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                            publishedAt = date.toISOString();
                        }
                    } catch {
                        // Invalid date
                    }
                }
            }

            // Generate post ID from URL slug
            const urlSlug = href.split('/').filter(s => s && !s.includes('.')).pop() || 'post';
            const postId = `${sourceId}-${urlSlug}`;

            // Extract image - Cloudflare uses various image patterns
            let imageUrl: string | undefined;
            const $img = $article.find('img[src*="cloudflare"], img[src*="cf-"], picture img, img').first();
            if ($img.length > 0) {
                imageUrl = $img.attr('src') || $img.attr('data-src');
            }

            const post: Post = {
                id: postId,
                sourceId,
                title,
                url: href,
                publishedAt,
                fetchedAt: new Date().toISOString(),
                imageUrl,
            };

            posts.push(post);
        });

        // Check for next page link
        const hasNextLink = $('a[href*="/page/"], a.pagination-next, a[rel="next"]').length > 0;
        const hasMore = posts.length > 0 && (hasNextLink || page < 50);

        console.log(`[${sourceId}] Cloudflare Blog page ${page}: Found ${posts.length} posts, hasMore: ${hasMore}`);

        if (posts.length > 0) {
            console.log(`[${sourceId}] First post: "${posts[0].title}" (${posts[0].url})`);
        }

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `${baseUrl}page/${page + 1}/` : undefined,
            detectedPattern: '/page/',
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Cloudflare Blog page ${page}:`, error);
        throw error;
    }
}

// ============================================================================
// META ENGINEERING SCRAPER
// ============================================================================

/**
 * Custom scraper for Meta Engineering Blog
 * Meta Engineering RSS feed only contains ~10 posts. HTML pages use /page/N/ pagination.
 * We scrape HTML pages directly for better pagination support.
 */
export async function fetchMetaEngineeringPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const baseUrl = 'https://engineering.fb.com/';

    // Construct URL for the requested page
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;

    console.log(`[${sourceId}] Fetching Meta Engineering page ${page}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const posts: Post[] = [];
        const seenUrls = new Set<string>();

        // Extract blog posts from article elements
        $('article, .post, .entry').each((i, elem) => {
            if (posts.length >= maxPostsPerPage) return false;

            const $article = $(elem);

            // Find the title link
            let $titleLink = $article.find('h2 a, h3 a, .entry-title a, .post-title a').first();
            if ($titleLink.length === 0) {
                $titleLink = $article.find('a[href*="engineering.fb.com"]').first();
            }

            const href = $titleLink.attr('href');
            let title = $titleLink.text().trim();

            // If no title from link, try h2/h3 directly
            if (!title) {
                title = $article.find('h2, h3, .entry-title, .post-title').first().text().trim();
            }

            // Skip if no link or title
            if (!href || !title || title.length < 5) return;

            // Skip already seen URLs, pagination, categories, tags
            if (seenUrls.has(href)) return;
            if (href.includes('/page/') || href.includes('/category/') || href.includes('/tag/') || href.includes('/author/')) return;

            seenUrls.add(href);

            // Get publish date
            let publishedAt: string | undefined;
            const $time = $article.find('time, .entry-date, .post-date, [class*="date"]').first();
            if ($time.length > 0) {
                const dateStr = $time.attr('datetime') || $time.text().trim();
                if (dateStr) {
                    try {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                            publishedAt = date.toISOString();
                        }
                    } catch {
                        // Invalid date
                    }
                }
            }

            // Generate post ID from URL slug
            const urlSlug = href.split('/').filter(s => s && !s.includes('.')).pop() || 'post';
            const postId = `${sourceId}-${urlSlug}`;

            // Extract image
            let imageUrl: string | undefined;
            const $img = $article.find('img[src], .featured-image img, .post-thumbnail img').first();
            if ($img.length > 0) {
                imageUrl = $img.attr('src') || $img.attr('data-src');
            }

            const post: Post = {
                id: postId,
                sourceId,
                title,
                url: href,
                publishedAt,
                fetchedAt: new Date().toISOString(),
                imageUrl,
            };

            posts.push(post);
        });

        // Check for next page link
        const hasNextLink = $('a[href*="/page/"], a.next, .pagination a:contains("Next"), .pagination a:contains("Older")').length > 0;
        const hasMore = posts.length > 0 && (hasNextLink || page < 50);

        if (posts.length > 0) {
            console.log(`[${sourceId}] First post: "${posts[0].title}" (${posts[0].url})`);
        }

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `${baseUrl}page/${page + 1}/` : undefined,
            detectedPattern: '/page/',
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Meta Engineering page ${page}:`, error);
        throw error;
    }
}

/**
 * Fetch Meta Research publications
 * Scrapes https://research.facebook.com/publications/
 */
async function fetchMetaPublications(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<Post[]> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const baseUrl = 'https://research.facebook.com/publications/';
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/?s`;

    console.log(`[${sourceId}] Fetching Meta Publications page ${page}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);
        const posts: Post[] = [];

        // Based on inspection, publications are likely in a list
        // We look for links that look like publications
        $('a[href*="/publications/"]').each((i, elem) => {
            let href = $(elem).attr('href');
            if (!href) return;

            // Resolve relative URLs
            if (href.startsWith('/')) {
                href = `https://research.facebook.com${href}`;
            }

            if (href === baseUrl || href === 'https://research.facebook.com/publications/') return;

            // Check if it's a publication link (usually has a slug)
            // Filter out common non-publication paths
            if (href.includes('/page/') || href.includes('/research-area/') || href.includes('/people/') || href.includes('/blog/') || href.includes('/tag/')) return;

            if (href.split('/').length < 5) return;

            const title = $(elem).text().trim();
            if (!title || title.length < 10 || title === 'Paper' || title === 'Load More') return;

            // Check if we already have this post
            if (posts.some(p => p.url === href)) return;

            // Try to find description (next sibling or parent's text)
            let summary = '';
            const parent = $(elem).parent();
            if (parent.length) {
                summary = parent.text().replace(title, '').trim();
                // Clean up summary
                if (summary.startsWith('Paper')) summary = summary.substring(5).trim();
            }

            const post: Post = {
                id: `meta-pub-${href.split('/').filter(Boolean).pop()}`,
                sourceId,
                title,
                url: href,
                summary: summary.substring(0, 200) + (summary.length > 200 ? '...' : ''),
                category: 'publication',
                fetchedAt: new Date().toISOString(),
                imageUrl: 'https://research.facebook.com/img/meta_research_og_image.jpeg', // Default Meta Research image
            };

            posts.push(post);
        });

        console.log(`[${sourceId}] Found ${posts.length} publications`);
        return posts;
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Meta publications:`, error);
        return [];
    }
}

// Cache for Meta posts (blog + publications)
let metaPostsCache: { posts: Post[]; fetchedAt: number } | null = null;
const META_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Combined scraper for Meta (Engineering Blog + Research Publications)
 */
export async function fetchMetaPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number; category?: string } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null; categories?: string[] }> {
    const { page = 1, maxPostsPerPage = 10, category } = options;

    console.log(`[${sourceId}] Fetching Meta page ${page} (${maxPostsPerPage} per page, category: ${category || 'all'})`);

    try {
        let allPosts: Post[] = [];

        // Fetch Engineering Blog for the requested page
        const blogResult = await fetchMetaEngineeringPosts(sourceId, fetchUrl, { page, maxPostsPerPage });
        const blogPosts = blogResult.posts.map(p => ({ ...p, category: 'blog' }));

        // Fetch Publications for the requested page
        const pubPosts = await fetchMetaPublications(sourceId, fetchUrl, { page, maxPostsPerPage });

        console.log(`[${sourceId}] Page ${page}: Got ${blogPosts.length} blog posts and ${pubPosts.length} publications`);

        // Merge
        allPosts = [...blogPosts, ...pubPosts];

        // Sort by date (newest first)
        allPosts.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });

        // Filter by category if requested
        if (category && category !== 'all') {
            allPosts = allPosts.filter(p => p.category === category);
        }

        // Determine hasMore
        // If either source has more, we likely have more. 
        // Or if we got a full page of results.
        const hasMore = blogResult.hasMore || pubPosts.length >= maxPostsPerPage;

        const categories = ['blog', 'publication'];

        return {
            posts: allPosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'custom-meta',
            categories,
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Meta posts:`, error);
        throw error;
    }
}

// Cache for Google posts
let googlePostsCache: { posts: Post[]; fetchedAt: number } | null = null;
const GOOGLE_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetch Google Research Blogs
 * Iterates through years based on page number
 * Page 1 -> Current Year
 * Page 2 -> Previous Year
 * etc.
 */
async function fetchGoogleResearchBlogs(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { page = 1 } = options;
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear - (page - 1);

    // Stop if we go back too far (e.g., before 2006)
    if (targetYear < 2006) {
        return { posts: [], hasMore: false };
    }

    const url = `https://research.google/blog/${targetYear}/`;
    console.log(`[${sourceId}] Fetching Google Blog for year ${targetYear}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);
        const posts: Post[] = [];

        // Selectors for blog posts based on inspection (glue-card)
        $('.glue-card, .blog-posts-grid__cards .glue-card').each((i, elem) => {
            // Title: .headline-5 or .glue-card__title or h3/h4
            const title = $(elem).find('.headline-5, h3, h4, .glue-card__title, span[class*="headline"]').first().text().trim();

            // Link: Check if card itself is a link, or find a link inside
            let href = $(elem).attr('href') || $(elem).find('a').first().attr('href');

            // If still no link, it might be constructed via JS, but we can't scrape that.
            // However, inspection showed glue-card__inner, maybe the link is on that?
            // Or maybe we missed the link in the inspection.
            // Let's assume there is a link somewhere.

            if (!title) return;

            // If no href found, skip (or maybe log it)
            if (!href) return;

            if (href.startsWith('/')) {
                href = `https://research.google${href}`;
            }

            // Extract date: .glue-label or time
            const dateStr = $(elem).find('.glue-label, time, .glue-card__date').text().trim();
            let publishedAt = new Date().toISOString(); // Default
            if (dateStr) {
                try {
                    publishedAt = new Date(dateStr).toISOString();
                } catch (e) { }
            } else {
                // Fallback: use year
                publishedAt = new Date(`${targetYear}-01-01`).toISOString();
            }

            // Extract image
            let imageUrl: string | undefined;
            const $img = $(elem).find('img').first();
            if ($img.length > 0) {
                imageUrl = $img.attr('src');
                if (imageUrl && imageUrl.startsWith('/')) {
                    imageUrl = `https://research.google${imageUrl}`;
                }
            }

            const post: Post = {
                id: `google-blog-${href.split('/').filter(Boolean).pop()}`,
                sourceId,
                title,
                url: href,
                publishedAt,
                fetchedAt: new Date().toISOString(),
                imageUrl,
                category: 'blog'
            };

            posts.push(post);
        });

        // If we found posts, we assume there might be more in the next year (page)
        const hasMore = targetYear > 2006;

        return { posts, hasMore };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Google Blog year ${targetYear}:`, error);
        // If 404, maybe the year doesn't exist or we went too far
        return { posts: [], hasMore: false };
    }
}

/**
 * Fetch Google Research Publications
 * Scrapes https://research.google/pubs/
 */
async function fetchGoogleResearchPubs(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number; researchArea?: string } = {}
): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { page = 1, researchArea } = options;

    // Construct URL
    let url = `https://research.google/pubs/?page=${page}`;

    if (researchArea && researchArea !== 'all') {
        url += `&area=${encodeURIComponent(researchArea)}`;
    }

    console.log(`[${sourceId}] Fetching Google Pubs page ${page}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);
        const posts: Post[] = [];
        const seenUrls = new Set<string>();

        // Look for links that point to /pubs/
        $('a[href*="/pubs/"]').each((i, elem) => {
            let href = $(elem).attr('href');
            if (!href) return;

            if (href.startsWith('/')) {
                href = `https://research.google${href}`;
            }

            // Filter out non-pubs or "View details" duplicates
            if (href === 'https://research.google/pubs/') return;
            if (seenUrls.has(href)) return;

            // The link text is usually the title, unless it's "View details"
            let title = $(elem).text().trim();
            if (title === 'View details' || title === 'Download PDF') {
                // Try to find the title in a sibling or parent
                // Usually the title link comes before "View details"
                return;
            }

            if (!title || title.length < 5) return;

            seenUrls.add(href);

            // Try to find authors (siblings or parent text)
            // This is tricky without exact structure, but we can try
            let summary = '';
            const parent = $(elem).parent();
            if (parent.length) {
                // Remove title from parent text to get potential authors/summary
                summary = parent.text().replace(title, '').replace('View details', '').trim();
            }

            const post: Post = {
                id: `google-pub-${href.split('/').filter(Boolean).pop()}`,
                sourceId,
                title,
                url: href,
                summary: summary.substring(0, 200),
                category: 'publication',
                fetchedAt: new Date().toISOString(),
                imageUrl: 'https://research.google/static/images/social-share.png' // Default
            };

            posts.push(post);
        });

        const hasMore = posts.length > 0; // Naive check

        return { posts, hasMore };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Google Pubs:`, error);
        return { posts: [], hasMore: false };
    }
}

/**
 * Combined scraper for Google Research
 */
export async function fetchGoogleResearchPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number; category?: string; researchArea?: string } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null; categories?: string[] }> {
    const { page = 1, maxPostsPerPage = 10, category, researchArea } = options;

    console.log(`[${sourceId}] Fetching Google page ${page} (category: ${category || 'all'})`);

    try {
        let allPosts: Post[] = [];
        let hasMore = false;

        // If category is 'blog' or 'all', fetch blogs
        if (!category || category === 'all' || category === 'blog') {
            const blogResult = await fetchGoogleResearchBlogs(sourceId, fetchUrl, { page });
            allPosts = [...allPosts, ...blogResult.posts];
            if (blogResult.hasMore) hasMore = true;
        }

        // If category is 'publication' or 'all', fetch pubs
        // Note: Pubs pagination might not match Blog pagination (years).
        // This is tricky. For 'all', we might just fetch page 1 of pubs.
        if (!category || category === 'all' || category === 'publication') {
            const pubResult = await fetchGoogleResearchPubs(sourceId, fetchUrl, { page, researchArea });
            allPosts = [...allPosts, ...pubResult.posts];
            if (pubResult.hasMore) hasMore = true;
        }

        // Sort by date/id
        // Blogs have dates, Pubs might not.
        allPosts.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });

        const categories = ['blog', 'publication'];

        return {
            posts: allPosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'custom-google',
            categories,
        };
    } catch (error) {
        console.error(`[${sourceId}] Error fetching Google posts:`, error);
        throw error;
    }
}

// ============================================================================
// HUGGING FACE BLOG SCRAPER
// ============================================================================

/**
 * Custom scraper for Hugging Face Blog
 * The RSS feed lacks images, so we scrape the blog listing page which contains
 * a JSON blob with all post data including thumbnails.
 */
export async function fetchHuggingFacePosts(
    sourceId: string,
    fetchUrl: (url: string) => Promise<string>,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const page = options.page || 1;
    const maxPostsPerPage = options.maxPostsPerPage || 14; // API default seems to be 14 or 20

    // Strategy:
    // Page 1: Fetch featured posts from /api/blog
    // Page > 1: Fetch community posts from /api/blog/community?p={page}
    // Note: /api/blog seems to ignore pagination params, so we only use it for page 1.
    // Community posts are paginated via ?p=N parameter.

    let targetUrl = '';
    let isCommunity = false;

    if (page === 1) {
        targetUrl = 'https://huggingface.co/api/blog';
    } else {
        // For page 2+, we switch to community posts
        // We map page 2 -> p=1 (or p=2? let's assume p=page for simplicity, though p=1 might overlap)
        // Based on verification, ?p=2 returns different content than ?p=1 (implied).
        // Let's use p=page.
        targetUrl = `https://huggingface.co/api/blog/community?p=${page}`;
        isCommunity = true;
    }

    console.log(`[${sourceId}] Fetching Hugging Face posts from API: ${targetUrl}`);

    try {
        // We use fetchUrl which returns string, but we expect JSON.
        // In a real env we might use fetch directly, but here we parse the string.
        const jsonString = await fetchUrl(targetUrl);

        let data: any = {};
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            console.error(`[${sourceId}] Failed to parse API JSON`, e);
            return { posts: [], hasMore: false };
        }

        let rawPosts: any[] = [];

        if (isCommunity) {
            // Community API returns { posts: [...] }
            rawPosts = data.posts || [];
        } else {
            // Main API returns { allBlogs: [...] }
            rawPosts = data.allBlogs || [];
        }

        const posts: Post[] = rawPosts.map((blog: any) => {
            // Construct full image URL
            let imageUrl = blog.thumbnail || blog.poster;
            if (imageUrl && !imageUrl.startsWith('http')) {
                if (imageUrl.startsWith('/')) {
                    imageUrl = `https://huggingface.co${imageUrl}`;
                } else {
                    imageUrl = `https://huggingface.co/${imageUrl}`;
                }
            }

            // Construct link
            let link = blog.url;
            if (link && !link.startsWith('http')) {
                if (link.startsWith('/')) {
                    link = `https://huggingface.co${link}`;
                } else {
                    link = `https://huggingface.co/${link}`;
                }
            }

            return {
                id: blog._id || blog.slug,
                title: blog.title,
                url: link,
                excerpt: blog.description || '', // API might not have description in list view
                publishedAt: blog.publishedAt,
                fetchedAt: new Date().toISOString(),
                imageUrl: imageUrl,
                sourceId: sourceId,
                author: blog.authorsData?.[0]?.fullname || blog.authorsData?.[0]?.name || 'Hugging Face',
            };
        });

        // Filter out posts without titles or URLs
        const validPosts = posts.filter(p => p.title && p.url);

        // Sort by date descending
        validPosts.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });

        // Calculate hasMore
        // For community, we can check numTotalItems vs (page * numItemsPerPage)
        // For main blog (page 1), we assume there's more (community posts)
        let hasMore = false;
        if (isCommunity) {
            const numTotalItems = data.numTotalItems || 0;
            const numItemsPerPage = data.numItemsPerPage || 20;
            hasMore = (page * numItemsPerPage) < numTotalItems;
        } else {
            // Page 1 (Main Blog) -> always has more (Community Blog)
            hasMore = true;
        }

        console.log(`[${sourceId}] Hugging Face page ${page}: Returning ${validPosts.length} posts. hasMore: ${hasMore}`);

        return {
            posts: validPosts,
            hasMore,
            nextPageUrl: hasMore ? `https://huggingface.co/api/blog/community?p=${page + 1}` : undefined,
            detectedPattern: 'json-api',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Hugging Face posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// LINKEDIN ENGINEERING SCRAPER
// ============================================================================

/**
 * Custom scraper for LinkedIn Engineering Blog
 * LinkedIn blog pages are server-rendered with static HTML containing post data.
 * Supports category filtering via URL path.
 */
// Simple in-memory cache for sitemap
let sitemapCache: { data: string[]; timestamp: number } | null = null;
const SITEMAP_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchLinkedInEngineeringPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number; category?: string; categoryUrl?: string } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10, category } = options;
    const sitemapUrl = 'https://www.linkedin.com/blog/engineering/sitemap.xml';

    try {
        // 1. Fetch and parse sitemap to get all post URLs (with caching)
        let allUrls: string[] = [];
        const now = Date.now();

        if (sitemapCache && (now - sitemapCache.timestamp < SITEMAP_CACHE_TTL)) {
            console.log(`[${sourceId}] Using cached sitemap`);
            allUrls = sitemapCache.data;
        } else {
            console.log(`[${sourceId}] Fetching LinkedIn Engineering sitemap: ${sitemapUrl}`);
            const sitemapXml = await fetchUrl(sitemapUrl);
            const $sitemap = cheerio.load(sitemapXml, { xmlMode: true });

            $sitemap('url loc').each((_, element) => {
                const url = $sitemap(element).text().trim();
                // Filter for engineering blog posts only
                if (url.includes('/blog/engineering/')) {
                    allUrls.push(url);
                }
            });

            sitemapCache = { data: allUrls, timestamp: now };
        }

        // 2. Filter by category
        if (category && category !== 'all') {
            const categoryMappings: Record<string, string[]> = {
                'ai': ['/ai/', '/artificial-intelligence/', '/machine-learning/', '/generative-ai/'],
                'generative-ai': ['/generative-ai/'],
                'data': ['/data/', '/data-management/', '/data-science/'],
                'trust-and-safety': ['/trust-and-safety/', '/security/', '/privacy/'],
                'product-design': ['/product-design/', '/design/'],
                'infrastructure': ['/infrastructure/', '/scalability/', '/performance/'],
            };

            const patterns = categoryMappings[category] || [`/${category}/`];
            allUrls = allUrls.filter(url => patterns.some(pattern => url.includes(pattern)));
        }

        // 3. Paginate URLs
        const totalPosts = allUrls.length;
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pageUrls = allUrls.slice(startIndex, endIndex);
        const hasMore = endIndex < totalPosts;

        console.log(`[${sourceId}] Found ${totalPosts} posts (category: ${category || 'all'}). Fetching page ${page} (${pageUrls.length} posts)`);

        if (pageUrls.length === 0) {
            return { posts: [], hasMore: false };
        }

        // 4. Fetch details for each post in parallel (with concurrency limit)
        const posts: Post[] = [];
        const CONCURRENCY_LIMIT = 5;

        // Helper to fetch single post
        const fetchPostDetails = async (url: string): Promise<Post | null> => {
            try {
                const html = await fetchUrl(url);
                const $ = cheerio.load(html);

                // Extract metadata
                const title = $('h1.title').text().trim() ||
                    $('meta[property="og:title"]').attr('content') ||
                    $('title').text().trim();

                // Try multiple selectors for image
                let imageUrl = $('meta[property="og:image"]').attr('content') ||
                    $('.featured-image img').attr('src') ||
                    $('.post-hero-image img').attr('src');

                if (imageUrl) {
                    imageUrl = imageUrl.replace(/&amp;/g, '&');
                }

                // Author - Clean up "Authored by" prefix
                let author = $('.author-profile__author-text-container a').first().text().trim();
                if (author.startsWith('Authored by')) {
                    author = author.replace('Authored by', '').trim();
                }

                if (!author) {
                    author = $('.author-name').first().text().trim() ||
                        $('meta[name="author"]').attr('content');
                }

                // Date
                const dateText = $('[data-published-date]').attr('data-published-date') ||
                    $('.publish-date').text().trim() ||
                    $('time').attr('datetime') ||
                    $('meta[property="article:published_time"]').attr('content');

                let publishedAt: string | undefined;
                if (dateText) {
                    try {
                        const parsedDate = new Date(dateText);
                        if (!isNaN(parsedDate.getTime())) {
                            publishedAt = parsedDate.toISOString();
                        }
                    } catch {
                        publishedAt = dateText;
                    }
                }

                if (title) {
                    return {
                        id: `${sourceId}-${url.split('/').pop() || title.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`,
                        sourceId,
                        title,
                        url,
                        author: author || undefined,
                        publishedAt,
                        imageUrl: imageUrl || undefined,
                        fetchedAt: new Date().toISOString(),
                        category: category || 'all',
                    };
                }
                return null;
            } catch (error) {
                console.error(`[${sourceId}] Error fetching post details for ${url}:`, error);
                return null;
            }
        };

        // Execute fetches in batches
        for (let i = 0; i < pageUrls.length; i += CONCURRENCY_LIMIT) {
            const batch = pageUrls.slice(i, i + CONCURRENCY_LIMIT);
            const batchPromises = batch.map(url => fetchPostDetails(url));
            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach(post => {
                if (post) posts.push(post);
            });
        }

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined, // Virtual pagination
            detectedPattern: 'sitemap-scrape',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching LinkedIn Engineering posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// MICROSOFT RESEARCH SCRAPER
// ============================================================================

/**
 * Custom scraper for Microsoft Research Blog
 * Supports pagination via /page/N/ URL pattern
 */
export async function fetchMicrosoftResearchPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1 } = options;
    const baseUrl = 'https://www.microsoft.com/en-us/research/blog/';
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;

    console.log(`[${sourceId}] Fetching Microsoft Research page ${page}: ${url}`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);
        const posts: Post[] = [];

        // Select post cards
        const cards = $('.card.material-card');
        console.log(`[${sourceId}] Found ${cards.length} posts on page ${page}`);

        cards.each((_, element) => {
            const $card = $(element);

            // Extract Title
            const titleElement = $card.find('h3, h2, .c-heading').first();
            const title = titleElement.text().trim();

            // Extract Link
            const link = $card.find('a').first().attr('href');

            if (!title || !link) return;

            // Extract Image
            let imageUrl = $card.find('img').first().attr('src');
            // Handle lazy loading or data attributes if present
            if (!imageUrl) {
                imageUrl = $card.find('img').first().attr('data-src');
            }

            // Extract Date & Author
            // Microsoft blog structure varies, sometimes date is in a time tag or distinct class
            const dateText = $card.find('time').attr('datetime') ||
                $card.find('time').text().trim() ||
                $card.find('.date').text().trim();

            let publishedAt: string | undefined;
            if (dateText) {
                try {
                    publishedAt = new Date(dateText).toISOString();
                } catch {
                    publishedAt = undefined;
                }
            }

            // Author is often not directly on the card, but sometimes in a footer
            // We'll leave it undefined if not found, or try a generic selector
            const author = $card.find('.author').text().trim() || undefined;

            const absoluteUrl = new URL(link, baseUrl).toString();

            posts.push({
                id: `${sourceId}-${absoluteUrl.split('/').filter(Boolean).pop() || title.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`,
                sourceId,
                title,
                url: absoluteUrl,
                imageUrl: imageUrl ? new URL(imageUrl, baseUrl).toString() : undefined,
                publishedAt,
                author,
                fetchedAt: new Date().toISOString(),
            });
        });

        return {
            posts,
            hasMore: posts.length > 0, // Assume more if we found posts
            nextPageUrl: posts.length > 0 ? `?page=${page + 1}` : undefined,
            detectedPattern: 'html-scrape',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Microsoft Research posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// NETFLIX RESEARCH SCRAPER
// ============================================================================

// Cache for Netflix posts to avoid re-fetching the full list on every page request
let netflixPostsCache: { posts: Post[]; fetchedAt: number } | null = null;
const NETFLIX_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Custom scraper for Netflix Research
 * Extracts data from Next.js Apollo cache (Contentful data)
 */
export async function fetchNetflixResearchPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const baseUrl = 'https://research.netflix.com';
    const archiveUrl = `${baseUrl}/archive`;

    console.log(`[${sourceId}] Fetching Netflix Research page ${page} (${maxPostsPerPage} per page)`);

    try {
        let allPosts: Post[] = [];

        // Check cache
        if (netflixPostsCache && (Date.now() - netflixPostsCache.fetchedAt) < NETFLIX_CACHE_TTL) {
            console.log(`[${sourceId}] Using cached Netflix posts (${netflixPostsCache.posts.length} total)`);
            allPosts = netflixPostsCache.posts;
        } else {
            const html = await fetchUrl(archiveUrl);

            // Extract __NEXT_DATA__
            const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
            if (!nextDataMatch) {
                throw new Error('Could not find __NEXT_DATA__ in Netflix Research page');
            }

            const json = JSON.parse(nextDataMatch[1]);
            const apolloData = json.props.pageProps.serverState?.apollo?.data;

            if (!apolloData) {
                throw new Error('Could not find Apollo data in Netflix Research page');
            }

            // Find the collection key (it has a limit of 500 usually)
            const collectionKey = Object.keys(apolloData).find(k => k.startsWith('$ROOT_QUERY.articleCollection({"limit":500'));

            if (!collectionKey || !apolloData[collectionKey].items) {
                console.warn(`[${sourceId}] Could not find articleCollection with limit 500, trying to find any articleCollection`);
                // Fallback to any article collection
                const anyCollectionKey = Object.keys(apolloData).find(k => k.startsWith('$ROOT_QUERY.articleCollection'));
                if (!anyCollectionKey) {
                    throw new Error('Could not find any articleCollection in Apollo data');
                }
            }

            const collection = apolloData[collectionKey || Object.keys(apolloData).find(k => k.startsWith('$ROOT_QUERY.articleCollection'))!];
            const items = collection.items || [];

            console.log(`[${sourceId}] Found ${items.length} items in Apollo cache`);

            // Helper to resolve reference
            const resolveRef = (ref: any) => {
                if (ref && ref.__ref) {
                    return apolloData[ref.__ref];
                }
                if (ref && ref.type === 'id' && ref.id) {
                    return apolloData[ref.id];
                }
                return ref;
            };

            for (const itemRef of items) {
                const item = resolveRef(itemRef);
                if (!item) continue;

                const title = item.title;
                const link = item.link;
                const date = item.date;

                if (!title || !link) continue;

                // Resolve image
                let imageUrl: string | undefined;
                if (item.image) {
                    const imageAsset = resolveRef(item.image);
                    if (imageAsset && imageAsset.url) {
                        imageUrl = imageAsset.url;
                    }
                }

                // Resolve author (usually a collection)
                let author: string | undefined;
                if (item.authorCollection) {
                    const authorCollection = resolveRef(item.authorCollection);
                    if (authorCollection && authorCollection.items && authorCollection.items.length > 0) {
                        const firstAuthorRef = authorCollection.items[0];
                        const firstAuthor = resolveRef(firstAuthorRef);
                        if (firstAuthor) {
                            author = firstAuthor.firstName;
                            if (firstAuthor.lastName) {
                                author += ` ${firstAuthor.lastName}`;
                            }
                        }
                    }
                }

                const postId = `${sourceId}-${link.split('/').filter(Boolean).pop() || title.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`;

                // Determine category based on URL
                // Blogs are usually on netflixtechblog.com or medium.com
                // Everything else (PDFs, external sites) is considered a publication
                const isBlog = link.includes('netflixtechblog.com') || link.includes('medium.com');
                const category = isBlog ? 'blog' : 'publication';

                allPosts.push({
                    id: postId,
                    sourceId,
                    title,
                    url: link,
                    imageUrl,
                    publishedAt: date ? new Date(date).toISOString() : undefined,
                    author,
                    category, // Add category field
                    fetchedAt: new Date().toISOString(),
                });
            }

            // Update cache
            netflixPostsCache = {
                posts: allPosts,
                fetchedAt: Date.now()
            };
        }

        // Client-side pagination
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const paginatedPosts = allPosts.slice(startIndex, endIndex);
        const hasMore = endIndex < allPosts.length;

        return {
            posts: paginatedPosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'apollo-cache',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Netflix Research posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// NVIDIA DEVELOPER SCRAPER
// ============================================================================

export async function fetchNvidiaDeveloperPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1 } = options;
    const rssUrl = 'https://developer.nvidia.com/blog/feed/';

    console.log(`[${sourceId}] Fetching NVIDIA Developer posts from RSS...`);

    try {
        // Dynamic import to avoid circular dependency
        const Parser = (await import('rss-parser')).default;
        const parser = new Parser();
        const feed = await parser.parseURL(rssUrl);

        const items = feed.items;

        // Manual pagination
        const postsPerPage = options.maxPostsPerPage || 10;
        const startIndex = (page - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;

        const pageItems = items.slice(startIndex, endIndex);
        const hasMore = endIndex < items.length;

        console.log(`[${sourceId}] Processing ${pageItems.length} items for page ${page}`);

        const posts: Post[] = [];

        // Process items in parallel to fetch images
        // Limit concurrency to avoid overwhelming the server
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < pageItems.length; i += CONCURRENCY_LIMIT) {
            const chunk = pageItems.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(async (item) => {
                if (!item.link || !item.title) return;

                let imageUrl: string | undefined;

                try {
                    // Fetch the page to get og:image
                    const html = await fetchUrl(item.link);
                    const $ = cheerio.load(html);
                    imageUrl = $('meta[property="og:image"]').attr('content') ||
                        $('meta[name="twitter:image"]').attr('content');

                    if (imageUrl) {
                        // Ensure https
                        if (imageUrl.startsWith('http://')) {
                            imageUrl = imageUrl.replace('http://', 'https://');
                        }
                    }
                } catch (err) {
                    console.warn(`[${sourceId}] Failed to fetch image for ${item.link}:`, err);
                }

                posts.push({
                    id: `${sourceId}-${item.link.split('/').filter(Boolean).pop() || item.title.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`,
                    sourceId,
                    title: item.title,
                    url: item.link,
                    imageUrl,
                    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    author: item.creator || 'NVIDIA',
                    fetchedAt: new Date().toISOString(),
                });
            }));
        }

        // Sort by date descending
        posts.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'rss-with-html-enrichment',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching NVIDIA posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// OPENAI RESEARCH SCRAPER
// ============================================================================

export async function fetchOpenAIPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1 } = options;
    const url = 'https://openai.com/news/';

    console.log(`[${sourceId}] Fetching OpenAI posts from ${url}...`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        // Find all links that look like blog posts
        const links = new Set<string>();
        $('main a').each((_, el) => {
            const href = $(el).attr('href');
            if (href && (href.startsWith('/index/') || href.startsWith('/research/')) && href.length > 15) {
                // Exclude known non-post pages if any, or very short paths
                // Ensure full URL
                const fullUrl = href.startsWith('http') ? href : `https://openai.com${href}`;
                links.add(fullUrl);
            }
        });

        console.log(`[${sourceId}] Found ${links.size} potential post links.`);

        // Convert to array and paginate
        const allLinks = Array.from(links);

        // Manual pagination
        const postsPerPage = options.maxPostsPerPage || 10;
        const startIndex = (page - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;

        const pageLinks = allLinks.slice(startIndex, endIndex);
        const hasMore = endIndex < allLinks.length;

        console.log(`[${sourceId}] Processing ${pageLinks.length} items for page ${page}`);

        const posts: Post[] = [];

        // Process items in parallel
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < pageLinks.length; i += CONCURRENCY_LIMIT) {
            const chunk = pageLinks.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(async (link) => {
                try {
                    const postHtml = await fetchUrl(link);
                    const $post = cheerio.load(postHtml);

                    const title = $post('meta[property="og:title"]').attr('content') ||
                        $post('title').text().replace(' | OpenAI', '').trim();

                    const imageUrl = $post('meta[property="og:image"]').attr('content') ||
                        $post('meta[name="twitter:image"]').attr('content');

                    const dateStr = $post('meta[property="article:published_time"]').attr('content') ||
                        $post('time').attr('datetime') ||
                        $post('time').text().trim();

                    const description = $post('meta[property="og:description"]').attr('content');

                    if (title) {
                        posts.push({
                            id: `${sourceId}-${link.split('/').filter(Boolean).pop()}`,
                            sourceId,
                            title,
                            url: link,
                            imageUrl,
                            publishedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                            author: 'OpenAI',
                            fetchedAt: new Date().toISOString(),
                        });
                    }
                } catch (err) {
                    console.warn(`[${sourceId}] Failed to fetch post ${link}:`, err);
                }
            }));
        }

        // Sort by date descending
        posts.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'html-list-crawl',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching OpenAI posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// META RESEARCH SCRAPER
// ============================================================================

export async function fetchMetaResearchPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1 } = options;
    // Meta Research uses /blog/page/N/ for pagination
    const url = page === 1
        ? 'https://ai.meta.com/blog/'
        : `https://ai.meta.com/blog/page/${page}/`;

    console.log(`[${sourceId}] Fetching Meta Research posts from ${url}...`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        // Find all links that look like blog posts
        const links = new Set<string>();
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            // Meta blog links usually look like /blog/slug/
            if (href && href.includes('/blog/') && href.length > 25) {
                // Exclude the main blog page itself and pagination links if any
                if (href === '/blog/' || href === 'https://ai.meta.com/blog/') return;

                // Ensure full URL
                const fullUrl = href.startsWith('http') ? href : `https://ai.meta.com${href}`;
                links.add(fullUrl);
            }
        });

        console.log(`[${sourceId}] Found ${links.size} potential post links.`);

        // Convert to array
        const pageLinks = Array.from(links);

        // Since we are fetching a specific page from the server, we use all found links
        const hasMore = pageLinks.length > 0;

        console.log(`[${sourceId}] Processing ${pageLinks.length} items for page ${page}`);

        const posts: Post[] = [];

        // Process items in parallel
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < pageLinks.length; i += CONCURRENCY_LIMIT) {
            const chunk = pageLinks.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(async (link) => {
                try {
                    const postHtml = await fetchUrl(link);
                    const $post = cheerio.load(postHtml);

                    const title = $post('meta[property="og:title"]').attr('content') ||
                        $post('title').text().replace(' | Meta AI', '').trim();

                    const imageUrl = $post('meta[property="og:image"]').attr('content') ||
                        $post('meta[name="twitter:image"]').attr('content');

                    const dateStr = $post('meta[property="article:published_time"]').attr('content') ||
                        $post('time').attr('datetime') ||
                        $post('time').text().trim();

                    // Meta often puts the date in a span with a specific class or just text
                    // We might need to look for a date pattern if meta tags fail

                    if (title) {
                        posts.push({
                            id: `${sourceId}-${link.split('/').filter(Boolean).pop()}`,
                            sourceId,
                            title,
                            url: link,
                            imageUrl,
                            publishedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                            author: 'Meta AI',
                            fetchedAt: new Date().toISOString(),
                        });
                    }
                } catch (err) {
                    console.warn(`[${sourceId}] Failed to fetch post ${link}:`, err);
                }
            }));
        }

        // Sort by date descending
        posts.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

        return {
            posts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'html-list-crawl',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Meta Research posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// SPOTIFY ENGINEERING SCRAPER
// ============================================================================

export async function fetchSpotifyEngineeringPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;

    // Spotify Engineering doesn't support standard pagination (404 on page 2).
    // Strategy: Fetch Homepage + Yearly Archives in parallel to get a comprehensive list.
    const currentYear = new Date().getFullYear();
    const urls = [
        'https://engineering.atspotify.com/',
        `https://engineering.atspotify.com/${currentYear}/`,
        `https://engineering.atspotify.com/${currentYear - 1}/`,
        `https://engineering.atspotify.com/${currentYear - 2}/`
    ];

    console.log(`[${sourceId}] Fetching Spotify posts from ${urls.length} sources (Homepage + Archives)...`);

    try {
        // Fetch all sources in parallel
        const responses = await Promise.allSettled(urls.map(url => fetchUrl(url)));

        const allPostsMap = new Map<string, Post>();

        for (let i = 0; i < responses.length; i++) {
            const result = responses[i];
            if (result.status === 'rejected') {
                console.warn(`[${sourceId}] Failed to fetch ${urls[i]}: ${result.reason}`);
                continue;
            }

            const html = result.value;
            const $ = cheerio.load(html);

            // Select all post cards
            const articles = $('.sticky-post, .post-card, article');

            articles.each((_, el) => {
                const $el = $(el);

                // Extract Link
                const link = $el.find('a').attr('href');
                if (!link) return;

                const fullUrl = link.startsWith('http') ? link : `https://engineering.atspotify.com${link}`;

                // Extract Title
                const title = $el.find('h1, h2, h3, .post-card__title, .sticky-post__title').text().trim();
                if (!title) return;

                // Extract Image
                let imageUrl = $el.find('img').attr('src') || $el.find('img').attr('srcset')?.split(' ')[0];
                if (imageUrl && imageUrl.startsWith('/')) {
                    imageUrl = `https://engineering.atspotify.com${imageUrl}`;
                }

                // Extract Date
                const dateStr = $el.find('time').attr('datetime') || $el.find('time').text().trim();

                // Create ID from URL
                const id = `${sourceId}-${fullUrl.split('/').filter(Boolean).pop()}`;

                if (!allPostsMap.has(id)) {
                    allPostsMap.set(id, {
                        id,
                        sourceId,
                        title,
                        url: fullUrl,
                        imageUrl,
                        publishedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                        author: 'Spotify Engineering',
                        fetchedAt: new Date().toISOString(),
                    });
                }
            });
        }

        // Convert to array and sort by date
        const allPosts = Array.from(allPostsMap.values());
        allPosts.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

        console.log(`[${sourceId}] Found ${allPosts.length} total unique posts.`);

        // Paginate in memory
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pagePosts = allPosts.slice(startIndex, endIndex);
        const hasMore = endIndex < allPosts.length;

        return {
            posts: pagePosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'archive-aggregation',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Spotify posts:`, error);
        return { posts: [], hasMore: false };
    }
}

// ============================================================================
// STRIPE ENGINEERING SCRAPER
// ============================================================================

export async function fetchStripeEngineeringPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    const url = 'https://stripe.com/blog/engineering';

    console.log(`[${sourceId}] Fetching Stripe Engineering posts from ${url}...`);

    try {
        // Stripe lists all posts on a single page, so we fetch once and paginate in memory.
        // In a real production app with caching, we'd cache the full list.
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const allPosts: Post[] = [];

        // Select all post elements
        const articles = $('.BlogIndexPost');

        console.log(`[${sourceId}] Found ${articles.length} total posts on the page.`);

        articles.each((_, el) => {
            const $el = $(el);

            // Extract Title and Link
            const titleEl = $el.find('.BlogIndexPost__titleLink');
            const title = titleEl.text().trim();
            const link = titleEl.attr('href');

            if (!title || !link) return;

            const fullUrl = link.startsWith('http') ? link : `https://stripe.com${link}`;

            // Extract Date
            const dateStr = $el.find('time').text().trim() || $el.find('.BlogIndexPost__date').text().trim();

            // Extract Author
            const author = $el.find('.BlogIndexPost__author').text().trim() || 'Stripe Engineering';

            // Extract Image
            // Stripe often uses background images or figures
            let imageUrl = $el.find('img').attr('src');
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('/') ? `https://stripe.com${imageUrl}` : imageUrl;
            }

            // Create ID
            const id = `${sourceId}-${fullUrl.split('/').filter(Boolean).pop()}`;

            allPosts.push({
                id,
                sourceId,
                title,
                url: fullUrl,
                imageUrl,
                publishedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                author,
                fetchedAt: new Date().toISOString(),
            });
        });

        // Sort by date just in case, though usually sorted
        // allPosts.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

        // Paginate in memory
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pagePosts = allPosts.slice(startIndex, endIndex);
        const hasMore = endIndex < allPosts.length;

        console.log(`[${sourceId}] Returning posts ${startIndex + 1} to ${Math.min(endIndex, allPosts.length)} (Page ${page})`);

        return {
            posts: pagePosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'single-page-list',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Stripe posts:`, error);
        return { posts: [], hasMore: false };
    }
}


// ============================================================================
// UBER ENGINEERING SCRAPER
// ============================================================================

export async function fetchUberEngineeringPosts(
    sourceId: string,
    fetchUrl: FetchUrlFn,
    options: { page?: number; maxPostsPerPage?: number } = {}
): Promise<{ posts: Post[]; hasMore: boolean; nextPageUrl?: string; detectedPattern?: string | null }> {
    const { page = 1, maxPostsPerPage = 10 } = options;
    // Use the localized US page which lists more posts than the RSS feed
    const url = 'https://www.uber.com/en-US/blog/engineering/';

    console.log(`[${sourceId}] Fetching Uber Engineering posts from HTML: ${url}...`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const allPostsMap = new Map<string, Post>();

        // Select all links that might be posts
        const articles = $('a[href*="/blog/"]');

        console.log(`[${sourceId}] Found ${articles.length} potential links.`);

        articles.each((_, el) => {
            const $el = $(el);
            const link = $el.attr('href');
            if (!link) return;

            // Filter out non-post links (heuristics)
            // 1. Must contain /blog/
            // 2. Text must be substantial (avoid "Read More" or "Uber Blog" generic links)
            const text = $el.text().trim();
            if (text.length < 15) return;

            // 3. Check parent context for "Engineering" or similar keywords if possible
            // Or just check if the link itself looks like a post (has slugs)
            const slug = link.split('/').filter(Boolean).pop();
            if (!slug || slug === 'engineering' || slug === 'blog') return;

            const fullUrl = link.startsWith('http') ? link : `https://www.uber.com${link}`;

            // Extract Title
            // Often the title is inside an h3/h4/h5 inside the link, or the link text itself
            let title = $el.find('h3, h4, h5, h6').text().trim();
            if (!title) title = text;

            // Clean title (remove "Engineering" prefix if present)
            title = title.replace(/^Engineering,?\s*/i, '').trim();

            // Extract Image
            // Image is usually in a sibling div or inside the link
            const parent = $el.closest('div');
            let imageUrl = parent.find('img').attr('src') || $el.find('img').attr('src');

            // Extract Date
            // Date is usually text in the parent container
            const parentText = parent.text();
            const dateMatch = parentText.match(/(\d{1,2}\s+[A-Za-z]+)|([A-Za-z]+\s+\d{1,2})/);
            let dateStr = dateMatch ? dateMatch[0] : undefined;

            let publishedAt = new Date().toISOString();
            if (dateStr) {
                try {
                    if (!dateStr.match(/\d{4}/)) {
                        dateStr += ` ${new Date().getFullYear()}`;
                    }
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        publishedAt = parsedDate.toISOString();
                    }
                } catch (e) { }
            }

            // If we have a valid title and link, add it
            // If we have a valid title and link, and a date (to filter out nav links), add it
            if (title && fullUrl && dateStr) {
                const id = `${sourceId}-${slug}`;

                // Avoid duplicates
                if (!allPostsMap.has(id)) {
                    allPostsMap.set(id, {
                        id,
                        sourceId,
                        title,
                        url: fullUrl,
                        imageUrl,
                        publishedAt,
                        author: 'Uber Engineering',
                        fetchedAt: new Date().toISOString(),
                    });
                }
            }
        });

        const allPosts = Array.from(allPostsMap.values());
        console.log(`[${sourceId}] Extracted ${allPosts.length} unique posts from HTML.`);

        // Sort by date (heuristic, as dates might be missing or partial)
        // If dates are missing, we rely on the order on the page (usually new to old)

        // Paginate in memory
        const startIndex = (page - 1) * maxPostsPerPage;
        const endIndex = startIndex + maxPostsPerPage;
        const pagePosts = allPosts.slice(startIndex, endIndex);
        const hasMore = endIndex < allPosts.length;

        return {
            posts: pagePosts,
            hasMore,
            nextPageUrl: hasMore ? `?page=${page + 1}` : undefined,
            detectedPattern: 'html-localized-crawl',
        };

    } catch (error) {
        console.error(`[${sourceId}] Error fetching Uber posts:`, error);
        return { posts: [], hasMore: false };
    }
}


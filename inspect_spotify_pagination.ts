
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectSpotifyPagination() {
    const url = 'https://engineering.atspotify.com/';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Look for pagination links
        console.log('\nScanning for pagination links...');
        const paginationLinks = $('a[href*="page"], a:contains("Next"), a:contains("Previous"), .pagination a');

        if (paginationLinks.length > 0) {
            console.log(`Found ${paginationLinks.length} pagination links:`);
            paginationLinks.each((i, el) => {
                console.log(`[${i}] Text: ${$(el).text().trim()}`);
                console.log(`    Href: ${$(el).attr('href')}`);
            });
        } else {
            console.log('No obvious pagination links found.');
        }

        // Check for Load More button
        console.log('\nScanning for Load More buttons...');
        const buttons = $('button');
        buttons.each((i, el) => {
            const text = $(el).text().trim();
            if (text.toLowerCase().includes('load') || text.toLowerCase().includes('more')) {
                console.log(`Button [${i}]: ${text}`);
                console.log(`    Classes: ${$(el).attr('class')}`);
                console.log(`    Attributes: ${JSON.stringify($(el).attr())}`);
            }
        });

        // Check for "All Posts" link
        const allPosts = $('a:contains("All posts"), a:contains("Archive")');
        if (allPosts.length > 0) {
            console.log('\nFound "All Posts" link:');
            console.log(`    Href: ${allPosts.attr('href')}`);
        }

        // Check for category links that might be the actual blog feed
        console.log('\nScanning for category links...');
        const categories = $('a[href*="/category/"]');
        categories.each((i, el) => {
            if (i < 5) {
                console.log(`Category: ${$(el).text()} -> ${$(el).attr('href')}`);
            }
        });

        // Check for Next.js data
        console.log('\nScanning for __NEXT_DATA__...');
        const nextData = $('script[id="__NEXT_DATA__"]').html();
        if (nextData) {
            console.log('Found __NEXT_DATA__!');
            try {
                const data = JSON.parse(nextData);
                console.log('Build ID:', data.buildId);
                console.log('Page Props Keys:', Object.keys(data.props?.pageProps || {}));

                // Check for posts in props
                if (data.props?.pageProps?.posts) {
                    console.log(`Found ${data.props.pageProps.posts.length} posts in props.`);
                }

                // Check for pagination info
                if (data.props?.pageProps?.pagination) {
                    console.log('Pagination Props:', data.props.pageProps.pagination);
                }
            } catch (e) {
                console.log('Error parsing JSON:', e.message);
            }
        } else {
            console.log('No __NEXT_DATA__ found.');
        }

        // Test potential patterns
        const patterns = [
            'https://engineering.atspotify.com/page/2/',
            'https://engineering.atspotify.com/blog/page/2/',
            'https://engineering.atspotify.com/?page=2',
            'https://engineering.atspotify.com/all/page/2/'
        ];

        for (const p of patterns) {
            console.log(`\nTesting ${p}...`);
            try {
                const res = await fetch(p, { method: 'HEAD' });
                console.log(`Status: ${res.status}`);
            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectSpotifyPagination();

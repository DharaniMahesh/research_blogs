
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectUberHeaders() {
    const url = 'https://www.uber.com/blog/engineering/';

    console.log(`\nFetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final URL: ${response.url}`);

        const html = await response.text();
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check for headings (post titles)
        console.log('\nScanning for headings...');
        const headings = $('h3, h4, h5, h6');
        console.log(`Found ${headings.length} headings.`);
        headings.slice(0, 10).each((i, el) => {
            const text = $(el).text().trim();
            if (text) {
                console.log(`Heading [${i}]: ${text}`);
                const link = $(el).closest('a');
                if (link.length > 0) {
                    console.log(`    Link: ${link.attr('href')}`);
                } else {
                    const parentLink = $(el).parents('a').first();
                    if (parentLink.length > 0) {
                        console.log(`    Link (parent): ${parentLink.attr('href')}`);
                    }
                }
            }
        });

        // Check for "Load More" button
        const buttons = $('button');
        buttons.each((i, el) => {
            if ($(el).text().toLowerCase().includes('load')) {
                console.log(`Button: ${$(el).text()}`);
            }
        });

        // Check RSS with headers
        const rssUrl = 'https://www.uber.com/blog/engineering/rss/';
        console.log(`\nChecking RSS ${rssUrl}...`);
        try {
            const rssRes = await fetch(rssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                }
            });
            console.log(`RSS Status: ${rssRes.status}`);
        } catch (e) {
            console.log(`RSS Error: ${e.message}`);
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectUberHeaders();

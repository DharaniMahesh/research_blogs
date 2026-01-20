
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectUberRedirects() {
    const url = 'https://www.uber.com/blog/engineering/';

    console.log(`\nFetching ${url}...`);

    const headersList = [
        {
            name: 'Standard US Headers',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=1.0',
                'Cookie': 'guest_id=v1%3A169700000000000000; _twitter_sess=...', // Dummy
            }
        },
        {
            name: 'No Accept-Language',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        }
    ];

    for (const config of headersList) {
        console.log(`\n--- Testing ${config.name} ---`);
        try {
            const response = await fetch(url, { headers: config.headers, redirect: 'manual' });
            console.log(`Status: ${response.status}`);
            console.log(`Location Header: ${response.headers.get('location')}`);

            if (response.status === 200) {
                const html = await response.text();
                const $ = cheerio.load(html);
                console.log('Title:', $('title').text());
                const articles = $('a[href*="/blog/"]');
                console.log(`Found ${articles.length} links.`);

                // Check if we are on the right page
                const isEngineering = $('title').text().toLowerCase().includes('engineering');
                console.log(`Is Engineering Page: ${isEngineering}`);

                if (isEngineering) {
                    console.log('SUCCESS: Reached Engineering page!');
                    // Look for pagination or load more
                    const buttons = $('button');
                    buttons.each((i, el) => {
                        if ($(el).text().toLowerCase().includes('load')) {
                            console.log(`Button: ${$(el).text()}`);
                        }
                    });
                }
            } else if (response.status === 301 || response.status === 302) {
                console.log('Redirected.');
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

inspectUberRedirects();

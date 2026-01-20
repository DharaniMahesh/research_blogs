
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectUberLocalizedState() {
    const url = 'https://www.uber.com/en-US/blog/engineering/';

    console.log(`\nFetching ${url}...`);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    try {
        const response = await fetch(url, { headers });
        const html = await response.text();
        const $ = cheerio.load(html);

        // Check for scripts with state
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content && (content.includes('__INITIAL_STATE__') || content.includes('window.__UBER_BLOG_STATE__') || content.includes('posts'))) {
                console.log(`\nFound Script with potential state (length: ${content.length})`);
                if (content.includes('"posts"')) {
                    console.log('Contains "posts" key!');
                    // Try to extract JSON
                    const match = content.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
                    if (match) {
                        console.log('Extracted __INITIAL_STATE__ JSON!');
                        try {
                            const data = JSON.parse(match[1]);
                            console.log('Keys:', Object.keys(data));
                        } catch (e) {
                            console.log('Error parsing JSON:', e.message);
                        }
                    }
                }
            }
        });

        // Check for API endpoints in the HTML
        const apiMatches = html.match(/\/api\/[a-zA-Z0-9_\-\/]+/g);
        if (apiMatches) {
            console.log('\nFound potential API paths:', [...new Set(apiMatches)]);
        }

    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

inspectUberLocalizedState();

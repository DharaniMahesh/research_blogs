
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectUberDeep() {
    const url = 'https://www.uber.com/blog/engineering/';

    console.log(`\nFetching ${url}...`);
    try {
        // Fetch with full response to check redirects
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final URL: ${response.url}`);

        const html = await response.text();
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check for links that look like posts
        console.log('\nScanning for post links...');
        const links = $('a');
        let postLinks = 0;
        links.each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && (href.includes('/blog/') || href.includes('/en-IN/blog/')) && text.length > 10) {
                if (postLinks < 5) {
                    console.log(`Link [${i}]: ${text} -> ${href}`);
                }
                postLinks++;
            }
        });
        console.log(`Found ${postLinks} potential post links.`);

        // Check data-baseweb blocks content
        console.log('\nScanning data-baseweb blocks...');
        const blocks = $('div[data-baseweb="block"]');
        blocks.slice(0, 5).each((i, el) => {
            console.log(`Block [${i}]: ${$(el).text().trim().substring(0, 100)}`);
        });

        // Check for JSON-LD again
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            console.log('\nFound JSON-LD!');
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectUberDeep();

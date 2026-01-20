
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function testUberHtmlPagination() {
    const urls = [
        'https://www.uber.com/en-US/blog/engineering/?page=2',
        'https://www.uber.com/en-US/blog/engineering/page/2/',
        'https://www.uber.com/blog/san-francisco/engineering/?page=2',
        'https://www.uber.com/blog/san-francisco/engineering/page/2/'
    ];

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    for (const url of urls) {
        console.log(`\n--- Checking ${url} ---`);
        try {
            const response = await fetch(url, { headers });
            console.log(`Status: ${response.status}`);
            if (response.status === 200) {
                const html = await response.text();
                const $ = cheerio.load(html);

                // Check first post title to see if it's different from page 1
                const firstPost = $('a[href*="/blog/"]').filter((i, el) => {
                    const text = $(el).text().toLowerCase();
                    return text.length > 10 && (text.includes('engineering') || text.includes('tech'));
                }).first().text().trim();

                console.log(`First Post: ${firstPost}`);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testUberHtmlPagination();

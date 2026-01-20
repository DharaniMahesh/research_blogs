
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function testPaginationUrls() {
    const patterns = [
        'https://ai.meta.com/blog/page/2/',
        'https://ai.meta.com/blog/2/',
        'https://ai.meta.com/blog/?p=2',
        'https://ai.meta.com/blog/?offset=10',
        'https://ai.meta.com/blog/all-posts/'
    ];

    for (const url of patterns) {
        console.log(`\nTesting ${url}...`);
        try {
            const html = await fetchUrl(url);
            const $ = cheerio.load(html);

            const links = new Set<string>();
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('/blog/') && href.length > 25) {
                    if (href === '/blog/' || href === 'https://ai.meta.com/blog/') return;
                    links.add(href);
                }
            });

            console.log(`Found ${links.size} posts.`);
            if (links.size > 0) {
                console.log('Sample:', Array.from(links)[0]);
            }

        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

testPaginationUrls();

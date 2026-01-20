
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function checkSitemap() {
    const urls = [
        'https://ai.meta.com/sitemap.xml',
        'https://ai.meta.com/blog/sitemap.xml',
        'https://about.fb.com/sitemap.xml' // Sometimes shared
    ];

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const content = await fetchUrl(url);
            if (content.includes('<?xml') || content.includes('<urlset') || content.includes('<sitemapindex')) {
                console.log('Sitemap found!');
                console.log('Content snippet:', content.substring(0, 200));

                // Check if it has blog posts
                if (content.includes('/blog/')) {
                    console.log('Contains /blog/ links!');
                    const matches = content.match(/https:\/\/ai\.meta\.com\/blog\/[^<]+/g);
                    if (matches) {
                        console.log(`Found ${matches.length} blog links.`);
                        console.log('First 3:', matches.slice(0, 3));
                    }
                }
            } else {
                console.log('Not a valid sitemap.');
            }
        } catch (e: any) {
            console.log(`Error fetching ${url}: ${e.message}`);
        }
    }
}

checkSitemap();

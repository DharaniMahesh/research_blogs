
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectSpotify() {
    const url = 'https://engineering.atspotify.com/';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check for RSS
        const rss = $('link[type="application/rss+xml"]').attr('href');
        console.log('RSS Feed:', rss);

        // Check for JSON-LD
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            console.log('Found JSON-LD!');
        }

        // Check for links since articles weren't found
        console.log('\nScanning for links...');
        const links = $('a');
        let count = 0;
        links.each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            // Look for blog post patterns
            if (href && href.length > 20 && !href.includes('/category/') && !href.includes('/tag/') && !href.includes('/author/')) {
                if (count < 5) {
                    console.log(`\nLink ${count}: ${href}`);
                    console.log('Text:', text);
                    console.log('Parent HTML:', $(el).parent().html()?.substring(0, 200));
                    count++;
                }
            }
        });

        // Check for common blog classes
        const classes = ['post', 'entry', 'card', 'article'];
        for (const cls of classes) {
            const elements = $(`.${cls}, [class*="${cls}"]`);
            if (elements.length > 0) {
                console.log(`\nFound elements with class containing "${cls}": ${elements.length}`);
                console.log('First element HTML:', elements.first().html()?.substring(0, 200));
            }
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectSpotify();


import { fetchUrl } from './lib/scraper';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

async function inspectNvidia() {
    const rssUrl = 'https://developer.nvidia.com/blog/feed/';
    console.log(`\nFetching RSS: ${rssUrl}...`);

    try {
        const parser = new Parser({
            customFields: {
                item: [
                    ['media:content', 'mediaContent'],
                    ['media:thumbnail', 'mediaThumbnail'],
                    ['content:encoded', 'contentEncoded'],
                ],
            },
        });

        const feed = await parser.parseURL(rssUrl);
        console.log(`Found ${feed.items.length} items in RSS`);

        if (feed.items.length > 0) {
            const item = feed.items[0];
            console.log('\n--- First Item ---');
            console.log('Title:', item.title);
            console.log('Link:', item.link);
            console.log('Media Content:', JSON.stringify(item.mediaContent));
            console.log('Media Thumbnail:', JSON.stringify(item.mediaThumbnail));
            // console.log('Content Encoded Snippet:', item.contentEncoded?.substring(0, 200));

            if (item.link) {
                console.log(`\nFetching Page: ${item.link}...`);
                const html = await fetchUrl(item.link);
                const $ = cheerio.load(html);

                const ogImage = $('meta[property="og:image"]').attr('content');
                const twitterImage = $('meta[name="twitter:image"]').attr('content');
                const firstImage = $('article img').first().attr('src');

                console.log('OG Image:', ogImage);
                console.log('Twitter Image:', twitterImage);
                console.log('First Article Image:', firstImage);
            }
        }

    } catch (e) {
        console.error(`Error:`, e);
    }
}

inspectNvidia();


import { fetchUrl } from './lib/scraper';
import Parser from 'rss-parser';

async function inspectSpotifyRss() {
    const url = 'https://engineering.atspotify.com/feed';
    console.log(`Fetching RSS from ${url}...`);

    try {
        const parser = new Parser();
        const feed = await parser.parseURL(url);

        console.log(`Title: ${feed.title}`);
        console.log(`Items: ${feed.items.length}`);

        if (feed.items.length > 0) {
            const item = feed.items[0];
            console.log('\nFirst Item:');
            console.log(`Title: ${item.title}`);
            console.log(`Link: ${item.link}`);
            console.log(`Date: ${item.pubDate}`);
            console.log(`Content Snippet: ${item.contentSnippet?.substring(0, 100)}`);
            console.log(`Content: ${item.content?.substring(0, 100)}`);

            // Check for images in content or enclosure
            if (item.enclosure) {
                console.log(`Enclosure: ${JSON.stringify(item.enclosure)}`);
            }
            // Check for media:content
            if (item['media:content']) {
                console.log(`Media Content: ${JSON.stringify(item['media:content'])}`);
            }
        }
    } catch (e) {
        console.error(`Error parsing RSS:`, e.message);
    }
}

inspectSpotifyRss();

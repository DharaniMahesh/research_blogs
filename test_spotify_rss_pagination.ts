
import { fetchUrl } from './lib/scraper';
import Parser from 'rss-parser';

async function testRssPagination() {
    const urls = [
        'https://engineering.atspotify.com/feed?paged=2',
        'https://engineering.atspotify.com/feed/?paged=2',
        'https://engineering.atspotify.com/feed/page/2',
        'https://engineering.atspotify.com/rss?paged=2'
    ];

    const parser = new Parser();

    for (const url of urls) {
        console.log(`\nTesting ${url}...`);
        try {
            const xml = await fetchUrl(url);
            if (xml.includes('<rss') || xml.includes('<feed')) {
                const feed = await parser.parseString(xml);
                console.log(`Success! Found ${feed.items.length} items.`);
                if (feed.items.length > 0) {
                    console.log(`First Item: ${feed.items[0].title}`);
                }
            } else {
                console.log('Not valid XML.');
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

testRssPagination();

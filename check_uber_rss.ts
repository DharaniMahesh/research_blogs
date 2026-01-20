
import { fetchUrl } from './lib/scraper';
import Parser from 'rss-parser';

async function checkUberRssAndApi() {
    const urls = [
        'https://www.uber.com/blog/engineering/rss/',
        'https://www.uber.com/blog/engineering/feed/',
        'https://www.uber.com/blog/rss/',
        'https://www.uber.com/blog/feed/',
        'https://eng.uber.com/feed/',
        'https://eng.uber.com/rss/'
    ];

    const parser = new Parser();

    console.log('--- Checking RSS Feeds ---');
    for (const url of urls) {
        console.log(`Checking ${url}...`);
        try {
            const xml = await fetchUrl(url);
            if (xml.includes('<rss') || xml.includes('<feed')) {
                console.log('Valid XML found!');
                try {
                    const feed = await parser.parseString(xml);
                    console.log(`Title: ${feed.title}`);
                    console.log(`Items: ${feed.items.length}`);
                    if (feed.items.length > 0) {
                        console.log(`First Item: ${feed.items[0].title}`);
                    }
                } catch (e) {
                    console.log('Error parsing RSS:', e.message);
                }
            } else {
                console.log('Not valid XML.');
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    console.log('\n--- Checking API Endpoints ---');
    const apiUrls = [
        'https://www.uber.com/blog/api/posts',
        'https://www.uber.com/api/blog/posts',
        'https://www.uber.com/wp-json/wp/v2/posts'
    ];

    for (const url of apiUrls) {
        console.log(`Checking ${url}...`);
        try {
            const res = await fetch(url);
            console.log(`Status: ${res.status}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

checkUberRssAndApi();

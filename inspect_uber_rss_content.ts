
import { fetchUrl } from './lib/scraper';
import Parser from 'rss-parser';

async function inspectUberRssContent() {
    const urls = [
        'https://eng.uber.com/rss/',
        'https://eng.uber.com/feed/',
        'https://www.uber.com/blog/rss/engineering',
        'https://www.uber.com/blog/tag/engineering/feed/'
    ];

    const parser = new Parser();

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const xml = await fetchUrl(url);
            if (xml.includes('<rss') || xml.includes('<feed')) {
                console.log('Valid XML found!');
                try {
                    const feed = await parser.parseString(xml);
                    console.log(`Title: ${feed.title}`);
                    console.log(`Items: ${feed.items.length}`);

                    if (feed.items.length > 0) {
                        console.log('First 5 Items:');
                        feed.items.slice(0, 5).forEach((item, i) => {
                            console.log(`[${i}] ${item.title}`);
                            console.log(`    Link: ${item.link}`);
                            console.log(`    Categories: ${item.categories?.join(', ')}`);
                            console.log(`    Date: ${item.pubDate}`);
                        });
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
}

inspectUberRssContent();

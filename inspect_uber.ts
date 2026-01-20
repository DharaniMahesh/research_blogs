
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectUber() {
    const url = 'https://www.uber.com/blog/engineering/';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check for posts with more specific selectors
        console.log('\nScanning for posts...');
        const headings = $('h3, h4, h5');
        console.log(`Found ${headings.length} headings.`);
        headings.slice(0, 10).each((i, el) => {
            const text = $(el).text().trim();
            if (text) {
                console.log(`Heading [${i}]: ${text}`);
                const link = $(el).closest('a');
                if (link.length > 0) {
                    console.log(`    Link: ${link.attr('href')}`);
                } else {
                    // Check if parent is a link
                    const parentLink = $(el).parents('a').first();
                    if (parentLink.length > 0) {
                        console.log(`    Link (parent): ${parentLink.attr('href')}`);
                    }
                }
            }
        });

        // Check for global state
        const scripts = $('script');
        scripts.each((i, el) => {
            const content = $(el).html();
            if (content && (content.includes('__INITIAL_STATE__') || content.includes('window.REDUX_STATE'))) {
                console.log('\nFound Global State!');
                console.log(content.substring(0, 500)); // Print more to see structure
            }
        });

        // Check for specific Uber blog classes
        const grid = $('div[data-baseweb="block"]');
        console.log(`\nFound ${grid.length} data-baseweb blocks.`);

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectUber();

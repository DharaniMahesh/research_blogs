
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectOpenAI() {
    const url = 'https://openai.com/news/';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        const main = $('main');
        console.log('Main tag found:', main.length > 0);

        if (main.length > 0) {
            const links = main.find('a');
            console.log(`Found ${links.length} links in main.`);

            let count = 0;
            links.each((i, el) => {
                const href = $(el).attr('href');
                // Target the specific link we found
                if (href && href.includes('introducing-chatgpt-atlas')) {
                    console.log(`\n--- Target Link: ${href} ---`);
                    const container = $(el).closest('li') || $(el).parent();
                    console.log('Container HTML:', container.html()?.substring(0, 2000));

                    // Check for picture tag
                    const picture = container.find('picture');
                    console.log('Picture tag found:', picture.length > 0);
                    if (picture.length > 0) {
                        console.log('Picture HTML:', picture.html());
                    }
                }
            });
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectOpenAI();

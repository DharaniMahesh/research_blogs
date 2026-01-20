
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function prototypeStripeScraper() {
    const url = 'https://stripe.com/blog/engineering';
    console.log(`Fetching ${url}...`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const posts = [];
        const articles = $('.BlogIndexPost');
        console.log(`Found ${articles.length} .BlogIndexPost elements.`);

        articles.each((i, el) => {
            const $el = $(el);
            const titleEl = $el.find('.BlogIndexPost__titleLink');
            const title = titleEl.text().trim();
            const link = titleEl.attr('href');
            const date = $el.find('time').text().trim() || $el.find('.BlogIndexPost__date').text().trim();
            const author = $el.find('.BlogIndexPost__author').text().trim();

            // Image might be in a figure or background
            let image = $el.find('img').attr('src');

            if (title && link) {
                posts.push({
                    title,
                    link,
                    date,
                    author,
                    image
                });
            }
        });

        console.log(`Successfully extracted ${posts.length} posts.`);
        if (posts.length > 0) {
            console.log('First 3 posts:');
            console.log(JSON.stringify(posts.slice(0, 3), null, 2));
        }

    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

prototypeStripeScraper();

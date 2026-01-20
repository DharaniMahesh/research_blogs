
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function verifyCategories() {
    const categories = [
        'https://engineering.atspotify.com/category/developer-experience/',
        'https://engineering.atspotify.com/category/platform/',
        'https://engineering.atspotify.com/category/maching-learning/', // Check typo
        'https://engineering.atspotify.com/category/machine-learning/', // Check correction
        'https://engineering.atspotify.com/category/data-science/',
        'https://engineering.atspotify.com/category/data/'
    ];

    for (const url of categories) {
        console.log(`\nChecking ${url}...`);
        try {
            const html = await fetchUrl(url);
            const $ = cheerio.load(html);
            const posts = $('.post-card, .sticky-post, article');
            console.log(`Found ${posts.length} posts.`);
            if (posts.length > 0) {
                console.log(`First Post: ${posts.first().find('h1, h2, h3, .post-card__title').text().trim()}`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

verifyCategories();

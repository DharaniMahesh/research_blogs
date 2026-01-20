
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectYearlyArchive() {
    const url = 'https://engineering.atspotify.com/2025/';
    console.log(`Fetching ${url}...`);

    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        const posts = $('.post-card, .sticky-post, article');
        console.log(`Found ${posts.length} posts in 2025 archive.`);

        if (posts.length > 0) {
            const first = posts.first();
            console.log('First Post HTML:', first.html()?.substring(0, 300));
            console.log('Title:', first.find('h1, h2, h3, .post-card__title').text().trim());
        }

        // Retry 2024
        const url2024 = 'https://engineering.atspotify.com/2024/';
        console.log(`\nFetching ${url2024}...`);
        try {
            const res = await fetch(url2024);
            console.log(`Status: ${res.status}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }

        // Check for pagination on archive page
        const pagination = $('a[href*="page"]');
        if (pagination.length > 0) {
            console.log('Archive has pagination links!');
            console.log(pagination.attr('href'));
        }

        // Test archive pagination
        const page2 = 'https://engineering.atspotify.com/2025/page/2/';
        console.log(`\nTesting ${page2}...`);
        try {
            const res = await fetch(page2, { method: 'HEAD' });
            console.log(`Status: ${res.status}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }

    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

inspectYearlyArchive();

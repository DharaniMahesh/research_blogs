
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function compareSpotifyPages() {
    const url1 = 'https://engineering.atspotify.com/';
    const url2 = 'https://engineering.atspotify.com/?page=2';

    console.log(`Fetching Page 1: ${url1}...`);
    const html1 = await fetchUrl(url1);
    const $1 = cheerio.load(html1);
    const title1 = $1('.post-card__title, .sticky-post__title').first().text().trim();
    console.log(`Page 1 First Post: ${title1}`);

    console.log(`\nFetching Page 2: ${url2}...`);
    const html2 = await fetchUrl(url2);
    const $2 = cheerio.load(html2);
    const title2 = $2('.post-card__title, .sticky-post__title').first().text().trim();
    console.log(`Page 2 First Post: ${title2}`);

    if (title1 === title2) {
        console.log('\nFAIL: Page 1 and Page 2 have the same content.');
        console.log('Query parameter ?page=N is likely ignored.');
    } else {
        console.log('\nSUCCESS: Page 1 and Page 2 have different content.');
        console.log('Query parameter ?page=N works!');
    }
}

compareSpotifyPages();

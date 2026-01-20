
import { fetchUrl } from './lib/scraper';

async function testCategoryPagination() {
    const patterns = [
        'https://engineering.atspotify.com/category/developer-experience/page/2/',
        'https://engineering.atspotify.com/category/developer-experience/?page=2',
        'https://engineering.atspotify.com/category/machine-learning/page/2/',
        'https://engineering.atspotify.com/category/data/page/2/'
    ];

    for (const url of patterns) {
        console.log(`\nTesting ${url}...`);
        try {
            const res = await fetch(url, { method: 'HEAD' });
            console.log(`Status: ${res.status}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

testCategoryPagination();

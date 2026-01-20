
import { fetchUrl } from './lib/scraper';

async function testDateArchives() {
    const urls = [
        'https://engineering.atspotify.com/2025/',
        'https://engineering.atspotify.com/2024/',
        'https://engineering.atspotify.com/2025/12/',
        'https://engineering.atspotify.com/2025/11/',
        'https://engineering.atspotify.com/2024/01/'
    ];

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const res = await fetch(url, { method: 'HEAD' });
            console.log(`Status: ${res.status}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

testDateArchives();


import { fetchUrl } from './lib/scraper';

async function checkUberApiHeaders() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.uber.com/blog/engineering/',
    };

    const urls = [
        'https://www.uber.com/blog/api/posts',
        'https://www.uber.com/api/blog/posts',
        'https://www.uber.com/wp-json/wp/v2/posts',
        'https://www.uber.com/blog/wp-json/wp/v2/posts',
        'https://eng.uber.com/wp-json/wp/v2/posts'
    ];

    for (const url of urls) {
        console.log(`Checking ${url}...`);
        try {
            const res = await fetch(url, { headers });
            console.log(`Status: ${res.status}`);
            if (res.status === 200) {
                const json = await res.json();
                console.log('Success! Found JSON response.');
                console.log(`Items: ${Array.isArray(json) ? json.length : 'Not an array'}`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    // Check eng.uber.com redirect
    console.log('\nChecking eng.uber.com redirect...');
    try {
        const res = await fetch('https://eng.uber.com/', { headers });
        console.log(`Status: ${res.status}`);
        console.log(`Final URL: ${res.url}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

checkUberApiHeaders();

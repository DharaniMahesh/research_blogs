
import { fetchUrl } from './lib/scraper';

async function checkWordPressApi() {
    const urls = [
        'https://engineering.atspotify.com/wp-json/wp/v2/posts',
        'https://engineering.atspotify.com/wp-json/',
        'https://engineering.atspotify.com/api/posts',
        'https://engineering.atspotify.com/feed'
    ];

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const res = await fetch(url);
            console.log(`Status: ${res.status}`);
            if (res.ok) {
                const contentType = res.headers.get('content-type');
                console.log(`Content-Type: ${contentType}`);
                if (contentType && contentType.includes('json')) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        console.log(`Found ${data.length} posts!`);
                        console.log('Sample:', data[0].title?.rendered || data[0].title);
                    } else {
                        console.log('Response is not an array.');
                    }
                }
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

checkWordPressApi();

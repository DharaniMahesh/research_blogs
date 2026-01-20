
import { fetchUrl } from './lib/scraper';

async function checkSpotifyApiEndpoints() {
    const urls = [
        'https://engineering.atspotify.com/api/v1/posts',
        'https://engineering.atspotify.com/api/articles',
        'https://engineering.atspotify.com/api/blog/posts',
        'https://engineering.atspotify.com/public/posts',
        'https://engineering.atspotify.com/public/api/posts',
        'https://engineering.atspotify.com/backend/api/posts',
        'https://engineering.atspotify.com/graphql'
    ];

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const res = await fetch(url);
            console.log(`Status: ${res.status}`);
            if (res.ok) {
                const contentType = res.headers.get('content-type');
                console.log(`Content-Type: ${contentType}`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

checkSpotifyApiEndpoints();

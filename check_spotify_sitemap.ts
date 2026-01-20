
import { fetchUrl } from './lib/scraper';

async function checkSpotifySitemap() {
    const urls = [
        'https://engineering.atspotify.com/sitemap.xml',
        'https://engineering.atspotify.com/sitemap_index.xml',
        'https://engineering.atspotify.com/wp-sitemap.xml',
        'https://engineering.atspotify.com/robots.txt'
    ];

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const content = await fetchUrl(url);
            if (content.includes('<?xml') || content.includes('User-agent')) {
                console.log('Found!');
                console.log('Snippet:', content.substring(0, 200));

                if (content.includes('.xml')) {
                    const matches = content.match(/https:\/\/[^<]+.xml/g);
                    if (matches) {
                        console.log('Sitemaps found:', matches);
                    }
                }
            } else {
                console.log('Not a valid sitemap/robots.');
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

checkSpotifySitemap();

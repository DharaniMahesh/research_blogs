
import { fetchLinkedInEngineeringPosts } from './lib/custom-scrapers';
import https from 'https';

// Simple fetch function for testing
async function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

async function verify() {
    console.log('Verifying LinkedIn Engineering scraper...\n');

    const categories = [
        { id: 'all', name: 'All' },
        { id: 'ai', name: 'AI' },
        { id: 'infrastructure', name: 'Infrastructure' },
    ];

    for (const cat of categories) {
        console.log(`\n--- Testing Category: ${cat.name} ---`);
        try {
            const startTime = Date.now();
            const result = await fetchLinkedInEngineeringPosts('linkedin-engineering', fetchUrl, {
                page: 1,
                maxPostsPerPage: 5,
                category: cat.id,
            });
            const endTime = Date.now();
            console.log(`Time taken: ${(endTime - startTime) / 1000}s`);

            console.log(`Fetched ${result.posts.length} posts`);
            console.log(`hasMore: ${result.hasMore}`);

            if (result.posts.length > 0) {
                const first = result.posts[0];
                console.log(`First post: ${first.title.substring(0, 60)}...`);
                console.log(`URL: ${first.url.substring(0, 70)}...`);
                console.log(`Author: ${first.author || 'N/A'}`);
                console.log(`Date: ${first.publishedAt || 'N/A'}`);
                console.log(`Image: ${first.imageUrl ? 'YES' : 'NO'}`);
                if (first.imageUrl) {
                    console.log(`FULL Image URL: ${first.imageUrl}`);
                }

                // Count posts with images
                const withImages = result.posts.filter(p => p.imageUrl).length;
                console.log(`Posts with images: ${withImages}/${result.posts.length}`);
            }
        } catch (error) {
            console.error(`Error testing ${cat.name}:`, error);
        }
    }

    console.log('\n--- Verification Complete ---');
}

verify();

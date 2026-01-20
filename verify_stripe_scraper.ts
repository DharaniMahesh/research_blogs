
import { fetchPostsFromSource } from './lib/scraper';
import { defaultSources } from './lib/sources';

async function verifyStripeScraper() {
    const source = defaultSources.find(s => s.id === 'stripe-engineering');
    if (!source) {
        console.error('Stripe Engineering source not found');
        return;
    }

    console.log('--- Testing Stripe Engineering Scraper (Page 1) ---');
    const start1 = Date.now();
    const result1 = await fetchPostsFromSource(source, { page: 1 });
    const end1 = Date.now();

    console.log(`Fetched ${result1.posts.length} posts in ${(end1 - start1) / 1000}s`);
    console.log(`Has More: ${result1.hasMore}`);

    if (result1.posts.length > 0) {
        console.log('First 3 posts:');
        result1.posts.slice(0, 3).forEach((p, i) => {
            console.log(`[${i}] ${p.title}`);
            console.log(`    URL: ${p.url}`);
            console.log(`    Image: ${p.imageUrl}`);
            console.log(`    Date: ${p.publishedAt}`);
        });
    }

    if (result1.hasMore) {
        console.log('\n--- Testing Stripe Engineering Scraper (Page 2) ---');
        const start2 = Date.now();
        const result2 = await fetchPostsFromSource(source, { page: 2 });
        const end2 = Date.now();

        console.log(`Fetched ${result2.posts.length} posts in ${(end2 - start2) / 1000}s`);
        if (result2.posts.length > 0) {
            console.log(`First post of Page 2: ${result2.posts[0].title}`);
            if (result1.posts[0].id !== result2.posts[0].id) {
                console.log('SUCCESS: Page 2 content is different from Page 1.');
            } else {
                console.log('FAIL: Page 2 content is same as Page 1.');
            }
        }
    }
}

verifyStripeScraper();

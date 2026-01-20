
import { fetchHuggingFacePosts } from './lib/custom-scrapers';
import { fetchUrl } from './lib/scraper';

async function verify() {
    console.log('Verifying Hugging Face scraper pagination...');
    try {
        // Page 1
        console.log('\n--- Page 1 ---');
        const result1 = await fetchHuggingFacePosts('huggingface', fetchUrl, { page: 1 });
        console.log(`Fetched ${result1.posts.length} posts.`);
        console.log(`hasMore: ${result1.hasMore}`);

        if (result1.posts.length > 0) {
            console.log('First post:', result1.posts[0].title);
            console.log('Image URL:', result1.posts[0].imageUrl);
        }

        // Page 2
        console.log('\n--- Page 2 ---');
        const result2 = await fetchHuggingFacePosts('huggingface', fetchUrl, { page: 2 });
        console.log(`Fetched ${result2.posts.length} posts.`);
        console.log(`hasMore: ${result2.hasMore}`);

        if (result2.posts.length > 0) {
            console.log('First post of page 2:', result2.posts[0].title);
        }

        // Check for overlap
        if (result1.posts.length > 0 && result2.posts.length > 0) {
            const p1Ids = new Set(result1.posts.map(p => p.id));
            const overlap = result2.posts.filter(p => p1Ids.has(p.id));
            console.log(`Overlap between Page 1 and Page 2: ${overlap.length} posts.`);
            if (overlap.length === 0) {
                console.log('SUCCESS: No overlap between pages.');
            } else {
                console.warn('WARNING: Overlap detected (this might be expected if the source shifts, but ideally 0).');
            }
        }

    } catch (error) {
        console.error('Error verifying scraper:', error);
    }
}

verify();

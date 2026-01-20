
import { fetchPostsFromSource } from './lib/scraper';
import { defaultSources } from './lib/sources';

async function verifySpotifyScraper() {
    const source = defaultSources.find(s => s.id === 'spotify-engineering');
    if (!source) {
        console.error('Spotify Engineering source not found');
        return;
    }

    console.log('--- Testing Spotify Engineering Scraper (Page 2) ---');
    const startTime = Date.now();
    const result = await fetchPostsFromSource(source, { page: 2 });
    const endTime = Date.now();

    console.log(`Fetched ${result.posts.length} posts in ${(endTime - startTime) / 1000}s`);

    if (result.posts.length > 0) {
        console.log('First 3 posts:');
        result.posts.slice(0, 3).forEach((p, i) => {
            console.log(`[${i}] ${p.title}`);
            console.log(`    URL: ${p.url}`);
            console.log(`    Image: ${p.imageUrl}`);
            console.log(`    Date: ${p.publishedAt}`);
        });

        const postsWithImage = result.posts.filter(p => p.imageUrl).length;
        console.log(`\nPosts with image: ${postsWithImage}/${result.posts.length}`);
    }
}

verifySpotifyScraper();

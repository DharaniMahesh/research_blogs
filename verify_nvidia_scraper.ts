
import { fetchPostsFromSource } from './lib/scraper';
import { defaultSources } from './lib/sources';

async function verifyNvidiaScraper() {
    const source = defaultSources.find(s => s.id === 'nvidia-developer');
    if (!source) {
        console.error('NVIDIA Developer source not found');
        return;
    }

    console.log('--- Testing NVIDIA Scraper ---');
    const result = await fetchPostsFromSource(source, { page: 1 });
    console.log(`Fetched ${result.posts.length} posts`);

    if (result.posts.length > 0) {
        console.log('First 3 posts:');
        result.posts.slice(0, 3).forEach((p, i) => {
            console.log(`[${i}] ${p.title}`);
            console.log(`    URL: ${p.url}`);
            console.log(`    Image: ${p.imageUrl}`);
        });

        const postsWithImage = result.posts.filter(p => p.imageUrl).length;
        console.log(`\nPosts with image: ${postsWithImage}/${result.posts.length}`);
    }
}

verifyNvidiaScraper();

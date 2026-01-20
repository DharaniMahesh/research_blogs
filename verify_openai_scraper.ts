
import { fetchPostsFromSource } from './lib/scraper';
import { defaultSources } from './lib/sources';

async function verifyOpenAIScraper() {
    const source = defaultSources.find(s => s.id === 'openai');
    if (!source) {
        console.error('OpenAI source not found');
        return;
    }

    console.log('--- Testing OpenAI Scraper ---');
    const result = await fetchPostsFromSource(source, { page: 1 });
    console.log(`Fetched ${result.posts.length} posts`);

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

verifyOpenAIScraper();


import { fetchPostsFromSource } from './lib/scraper';
import { defaultSources } from './lib/sources';

async function verifyNetflixCategories() {
    const source = defaultSources.find(s => s.id === 'netflix-research');
    if (!source) {
        console.error('Netflix Research source not found');
        return;
    }

    console.log('--- Testing Netflix Categories ---');
    const result = await fetchPostsFromSource(source, { page: 1 });
    console.log(`Fetched ${result.posts.length} posts`);

    if (result.posts.length > 0) {
        let blogs = 0;
        let pubs = 0;
        let undefinedCats = 0;

        result.posts.forEach((p, i) => {
            if (i < 5) {
                console.log(`[${i}] ${p.title}`);
                console.log(`    URL: ${p.url}`);
                console.log(`    Category: ${p.category}`);
            }

            if (p.category === 'blog') blogs++;
            else if (p.category === 'publication') pubs++;
            else undefinedCats++;
        });

        console.log('\nSummary:');
        console.log(`Blogs: ${blogs}`);
        console.log(`Publications: ${pubs}`);
        console.log(`Undefined: ${undefinedCats}`);
    }
}

verifyNetflixCategories();


import { fetchGoogleResearchPosts } from '../lib/custom-scrapers';
import { fetchUrl } from '../lib/scraper';

async function verifyGoogle() {
    console.log('Starting Google scraper verification...');

    try {
        // 1. Fetch Blogs (Page 1 -> 2026)
        console.log('\n--- Fetching Blogs (Page 1 / 2026) ---');
        const blogs2026 = await fetchGoogleResearchPosts('google-research', fetchUrl, { page: 1, category: 'blog' });
        console.log(`Found ${blogs2026.posts.length} blog posts`);
        if (blogs2026.posts.length > 0) {
            console.log(`Sample: ${blogs2026.posts[0].title} (${blogs2026.posts[0].publishedAt})`);
        }

        // 2. Fetch Blogs (Page 2 -> 2025)
        console.log('\n--- Fetching Blogs (Page 2 / 2025) ---');
        const blogs2025 = await fetchGoogleResearchPosts('google-research', fetchUrl, { page: 2, category: 'blog' });
        console.log(`Found ${blogs2025.posts.length} blog posts`);
        if (blogs2025.posts.length > 0) {
            console.log(`Sample: ${blogs2025.posts[0].title} (${blogs2025.posts[0].publishedAt})`);
        }

        // 3. Fetch Publications
        console.log('\n--- Fetching Publications (Page 1) ---');
        const pubs = await fetchGoogleResearchPosts('google-research', fetchUrl, { page: 1, category: 'publication' });
        console.log(`Found ${pubs.posts.length} publications`);
        if (pubs.posts.length > 0) {
            console.log(`Sample: ${pubs.posts[0].title}`);
        }

        // 4. Fetch Publications with Filter
        console.log('\n--- Fetching Publications (Algorithms and Theory) ---');
        const filteredPubs = await fetchGoogleResearchPosts('google-research', fetchUrl, {
            page: 1,
            category: 'publication',
            researchArea: 'Algorithms and Theory'
        });
        console.log(`Found ${filteredPubs.posts.length} filtered publications`);
        if (filteredPubs.posts.length > 0) {
            console.log(`Sample: ${filteredPubs.posts[0].title}`);
        }

    } catch (e) {
        console.error('Verification failed:', e);
    }
}

verifyGoogle();

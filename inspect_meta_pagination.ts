
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectMetaPagination() {
    const url = 'https://ai.meta.com/blog/?page=2';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check if we get different posts on page 2
        console.log('\nScanning for links on page 2...');
        const links = new Set<string>();
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/blog/') && href.length > 25) {
                if (href === '/blog/' || href === 'https://ai.meta.com/blog/') return;
                links.add(href);
            }
        });

        console.log(`Found ${links.size} posts on page 2.`);
        Array.from(links).slice(0, 3).forEach(l => console.log(l));

        // Check for "Load More" button or pagination links
        console.log('\nChecking for pagination controls...');
        const loadMore = $('button:contains("Load More"), a:contains("Next"), a:contains("Load More")');
        console.log('Load More/Next found:', loadMore.length > 0);
        if (loadMore.length > 0) {
            console.log('Element:', loadMore.prop('tagName'));
            console.log('Text:', loadMore.text());
            console.log('Href:', loadMore.attr('href'));
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectMetaPagination();

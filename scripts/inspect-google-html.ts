
import { fetchUrl } from '../lib/scraper';
import * as cheerio from 'cheerio';

async function inspect() {
    console.log('Inspecting Google HTML...');

    try {
        // Inspect Blog
        console.log('\n--- Blog (2025) ---');
        const blogHtml = await fetchUrl('https://research.google/blog/2025/');
        const $blog = cheerio.load(blogHtml);

        // Log potential post containers
        console.log('Blog classes found:');
        const classes = new Set();
        $blog('*').each((i, elem) => {
            const cls = $blog(elem).attr('class');
            if (cls) cls.split(' ').forEach(c => classes.add(c));
        });
        // Filter for interesting ones
        const interesting = Array.from(classes).filter(c => c.includes('post') || c.includes('card') || c.includes('article') || c.includes('item'));
        console.log(interesting.slice(0, 20));

        // Try to find links
        console.log('Links found:');
        $blog('a').slice(0, 10).each((i, elem) => {
            console.log($blog(elem).attr('href'), $blog(elem).text().trim().substring(0, 50));
        });

        // Inspect Pubs
        console.log('\n--- Pubs ---');
        const pubsHtml = await fetchUrl('https://research.google/pubs/');
        const $pubs = cheerio.load(pubsHtml);

        console.log('Pubs links found:');
        $pubs('a[href*="/pubs/"]').slice(0, 10).each((i, elem) => {
            console.log($pubs(elem).attr('href'), $pubs(elem).text().trim().substring(0, 50));
        });

    } catch (e) {
        console.error('Inspection failed:', e);
    }
}

inspect();

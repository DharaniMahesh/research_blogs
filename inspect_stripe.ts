
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectStripe() {
    const url = 'https://stripe.com/blog/engineering';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check for posts
        console.log('\nScanning for posts...');
        const articles = $('article, .BlogPost, .Post, a[href*="/blog/"]');
        console.log(`Found ${articles.length} potential post elements.`);

        if (articles.length > 0) {
            console.log('First 3 elements:');
            articles.slice(0, 3).each((i, el) => {
                console.log(`[${i}] Tag: ${el.tagName}, Class: ${$(el).attr('class')}, Href: ${$(el).attr('href')}`);
                console.log(`    Text: ${$(el).text().trim().substring(0, 100)}`);
                console.log(`    Parent: ${$(el).parent().prop('tagName')} class="${$(el).parent().attr('class')}"`);
            });
        }

        // Check for specific Stripe blog classes
        const section = $('section.BlogIndex, .BlogIndex');
        if (section.length > 0) {
            console.log('Found BlogIndex section.');
            const posts = section.find('a');
            console.log(`Found ${posts.length} links in BlogIndex.`);
            if (posts.length > 0) {
                console.log('First Post Link HTML:', posts.first().parent().html()?.substring(0, 300));
            }
        } else {
            console.log('No BlogIndex section found.');
            // Try to find the main list
            const main = $('main');
            if (main.length > 0) {
                console.log('Found main element.');
                const links = main.find('a[href*="/blog/"]');
                console.log(`Found ${links.length} blog links in main.`);
                if (links.length > 0) {
                    console.log('First Blog Link HTML:', links.first().parent().html()?.substring(0, 300));
                }
            }
        }

        // Check for Load More button
        console.log('\nScanning for Load More buttons...');
        const buttons = $('button, a[class*="load"], a[class*="more"]');
        buttons.each((i, el) => {
            const text = $(el).text().trim();
            if (text.toLowerCase().includes('load') || text.toLowerCase().includes('more')) {
                console.log(`Button [${i}]: ${text}`);
                console.log(`    Classes: ${$(el).attr('class')}`);
                console.log(`    Href: ${$(el).attr('href')}`);
            }
        });

        // Check for Next.js data
        const nextData = $('script[id="__NEXT_DATA__"]').html();
        if (nextData) {
            console.log('\nFound __NEXT_DATA__!');
        } else {
            console.log('\nNo __NEXT_DATA__ found.');
        }

        // Check for JSON-LD
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            console.log('Found JSON-LD!');
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectStripe();

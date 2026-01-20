
import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectMeta() {
    const url = 'https://ai.meta.com/blog/';

    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        const $ = cheerio.load(html);

        console.log('Title:', $('title').text());

        // Check for Next.js data
        const nextData = $('#__NEXT_DATA__').html();
        if (nextData) {
            console.log('Found __NEXT_DATA__!');
            const json = JSON.parse(nextData);
            console.log('Keys in props:', Object.keys(json.props));
        } else {
            console.log('No __NEXT_DATA__ found.');
        }

        // Check for JSON-LD
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            console.log('Found JSON-LD!');
            console.log(jsonLd.substring(0, 500));
        }

        // Check for article links
        console.log('\nScanning for links...');
        const links = $('a');
        let count = 0;
        links.each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/blog/') && href.length > 20) {
                if (count < 5) {
                    console.log(`\nLink ${count}: ${href}`);
                    console.log('Text:', $(el).text().trim());
                    console.log('Parent HTML:', $(el).parent().html()?.substring(0, 500));
                    count++;
                }
            }
        });

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectMeta();


import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectUberLocalized() {
    const url = 'https://www.uber.com/en-US/blog/engineering/';

    console.log(`\nFetching ${url}...`);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    try {
        const response = await fetch(url, { headers });
        console.log(`Status: ${response.status}`);

        if (response.status === 200) {
            const html = await response.text();
            const $ = cheerio.load(html);
            console.log('Title:', $('title').text());

            const articles = $('a[href*="/blog/"]');
            console.log(`Found ${articles.length} links.`);

            let engPosts = 0;
            const seenLinks = new Set();

            articles.each((i, el) => {
                const link = $(el).attr('href');
                if (!link || seenLinks.has(link)) return;

                const text = $(el).text().toLowerCase();
                // Heuristic: Link must contain /blog/ and text must be substantial
                if (link.includes('/blog/') && text.length > 20) {
                    // Check if it's likely a post (has date or category)
                    const parent = $(el).closest('div');
                    const html = parent.html();

                    if (html && (html.includes('Engineering') || text.includes('engineering'))) {
                        seenLinks.add(link);
                        engPosts++;
                        if (engPosts <= 5) {
                            console.log(`\nPost [${engPosts}]:`);
                            console.log(`  Title: ${$(el).find('h3, h4, h5, h6').text() || $(el).text().trim().substring(0, 50)}...`);
                            console.log(`  Link: ${link}`);

                            // Try to find image
                            const img = parent.find('img').attr('src') || $(el).find('img').attr('src');
                            console.log(`  Image: ${img}`);

                            // Try to find date
                            const date = parent.text().match(/\d{1,2} [A-Za-z]+|January|February|March|April|May|June|July|August|September|October|November|December/);
                            console.log(`  Date Match: ${date ? date[0] : 'None'}`);
                        }
                    }
                }
            });
            console.log(`\nFound ${engPosts} unique potential engineering posts.`);
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

inspectUberLocalized();


import { fetchUrl } from './lib/scraper';
import * as cheerio from 'cheerio';

async function inspectNetflix() {
    const url = 'https://research.netflix.com/archive';
    console.log(`\nFetching ${url}...`);
    try {
        const html = await fetchUrl(url);

        const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
        if (nextDataMatch) {
            const json = JSON.parse(nextDataMatch[1]);
            const apolloData = json.props.pageProps.serverState?.apollo?.data;

            if (apolloData) {
                const listKey = Object.keys(apolloData).find(k => k.startsWith('$ROOT_QUERY.articleCollection({"limit":500'));
                if (listKey && apolloData[listKey].items) {
                    const items = apolloData[listKey].items;
                    console.log(`Found ${items.length} items in list`);

                    const resolveRef = (ref: any) => {
                        if (ref && ref.__ref) return apolloData[ref.__ref];
                        if (ref && ref.type === 'id' && ref.id) return apolloData[ref.id];
                        return ref;
                    };

                    let blogCount = 0;
                    let pubCount = 0;
                    let otherCount = 0;

                    for (let i = 0; i < items.length; i++) {
                        const item = resolveRef(items[i]);
                        if (item && item.link) {
                            const isBlog = item.link.includes('netflixtechblog.com') || item.link.includes('medium.com');
                            const isPdf = item.link.endsWith('.pdf');

                            if (isBlog) {
                                blogCount++;
                            } else {
                                pubCount++;
                                console.log(`[Non-Blog] ${item.title} -> ${item.link}`);
                            }
                        }
                    }

                    console.log(`\nSummary:`);
                    console.log(`Blogs: ${blogCount}`);
                    console.log(`Publications (Non-Blog): ${pubCount}`);
                }
            }
        }

    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

inspectNetflix();

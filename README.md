# Research Blog Aggregator

A production-quality Next.js web application that scrapes top posts from research and engineering blogs, generates concise summaries and suggested startup use cases using LLM APIs, and displays them in a clean, modern UI.

## Features

- 🔍 **Multi-source aggregation**: Scrapes posts from 20+ research and engineering blogs (Google, Meta, AWS, Netflix, OpenAI, etc.)
- 📰 **RSS & HTML scraping**: Automatically tries RSS feeds first, falls back to HTML scraping when needed
- 🤖 **AI-powered summarization**: Generates concise summaries, highlights, hooks, and startup use cases using LLM APIs
- 💾 **Smart caching**: Filesystem-based caching with configurable refresh intervals (default: 6 hours)
- 🔎 **Search & filtering**: Search posts by keyword, filter by source, date range
- 📱 **Responsive UI**: Built with shadcn/ui and TailwindCSS, fully mobile-responsive
- ⚡ **Rate limiting**: Respects robots.txt and implements polite scraping with delays
- 🔖 **Bookmarking**: Save posts to browser local storage

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + shadcn/ui
- **Scraping**: rss-parser, cheerio
- **LLM APIs**: OpenAI, Groq, or OpenRouter (configurable)
- **Caching**: Filesystem-based JSON cache

## Prerequisites

- Node.js 20+ (or 22+ recommended)
- npm or yarn
- An API key from one of (all free tier options):
  - [Groq](https://console.groq.com/) - **Recommended**: Free tier, fast, no credit card required
  - [OpenRouter](https://openrouter.ai/) - Free tier models available (meta-llama/llama-3.2-3b-instruct, etc.)
  - [OpenAI](https://platform.openai.com/api-keys) - May incur charges, not recommended for free usage

## Installation

1. **Clone the repository** (or navigate to the project directory)

```bash
cd research_blogs
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy `.env.example` to `.env` and add your API key:

```bash
cp .env.example .env
```

Edit `.env` and add at least one API key (free tier recommended):

```env
# Option 1: Groq (FREE TIER - Recommended)
GROQ_API_KEY=gsk-your-key-here

# Option 2: OpenRouter (FREE TIER models)
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct

# Option 3: OpenAI (May incur charges)
# OPENAI_API_KEY=sk-your-key-here
```

**Note**: The app is configured to use free tier models only. Groq is prioritized as it's the fastest free option.

4. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Fetching Posts

1. **Automatic fetch**: Click "Fetch [Source Name]" buttons on the dashboard to fetch latest posts from that source
2. **Manual API call**: Use the `/api/fetch` endpoint:

```bash
curl "http://localhost:3000/api/fetch?sourceId=google-research"
```

### Viewing Posts

- Posts are displayed in a responsive grid on the homepage
- Use the search box to filter by keyword
- Use the source dropdown to filter by specific blog
- Click "Read Full" to open the original post in a new tab

### Summarizing Posts

1. Click "Get Summary" on any post card
2. The app will call the LLM API to generate:
   - A 1-2 sentence summary
   - 3 bullet highlights
   - A click-worthy hook
   - 2-4 startup use cases with complexity ratings

### Use Cases

Click "Use Cases" (or "Get Use Cases") to view suggested business ideas based on the research, including:
- Idea title
- One-line description
- Target market/vertical
- Complexity rating (low/medium/high)

### Bookmarking

Click the bookmark icon on any post to save it to browser local storage. Bookmarks persist across sessions.

## API Endpoints

### `GET /api/sources`

Returns list of all configured sources.

**Response:**
```json
{
  "sources": [
    {
      "id": "google-research",
      "name": "Google Research / Google AI Blog",
      "homepage": "https://research.google/",
      "rss": "https://research.google/rss/blog/",
      "allowScrape": true
    }
  ]
}
```

### `GET /api/fetch?sourceId=<id>`

Fetches latest posts from a source. Respects cache refresh interval (default: 6 hours).

**Query Parameters:**
- `sourceId` (required): Source identifier
- `refreshIntervalHours` (optional): Override default 6-hour refresh interval

**Response:**
```json
{
  "posts": [...],
  "sourceId": "google-research",
  "fetchedAt": "2024-01-01T00:00:00.000Z",
  "cached": false
}
```

### `GET /api/posts`

Returns paginated posts with optional filtering.

**Query Parameters:**
- `sourceId` (optional): Filter by source
- `limit` (optional, default: 20): Number of posts per page
- `offset` (optional, default: 0): Pagination offset
- `keyword` (optional): Search keyword
- `dateFrom` (optional): Filter posts from this date (ISO format)
- `dateTo` (optional): Filter posts until this date (ISO format)

**Response:**
```json
{
  "posts": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### `POST /api/summarize`

Summarizes a blog post using LLM.

**Request Body:**
```json
{
  "url": "https://example.com/post",
  "title": "Post Title",
  "content": "Post content...",
  "author": "Author Name",
  "publishedAt": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "summary": "1-2 sentence summary...",
  "bullets": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "hook": "Click-worthy hook...",
  "usecases": [
    {
      "idea": "Startup Idea",
      "oneLine": "Description...",
      "marketFit": "Target customer...",
      "complexity": "medium"
    }
  ],
  "cached": false
}
```

## Adding New Sources

Edit `lib/sources.ts` and add a new source to the `defaultSources` array:

```typescript
{
  id: 'new-source',
  name: 'Source Name',
  homepage: 'https://example.com',
  rss: 'https://example.com/feed.xml', // Optional: RSS feed URL
  blogListUrl: 'https://example.com/blog', // Optional: Blog listing page for HTML scraping
  allowScrape: true, // Whether HTML scraping is allowed
}
```

## Configuration

### Cache Refresh Interval

Default: 6 hours. Can be overridden per fetch request:

```bash
curl "http://localhost:3000/api/fetch?sourceId=google-research&refreshIntervalHours=12"
```

### LLM Provider Selection

The app automatically selects a provider based on available API keys (priority order):
1. **Groq** (if `GROQ_API_KEY` is set) - **Recommended**: Free tier, fastest
2. **OpenRouter** (if `OPENROUTER_API_KEY` is set) - Free tier models only (meta-llama/llama-3.2-3b-instruct, etc.)
3. **OpenAI** (if `OPENAI_API_KEY` is set) - May incur charges, not recommended for free usage

**Free Tier Models Used**:
- Groq: `llama-3.1-70b-versatile` (free)
- OpenRouter: `meta-llama/llama-3.2-3b-instruct` (free) or other free tier models

## Testing

Run tests with:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

## Project Structure

```
research_blogs/
├── app/
│   ├── api/              # API routes
│   │   ├── fetch/        # Fetch posts from source
│   │   ├── posts/        # Get paginated posts
│   │   ├── summarize/    # Summarize post
│   │   └── sources/      # List sources
│   ├── page.tsx          # Main dashboard
│   └── layout.tsx        # Root layout
├── components/
│   ├── ui/               # shadcn/ui components
│   └── PostCard.tsx      # Post card component
├── lib/
│   ├── cache.ts          # Caching utilities
│   ├── scraper.ts        # RSS/HTML scraping
│   ├── sources.ts        # Source configuration
│   └── summarize.ts      # LLM summarization
├── types/
│   └── index.ts          # TypeScript types
└── __tests__/            # Test files
```

## Legal & Ethical Considerations

⚠️ **Important**: This app is designed for research and preview purposes only.

- **RSS First**: The app prioritizes RSS feeds and publisher-provided APIs
- **HTML Scraping**: Only used as a fallback when RSS is unavailable
- **Robots.txt**: The app checks and respects robots.txt before scraping
- **Attribution**: All posts link back to original sources with proper attribution
- **Rate Limiting**: Implements delays and respects refresh intervals to avoid overloading servers
- **Non-commercial**: Intended for personal research and learning

**Please respect**:
- Website terms of service
- Rate limits and robots.txt
- Copyright and intellectual property rights
- Use RSS feeds when available

## Troubleshooting

### "No LLM API key found"

Make sure you've set at least one API key in `.env`:
- `OPENAI_API_KEY`, or
- `GROQ_API_KEY`, or
- `OPENROUTER_API_KEY`

### Posts not loading

1. Check that you've fetched posts from at least one source
2. Verify the source has a valid RSS feed or blogListUrl
3. Check browser console for errors

### Summarization failing

1. Verify your API key is valid
2. Check API rate limits (especially for free tiers)
3. Ensure you have sufficient API credits/quota

### CORS errors

If you're calling the API from a different domain, you may need to configure CORS in `next.config.ts`.

## Development

### Building for Production

```bash
npm run build
npm start
```

### Environment Variables

See `.env.example` for all available environment variables.

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

# Quick Start Guide

Get up and running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up API Key

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add **at least one** API key:

**Option 1: Groq (Recommended for free tier)**
```env
GROQ_API_KEY=gsk_your_key_here
```

Get your free API key at: https://console.groq.com/

**Option 2: OpenAI**
```env
OPENAI_API_KEY=sk-your_key_here
```

**Option 3: OpenRouter**
```env
OPENROUTER_API_KEY=sk-or-your_key_here
```

## 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 4. Fetch Your First Posts

1. On the homepage, click "Fetch Google Research" (or any other source)
2. Wait a few seconds for posts to load
3. Click "Get Summary" on any post to generate AI summaries
4. Click "Use Cases" to see suggested startup ideas

## What's Next?

- **Read the full README.md** for detailed documentation
- **Check API_EXAMPLES.md** for API usage examples
- **Add more sources** in `lib/sources.ts`
- **Customize the UI** in `app/page.tsx` and `components/PostCard.tsx`

## Troubleshooting

### "No LLM API key found"
Make sure you've set at least one API key in `.env`

### Posts not showing
1. Make sure you've fetched posts from at least one source
2. Check browser console for errors
3. Verify the source has a valid RSS feed

### Build errors
Run `npm run build` to check for TypeScript errors

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Review [API_EXAMPLES.md](./API_EXAMPLES.md) for API usage
- Run tests with `npm test`


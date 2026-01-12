/**
 * Default source configuration for research and engineering blogs
 * Based on MAANG and other global tech companies
 */

import { Source } from '@/types';

export const defaultSources: Source[] = [
  {
    id: 'google-research',
    name: 'Google Research Blog',
    homepage: 'https://research.google/',
    blogListUrl: 'https://research.google/blog/2025/',
    allowScrape: true,
  },
  {
    id: 'deepmind',
    name: 'DeepMind Research',
    homepage: 'https://deepmind.google/',
    blogListUrl: 'https://deepmind.google/blog/',
    allowScrape: true,
  },
  {
    id: 'meta-research',
    name: 'Meta Research blog',
    homepage: 'https://ai.meta.com/',
    blogListUrl: 'https://ai.meta.com/blog/',
    allowScrape: true,
  },
  {
    id: 'meta-engineering',
    name: 'Engineering at Meta',
    homepage: 'https://engineering.fb.com/',
    blogListUrl: 'https://engineering.fb.com/',
    allowScrape: true,
  },
  {
    id: 'amazon-science',
    name: 'Amazon Science',
    homepage: 'https://www.amazon.science/',
    blogListUrl: 'https://www.amazon.science/blog',
    allowScrape: true,
  },
  {
    id: 'aws-architecture',
    name: 'AWS Architecture Blog',
    homepage: 'https://aws.amazon.com/blogs/architecture/',
    rss: 'https://aws.amazon.com/blogs/architecture/feed/',
    allowScrape: true,
  },
  {
    id: 'apple-ml',
    name: 'Apple Machine Learning Research',
    homepage: 'https://machinelearning.apple.com/',
    blogListUrl: 'https://machinelearning.apple.com/research',
    allowScrape: true,
  },
  {
    id: 'netflix-tech',
    name: 'Netflix Tech Blog',
    homepage: 'https://netflixtechblog.com/',
    rss: 'https://netflixtechblog.com/feed',
    allowScrape: true,
  },
  {
    id: 'netflix-research',
    name: 'Netflix Research',
    homepage: 'https://research.netflix.com/',
    blogListUrl: 'https://research.netflix.com/',
    allowScrape: true,
  },
  {
    id: 'microsoft-research',
    name: 'Microsoft Research Blog',
    homepage: 'https://www.microsoft.com/en-us/research/blog/',
    rss: 'https://www.microsoft.com/en-us/research/feed/',
    allowScrape: true,
  },
  {
    id: 'openai',
    name: 'OpenAI Research',
    homepage: 'https://openai.com/research/',
    blogListUrl: 'https://openai.com/index/',
    allowScrape: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Research',
    homepage: 'https://www.anthropic.com/research',
    blogListUrl: 'https://www.anthropic.com/research/',
    allowScrape: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Blog',
    homepage: 'https://huggingface.co/blog',
    rss: 'https://huggingface.co/blog/feed.xml',
    allowScrape: true,
  },
  {
    id: 'uber-engineering',
    name: 'Uber Engineering',
    homepage: 'https://www.uber.com/blog/engineering/',
    blogListUrl: 'https://www.uber.com/blog/engineering/',
    allowScrape: true,
  },
  {
    id: 'spotify-engineering',
    name: 'Spotify Engineering',
    homepage: 'https://engineering.atspotify.com/',
    blogListUrl: 'https://engineering.atspotify.com/',
    allowScrape: true,
  },
  {
    id: 'linkedin-engineering',
    name: 'LinkedIn Engineering',
    homepage: 'https://engineering.linkedin.com/',
    blogListUrl: 'https://engineering.linkedin.com/',
    allowScrape: true,
  },
  {
    id: 'stripe-engineering',
    name: 'Stripe Engineering',
    homepage: 'https://stripe.com/blog/',
    blogListUrl: 'https://stripe.com/blog/engineering',
    allowScrape: true,
  },
  {
    id: 'nvidia-developer',
    name: 'NVIDIA Developer Blog',
    homepage: 'https://developer.nvidia.com/blog',
    rss: 'https://developer.nvidia.com/blog/feed/',
    allowScrape: true,
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Blog',
    homepage: 'https://blog.cloudflare.com/',
    rss: 'https://blog.cloudflare.com/rss/',
    allowScrape: true,
  },
];

/**
 * Get source by ID
 */
export function getSourceById(id: string): Source | undefined {
  return defaultSources.find(s => s.id === id);
}

/**
 * Get all sources
 */
export function getAllSources(): Source[] {
  return defaultSources;
}


/**
 * LLM summarization service with provider abstraction
 * Supports OpenAI, Groq, and OpenRouter APIs
 */

import { SummarizationResult, UseCase } from '@/types';

const SUMMARIZATION_PROMPT = `You will receive a blog post as input. Return a strict JSON object (no extra text) matching the following structure:

{
  "summary": "1-2 sentence concise summary of the post (<= 200 chars).",
  "bullets": ["3 short highlights, each <= 140 chars"],
  "hook": "1 sentence hook that would make someone click to read the full article (<= 120 chars).",
  "usecases": [
    {
      "idea": "short idea title",
      "oneLine": "one-line description explaining how this can be a startup or product",
      "marketFit": "1-line target customer or vertical",
      "complexity": "low|medium|high"
    }
  ]
}

Input payload fields:
- title (string)
- url (string)
- content (plain text; if truncated, still work with the first 800-2000 words)
- author (optional)
- publishedAt (optional ISO date)

Rules:
- Be creative but realistic for usecases. Provide 2-4 usecases.
- Keep bullets factual, not speculative.
- Use US English and concise phrasing.
- Output must be valid JSON only — no explanations or commentary.`;

interface LLMProvider {
  summarize(content: string, metadata: { title: string; url: string; author?: string; publishedAt?: string }): Promise<SummarizationResult>;
}

/**
 * OpenAI provider
 */
class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.openai.com/v1';
  }

  async summarize(content: string, metadata: { title: string; url: string; author?: string; publishedAt?: string }): Promise<SummarizationResult> {
    const prompt = `${SUMMARIZATION_PROMPT}\n\nTitle: ${metadata.title}\nURL: ${metadata.url}\n${metadata.author ? `Author: ${metadata.author}\n` : ''}${metadata.publishedAt ? `Published: ${metadata.publishedAt}\n` : ''}\n\nContent:\n${content.substring(0, 8000)}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return this.normalizeResult(result);
  }

  private normalizeResult(result: any): SummarizationResult {
    return {
      summary: result.summary || '',
      bullets: Array.isArray(result.bullets) ? result.bullets : [],
      hook: result.hook || '',
      usecases: Array.isArray(result.usecases) ? result.usecases.map((u: any) => ({
        idea: u.idea || '',
        oneLine: u.oneLine || '',
        marketFit: u.marketFit || '',
        complexity: (u.complexity || 'medium') as 'low' | 'medium' | 'high',
      })) : [],
    };
  }
}

/**
 * Groq provider
 */
class GroqProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || 'openai/gpt-oss-120b';
  }

  async summarize(content: string, metadata: { title: string; url: string; author?: string; publishedAt?: string }): Promise<SummarizationResult> {
    const prompt = `${SUMMARIZATION_PROMPT}\n\nTitle: ${metadata.title}\nURL: ${metadata.url}\n${metadata.author ? `Author: ${metadata.author}\n` : ''}${metadata.publishedAt ? `Published: ${metadata.publishedAt}\n` : ''}\n\nContent:\n${content.substring(0, 8000)}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return this.normalizeResult(result);
  }

  private normalizeResult(result: any): SummarizationResult {
    return {
      summary: result.summary || '',
      bullets: Array.isArray(result.bullets) ? result.bullets : [],
      hook: result.hook || '',
      usecases: Array.isArray(result.usecases) ? result.usecases.map((u: any) => ({
        idea: u.idea || '',
        oneLine: u.oneLine || '',
        marketFit: u.marketFit || '',
        complexity: (u.complexity || 'medium') as 'low' | 'medium' | 'high',
      })) : [],
    };
  }
}

/**
 * OpenRouter provider (Free tier models only)
 */
class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'meta-llama/llama-3.2-3b-instruct') {
    this.apiKey = apiKey;
    // Ensure we only use free tier models
    const freeModels = [
      'meta-llama/llama-3.2-3b-instruct',
      'google/gemma-2-2b-it',
      'microsoft/phi-3-mini-128k-instruct',
      'qwen/qwen-2.5-7b-instruct',
    ];
    this.model = freeModels.includes(model) ? model : freeModels[0];
  }

  async summarize(content: string, metadata: { title: string; url: string; author?: string; publishedAt?: string }): Promise<SummarizationResult> {
    const prompt = `${SUMMARIZATION_PROMPT}\n\nTitle: ${metadata.title}\nURL: ${metadata.url}\n${metadata.author ? `Author: ${metadata.author}\n` : ''}${metadata.publishedAt ? `Published: ${metadata.publishedAt}\n` : ''}\n\nContent:\n${content.substring(0, 8000)}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Research Blog Aggregator',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return this.normalizeResult(result);
  }

  private normalizeResult(result: any): SummarizationResult {
    return {
      summary: result.summary || '',
      bullets: Array.isArray(result.bullets) ? result.bullets : [],
      hook: result.hook || '',
      usecases: Array.isArray(result.usecases) ? result.usecases.map((u: any) => ({
        idea: u.idea || '',
        oneLine: u.oneLine || '',
        marketFit: u.marketFit || '',
        complexity: (u.complexity || 'medium') as 'low' | 'medium' | 'high',
      })) : [],
    };
  }
}

/**
 * Get LLM provider based on environment variables
 * Priority: Groq > OpenRouter (free tier) > OpenAI
 * 
 * Note: openai/gpt-oss-120b on Groq is a PAID model ($0.15/$0.75 per million tokens)
 * For free tier, set GROQ_FREE_MODEL=true in environment variables
 */
function getLLMProvider(): LLMProvider {
  // Priority: Groq first
  if (process.env.GROQ_API_KEY) {
    // Check if user wants free tier model
    if (process.env.GROQ_FREE_MODEL === 'true') {
      console.log('Using free tier Groq model: llama-3.1-8b-instant-128k');
      return new GroqProvider(process.env.GROQ_API_KEY, 'llama-3.1-8b-instant-128k');
    }

    // Use specified model or default to gpt-oss-120b
    const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    if (groqModel === 'openai/gpt-oss-120b') {
      console.warn('⚠️  Using openai/gpt-oss-120b (PAID model: $0.15/$0.75 per million tokens). Set GROQ_FREE_MODEL=true for free tier.');
    }
    return new GroqProvider(process.env.GROQ_API_KEY, groqModel);
  }

  // OpenRouter with free tier models only
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenRouterProvider(
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct'
    );
  }

  // OpenAI as fallback (may incur charges)
  if (process.env.OPENAI_API_KEY) {
    console.warn('Warning: Using OpenAI API which may incur charges. Consider using Groq or OpenRouter free tier instead.');
    return new OpenAIProvider(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_BASE_URL
    );
  }

  throw new Error('No LLM API key found. Set GROQ_API_KEY (recommended - free), OPENROUTER_API_KEY (free tier), or OPENAI_API_KEY');
}

/**
 * Summarize a blog post
 */
export async function summarizePost(
  content: string,
  metadata: { title: string; url: string; author?: string; publishedAt?: string }
): Promise<SummarizationResult> {
  const provider = getLLMProvider();
  return provider.summarize(content, metadata);
}


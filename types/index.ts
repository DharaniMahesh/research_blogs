/**
 * Data models for the research blog aggregator
 */

export interface Source {
  id: string;
  name: string;
  homepage: string;
  rss?: string;
  blogListUrl?: string;
  allowScrape: boolean;
}

export interface UseCase {
  idea: string;
  oneLine: string;
  marketFit: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface Post {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  summary?: string;
  bullets?: string[];
  hook?: string;
  usecases?: UseCase[];
  rawHtml?: string;
  imageUrl?: string; // Header/featured image URL
  fetchedAt: string;
}

export interface SummarizationResult {
  summary: string;
  bullets: string[];
  hook: string;
  usecases: UseCase[];
}

export interface FetchPostsResponse {
  posts: Post[];
  sourceId: string;
  fetchedAt: string;
}

export interface PostsQueryParams {
  sourceId?: string;
  limit?: number;
  offset?: number;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}


'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Post, Source } from '@/types';
import { PostCard } from '@/components/PostCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Loader2, Trash2, Building2 } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  sources: Source[];
}

export default function Home() {
  const [sources, setSources] = useState<Source[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchDate, setLastFetchDate] = useState<string>('');
  
  // Infinite scroll refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const loadedPostIds = useRef<Set<string>>(new Set());
  const sourcePages = useRef<Map<string, number>>(new Map()); // Track current page per source
  const sourceHasMore = useRef<Map<string, boolean>>(new Map()); // Track if source has more pages
  const totalPostsCount = useRef(0); // Track total posts to avoid stale closure
  const MAX_POSTS = 70;

  // Group sources by company
  const groupSourcesByCompany = (sources: Source[]): Company[] => {
    const groups: { [key: string]: Source[] } = {};
    
    sources.forEach(source => {
      // Extract company name from source name
      let company = source.name.split(' ')[0];
      if (company === 'Engineering' || company === 'Research') {
        const parts = source.name.split(' ');
        company = parts[parts.length - 1] === 'Engineering' || parts[parts.length - 1] === 'Research' 
          ? parts[0] 
          : company;
      }
      
      if (!groups[company]) {
        groups[company] = [];
      }
      groups[company].push(source);
    });

    return Object.entries(groups).map(([company, companySources]) => ({
      id: company.toLowerCase().replace(/\s+/g, '-'),
      name: company,
      sources: companySources,
    })).sort((a, b) => a.name.localeCompare(b.name));
  };

  // Check if it's a new day and refresh if needed
  const checkAndRefreshForNewDay = useCallback(() => {
    const today = new Date().toDateString();
    const lastFetch = localStorage.getItem('lastFetchDate');
    
    if (lastFetch !== today) {
      // New day - clear cache and refresh
      localStorage.setItem('lastFetchDate', today);
      setLastFetchDate(today);
      
      if (selectedCompany) {
        // Clear loaded posts and reload
        loadedPostIds.current.clear();
        currentOffset.current = 0;
        setPosts([]);
        loadPosts(selectedCompany, true);
      }
    }
  }, [selectedCompany]);

  // Deduplicate posts by URL (most reliable identifier)
  const deduplicatePosts = (newPosts: Post[], existingPosts: Post[]): Post[] => {
    const existingUrls = new Set(existingPosts.map(p => p.url));
    const existingIds = new Set(existingPosts.map(p => p.id));
    
    return newPosts.filter(post => {
      // Check both URL and ID to avoid duplicates
      if (existingUrls.has(post.url) || existingIds.has(post.id)) {
        return false;
      }
      existingUrls.add(post.url);
      existingIds.add(post.id);
      return true;
    });
  };

  // Load posts for a company (with lazy pagination)
  const loadPosts = async (company: Company, reset: boolean = false) => {
    if (reset) {
      setPosts([]);
      loadedPostIds.current.clear();
      sourcePages.current.clear();
      sourceHasMore.current.clear();
      totalPostsCount.current = 0;
      setHasMore(true);
    }

    // Check if we've reached max posts
    if (totalPostsCount.current >= MAX_POSTS) {
      setHasMore(false);
      return;
    }

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      // Fetch from all sources for this company
      const allNewPosts: Post[] = [];
      let anySourceHasMore = false;
      
      for (const source of company.sources) {
        // Skip if this source has no more pages
        if (!reset && !sourceHasMore.current.get(source.id)) {
          continue;
        }

        try {
          // Determine which page to fetch
          const currentPage = reset ? 1 : (sourcePages.current.get(source.id) || 0) + 1;
          
          // Only fetch if we haven't reached max posts
          if (totalPostsCount.current + allNewPosts.length >= MAX_POSTS) {
            sourceHasMore.current.set(source.id, false);
            continue;
          }

          // Fetch page from source
          const fetchResponse = await fetch(
            `/api/fetch?sourceId=${source.id}&page=${currentPage}&maxPosts=${MAX_POSTS}&refreshIntervalHours=24`
          );
          
          if (!fetchResponse.ok) {
            console.warn(`Failed to fetch from ${source.name}`);
            sourceHasMore.current.set(source.id, false);
            continue;
          }
          
          const data = await fetchResponse.json();
          const sourcePosts = data.posts || [];
          const hasMore = data.hasMore || false;
          
          // Update page tracking
          sourcePages.current.set(source.id, currentPage);
          const projectedTotal = totalPostsCount.current + allNewPosts.length + sourcePosts.length;
          sourceHasMore.current.set(source.id, hasMore && projectedTotal < MAX_POSTS);
          
          if (hasMore && projectedTotal < MAX_POSTS) {
            anySourceHasMore = true;
          }
          
          // Filter out already loaded posts
          const newSourcePosts = sourcePosts.filter((post: Post) => 
            !loadedPostIds.current.has(post.id) && !loadedPostIds.current.has(post.url)
          );
          
          // Limit to MAX_POSTS
          const remainingSlots = MAX_POSTS - (totalPostsCount.current + allNewPosts.length);
          if (remainingSlots > 0) {
            allNewPosts.push(...newSourcePosts.slice(0, remainingSlots));
          }
        } catch (err) {
          console.error(`Error loading posts from ${source.name}:`, err);
          sourceHasMore.current.set(source.id, false);
        }
      }

      // Deduplicate and sort
      const uniqueNewPosts = deduplicatePosts(allNewPosts, reset ? [] : posts);
      
      // Sort by date (newest first)
      uniqueNewPosts.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.fetchedAt).getTime();
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.fetchedAt).getTime();
        return dateB - dateA;
      });

      // Add to loaded IDs
      uniqueNewPosts.forEach(post => {
        loadedPostIds.current.add(post.id);
        loadedPostIds.current.add(post.url);
      });

      // Update state
      setPosts(prev => {
        const combined = reset ? uniqueNewPosts : [...prev, ...uniqueNewPosts];
        // Final deduplication by URL (most reliable)
        const urlMap = new Map<string, Post>();
        combined.forEach(post => {
          if (!urlMap.has(post.url)) {
            urlMap.set(post.url, post);
          }
        });
        const final = Array.from(urlMap.values());
        
        // Limit to MAX_POSTS
        const limited = final.slice(0, MAX_POSTS);
        
        // Update total count
        totalPostsCount.current = limited.length;
        
        return limited.sort((a, b) => {
          const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.fetchedAt).getTime();
          const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.fetchedAt).getTime();
          return dateB - dateA;
        });
      });

      // Check if we have more posts to load
      setHasMore(anySourceHasMore && totalPostsCount.current < MAX_POSTS);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load more posts (infinite scroll)
  const loadMorePosts = useCallback(async () => {
    if (!selectedCompany || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      await loadPosts(selectedCompany, false);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedCompany, loadingMore, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loading, loadMorePosts]);

  // Load sources on mount
  useEffect(() => {
    fetch('/api/sources')
      .then(res => res.json())
      .then(data => {
        const sourcesList = data.sources || [];
        setSources(sourcesList);
        const companiesList = groupSourcesByCompany(sourcesList);
        setCompanies(companiesList);
        
        // Auto-select first company
        if (companiesList.length > 0) {
          setSelectedCompany(companiesList[0]);
        }
      })
      .catch(err => console.error('Error loading sources:', err));
  }, []);

  // Load posts when company is selected
  useEffect(() => {
    if (selectedCompany) {
      checkAndRefreshForNewDay();
      loadPosts(selectedCompany, true);
    }
  }, [selectedCompany]);

  // Check for new day periodically
  useEffect(() => {
    // Check every hour
    const interval = setInterval(() => {
      checkAndRefreshForNewDay();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkAndRefreshForNewDay]);

  // Initialize last fetch date
  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('lastFetchDate');
    if (!stored) {
      localStorage.setItem('lastFetchDate', today);
    }
    setLastFetchDate(stored || today);
  }, []);

  const handleSummarize = async (post: Post) => {
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, ...post } : p));
  };

  const clearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached posts?')) return;

    try {
      const response = await fetch('/api/cache/clear', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to clear cache');
      
      loadedPostIds.current.clear();
      sourcePages.current.clear();
      sourceHasMore.current.clear();
      totalPostsCount.current = 0;
      setPosts([]);
      
      if (selectedCompany) {
        loadPosts(selectedCompany, true);
      }
      
      alert('Cache cleared successfully!');
    } catch (err) {
      alert(`Failed to clear cache: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Filter posts by search query
  const filteredPosts = searchQuery
    ? posts.filter(post => {
        const searchLower = searchQuery.toLowerCase();
        return (
          post.title.toLowerCase().includes(searchLower) ||
          post.summary?.toLowerCase().includes(searchLower) ||
          post.bullets?.some(b => b.toLowerCase().includes(searchLower)) ||
          post.sourceId.toLowerCase().includes(searchLower)
        );
      })
    : posts;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Research Blog Aggregator</h1>
            <p className="text-sm text-muted-foreground">
              Daily insights from top tech companies
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCache}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Cache
            </Button>
            {selectedCompany && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPosts(selectedCompany, true)}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Company Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5" />
                  <h2 className="font-semibold">Companies</h2>
                </div>
                <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {companies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedCompany?.id === company.id
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">{company.name}</div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {company.sources.length} source{company.sources.length !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Selected Company Info */}
            {selectedCompany && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedCompany.name}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedCompany.sources.map(s => s.name).join(' • ')}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {posts.length} post{posts.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error message */}
            {error && (
              <Card className="mb-4 border-destructive">
                <CardContent className="p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Posts Grid */}
            {loading && posts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? 'No posts match your search.' 
                      : selectedCompany 
                        ? 'No posts found. Try refreshing.' 
                        : 'Select a company to view posts.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPosts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onSummarize={handleSummarize}
                    />
                  ))}
                </div>

                {/* Infinite Scroll Trigger */}
                <div ref={observerTarget} className="h-20 flex items-center justify-center py-8">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Loading more posts...</span>
                    </div>
                  )}
                  {!hasMore && posts.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {posts.length >= MAX_POSTS 
                        ? `Reached maximum of ${MAX_POSTS} posts. No more posts to load.`
                        : 'No more posts to load'}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Post, Source } from '@/types';
import { PostCard } from '@/components/PostCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Loader2, Trash2, Building2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { CompanyPills } from '@/components/ui/company-pills';
import { motion, AnimatePresence } from 'framer-motion';
import { PostGridSkeleton } from '@/components/PostGridSkeleton';

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
  const isLoadingRef = useRef(false); // Prevent race conditions
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce timeout
  const MAX_POSTS = 70;
  const LOAD_MORE_DEBOUNCE_MS = 300; // Debounce delay for infinite scroll

  // Group sources by company
  const groupSourcesByCompany = (sources: Source[]): Company[] => {
    const groups: { [key: string]: Source[] } = {};

    sources.forEach(source => {
      // Extract company name from source name
      let company = source.name.split(' ')[0];

      // Handle "Engineering at X"
      if (source.name.includes(' at ')) {
        // Special case for Meta: keep them separate
        if (source.id === 'meta-engineering' || source.id === 'meta-research') {
          company = source.name;
        } else {
          company = source.name.split(' at ')[1];
        }
      } else if (company === 'Engineering' || company === 'Research') {
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
        sourcePages.current.clear();
        sourceHasMore.current.clear();
        totalPostsCount.current = 0;
        isLoadingRef.current = false;
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

  const fetchRequestId = useRef(0); // Track fetch requests to ignore stale ones

  // Load posts for a company (with lazy pagination)
  const loadPosts = async (company: Company, reset: boolean = false) => {
    const currentRequestId = ++fetchRequestId.current;
    console.log(`[loadPosts] Starting request #${currentRequestId} for ${company.name} (reset=${reset})`);

    if (reset) {
      setPosts([]);
      loadedPostIds.current.clear();
      sourcePages.current.clear();
      sourceHasMore.current.clear();
      totalPostsCount.current = 0;
      setHasMore(true);
    }

    // Check if we've reached max posts
    if (!reset && totalPostsCount.current >= MAX_POSTS) {
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
        // Check if this request is stale
        if (fetchRequestId.current !== currentRequestId) {
          console.log(`[loadPosts] Request #${currentRequestId} is stale (current: ${fetchRequestId.current}), aborting source loop.`);
          return;
        }

        // Check if this source has more pages - default to true if not tracked yet
        const sourceStillHasMore = sourceHasMore.current.get(source.id);
        if (!reset && sourceStillHasMore === false) {
          // Explicitly set to false, skip this source
          console.log(`[loadPosts] Skipping ${source.id} - no more pages`);
          continue;
        }

        let currentSourcePage = reset ? 1 : (sourcePages.current.get(source.id) || 0) + 1;
        let consecutiveDuplicatePages = 0;
        const MAX_CONSECUTIVE_DUPLICATES = 10; // Safety break

        while (true) {
          try {
            // Only fetch if we haven't reached max posts
            if (totalPostsCount.current + allNewPosts.length >= MAX_POSTS) {
              sourceHasMore.current.set(source.id, false);
              break;
            }

            // Determine if we should filter by category (blog only) for specific sources
            let apiUrl = `/api/fetch?sourceId=${source.id}&page=${currentSourcePage}&maxPosts=${MAX_POSTS}&refreshIntervalHours=24`;

            // Filter out publications for DeepMind, Meta, and Google on the home page
            if (['deepmind', 'meta-engineering', 'meta-research', 'google-research'].includes(source.id)) {
              apiUrl += '&category=blog';
            }

            // Fetch page from source
            console.log(`[loadPosts] Fetching ${apiUrl}`);
            const fetchResponse = await fetch(apiUrl);

            // Check stale again after await
            if (fetchRequestId.current !== currentRequestId) {
              console.log(`[loadPosts] Request #${currentRequestId} is stale after fetch, aborting.`);
              return;
            }

            if (!fetchResponse.ok) {
              console.warn(`Failed to fetch from ${source.name}: ${fetchResponse.status}`);
              sourceHasMore.current.set(source.id, false);
              break;
            }

            const data = await fetchResponse.json();
            const sourcePosts = data.posts || [];
            const hasMore = data.hasMore || false;

            console.log(`[loadPosts] ${source.id} page ${currentSourcePage}: got ${sourcePosts.length} posts, API hasMore=${hasMore}`);

            // Filter out already loaded posts
            const newSourcePosts = sourcePosts.filter((post: Post) =>
              !loadedPostIds.current.has(post.id) && !loadedPostIds.current.has(post.url)
            );

            console.log(`[loadPosts] ${source.id}: ${sourcePosts.length} posts from API, ${newSourcePosts.length} after filtering duplicates`);

            // Smart Skip Logic:
            // If we got posts but they are ALL duplicates, it means we likely have this page cached/loaded already.
            // We should skip to the next page immediately.
            if (sourcePosts.length > 0 && newSourcePosts.length === 0) {
              console.log(`[loadPosts] ${source.id} Page ${currentSourcePage} is fully duplicated. Skipping to next page...`);
              currentSourcePage++;
              consecutiveDuplicatePages++;

              if (consecutiveDuplicatePages > MAX_CONSECUTIVE_DUPLICATES) {
                console.warn(`[loadPosts] Hit max consecutive duplicates for ${source.id}. Stopping.`);
                break;
              }

              if (!hasMore) {
                console.log(`[loadPosts] ${source.id} has no more pages (and current was duplicate). Stopping.`);
                sourceHasMore.current.set(source.id, false);
                break;
              }

              // Continue loop to fetch next page
              continue;
            }

            // If we found new posts, or empty (end of list), we process them and stop the loop

            // Update page tracking to the successful page
            sourcePages.current.set(source.id, currentSourcePage);

            const projectedTotal = totalPostsCount.current + allNewPosts.length + sourcePosts.length;
            const sourceCanLoadMore = hasMore && projectedTotal < MAX_POSTS;
            sourceHasMore.current.set(source.id, sourceCanLoadMore);

            if (sourceCanLoadMore) {
              anySourceHasMore = true;
            }

            // Limit to MAX_POSTS
            const remainingSlots = MAX_POSTS - (totalPostsCount.current + allNewPosts.length);
            if (remainingSlots > 0) {
              allNewPosts.push(...newSourcePosts.slice(0, remainingSlots));
            }

            // Break the loop as we found valid content
            break;

          } catch (err) {
            console.error(`Error loading posts from ${source.name}:`, err);
            sourceHasMore.current.set(source.id, false);
            break;
          }
        }
      }

      // Check stale before updating state
      if (fetchRequestId.current !== currentRequestId) {
        console.log(`[loadPosts] Request #${currentRequestId} is stale before state update, aborting.`);
        return;
      }

      console.log(`[loadPosts] allNewPosts before dedup: ${allNewPosts.length}`);

      // Deduplicate and sort
      const uniqueNewPosts = deduplicatePosts(allNewPosts, reset ? [] : posts);

      console.log(`[loadPosts] uniqueNewPosts after dedup: ${uniqueNewPosts.length}`);

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
      const finalHasMore = anySourceHasMore && totalPostsCount.current < MAX_POSTS;
      console.log(`[loadPosts] Final state: anySourceHasMore=${anySourceHasMore}, totalPostsCount=${totalPostsCount.current}, finalHasMore=${finalHasMore}`);
      setHasMore(finalHasMore);
    } catch (err) {
      // Check stale in catch too
      if (fetchRequestId.current !== currentRequestId) return;
      console.error('Error loading posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      if (fetchRequestId.current === currentRequestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  // Load more posts (infinite scroll) - with debouncing
  const loadMorePosts = useCallback(async () => {
    console.log(`[loadMorePosts] Called: selectedCompany=${selectedCompany?.id}, isLoading=${isLoadingRef.current}, hasMore=${hasMore}`);

    // Use ref to prevent race conditions - state may be stale in callback
    if (!selectedCompany || isLoadingRef.current || !hasMore) {
      console.log(`[loadMorePosts] Skipping - conditions not met`);
      return;
    }

    console.log(`[loadMorePosts] Starting load...`);

    // Set both state and ref
    isLoadingRef.current = true;
    setLoadingMore(true);

    try {
      await loadPosts(selectedCompany, false);
    } finally {
      isLoadingRef.current = false;
      setLoadingMore(false);
    }
  }, [selectedCompany, hasMore]);

  // Debounced version for scroll events
  const debouncedLoadMore = useCallback(() => {
    // Clear any pending timeout
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
    }

    // Set new timeout
    loadMoreTimeoutRef.current = setTimeout(() => {
      loadMorePosts();
    }, LOAD_MORE_DEBOUNCE_MS);
  }, [loadMorePosts]);

  // Intersection Observer for infinite scroll - with larger rootMargin for earlier trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Use ref to check loading state (more reliable than state in observer callback)
        if (entries[0].isIntersecting && hasMore && !isLoadingRef.current && !loading) {
          debouncedLoadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px 0px' // Start loading 200px before reaching the bottom
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      // Clear any pending debounce timeout on cleanup
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, [hasMore, loading, debouncedLoadMore]);

  // Load sources on mount
  useEffect(() => {
    fetch('/api/sources')
      .then(res => res.json())
      .then(data => {
        const sourcesList = data.sources || [];
        setSources(sourcesList);
        const companiesList = groupSourcesByCompany(sourcesList);
        setCompanies(companiesList);

        // Restore selected company from localStorage or default to first
        const savedCompanyId = localStorage.getItem('selectedCompanyId');
        const savedCompany = companiesList.find(c => c.id === savedCompanyId);

        if (savedCompany) {
          setSelectedCompany(savedCompany);
        } else if (companiesList.length > 0) {
          setSelectedCompany(companiesList[0]);
        }
      })
      .catch(err => console.error('Error loading sources:', err));
  }, []);

  // Save selected company to localStorage
  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('selectedCompanyId', selectedCompany.id);
    }
  }, [selectedCompany]);

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
    <div className="min-h-screen bg-background relative">


      {/* Sticky Glassmorphic Header */}
      <div className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl shadow-sm supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Research Blogs</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
                Daily insights from top tech companies
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {selectedCompany && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => loadPosts(selectedCompany, true)}
                  disabled={loading}
                  className="h-9 w-9"
                  title="Refresh posts"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="sr-only">Refresh</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={clearCache}
                className="h-9 w-9"
                title="Clear cache"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear Cache</span>
              </Button>
            </div>
          </div>

          {/* Mobile Navigation (Pills) */}
          <div className="mt-3 lg:hidden">
            <CompanyPills
              companies={companies}
              selectedCompany={selectedCompany}
              onSelect={setSelectedCompany}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <div className="space-y-1">
                <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">
                  Companies
                </h2>
                <div className="space-y-1">
                  {companies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 ${selectedCompany?.id === company.id
                        ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{company.name}</span>
                        <span className={`text-xs ${selectedCompany?.id === company.id ? 'opacity-90' : 'opacity-50'}`}>
                          {company.sources.length}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            <div className="mb-4">
              <motion.div
                className="relative max-w-md"
                initial={false}
                animate={searchQuery ? { scale: 1.02 } : { scale: 1 }}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 transition-shadow duration-200"
                />
              </motion.div>
            </div>

            {/* Selected Company Info */}
            {selectedCompany && (
              <Card className="mb-4 overflow-hidden border-none shadow-sm bg-gradient-to-br from-background to-muted/50">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-lg md:text-xl font-bold tracking-tight">{selectedCompany.name}</h2>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                        {selectedCompany.sources.map(s => s.name).join(' • ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      {/* DeepMind Hub Link */}
                      {selectedCompany.sources.some(s => s.id === 'deepmind') && (
                        <Link
                          href="/deepmind"
                          className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs md:text-sm font-medium rounded-full hover:from-blue-500 hover:to-purple-500 transition-all shadow-sm hover:shadow-md hover:shadow-purple-500/20"
                        >
                          <span>DeepMind Hub</span>
                          <svg className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Link>
                      )}
                      {/* Meta Hub Link */}
                      {selectedCompany.sources.some(s => s.id === 'meta-engineering') && (
                        <Link
                          href="/meta"
                          className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs md:text-sm font-medium rounded-full hover:from-blue-500 hover:to-indigo-500 transition-all shadow-sm hover:shadow-md hover:shadow-blue-500/20"
                        >
                          <span>Meta Hub</span>
                          <svg className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Link>
                      )}
                      {/* Google Hub Link */}
                      {selectedCompany.sources.some(s => s.id === 'google-research') && (
                        <Link
                          href="/google"
                          className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500 via-red-500 to-yellow-500 text-white text-xs md:text-sm font-medium rounded-full hover:opacity-90 transition-all shadow-sm hover:shadow-md hover:shadow-blue-500/20"
                        >
                          <span>Google Hub</span>
                          <svg className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Link>
                      )}
                      {/* Netflix Hub Link */}
                      {selectedCompany.sources.some(s => s.id === 'netflix-research') && (
                        <Link
                          href="/netflix"
                          className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-red-600 to-black text-white text-xs md:text-sm font-medium rounded-full hover:from-red-500 hover:to-gray-900 transition-all shadow-sm hover:shadow-md hover:shadow-red-500/20"
                        >
                          <span>Netflix Hub</span>
                          <svg className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Link>
                      )}
                      <Badge variant="secondary" className="px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-background/50 backdrop-blur-sm border-border/50">
                        {posts.length} post{posts.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
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
              <PostGridSkeleton />
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
                <motion.div
                  layout
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredPosts.map(post => (
                      <motion.div
                        key={post.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.2 }}
                      >
                        <PostCard
                          post={post}
                          onSummarize={handleSummarize}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

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

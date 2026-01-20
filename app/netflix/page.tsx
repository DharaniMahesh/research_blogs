
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import { PostCard } from '@/components/PostCard';
import { PostGridSkeleton } from '@/components/PostGridSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

// Netflix brand colors
const NETFLIX_COLORS = {
    red: '#E50914',
    black: '#141414',
    dark: '#181818',
    gray: '#808080',
};

type TabType = 'all' | 'blog' | 'publication';

export default function NetflixPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('all');

    // Fetch posts for a specific page
    const fetchPosts = useCallback(async (pageNum: number, isInitial: boolean = false, currentPosts: Post[] = []) => {
        if (isInitial) {
            setLoading(true);
            setError(null);
        } else {
            setLoadingMore(true);
        }

        try {
            const url = `/api/fetch?sourceId=netflix-research&page=${pageNum}&maxPosts=20`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch Netflix posts');
            }

            const data = await response.json();
            const newPosts = data.posts || [];
            const lastHasMore = data.hasMore;

            setPosts(prev => {
                const combined = isInitial ? newPosts : [...prev, ...newPosts];
                // Deduplicate by URL
                const seen = new Set();
                return combined.filter((post: Post) => {
                    const duplicate = seen.has(post.url);
                    seen.add(post.url);
                    return !duplicate;
                });
            });

            setHasMore(lastHasMore);
            setPage(pageNum);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch posts');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchPosts(1, true, []);
    }, [fetchPosts]);

    // Infinite scroll handler
    const handleScroll = useCallback(() => {
        if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight || loading || loadingMore || !hasMore) {
            return;
        }
        fetchPosts(page + 1, false, posts);
    }, [loading, loadingMore, hasMore, page, fetchPosts, posts]);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Filter posts by search and tab
    const filteredPosts = posts.filter(post => {
        // Tab filter
        if (activeTab !== 'all' && post.category !== activeTab) {
            return false;
        }
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return post.title.toLowerCase().includes(query) ||
                post.summary?.toLowerCase().includes(query);
        }
        return true;
    });

    // Count by category
    const blogCount = posts.filter(p => p.category === 'blog').length;
    const pubCount = posts.filter(p => p.category === 'publication').length;

    const handleSummarize = async (post: Post) => {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, ...post } : p));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black">
            {/* Header */}
            <header className="relative overflow-hidden border-b border-zinc-800/50 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-transparent to-transparent" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </Link>
                            <div className="h-8 w-px bg-zinc-800" />
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
                                    Netflix Research Hub
                                </h1>
                                <p className="text-zinc-400 mt-1 text-sm md:text-base">
                                    Latest research blogs and publications from Netflix
                                </p>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="px-3 py-1.5 text-sm bg-zinc-900/50 text-zinc-300 rounded-full border border-zinc-800">
                                {posts.length} Posts
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search and Tabs */}
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search Netflix research..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                            />
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-zinc-900/50 rounded-xl p-1 border border-zinc-800 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'all'
                                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                All ({posts.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('blog')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'blog'
                                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                Blog ({blogCount})
                            </button>
                            <button
                                onClick={() => setActiveTab('publication')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'publication'
                                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                Publications ({pubCount})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <PostGridSkeleton />
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                        <p className="text-red-400">{error}</p>
                        <button
                            onClick={() => fetchPosts(page, true)}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Posts Grid */}
                {!loading && !error && (
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        <AnimatePresence mode="popLayout">
                            {filteredPosts.map((post) => (
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
                )}

                {/* Empty State */}
                {!loading && !error && filteredPosts.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto mb-4 bg-zinc-900/50 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-zinc-300">No posts found</h3>
                        <p className="text-zinc-500 mt-1">Try adjusting your search or tab</p>
                    </div>
                )}

                {/* Infinite Scroll Loading Indicator */}
                {loadingMore && (
                    <div className="flex justify-center py-8">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            <span className="text-sm">Loading more posts...</span>
                        </div>
                    </div>
                )}

                {!hasMore && posts.length > 0 && !loading && (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        No more posts to load
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-800/50 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-zinc-500 text-sm">
                    Aggregating research from{' '}
                    <a
                        href="https://research.netflix.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-500 hover:text-red-400"
                    >
                        Netflix Research
                    </a>
                </div>
            </footer>
        </div>
    );
}

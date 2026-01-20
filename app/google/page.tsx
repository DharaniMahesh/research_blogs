'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import { PostCard } from '@/components/PostCard';
import { PostGridSkeleton } from '@/components/PostGridSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

// Google brand colors
const GOOGLE_COLORS = {
    blue: '#4285F4',
    red: '#EA4335',
    yellow: '#FBBC05',
    green: '#34A853',
    dark: '#202124',
};

interface GooglePost extends Post {
    category?: string;
}

type TabType = 'all' | 'blog' | 'publication';

const RESEARCH_AREAS = [
    "Algorithms and Theory", "Climate and Sustainability", "Data Management",
    "Data Mining and Modeling", "Distributed Systems and Parallel Computing",
    "Economics and Electronic Commerce", "Education Innovation", "General Science",
    "Hardware and Architecture", "Health & Bioscience",
    "Human-Computer Interaction and Visualization", "Information Retrieval and the Web",
    "Machine Intelligence", "Machine Perception", "Machine Translation",
    "Mobile Systems", "Natural Language Processing", "Networking",
    "Quantum Computing", "Responsible AI", "Robotics",
    "Security, Privacy and Abuse Prevention", "Software Engineering",
    "Software Systems", "Speech Processing"
];

export default function GooglePage() {
    const [posts, setPosts] = useState<GooglePost[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Fetch posts for a specific page
    const fetchPosts = useCallback(async (pageNum: number, isInitial: boolean = false, currentPosts: GooglePost[] = []) => {
        if (isInitial) {
            setLoading(true);
            setError(null);
        } else {
            setLoadingMore(true);
        }

        try {
            let currentP = pageNum;
            let accumulatedPosts: GooglePost[] = [];
            let keepFetching = true;
            let lastHasMore = false;

            // Fetch until we have enough posts or run out of data
            while (keepFetching) {
                let url = `/api/fetch?sourceId=google-research&page=${currentP}&maxPosts=20`;

                // Always fetch all categories to ensure we have a mix for the "All" tab and consistent counts
                // We filter client-side for the specific tabs

                if (selectedArea) {
                    url += `&researchArea=${encodeURIComponent(selectedArea)}`;
                }

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to fetch Google posts');
                }

                const data = await response.json();
                const newPosts = data.posts || [];
                accumulatedPosts = [...accumulatedPosts, ...newPosts];
                lastHasMore = data.hasMore;

                // Check if we have enough posts for the ACTIVE tab
                const allPostsSoFar = [...currentPosts, ...accumulatedPosts];
                const totalCount = allPostsSoFar.length;
                const blogCount = allPostsSoFar.filter(p => p.category === 'blog').length;
                const pubCount = allPostsSoFar.filter(p => p.category === 'publication').length;

                let satisfied = false;
                if (activeTab === 'blog') {
                    satisfied = blogCount >= 15;
                } else if (activeTab === 'publication') {
                    satisfied = pubCount >= 15;
                } else {
                    // 'all'
                    satisfied = totalCount >= 60 && blogCount >= 15;
                }

                // Stop conditions:
                // 1. Satisfied criteria for active tab
                // 2. No more data available
                // 3. We've fetched too many pages in this batch (safety limit of 15)
                if ((satisfied) || !lastHasMore || currentP >= pageNum + 15) {
                    keepFetching = false;
                } else {
                    currentP++;
                }
            }

            setPosts(prev => {
                const combined = isInitial ? accumulatedPosts : [...prev, ...accumulatedPosts];
                // Deduplicate by URL
                const seen = new Set();
                return combined.filter((post: GooglePost) => {
                    const duplicate = seen.has(post.url);
                    seen.add(post.url);
                    return !duplicate;
                });
            });

            setHasMore(lastHasMore);
            setPage(currentP);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch posts');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [selectedArea, activeTab]);

    // Initial fetch and when filters change (Research Area)
    useEffect(() => {
        // Reset state when filters change
        setPosts([]);
        setPage(1);
        setHasMore(true);
        fetchPosts(1, true, []);
    }, [fetchPosts, selectedArea]);

    // When switching tabs, check if we need more content
    useEffect(() => {
        const blogCount = posts.filter(p => p.category === 'blog').length;
        const pubCount = posts.filter(p => p.category === 'publication').length;

        let needsMore = false;
        if (activeTab === 'blog' && blogCount < 15) needsMore = true;
        if (activeTab === 'publication' && pubCount < 15) needsMore = true;
        if (activeTab === 'all' && (blogCount < 15 || posts.length < 60)) needsMore = true;

        if (needsMore && hasMore && !loading && !loadingMore) {
            console.log(`Tab ${activeTab} needs more content, fetching...`);
            fetchPosts(page + 1, false, posts);
        }
    }, [activeTab, posts, hasMore, loading, loadingMore, page, fetchPosts]); // Only trigger on tab change


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

    // Filter posts by tab and search
    // Note: Research Area filtering is done on server side for publications
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="relative overflow-hidden border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-red-500/5 to-yellow-500/5" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </Link>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 via-red-400 to-yellow-400 bg-clip-text text-transparent">
                                    Google Research Hub
                                </h1>
                                <p className="text-slate-400 mt-1 text-sm md:text-base">
                                    Latest research blogs and publications from Google
                                </p>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="px-3 py-1.5 text-sm bg-slate-800/50 text-slate-300 rounded-full border border-slate-700">
                                {posts.length} Posts
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search, Tabs, and Filters */}
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search Google research..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                            />
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'all'
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                All ({posts.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('blog')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'blog'
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Blog ({blogCount})
                            </button>
                            <button
                                onClick={() => setActiveTab('publication')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'publication'
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Publications ({pubCount})
                            </button>
                        </div>
                    </div>

                    {/* Research Area Filter (Only visible when Publication tab is active or All) */}
                    {(activeTab === 'all' || activeTab === 'publication') && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <span className="text-sm text-slate-400 whitespace-nowrap">Research Area:</span>
                            <select
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                className="bg-slate-800/50 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 min-w-[200px]"
                            >
                                <option value="">All Areas</option>
                                {RESEARCH_AREAS.map(area => (
                                    <option key={area} value={area}>{area}</option>
                                ))}
                            </select>
                        </div>
                    )}
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
                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800/50 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-slate-300">No posts found</h3>
                        <p className="text-slate-500 mt-1">Try adjusting your search or changing the tab</p>
                    </div>
                )}

                {/* Infinite Scroll Loading Indicator */}
                {loadingMore && (
                    <div className="flex justify-center py-8">
                        <div className="flex items-center gap-2 text-slate-400">
                            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-sm">Loading more posts...</span>
                        </div>
                    </div>
                )}

                {!hasMore && posts.length > 0 && !loading && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        No more posts to load
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/50 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-slate-500 text-sm">
                    Aggregating research from{' '}
                    <a
                        href="https://research.google/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                    >
                        Google Research
                    </a>
                </div>
            </footer>
        </div>
    );
}

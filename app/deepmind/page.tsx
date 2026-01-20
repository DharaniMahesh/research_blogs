'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import { PostCard } from '@/components/PostCard';
import { PostGridSkeleton } from '@/components/PostGridSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

// DeepMind brand colors
const DEEPMIND_COLORS = {
    primary: '#4285F4', // Google Blue
    secondary: '#A855F7', // Purple
    accent: '#7C3AED',
    dark: '#0F172A',
    darker: '#020617',
    card: 'rgba(30, 41, 59, 0.8)',
};

interface DeepMindPost extends Post {
    category?: string;
    subCategory?: string;
    venue?: string;
}

type TabType = 'all' | 'blog' | 'publication' | 'science';

export default function DeepMindPage() {
    const [posts, setPosts] = useState<DeepMindPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all pages to get comprehensive data (up to 100 posts limit)
            const allPosts: DeepMindPost[] = [];
            const seenUrls = new Set<string>();
            let page = 1;
            let hasMore = true;

            while (hasMore && allPosts.length < 100) {
                const response = await fetch(
                    `/api/fetch?sourceId=deepmind&page=${page}&maxPosts=20`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch DeepMind posts');
                }

                const data = await response.json();

                // Deduplicate by URL
                for (const post of data.posts) {
                    if (!seenUrls.has(post.url)) {
                        seenUrls.add(post.url);
                        allPosts.push(post);
                    }
                }

                hasMore = data.hasMore;
                page++;

                // Safety limit
                if (page > 10) break;
            }

            setPosts(allPosts.slice(0, 100));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch posts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Filter posts by tab and search
    const filteredPosts = posts.filter(post => {
        // Tab filter
        if (activeTab !== 'all' && post.category !== activeTab) {
            return false;
        }
        // Sub-category filter (only for Science tab)
        if (activeTab === 'science' && activeSubCategory !== 'all' && post.subCategory !== activeSubCategory) {
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
    const scienceCount = posts.filter(p => p.category === 'science').length;

    const handleSummarize = async (post: Post) => {
        // Optimistic update if needed, or just let PostCard handle it
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, ...post } : p));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950">
            {/* Header */}
            <header className="relative overflow-hidden border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10" />
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
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    DeepMind Research Hub
                                </h1>
                                <p className="text-slate-400 mt-1 text-sm md:text-base">
                                    Latest breakthroughs, publications, and research from Google DeepMind
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
                {/* Search and Tabs */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
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
                            placeholder="Search DeepMind research..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'all'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            All ({posts.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('blog')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'blog'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Blog ({blogCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('publication')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'publication'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Publications ({pubCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('science')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'science'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Science ({scienceCount})
                        </button>
                    </div>
                </div>

                {/* Sub-category Filters (only for Science tab) */}
                {activeTab === 'science' && (
                    <div className="flex flex-wrap gap-2 mb-8 animate-fadeIn">
                        {['all', 'Biology', 'Climate & Sustainability', 'Mathematics & Computer Science', 'Physics & Chemistry'].map((subCat) => (
                            <button
                                key={subCat}
                                onClick={() => setActiveSubCategory(subCat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${activeSubCategory === subCat
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                                    }`}
                            >
                                {subCat === 'all' ? 'All Science' : subCat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <PostGridSkeleton />
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                        <p className="text-red-400">{error}</p>
                        <button
                            onClick={fetchPosts}
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
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/50 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-slate-500 text-sm">
                    Aggregating research from{' '}
                    <a
                        href="https://deepmind.google"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300"
                    >
                        Google DeepMind
                    </a>
                </div>
            </footer>
        </div>
    );
}

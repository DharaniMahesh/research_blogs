'use client';

import Image from 'next/image';
import { Post, UseCase } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink, BookOpen, Lightbulb, Bookmark, BookmarkCheck, Calendar, ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: Post;
  onSummarize?: (post: Post) => Promise<void>;
}

export function PostCard({ post, onSummarize }: PostCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [summary, setSummary] = useState<{ bullets?: string[]; hook?: string; usecases?: UseCase[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    setIsBookmarked(bookmarks.includes(post.id));
  }, [post.id]);

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    if (isBookmarked) {
      const newBookmarks = bookmarks.filter((id: string) => id !== post.id);
      localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
      setIsBookmarked(false);
    } else {
      bookmarks.push(post.id);
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
      setIsBookmarked(true);
    }
  };

  const handleSummarize = async (e: React.MouseEvent) => {
    // Do not stop propagation here, let DialogTrigger handle the open state
    if (summary) return;

    setLoading(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: post.url,
          title: post.title,
          content: post.rawHtml,
          author: post.author,
          publishedAt: post.publishedAt,
        }),
      });

      if (!response.ok) throw new Error('Failed to summarize');

      const data = await response.json();
      setSummary(data);

      if (onSummarize) {
        await onSummarize({ ...post, ...data });
      }
    } catch (error) {
      console.error('Error summarizing post:', error);
    } finally {
      setLoading(false);
    }
  };

  const complexityColors = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="group relative flex flex-col h-full bg-card rounded-xl border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md hover:border-border/80 overflow-hidden">
      {/* Image Container */}
      <a href={post.url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video overflow-hidden bg-muted">
        {post.imageUrl && !imageError ? (
          <Image
            src={post.imageUrl}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/30 text-muted-foreground">
            <span className="text-sm font-medium">{post.sourceId}</span>
          </div>
        )}

        {/* Floating Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-sm border-0 text-xs font-medium">
            {post.sourceId.split('-')[0]}
          </Badge>
        </div>
      </a>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="group/title">
            <h3 className="text-lg font-semibold leading-tight tracking-tight group-hover/title:text-primary transition-colors line-clamp-2">
              {post.title}
            </h3>
          </a>
        </div>

        {post.summary && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {post.summary}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/40">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {post.publishedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{new Date(post.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={toggleBookmark}
              title={isBookmarked ? "Remove bookmark" : "Bookmark"}
            >
              {isBookmarked ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={handleSummarize}
                  title="AI Summary"
                >
                  <Lightbulb className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-0 gap-0">
                <DialogHeader className="p-6 pb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
                  <DialogTitle className="text-xl">Startup Use Cases</DialogTitle>
                  <DialogDescription>
                    Suggested business ideas based on this research
                  </DialogDescription>
                </DialogHeader>
                <div className="p-6 pt-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : summary ? (
                    <div className="space-y-6 pt-4">
                      {summary.hook && (
                        <div className="bg-muted/30 p-4 rounded-lg border">
                          <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">The Hook</h4>
                          <p className="text-base leading-relaxed">{summary.hook}</p>
                        </div>
                      )}
                      {summary.bullets && summary.bullets.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Key Insights</h4>
                          <ul className="space-y-3">
                            {summary.bullets.map((bullet, idx) => (
                              <li key={idx} className="flex items-start gap-3">
                                <span className="text-primary mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                <span className="text-sm leading-relaxed">{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(summary.usecases || post.usecases) && (
                        <div>
                          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Startup Opportunities</h4>
                          <div className="grid gap-3">
                            {(summary.usecases || post.usecases || []).map((usecase, idx) => (
                              <div key={idx} className="border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">{usecase.idea}</span>
                                  <Badge variant="secondary" className="text-[10px] h-5">{usecase.complexity}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{usecase.oneLine}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Click to generate an AI summary
                    </div>
                  )}
                </div>

              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => window.open(post.url, '_blank')}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

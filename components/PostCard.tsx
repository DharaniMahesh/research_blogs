'use client';

import { Post, UseCase } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink, BookOpen, Lightbulb, Bookmark, BookmarkCheck } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PostCardProps {
  post: Post;
  onSummarize?: (post: Post) => Promise<void>;
}

export function PostCard({ post, onSummarize }: PostCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [summary, setSummary] = useState<{ bullets?: string[]; hook?: string; usecases?: UseCase[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if post is bookmarked
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    setIsBookmarked(bookmarks.includes(post.id));
  }, [post.id]);

  const toggleBookmark = () => {
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

  const handleSummarize = async () => {
    if (summary) return; // Already summarized
    
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
    <Card className="flex flex-col h-full overflow-hidden">
      {/* Header Image */}
      {post.imageUrl && (
        <div className="relative w-full h-48 overflow-hidden bg-muted">
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2 flex-1">{post.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleBookmark}
            className="flex-shrink-0"
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription className="flex items-center gap-2 flex-wrap mt-2">
          <Badge variant="outline">{post.sourceId}</Badge>
          {post.publishedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(post.publishedAt).toLocaleDateString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        {post.summary && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {post.summary}
          </p>
        )}
        
        {post.bullets && post.bullets.length > 0 ? (
          <ul className="text-sm space-y-1 mb-3">
            {post.bullets.slice(0, 3).map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="line-clamp-1">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary available yet</p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(post.url, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Read Full
        </Button>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={loading}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              {summary ? 'View Summary' : loading ? 'Loading...' : 'Get Summary'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{post.title}</DialogTitle>
              <DialogDescription>
                {post.url}
              </DialogDescription>
            </DialogHeader>
            
            {loading ? (
              <p>Loading summary...</p>
            ) : summary ? (
              <div className="space-y-4">
                {summary.hook && (
                  <div>
                    <h4 className="font-semibold mb-2">Hook</h4>
                    <p className="text-sm">{summary.hook}</p>
                  </div>
                )}
                
                {summary.bullets && summary.bullets.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Highlights</h4>
                    <ul className="space-y-2">
                      {summary.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Click "Get Summary" to generate a summary</p>
            )}
          </DialogContent>
        </Dialog>

        {(summary?.usecases && summary.usecases.length > 0) || post.usecases ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Lightbulb className="h-4 w-4 mr-1" />
                Use Cases
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Startup Use Cases</DialogTitle>
                <DialogDescription>
                  Suggested business ideas based on this research
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {(summary?.usecases || post.usecases || []).map((usecase, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">{usecase.idea}</h4>
                      <Badge className={complexityColors[usecase.complexity]}>
                        {usecase.complexity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{usecase.oneLine}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Target:</span> {usecase.marketFit}
                    </p>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSummarize}
            disabled={loading}
          >
            <Lightbulb className="h-4 w-4 mr-1" />
            {loading ? 'Loading...' : 'Get Use Cases'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}


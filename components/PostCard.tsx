'use client';

import Image from 'next/image';
import { Post } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookmarkCheck, Calendar, ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
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

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => window.open(post.url, '_blank')}
              title="Open in new tab"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

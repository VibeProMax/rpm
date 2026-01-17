import type { PRComment } from '../../types/index.ts';
import { formatRelativeTime } from '../../lib/utils.ts';
import { useAppState, useAppActions } from '../../context/AppContext.tsx';
import { useState, useEffect, useRef } from 'react';

interface CommentProps {
  comment: PRComment;
  replies?: PRComment[];
  depth?: number;
}

export function Comment({ comment, replies = [], depth = 0 }: CommentProps) {
  const { scrollToCommentId } = useAppState();
  const { navigateToFileLine } = useAppActions();
  const [isExpanded, setIsExpanded] = useState(true);
  const commentRef = useRef<HTMLDivElement>(null);

  // Scroll to this comment when scrollToCommentId matches
  useEffect(() => {
    if (scrollToCommentId === comment.id && commentRef.current) {
      commentRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Flash highlight effect
      commentRef.current.style.backgroundColor = 'rgba(255, 200, 0, 0.3)';
      setTimeout(() => {
        if (commentRef.current) {
          commentRef.current.style.backgroundColor = '';
        }
      }, 2000);
    }
  }, [scrollToCommentId, comment.id]);

  // Use line, originalLine, or position as fallback
  const effectiveLine = comment.line || comment.originalLine || comment.position;

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (comment.path && effectiveLine) {
      navigateToFileLine(comment.path, effectiveLine);
    }
  };

  const hasReplies = replies.length > 0;
  const isClickable = comment.path && effectiveLine;

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-border pl-4' : ''}`}>
      <div 
        ref={commentRef}
        className="p-3 border-b border-border hover:bg-surface/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {comment.author.avatarUrl && (
            <img
              src={comment.author.avatarUrl}
              alt={comment.author.login}
              className="w-7 h-7 rounded-full shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold">{comment.author.login}</span>
              <span className="text-xs text-text-secondary">
                {formatRelativeTime(comment.createdAt)}
              </span>
              {hasReplies && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 ml-auto"
                >
                  {isExpanded ? '▼' : '▶'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
            
            {comment.path && (
              <button
                onClick={handleNavigate}
                disabled={!isClickable}
                className={`text-xs font-mono mb-2 block ${
                  isClickable 
                    ? 'text-blue-400 hover:text-blue-300 cursor-pointer hover:underline' 
                    : 'text-text-secondary cursor-default'
                }`}
                title={isClickable ? `Click to navigate to ${comment.path}:${effectiveLine}` : undefined}
              >
                {comment.path}
                {effectiveLine && ` :${effectiveLine}`}
              </button>
            )}

            <div className="text-sm text-text-primary whitespace-pre-wrap">
              {comment.body}
            </div>

            {/* Show diff hunk only for parent comments (depth 0) to provide context */}
            {depth === 0 && comment.diffHunk && (
              <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto font-mono text-text-secondary border border-border">
                {comment.diffHunk}
              </pre>
            )}
          </div>
        </div>
      </div>
      
      {hasReplies && isExpanded && (
        <div className="bg-surface/30">
          {replies.map((reply) => (
            <Comment key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

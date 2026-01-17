import { useAppState } from '../../context/AppContext.tsx';
import { Comment } from './Comment.tsx';
import { LoadingSpinner } from '../LoadingSpinner.tsx';
import { useMemo } from 'react';
import type { PRComment } from '../../types/index.ts';

// Build a threaded comment structure
function buildCommentThreads(comments: PRComment[]): Array<{ comment: PRComment; replies: PRComment[] }> {
  // Create a map of comment ID to comment
  const commentMap = new Map<number, PRComment>();
  comments.forEach((c) => commentMap.set(c.id, c));

  // Separate top-level comments from replies
  const topLevel: PRComment[] = [];
  const replyMap = new Map<number, PRComment[]>(); // parentId -> replies

  comments.forEach((comment) => {
    if (comment.inReplyToId) {
      // This is a reply
      if (!replyMap.has(comment.inReplyToId)) {
        replyMap.set(comment.inReplyToId, []);
      }
      replyMap.get(comment.inReplyToId)!.push(comment);
    } else {
      // This is a top-level comment
      topLevel.push(comment);
    }
  });

  // Build threads
  return topLevel.map((comment) => ({
    comment,
    replies: replyMap.get(comment.id) || [],
  }));
}

export function CommentsPanel() {
  const { currentComments, selectedFile, loading } = useAppState();

  // Filter comments by selected file if a file is selected
  const filteredComments = useMemo(() => {
    return selectedFile
      ? currentComments.filter((c) => c.path === selectedFile)
      : currentComments;
  }, [currentComments, selectedFile]);

  // Build threaded structure
  const threads = useMemo(() => {
    return buildCommentThreads(filteredComments);
  }, [filteredComments]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-surface border-b border-border">
        <h3 className="text-sm font-semibold">
          Comments ({filteredComments.length})
        </h3>
      </div>

      {loading && threads.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading comments..." size="sm" />
        </div>
      ) : threads.length === 0 ? (
        <div className="p-4 text-center text-text-secondary text-sm">
          No comments {selectedFile ? 'for this file' : 'yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {threads.map(({ comment, replies }) => (
            <Comment key={comment.id} comment={comment} replies={replies} />
          ))}
        </div>
      )}
    </div>
  );
}

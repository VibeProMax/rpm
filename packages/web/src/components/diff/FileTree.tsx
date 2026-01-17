import { useAppState, useAppActions } from '../../context/AppContext.tsx';
import { useState, useMemo } from 'react';

// Tree node structure
interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Map<string, TreeNode>;
  fileData?: {
    additions: number;
    deletions: number;
    status: string;
  };
}

// Build a tree structure from flat file paths
function buildFileTree(files: Array<{ filename: string; additions: number; deletions: number; status: string }>): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isDirectory: true,
    children: new Map(),
  };

  files.forEach((file) => {
    const parts = file.filename.split('/');
    let currentNode = root;

    parts.forEach((part, index) => {
      const isLastPart = index === parts.length - 1;
      const pathSoFar = parts.slice(0, index + 1).join('/');

      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, {
          name: part,
          path: pathSoFar,
          isDirectory: !isLastPart,
          children: new Map(),
          fileData: isLastPart ? file : undefined,
        });
      }

      currentNode = currentNode.children.get(part)!;
    });
  });

  return root;
}

// Recursive tree node component
function TreeNodeComponent({
  node,
  depth = 0,
  selectedFile,
  onSelectFile,
  fileCommentCounts,
}: {
  node: TreeNode;
  depth?: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  fileCommentCounts: Map<string, number>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (node.isDirectory) {
    const childNodes = Array.from(node.children.values()).sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <>
        {node.name && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-left px-4 py-1 text-sm hover:bg-hover transition-colors flex items-center gap-1"
            style={{ paddingLeft: `${depth * 12 + 16}px` }}
          >
            <span className="text-text-secondary">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span className="text-text-primary">{node.name}/</span>
          </button>
        )}
        {(isExpanded || !node.name) &&
          childNodes.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={node.name ? depth + 1 : depth}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              fileCommentCounts={fileCommentCounts}
            />
          ))}
      </>
    );
  }

  // File node
  const commentCount = fileCommentCounts.get(node.path);
  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`w-full text-left px-4 py-1 text-sm hover:bg-hover transition-colors ${
        selectedFile === node.path ? 'bg-hover' : ''
      }`}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-primary truncate">{node.name}</span>
        <div className="flex items-center gap-2 text-xs shrink-0">
          {commentCount && (
            <span className="text-blue-400 flex items-center gap-1" title={`${commentCount} comment(s)`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {commentCount}
            </span>
          )}
          <span className="text-diff-add">+{node.fileData!.additions}</span>
          <span className="text-diff-delete">-{node.fileData!.deletions}</span>
        </div>
      </div>
    </button>
  );
}

export function FileTree() {
  const { currentPR, selectedFile, currentComments } = useAppState();
  const { setSelectedFile, clearPR } = useAppActions();

  // Create a map of file paths to comment counts
  const fileCommentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    currentComments.forEach((comment) => {
      if (comment.path) {
        counts.set(comment.path, (counts.get(comment.path) || 0) + 1);
      }
    });
    return counts;
  }, [currentComments]);

  // Build tree structure
  const fileTree = useMemo(() => {
    if (!currentPR) return null;
    return buildFileTree(currentPR.files);
  }, [currentPR]);

  if (!currentPR || !fileTree) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        No PR selected
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-surface border-b border-border">
        <button
          onClick={clearPR}
          className="mb-2 text-sm text-blue-500 hover:text-blue-400 flex items-center gap-1"
        >
          <span>←</span> Back to PRs
        </button>
        <h3 className="text-sm font-semibold">
          PR #{currentPR.number}: {currentPR.title}
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          {currentPR.files.length} files changed
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <TreeNodeComponent
          node={fileTree}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          fileCommentCounts={fileCommentCounts}
        />
      </div>
    </div>
  );
}

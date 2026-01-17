import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useAppState, useAppActions } from '../context/AppContext';

// Type workaround for DOM APIs
declare const window: any;

interface CommandAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  execute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { currentPR, selectedFile } = useAppState();
  const { setSelectedFile, navigateToFileLine } = useAppActions();
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // File items for fuzzy search
  const fileItems = useMemo(() => {
    if (!currentPR?.files) return [];
    return currentPR.files.map(file => ({
      path: file.filename,
      basename: file.filename.split('/').pop() || file.filename,
      dirname: file.filename.split('/').slice(0, -1).join('/'),
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    }));
  }, [currentPR]);

  // Fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(fileItems, {
      keys: ['path', 'basename'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [fileItems]);

  const results = useMemo(() => {
    if (!query.trim()) return fileItems;
    return fuse.search(query).map(result => result.item);
  }, [query, fuse, fileItems]);

  // Actions for selected file
  const getActions = (filePath: string): CommandAction[] => [
    {
      id: 'open-in-vscode',
      label: 'Open in VSCode',
      icon: '📝',
      shortcut: 'o',
      execute: async () => {
        try {
          await fetch(`http://localhost:3000/api/open-in-editor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath }),
          });
          onClose();
        } catch (error) {
          console.error('Failed to open in editor:', error);
        }
      },
    },
    {
      id: 'view-diff',
      label: 'View Diff',
      icon: '👁️',
      shortcut: 'Enter',
      execute: () => {
        setSelectedFile(filePath);
        navigateToFileLine(filePath, 1);
        onClose();
      },
    },
  ];

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: Event) => {
      const ke = e as unknown as { key: string; preventDefault: () => void };
      
      if (showActions) {
        // Actions menu navigation
        const selectedFile = results[selectedIndex];
        if (!selectedFile) return;
        
        const actions = getActions(selectedFile.path);

        if (ke.key === 'ArrowUp') {
          ke.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
        } else if (ke.key === 'ArrowDown') {
          ke.preventDefault();
          setSelectedIndex(prev => Math.min(actions.length - 1, prev + 1));
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          setShowActions(false);
          setSelectedIndex(0);
        } else if (ke.key === 'Enter') {
          ke.preventDefault();
          actions[selectedIndex]?.execute();
        } else if (ke.key === 'o') {
          ke.preventDefault();
          actions.find(a => a.shortcut === 'o')?.execute();
        }
      } else {
        // File list navigation
        if (ke.key === 'ArrowUp') {
          ke.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
        } else if (ke.key === 'ArrowDown') {
          ke.preventDefault();
          setSelectedIndex(prev => Math.min(results.length - 1, prev + 1));
        } else if (ke.key === 'ArrowRight') {
          ke.preventDefault();
          if (results[selectedIndex]) {
            setShowActions(true);
            setSelectedIndex(0);
          }
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          onClose();
        } else if (ke.key === 'Enter') {
          ke.preventDefault();
          const file = results[selectedIndex];
          if (file) {
            setSelectedFile(file.path);
            navigateToFileLine(file.path, 1);
            onClose();
          }
        } else if (ke.key === 'o') {
          ke.preventDefault();
          const file = results[selectedIndex];
          if (file) {
            getActions(file.path)[0]?.execute();
          }
        }
      }
    };

    (window as any).addEventListener('keydown', handleKeyDown);
    return () => (window as any).removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results, showActions, onClose, setSelectedFile, navigateToFileLine]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setShowActions(false);
      (inputRef.current as any)?.focus();
    }
  }, [isOpen]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!isOpen) return;
    const selected = (listRef.current as any)?.querySelector(`[data-index="${selectedIndex}"]`);
    (selected as any)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex, isOpen]);

  // Don't render if not in PR view
  if (!currentPR || !isOpen) return null;

  const selectedFileForActions = showActions ? results[Math.min(selectedIndex, results.length - 1)] : null;
  const actions = selectedFileForActions ? getActions(selectedFileForActions.path) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-gray-700 px-4 py-3">
          <span className="text-gray-500 mr-2">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery((e.target as any).value);
              setSelectedIndex(0);
              setShowActions(false);
            }}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-white outline-none placeholder-gray-500"
          />
          <span className="text-xs text-gray-500 ml-2">
            {showActions ? '← Back' : '→ Actions'}
          </span>
        </div>

        {/* Results List */}
        {!showActions ? (
          <div ref={listRef} className="max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                {query ? 'No files found' : 'No files in this PR'}
              </div>
            ) : (
              results.map((file, index) => (
                <div
                  key={file.path}
                  data-index={index}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-600/30 border-l-2 border-blue-500'
                      : 'hover:bg-gray-800'
                  }`}
                  onClick={() => {
                    setSelectedFile(file.path);
                    navigateToFileLine(file.path, 1);
                    onClose();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-mono truncate">
                        {file.basename}
                      </div>
                      {file.dirname && (
                        <div className="text-xs text-gray-500 font-mono truncate">
                          {file.dirname}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-800 rounded">
                        {file.status}
                      </span>
                      {file.additions > 0 && (
                        <span className="text-xs text-green-400">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-xs text-red-400">-{file.deletions}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Actions Menu
          <div ref={listRef} className="max-h-96 overflow-y-auto">
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-700">
              Actions for: {selectedFileForActions?.basename}
            </div>
            {actions.map((action, index) => (
              <div
                key={action.id}
                data-index={index}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between ${
                  index === selectedIndex
                    ? 'bg-blue-600/30 border-l-2 border-blue-500'
                    : 'hover:bg-gray-800'
                }`}
                onClick={() => action.execute()}
              >
                <div className="flex items-center gap-3">
                  {action.icon && <span>{action.icon}</span>}
                  <span className="text-sm text-white">{action.label}</span>
                </div>
                {action.shortcut && (
                  <span className="text-xs text-gray-500 px-2 py-1 bg-gray-800 rounded font-mono">
                    {action.shortcut}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-700 flex justify-between">
          <div>
            <kbd className="px-1 py-0.5 bg-gray-800 rounded">↑↓</kbd> Navigate
            {!showActions && (
              <>
                <kbd className="ml-2 px-1 py-0.5 bg-gray-800 rounded">→</kbd> Actions
                <kbd className="ml-2 px-1 py-0.5 bg-gray-800 rounded">o</kbd> Open in VSCode
              </>
            )}
          </div>
          <div>
            <kbd className="px-1 py-0.5 bg-gray-800 rounded">Enter</kbd> Select
            <kbd className="ml-2 px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
}

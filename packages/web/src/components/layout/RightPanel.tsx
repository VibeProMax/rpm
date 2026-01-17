import { useState, useEffect, useRef } from 'react';
import { CommentsPanel } from '../comments/CommentsPanel.tsx';
import { ChatPanel } from '../chat/ChatPanel.tsx';
import { api } from '../../lib/api.ts';

type Tab = 'comments' | 'chat';

const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 800;

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('comments');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [opencodeAvailable, setOpencodeAvailable] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  // Check OpenCode availability on mount
  useEffect(() => {
    api.health().then((health) => {
      setOpencodeAvailable(health.opencode?.installed || false);
    }).catch(() => {
      setOpencodeAvailable(false);
    });
  }, []);

  // Cmd+K / Ctrl+K to toggle chat (only if OpenCode is available)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!opencodeAvailable) return; // Don't register shortcut if not available
      
      const hasModifier = e.metaKey || e.ctrlKey;
      const isK = e.key === 'K' || e.key === 'k' || e.code === 'KeyK';
      
      if (hasModifier && isK) {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'chat' ? 'comments' : 'chat'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opencodeAvailable]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setIsResizing(true);
  };

  return (
    <div className="h-full flex flex-row">
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 bg-[#3e3e42] hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0"
        style={{ cursor: 'col-resize' }}
      />
      
      {/* Panel Content */}
      <div 
        className="h-full flex flex-col bg-[#252526] border-l border-[#3e3e42]"
        style={{ width: `${width}px` }}
      >
      {/* Tab Header */}
      <div className="flex border-b border-[#3e3e42]">
        <button
          onClick={() => setActiveTab('comments')}
          className={`${opencodeAvailable ? 'flex-1' : 'w-full'} px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'comments'
              ? 'bg-[#1e1e1e] text-[#ccc] border-b-2 border-blue-500'
              : 'text-[#858585] hover:text-[#ccc] hover:bg-[#2a2d2e]'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Comments
          </div>
        </button>
        {opencodeAvailable && (
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-[#1e1e1e] text-[#ccc] border-b-2 border-blue-500'
                : 'text-[#858585] hover:text-[#ccc] hover:bg-[#2a2d2e]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              AI Chat
            </div>
          </button>
        )}
      </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'comments' ? <CommentsPanel /> : <ChatPanel />}
        </div>
      </div>
    </div>
  );
}

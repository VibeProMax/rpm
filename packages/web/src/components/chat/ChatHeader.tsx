import { useState, useEffect, useRef } from 'react';

interface Session {
  id: string;
  title: string;
  createdAt: number;
  messageCount: number;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

const AVAILABLE_MODELS: Model[] = [
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'github-copilot' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'github-copilot' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'github-copilot' },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'github-copilot' },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'github-copilot' },
];

interface ChatHeaderProps {
  sessionId: string | null;
  prNumber: number | null;
  selectedModel: Model;
  onSessionChange: (sessionId: string | null) => void;
  onModelChange: (model: Model) => void;
}

export function ChatHeader({ sessionId, prNumber, selectedModel, onSessionChange, onModelChange }: ChatHeaderProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdowns on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target as Node)) {
        setShowSessionDropdown(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Load sessions for current PR
    const loadSessions = async () => {
      try {
        const response = await fetch('/api/chat/sessions');
        if (response.ok) {
          const allSessions = await response.json();
          // Filter to current PR if we have one
          const prSessions = prNumber 
            ? allSessions.filter((s: any) => s.prNumber === prNumber)
            : allSessions;
          setSessions(prSessions);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };

    if (prNumber) {
      loadSessions();
    }
  }, [prNumber, sessionId]);

  const handleNewSession = () => {
    onSessionChange(null); // null triggers creating a new session
    setShowSessionDropdown(false);
  };

  const handleSelectSession = (id: string) => {
    onSessionChange(id);
    setShowSessionDropdown(false);
  };

  const handleSelectModel = (model: Model) => {
    onModelChange(model);
    setShowModelDropdown(false);
  };

  const currentSession = sessions.find(s => s.id === sessionId);
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="px-4 py-3 border-b border-[#3e3e42] bg-[#2d2d30]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${sessionId ? 'bg-green-500' : 'bg-yellow-500'}`} />
          
          {/* Session Dropdown */}
          <div className="relative" ref={sessionDropdownRef}>
            <button
              onClick={() => setShowSessionDropdown(!showSessionDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#3e3e42] hover:bg-[#4e4e52] transition-colors text-sm text-[#ccc] font-medium"
            >
              <span>{currentSession?.title || 'New Chat'}</span>
              <svg className={`w-4 h-4 transition-transform ${showSessionDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSessionDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[#2d2d30] border border-[#3e3e42] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={handleNewSession}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[#3e3e42] text-sm text-[#ccc] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">New Chat</span>
                  </button>
                  
                  {sessions.length > 0 && (
                    <>
                      <div className="my-2 border-t border-[#3e3e42]"></div>
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => handleSelectSession(session.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded hover:bg-[#3e3e42] text-sm transition-colors ${
                            session.id === sessionId ? 'bg-[#3e3e42] text-blue-400' : 'text-[#ccc]'
                          }`}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-medium truncate max-w-[180px]">{session.title}</span>
                            <span className="text-xs text-[#858585]">
                              {session.messageCount} messages · {formatDate(session.createdAt)}
                            </span>
                          </div>
                          {session.id === sessionId && (
                            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#858585]">Model</span>
          <span className="text-xs text-[#3e3e42]">·</span>
          
          {/* Model Dropdown */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#3e3e42] hover:bg-[#4e4e52] transition-colors text-xs text-[#ccc]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span>{selectedModel.name}</span>
              <svg className={`w-3 h-3 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showModelDropdown && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-[#2d2d30] border border-[#3e3e42] rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs text-[#858585] font-medium">Select Model</div>
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded hover:bg-[#3e3e42] text-sm transition-colors ${
                        model.id === selectedModel.id ? 'bg-[#3e3e42] text-blue-400' : 'text-[#ccc]'
                      }`}
                    >
                      <span className="font-medium">{model.name}</span>
                      {model.id === selectedModel.id && (
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

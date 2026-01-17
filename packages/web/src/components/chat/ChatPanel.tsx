import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../context/AppContext.tsx';
import { ChatMessage } from './ChatMessage.tsx';
import { ChatInput } from './ChatInput.tsx';
import { ChatHeader } from './ChatHeader.tsx';
import { QuickActions } from './QuickActions.tsx';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

const DEFAULT_MODEL: Model = {
  id: 'gpt-4.1',
  name: 'GPT-4.1',
  provider: 'github-copilot',
};

export function ChatPanel() {
  const { currentPR } = useAppState();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model>(DEFAULT_MODEL);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create session when PR is loaded (only if no session exists)
  useEffect(() => {
    if (currentPR && !sessionId && !sessionInitialized) {
      createSession();
    }
  }, [currentPR, sessionId, sessionInitialized]);

  const createSession = async () => {
    if (!currentPR) return;

    try {
      // Build PR context
      const context = buildPRContext(currentPR);

      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prNumber: currentPR.number,
          context,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const session = await response.json();
      setSessionId(session.id);
      setSessionInitialized(true);
      setMessages([]); // Clear messages for new session
      setError(null);
    } catch (err) {
      console.error('Error creating session:', err);
      setError('Failed to start chat session. Make sure OpenCode is running.');
    }
  };

  const loadSession = async (id: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load session');
      }

      const sessionData = await response.json();
      setMessages(sessionData.messages || []);
      setError(null);
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Failed to load session');
    }
  };

  const handleSessionChange = (newSessionId: string | null) => {
    if (newSessionId === null) {
      // Create new session
      setSessionId(null);
      setSessionInitialized(false);
      setMessages([]);
      createSession();
    } else if (newSessionId !== sessionId) {
      // Switch to existing session
      setSessionId(newSessionId);
      setSessionInitialized(true);
      loadSession(newSessionId);
    }
  };

  const sendMessage = async (message: string) => {
    if (!sessionId || !message.trim()) return;

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    try {
      // Set up EventSource for streaming
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          model: { providerID: selectedModel.provider, modelID: selectedModel.id },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk') {
                  assistantContent += data.content;
                  // Update the last message (or create if doesn't exist)
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'assistant') {
                      // Update existing assistant message
                      return [
                        ...prev.slice(0, -1),
                        { ...last, content: assistantContent },
                      ];
                    } else {
                      // Create new assistant message
                      return [
                        ...prev,
                        {
                          role: 'assistant',
                          content: assistantContent,
                          timestamp: Date.now(),
                        },
                      ];
                    }
                  });
                } else if (data.type === 'progress') {
                  // Progress update - keep streaming indicator alive
                  console.log('Progress:', data.message);
                } else if (data.type === 'error') {
                  setError(data.error);
                }
              } catch (parseErr) {
                console.error('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      setIsStreaming(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  if (!currentPR) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <div className="text-[#858585]">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Select a PR to start chatting</p>
        </div>
      </div>
    );
  }

  if (error && !sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-400 mb-2">❌ {error}</div>
          <button
            onClick={createSession}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatHeader 
        sessionId={sessionId} 
        prNumber={currentPR?.number || null}
        selectedModel={selectedModel}
        onSessionChange={handleSessionChange}
        onModelChange={setSelectedModel}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[#858585] py-8">
            <QuickActions onAction={handleQuickAction} />
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 bg-[#2a2d2e] rounded-lg p-4 border border-[#3e3e42]">
              <div className="flex items-center gap-2 text-[#ccc]">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm text-[#858585]">AI is analyzing your request...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={!sessionId || isStreaming} />
    </div>
  );
}

// Helper to build PR context
function buildPRContext(pr: any): string {
  return `
# Pull Request Context

## PR Information
- **Number**: #${pr.number}
- **Title**: ${pr.title}
- **Author**: ${pr.author.login}
- **Status**: ${pr.state}
- **Branch**: ${pr.headRefName} → ${pr.baseRefName}

## Description
${pr.body || 'No description provided'}

## Changed Files
${pr.files?.map((f: any) => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n') || 'No files changed'}

You are an expert code review assistant. Help me understand and review this pull request.
`.trim();
}

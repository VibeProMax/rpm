import { useEffect, useState } from 'react';
import { AppProvider, useAppState } from './context/AppContext.tsx';
import { Layout } from './components/layout/Layout.tsx';
import { PRList } from './components/pr-list/PRList.tsx';
import { DiffViewer } from './components/diff/DiffViewer.tsx';
import { FileTree } from './components/diff/FileTree.tsx';
import { RightPanel } from './components/layout/RightPanel.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { api, APIError } from './lib/api.ts';
import './styles/globals.css';

// Type workaround for window
declare const window: any;

function AppContent() {
  const { currentPR } = useAppState();
  const [repoName, setRepoName] = useState<string | undefined>();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [opencodeInstalled, setOpencodeInstalled] = useState(false);

  useEffect(() => {
    // Fetch repo info and OpenCode status on mount
    api.health().then((health) => {
      if (health.repo) {
        setRepoName(health.repo.nameWithOwner);
      }
      if (health.opencode) {
        setOpencodeInstalled(health.opencode.installed);
      }
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      const hasModifier = e.metaKey || e.ctrlKey;
      
      // Cmd+Shift+P or Ctrl+Shift+P - Command Palette
      const isP = e.key === 'P' || e.key === 'p' || e.code === 'KeyP';
      if (hasModifier && e.shiftKey && isP) {
        e.preventDefault();
        if (currentPR) {
          setCommandPaletteOpen(true);
        }
      }

      // Cmd+Shift+A or Ctrl+Shift+A - AI Chat
      const isA = e.key === 'A' || e.key === 'a' || e.code === 'KeyA';
      if (hasModifier && e.shiftKey && isA) {
        e.preventDefault();
        if (currentPR) {
          if (opencodeInstalled) {
            startAIChat();
          } else {
            alert('OpenCode is not installed. Install from https://opencode.ai to enable AI chat features.');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPR, opencodeInstalled]);

  // Start AI chat session
  const startAIChat = async () => {
    if (!currentPR) return;
    
    try {
      const response = await fetch('http://localhost:3000/api/opencode/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber: currentPR.number }),
      });

      if (!response.ok) {
        const error = await response.json() as { message?: string; code?: string };
        
        // Show helpful message for missing OpenCode
        if (error.code === 'NOT_INSTALLED') {
          alert('OpenCode is not installed.\n\nInstall from: https://opencode.ai\n\nAI chat features require OpenCode to be installed on your system.');
        } else if (error.code === 'NO_PORT') {
          alert('Unable to start OpenCode server. No available ports found.\n\nPlease close some applications and try again.');
        } else {
          alert(error.message || 'Failed to start AI chat. Please try again.');
        }
        return;
      }
    } catch (error) {
      console.error('Failed to start AI chat:', error);
      
      // Network or connection error
      const errorMessage = error instanceof Error
        ? error.message
        : 'Network error occurred';
      
      alert(`Failed to start AI chat: ${errorMessage}\n\nPlease check:\n- Is OpenCode installed? (https://opencode.ai)\n- Is the server running?\n- Check the browser console for details`);
    }
  };

  return (
    <>
      <Layout
        repoName={repoName}
        sidebar={currentPR ? <FileTree /> : <PRList />}
        main={
          currentPR ? (
            <DiffViewer />
          ) : (
            <div className="h-full flex items-center justify-center text-text-secondary">
              Select a PR to view details
            </div>
          )
        }
        rightPanel={currentPR ? <RightPanel /> : undefined}
      />
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

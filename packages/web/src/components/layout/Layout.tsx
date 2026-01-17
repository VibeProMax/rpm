import { type ReactNode } from 'react';
import { Header } from './Header.tsx';
import { Sidebar } from './Sidebar.tsx';

interface LayoutProps {
  repoName?: string;
  sidebar: ReactNode;
  main: ReactNode;
  rightPanel?: ReactNode;
}

export function Layout({ repoName, sidebar, main, rightPanel }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      <Header repoName={repoName} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar>{sidebar}</Sidebar>
        <main className="flex-1 overflow-hidden">{main}</main>
        {rightPanel && <div className="flex-shrink-0">{rightPanel}</div>}
      </div>
    </div>
  );
}

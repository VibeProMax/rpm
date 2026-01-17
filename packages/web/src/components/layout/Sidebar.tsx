import { type ReactNode } from 'react';

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-80 border-r border-border bg-surface overflow-y-auto">
      {children}
    </aside>
  );
}

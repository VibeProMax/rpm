interface HeaderProps {
  repoName?: string;
}

export function Header({ repoName }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">RPM</h1>
        {repoName && (
          <>
            <span className="text-text-secondary">/</span>
            <span className="text-text-secondary">{repoName}</span>
          </>
        )}
      </div>
    </header>
  );
}

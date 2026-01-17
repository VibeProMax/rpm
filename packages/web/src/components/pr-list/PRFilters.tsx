import { useAppState, useAppActions } from '../../context/AppContext.tsx';

export function PRFilters() {
  const { filters } = useAppState();
  const { setFilters } = useAppActions();

  return (
    <div className="p-4 space-y-3 border-b border-border">
      <input
        type="text"
        placeholder="Search PRs..."
        value={filters.query}
        onInput={(e) => setFilters({ query: e.currentTarget.value })}
        className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      
      <div className="flex gap-2">
        {(['open', 'closed', 'all'] as const).map((state) => (
          <button
            key={state}
            onClick={() => setFilters({ state })}
            className={`px-3 py-1 rounded-md text-sm capitalize transition-colors ${
              filters.state === state
                ? 'bg-blue-600 text-white'
                : 'bg-background text-text-secondary hover:bg-hover'
            }`}
          >
            {state}
          </button>
        ))}
      </div>
    </div>
  );
}

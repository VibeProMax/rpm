import { useEffect } from 'react';
import { useAppState, useAppActions } from '../../context/AppContext.tsx';
import { PRCard } from './PRCard.tsx';
import { PRFilters } from './PRFilters.tsx';
import { LoadingSpinner } from '../LoadingSpinner.tsx';

export function PRList() {
  const { prs, filters, loading, error } = useAppState();
  const { fetchPRs } = useAppActions();

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  // Filter PRs by search query
  const filteredPRs = prs.filter((pr) => {
    const matchesQuery =
      !filters.query ||
      pr.title.toLowerCase().includes(filters.query.toLowerCase()) ||
      pr.author.login.toLowerCase().includes(filters.query.toLowerCase());

    const matchesAuthor =
      !filters.author || pr.author.login === filters.author;

    // Always hide Dependabot PRs (all variants)
    const isDependabot = pr.author.login === 'dependabot[bot]' || 
                         pr.author.login === 'dependabot' ||
                         pr.author.login === 'app/dependabot';

    return matchesQuery && matchesAuthor && !isDependabot;
  });

  return (
    <div className="h-full flex flex-col">
      <PRFilters />
      
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <LoadingSpinner text="Loading pull requests..." className="p-8" />
        )}

        {error && (
          <div className="p-4 text-center text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && filteredPRs.length === 0 && (
          <div className="p-4 text-center text-text-secondary">
            No pull requests found
          </div>
        )}

        {!loading && !error && filteredPRs.map((pr) => (
          <PRCard key={pr.number} pr={pr} />
        ))}
      </div>
    </div>
  );
}

import { MonacoDiff } from './MonacoDiff.tsx';
import { useAppState } from '../../context/AppContext.tsx';
import { LoadingSpinner } from '../LoadingSpinner.tsx';

export function DiffViewer() {
  const { loading, currentPR } = useAppState();

  // Show loading state when switching between PRs
  if (loading && !currentPR) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner text="Loading PR details..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <MonacoDiff />
    </div>
  );
}

import type { PR } from '../../types/index.ts';
import { formatRelativeTime, getStateColor } from '../../lib/utils.ts';
import { useAppActions, useAppState } from '../../context/AppContext.tsx';

interface PRCardProps {
  pr: PR;
}

export function PRCard({ pr }: PRCardProps) {
  const { selectPR } = useAppActions();
  const { currentPR } = useAppState();
  const isSelected = currentPR?.number === pr.number;

  return (
    <button
      onClick={() => selectPR(pr.number)}
      className={`w-full text-left p-4 border-b border-border transition-colors ${
        isSelected ? 'bg-hover' : 'hover:bg-hover'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-text-primary line-clamp-2">
            {pr.title}
          </h3>
          <span className={`text-xs font-semibold shrink-0 ${getStateColor(pr.state)}`}>
            #{pr.number}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span>{pr.author.login}</span>
          <span>•</span>
          <span>{formatRelativeTime(pr.updatedAt)}</span>
          {pr.isDraft && (
            <>
              <span>•</span>
              <span className="text-yellow-500">Draft</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-secondary">
            {pr.headRefName} → {pr.baseRefName}
          </span>
        </div>

        {pr.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pr.labels.map((label) => (
              <span
                key={label.name}
                className="px-2 py-0.5 text-xs rounded-full"
                style={{
                  backgroundColor: `#${label.color}20`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

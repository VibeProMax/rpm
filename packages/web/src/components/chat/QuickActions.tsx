interface QuickAction {
  icon: string;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: '📝',
    label: 'Summarize Changes',
    prompt: 'Provide a concise summary of all changes in this PR. Organize by: 1) New features, 2) Bug fixes, 3) Refactoring, 4) Tests, 5) Documentation',
  },
  {
    icon: '🔒',
    label: 'Security Review',
    prompt: 'Perform a security review of this PR. Look for authentication/authorization issues, input validation problems, hardcoded secrets, weak crypto, vulnerable dependencies, and logic flaws.',
  },
  {
    icon: '⚡',
    label: 'Performance',
    prompt: 'Analyze this PR for potential performance issues: inefficient algorithms, unnecessary re-renders, memory leaks, large bundle size impacts, and database query performance.',
  },
  {
    icon: '🧪',
    label: 'Test Coverage',
    prompt: 'Review the test coverage for this PR. Are the changes adequately tested? What test cases are missing? Are there edge cases not covered?',
  },
  {
    icon: '✨',
    label: 'Best Practices',
    prompt: 'Review this code for adherence to best practices: code style, error handling, logging, documentation, naming conventions, and DRY principle.',
  },
];

interface QuickActionsProps {
  onAction: (prompt: string) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-[#ccc] font-medium">Quick Actions</div>
      <div className="grid grid-cols-1 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onAction(action.prompt)}
            className="flex items-center gap-3 px-3 py-2 bg-[#2d2d30] hover:bg-[#3e3e42] border border-[#3e3e42] rounded text-left transition-colors"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-sm text-[#ccc]">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

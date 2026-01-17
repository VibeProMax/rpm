/**
 * Format a date string to a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

/**
 * Get the state color for a PR
 */
export function getStateColor(state: string): string {
  switch (state) {
    case 'OPEN':
      return 'text-green-500';
    case 'CLOSED':
      return 'text-red-500';
    case 'MERGED':
      return 'text-purple-500';
    default:
      return 'text-text-secondary';
  }
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1]! : '';
}

/**
 * Determine language from file path for Monaco editor
 */
export function getLanguageFromPath(path: string): string {
  const ext = getFileExtension(path);
  
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    sh: 'shell',
    sql: 'sql',
  };

  return languageMap[ext] || 'plaintext';
}

/**
 * Parse a diff hunk header to extract line range information
 * Format: @@ -40,7 +40,8 @@ optional context
 * Returns the new file line range (after the change)
 */
export function parseDiffHunk(diffHunk: string): { startLine: number; lineCount: number } | null {
  if (!diffHunk) return null;
  
  // Match the hunk header pattern: @@ -old_start,old_count +new_start,new_count @@
  const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
  const match = diffHunk.match(hunkRegex);
  
  if (!match) return null;
  
  const startLine = parseInt(match[1]!, 10);
  const lineCount = match[2] ? parseInt(match[2], 10) : 1;
  
  return { startLine, lineCount };
}

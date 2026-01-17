/**
 * Parse unified diff format into original and modified content
 */
export function parseDiffForFile(fullDiff: string, filePath: string): {
  original: string;
  modified: string;
} | null {
  if (!fullDiff || !filePath) {
    return null;
  }

  try {
    // Extract the diff for this specific file
    const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match only where b/path matches the target file (handles renames)
    const filePattern = new RegExp(
      `diff --git a/[^\\s]+ b/${escapedPath}.*?(?=diff --git|$)`,
      's'
    );
    const fileDiffMatch = fullDiff.match(filePattern);
    
    if (!fileDiffMatch) {
      return null;
    }

    const fileDiff = fileDiffMatch[0];
    
    // Check for binary file
    if (fileDiff.includes('Binary files')) {
      return null; // Binary files can't be displayed as text
    }
    
    // Check for deleted file
    if (fileDiff.includes('deleted file mode')) {
      return null; // Deleted files have no modified content
    }
    
    const lines = fileDiff.split('\n');
    
    const originalLines: string[] = [];
    const modifiedLines: string[] = [];
    
    let inHunk = false;
    
    for (const line of lines) {
      // Start of a hunk
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      
      if (!inHunk) continue;
      
      // Skip diff metadata
      if (line.startsWith('diff ') || line.startsWith('index ') || 
          line.startsWith('--- ') || line.startsWith('+++ ')) {
        continue;
      }
      
      // Removed line (only in original)
      if (line.startsWith('-')) {
        originalLines.push(line.substring(1));
      }
      // Added line (only in modified)
      else if (line.startsWith('+')) {
        modifiedLines.push(line.substring(1));
      }
      // Context line (in both)
      else {
        originalLines.push(line.startsWith(' ') ? line.substring(1) : line);
        modifiedLines.push(line.startsWith(' ') ? line.substring(1) : line);
      }
    }
    
    return {
      original: originalLines.join('\n'),
      modified: modifiedLines.join('\n'),
    };
  } catch (error) {
    console.error('Error parsing diff:', error);
    return null;
  }
}

/**
 * Alternative: Parse diff to show with colored lines in a single editor
 */
export function parseDiffWithColors(fullDiff: string, filePath: string): {
  content: string;
  decorations: Array<{
    range: { startLineNumber: number; endLineNumber: number };
    options: {
      isWholeLine: boolean;
      className?: string;
      glyphMarginClassName?: string;
    };
  }>;
} | null {
  if (!fullDiff || !filePath) {
    return null;
  }

  try {
    // Extract the diff for this specific file
    const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match only where b/path matches the target file (handles renames)
    const filePattern = new RegExp(
      `diff --git a/[^\\s]+ b/${escapedPath}.*?(?=diff --git|$)`,
      's'
    );
    const fileDiffMatch = fullDiff.match(filePattern);
    
    if (!fileDiffMatch) {
      return null;
    }

    const fileDiff = fileDiffMatch[0];
    
    // Check for binary file
    if (fileDiff.includes('Binary files')) {
      return {
        content: 'Binary file - no preview available',
        decorations: [],
      };
    }
    
    // Check for deleted file
    if (fileDiff.includes('deleted file mode')) {
      return {
        content: 'File was deleted in this PR',
        decorations: [],
      };
    }
    
    // Check for new file
    const isNewFile = fileDiff.includes('new file mode');
    
    // Check for renamed file
    const renameMatch = fileDiff.match(/rename from (.+)\nrename to (.+)/);
    const isRenamed = !!renameMatch;
    
    const lines = fileDiff.split('\n');
    
    const contentLines: string[] = [];
    const decorations: Array<{
      range: { startLineNumber: number; endLineNumber: number };
      options: {
        isWholeLine: boolean;
        className?: string;
        glyphMarginClassName?: string;
      };
    }> = [];
    
    // Add metadata line for renamed files
    if (isRenamed && renameMatch) {
      contentLines.push(`// File renamed: ${renameMatch[1]} → ${renameMatch[2]}`);
      contentLines.push('');
    } else if (isNewFile) {
      contentLines.push('// New file');
      contentLines.push('');
    }
    
    let lineNumber = contentLines.length;
    let inHunk = false;
  
    for (const line of lines) {
      // Skip diff metadata
      if (line.startsWith('diff ') || line.startsWith('index ') || 
          line.startsWith('--- ') || line.startsWith('+++ ') ||
          line.startsWith('new file mode') || line.startsWith('deleted file mode') ||
          line.startsWith('rename from') || line.startsWith('rename to')) {
        continue;
      }
      
      // Hunk header
      if (line.startsWith('@@')) {
        inHunk = true;
        lineNumber++;
        contentLines.push(line);
        decorations.push({
          range: { startLineNumber: lineNumber, endLineNumber: lineNumber },
          options: {
            isWholeLine: true,
            className: 'diff-hunk-header',
          },
        });
        continue;
      }
      
      if (!inHunk) continue;
      
      lineNumber++;
      
      // Removed line
      if (line.startsWith('-')) {
        contentLines.push(line.substring(1)); // Strip the '-' prefix
        decorations.push({
          range: { startLineNumber: lineNumber, endLineNumber: lineNumber },
          options: {
            isWholeLine: true,
            className: 'diff-line-deleted',
            glyphMarginClassName: 'diff-glyph-deleted',
          },
        });
      }
      // Added line
      else if (line.startsWith('+')) {
        contentLines.push(line.substring(1)); // Strip the '+' prefix
        decorations.push({
          range: { startLineNumber: lineNumber, endLineNumber: lineNumber },
          options: {
            isWholeLine: true,
            className: 'diff-line-added',
            glyphMarginClassName: 'diff-glyph-added',
          },
        });
      }
      // Context line
      else {
        contentLines.push(line.startsWith(' ') ? line.substring(1) : line);
      }
    }
    
    // If no content was found, show a message
    if (contentLines.length === 0) {
      return {
        content: 'No changes to display',
        decorations: [],
      };
    }
    
    return {
      content: contentLines.join('\n'),
      decorations,
    };
  } catch (error) {
    console.error('Error parsing diff:', error);
    return {
      content: 'Error parsing diff. The diff format may be unsupported.',
      decorations: [],
    };
  }
}

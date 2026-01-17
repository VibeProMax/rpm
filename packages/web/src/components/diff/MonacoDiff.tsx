import Editor, { type OnMount } from '@monaco-editor/react';
import { useAppState, useAppActions } from '../../context/AppContext.tsx';
import { getLanguageFromPath, parseDiffHunk } from '../../lib/utils.ts';
import { parseDiffWithColors } from '../../lib/diffParser.ts';
import { useEffect, useRef, useMemo, useState } from 'react';
import { LoadingSpinner } from '../LoadingSpinner.tsx';
import type { PRComment } from '../../types/index.ts';

export function MonacoDiff() {
  const { currentDiff, selectedFile, targetLine, currentComments } = useAppState();
  const { setSelectedFile, scrollToComment } = useAppActions();
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const highlightDecorationsRef = useRef<string[]>([]);
  const glyphDecorationsRef = useRef<string[]>([]);
  const hoverProviderRef = useRef<any>(null);
  const commentLineRangesRef = useRef<typeof commentLineRanges>([]);
  const [isEditorLoading, setIsEditorLoading] = useState(true);

  // Parse the diff when file changes
  const parsed = currentDiff && selectedFile 
    ? parseDiffWithColors(currentDiff, selectedFile)
    : null;

  // Get comments for the selected file
  const fileComments = useMemo(() => {
    if (!selectedFile) return [];
    return currentComments.filter(c => c.path === selectedFile);
  }, [currentComments, selectedFile]);

  // Calculate comment line positions with multi-line support from diffHunk
  const commentLineRanges = useMemo(() => {
    return fileComments.map(comment => {
      // Try to get line from comment data (fallback order)
      const effectiveLine = comment.line || comment.originalLine || comment.position || 1;
      
      // Parse diffHunk to get multi-line range if available
      const hunkRange = comment.diffHunk ? parseDiffHunk(comment.diffHunk) : null;
      
      if (hunkRange) {
        return {
          comment,
          startLine: hunkRange.startLine,
          endLine: hunkRange.startLine + hunkRange.lineCount - 1,
        };
      }
      
      // Single line fallback
      return {
        comment,
        startLine: effectiveLine,
        endLine: effectiveLine,
      };
    });
  }, [fileComments]);

  // Keep ref updated with latest commentLineRanges
  useEffect(() => {
    commentLineRangesRef.current = commentLineRanges;
  }, [commentLineRanges]);

  // Apply decorations whenever the editor or parsed content changes
  useEffect(() => {
    if (!editorRef.current || !parsed) return;

    const monacoDecorations = parsed.decorations.map(dec => ({
      range: {
        startLineNumber: dec.range.startLineNumber,
        startColumn: 1,
        endLineNumber: dec.range.endLineNumber,
        endColumn: 1000,
      },
      options: dec.options,
    }));

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      monacoDecorations
    );
  }, [parsed, selectedFile]);

  // Add glyph margin decorations for comments
  useEffect(() => {
    if (!editorRef.current || commentLineRanges.length === 0) {
      // Clear glyph decorations if no comments
      if (glyphDecorationsRef.current.length > 0) {
        glyphDecorationsRef.current = editorRef.current?.deltaDecorations(
          glyphDecorationsRef.current,
          []
        ) || [];
      }
      return;
    }

    const glyphDecorations = commentLineRanges.map(({ comment, startLine }) => ({
      range: {
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: startLine,
        endColumn: 1,
      },
      options: {
        glyphMarginClassName: 'comment-glyph-marker',
        glyphMarginHoverMessage: {
          value: `**${comment.author.login}** commented:\n\n${comment.body.substring(0, 200)}${comment.body.length > 200 ? '...' : ''}`,
        },
      },
    }));

    glyphDecorationsRef.current = editorRef.current.deltaDecorations(
      glyphDecorationsRef.current,
      glyphDecorations
    );
  }, [commentLineRanges]);

  // Scroll to target line when it changes and add flash highlight
  useEffect(() => {
    if (!editorRef.current || !targetLine) return;
    
    // Find if this target line has a comment with multi-line range
    const commentRange = commentLineRanges.find(
      range => targetLine >= range.startLine && targetLine <= range.endLine
    );
    
    const highlightStartLine = commentRange ? commentRange.startLine : targetLine;
    const highlightEndLine = commentRange ? commentRange.endLine : targetLine;
    
    // Small delay to ensure editor is ready
    setTimeout(() => {
      // Reveal the line and center it in the viewport
      editorRef.current.revealLineInCenter(highlightStartLine);
      
      // Set cursor position to the target line
      editorRef.current.setPosition({ lineNumber: highlightStartLine, column: 1 });
      
      // Focus the editor
      editorRef.current.focus();
      
      // Add flash highlight decoration (multi-line if applicable)
      highlightDecorationsRef.current = editorRef.current.deltaDecorations(
        highlightDecorationsRef.current,
        [{
          range: {
            startLineNumber: highlightStartLine,
            startColumn: 1,
            endLineNumber: highlightEndLine,
            endColumn: 1000,
          },
          options: {
            isWholeLine: true,
            className: 'flash-highlight-line',
          },
        }]
      );
      
      // Remove the flash highlight after animation completes
      setTimeout(() => {
        if (editorRef.current) {
          highlightDecorationsRef.current = editorRef.current.deltaDecorations(
            highlightDecorationsRef.current,
            []
          );
        }
      }, 2000); // Match the CSS animation duration
    }, 100);
  }, [targetLine, commentLineRanges]);

  if (!currentDiff || !selectedFile) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary">
        Select a file to view the diff
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary">
        No diff available for this file
      </div>
    );
  }

  const language = getLanguageFromPath(selectedFile);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setIsEditorLoading(false);
    
    // Add click handler for glyph margin
    editor.onMouseDown((e) => {
      // Check if click was on glyph margin
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position?.lineNumber;
        if (!lineNumber) return;
        
        // Find comment at this line - use ref to get latest value
        const commentAtLine = commentLineRangesRef.current.find(
          range => lineNumber >= range.startLine && lineNumber <= range.endLine
        );
        
        if (commentAtLine) {
          scrollToComment(commentAtLine.comment.id);
        }
      }
    });
  };

  return (
    <div className="h-full diff-viewer">
      <style>{`
        .diff-line-added {
          background-color: rgba(40, 167, 69, 0.2) !important;
        }
        .diff-line-deleted {
          background-color: rgba(215, 58, 73, 0.2) !important;
        }
        .diff-glyph-added {
          background-color: rgba(40, 167, 69, 0.5);
          width: 5px !important;
          margin-left: 3px;
        }
        .diff-glyph-deleted {
          background-color: rgba(215, 58, 73, 0.5);
          width: 5px !important;
          margin-left: 3px;
        }
        .diff-hunk-header {
          background-color: rgba(100, 100, 100, 0.2) !important;
          color: #858585 !important;
        }
        .flash-highlight-line {
          background-color: rgba(255, 200, 0, 0.5) !important;
          animation: flash-fade 2s ease-out forwards;
        }
        @keyframes flash-fade {
          0% {
            background-color: rgba(255, 200, 0, 0.7) !important;
          }
          50% {
            background-color: rgba(255, 200, 0, 0.5) !important;
          }
          100% {
            background-color: transparent !important;
          }
        }
        /* Comment glyph marker styles */
        .comment-glyph-marker {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px !important;
          height: 16px !important;
          margin-left: 2px;
          margin-top: 2px;
        }
        .comment-glyph-marker::before {
          content: '💬';
          font-size: 14px;
          line-height: 1;
          filter: grayscale(0.3) brightness(1.2);
        }
        .comment-glyph-marker:hover::before {
          filter: grayscale(0) brightness(1.4);
          transform: scale(1.1);
        }
      `}</style>
      <Editor
        height="100%"
        language={language}
        value={parsed.content}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        loading={<LoadingSpinner text="Loading editor..." />}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: true,
          folding: false,
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          fontSize: 13,
        }}
      />
    </div>
  );
}

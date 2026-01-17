import { describe, test, expect } from 'vitest';
import { parseDiffForFile, parseDiffWithColors } from '../diffParser';

describe('Diff Parser', () => {
  describe('parseDiffForFile', () => {
    test('parses simple addition', () => {
      const diff = `diff --git a/test.txt b/test.txt
index 123abc..456def 100644
--- a/test.txt
+++ b/test.txt
@@ -1,1 +1,2 @@
 existing line
+new line`;

      const result = parseDiffForFile(diff, 'test.txt');
      
      expect(result).not.toBeNull();
      expect(result?.original).toContain('existing line');
      expect(result?.modified).toContain('existing line');
      expect(result?.modified).toContain('new line');
    });

    test('parses simple deletion', () => {
      const diff = `diff --git a/test.txt b/test.txt
index 123abc..456def 100644
--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,1 @@
 existing line
-deleted line`;

      const result = parseDiffForFile(diff, 'test.txt');
      
      expect(result).not.toBeNull();
      expect(result?.original).toContain('deleted line');
      expect(result?.modified).not.toContain('deleted line');
    });

    test('parses modification', () => {
      const diff = `diff --git a/test.txt b/test.txt
index 123abc..456def 100644
--- a/test.txt
+++ b/test.txt
@@ -1,1 +1,1 @@
-old content
+new content`;

      const result = parseDiffForFile(diff, 'test.txt');
      
      expect(result).not.toBeNull();
      expect(result?.original).toBe('old content');
      expect(result?.modified).toBe('new content');
    });

    test('returns null for non-existent file', () => {
      const diff = `diff --git a/other.txt b/other.txt
index 123abc..456def 100644
--- a/other.txt
+++ b/other.txt
@@ -1,1 +1,1 @@
-old
+new`;

      const result = parseDiffForFile(diff, 'test.txt');
      
      expect(result).toBeNull();
    });

    test('handles empty diff', () => {
      const result = parseDiffForFile('', 'test.txt');
      expect(result).toBeNull();
    });

    test('handles binary files', () => {
      const diff = `diff --git a/image.png b/image.png
index 123abc..456def 100644
Binary files a/image.png and b/image.png differ`;

      const result = parseDiffForFile(diff, 'image.png');
      expect(result).toBeNull();
    });

    test('handles deleted files', () => {
      const diff = `diff --git a/deleted.txt b/deleted.txt
deleted file mode 100644
index 123abc..0000000
--- a/deleted.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`;

      const result = parseDiffForFile(diff, 'deleted.txt');
      expect(result).toBeNull();
    });

    test('handles malformed diff gracefully', () => {
      const result = parseDiffForFile('garbage input ###', 'test.txt');
      expect(result).toBeNull();
    });
  });

  describe('parseDiffWithColors', () => {
    test('parses diff with decorations', () => {
      const diff = `diff --git a/test.txt b/test.txt
index 123abc..456def 100644
--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,3 @@
 existing line
-removed line
+added line
+another added line`;

      const result = parseDiffWithColors(diff, 'test.txt');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('existing line');
      expect(result?.content).toContain('removed line');
      expect(result?.content).toContain('added line');
      expect(result?.decorations).toBeDefined();
      expect(result?.decorations.length).toBeGreaterThan(0);
    });

    test('returns null for non-existent file', () => {
      const diff = `diff --git a/other.txt b/other.txt
index 123abc..456def 100644
--- a/other.txt
+++ b/other.txt
@@ -1,1 +1,1 @@
-old
+new`;

      const result = parseDiffWithColors(diff, 'test.txt');
      
      expect(result).toBeNull();
    });

    test('handles empty diff', () => {
      const result = parseDiffWithColors('', 'test.txt');
      expect(result).toBeNull();
    });

    test('handles special characters in file path', () => {
      const diff = `diff --git a/src/test-file.ts b/src/test-file.ts
index 123abc..456def 100644
--- a/src/test-file.ts
+++ b/src/test-file.ts
@@ -1,1 +1,1 @@
-old
+new`;

      const result = parseDiffWithColors(diff, 'src/test-file.ts');
      
      expect(result).not.toBeNull();
    });

    test('handles binary files with message', () => {
      const diff = `diff --git a/image.png b/image.png
index 123abc..456def 100644
Binary files a/image.png and b/image.png differ`;

      const result = parseDiffWithColors(diff, 'image.png');
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Binary file - no preview available');
      expect(result?.decorations).toEqual([]);
    });

    test('handles deleted files with message', () => {
      const diff = `diff --git a/deleted.txt b/deleted.txt
deleted file mode 100644
index 123abc..0000000
--- a/deleted.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`;

      const result = parseDiffWithColors(diff, 'deleted.txt');
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('File was deleted in this PR');
      expect(result?.decorations).toEqual([]);
    });

    test('handles renamed files', () => {
      const diff = `diff --git a/old-name.txt b/new-name.txt
similarity index 100%
rename from old-name.txt
rename to new-name.txt
index 123abc..123abc 100644
--- a/old-name.txt
+++ b/new-name.txt
@@ -1,1 +1,1 @@
 content
+more content`;

      const result = parseDiffWithColors(diff, 'new-name.txt');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('File renamed');
      expect(result?.content).toContain('old-name.txt');
      expect(result?.content).toContain('new-name.txt');
    });

    test('handles new files', () => {
      const diff = `diff --git a/new-file.txt b/new-file.txt
new file mode 100644
index 0000000..123abc
--- /dev/null
+++ b/new-file.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

      const result = parseDiffWithColors(diff, 'new-file.txt');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('New file');
    });

    test('handles malformed diff with error message', () => {
      const diff = 'this is not a valid diff';
      const result = parseDiffWithColors(diff, 'test.txt');
      
      expect(result).toBeNull();
    });

    test('handles empty content with message', () => {
      const diff = `diff --git a/empty.txt b/empty.txt
index 123abc..456def 100644
--- a/empty.txt
+++ b/empty.txt`;

      const result = parseDiffWithColors(diff, 'empty.txt');
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('No changes to display');
    });
  });
});

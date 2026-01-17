import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath, validateLineNumber } from '../utils/validation.ts';

const execAsync = promisify(exec);
const router = Router();

/**
 * POST /api/open-in-editor
 * Opens a file in VSCode
 * 
 * Body:
 *   - filePath: string (relative path from repo root)
 *   - line?: number (optional line number)
 */
router.post('/open-in-editor', async (req, res) => {
  try {
    const { filePath, line } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    // Validate inputs to prevent injection attacks
    const validatedPath = validateFilePath(filePath);
    const validatedLine = validateLineNumber(line);

    // Get the current working directory (repo root)
    const { stdout: repoRoot } = await execAsync('git rev-parse --show-toplevel');
    const absolutePath = `${repoRoot.trim()}/${validatedPath}`;

    // Construct the VSCode command
    // Format: code --goto <file>:<line>:<column>
    const lineArg = validatedLine ? `:${validatedLine}:1` : '';
    const command = `code --goto "${absolutePath}${lineArg}"`;

    // Execute the command
    await execAsync(command);

    res.json({ 
      success: true, 
      message: `Opened ${validatedPath}${validatedLine ? ` at line ${validatedLine}` : ''} in VSCode` 
    });
  } catch (error: any) {
    console.error('Failed to open file in editor:', error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({ 
        error: error.message 
      });
    }
    
    // Check if VSCode is not installed
    if (error.message?.includes('command not found')) {
      return res.status(500).json({ 
        error: 'VSCode CLI not found. Please install VSCode command line tools.',
        hint: 'Open VSCode and run: Shell Command: Install "code" command in PATH'
      });
    }

    res.status(500).json({ 
      error: 'Failed to open file in editor',
      details: error.message 
    });
  }
});

export default router;

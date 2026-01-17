import { Router } from 'express';
import { githubService, GitHubServiceError } from '../services/github.ts';
import { opencodeManager, OpenCodeServiceError } from '../services/opencode.ts';
import { validatePRNumber } from '../utils/validation.ts';

const router = Router();

/**
 * POST /api/opencode/chat
 * Start AI chat session for a PR
 * 
 * Body:
 *   - prNumber: number
 */
router.post('/chat', async (req, res) => {
  try {
    const { prNumber } = req.body;

    if (!prNumber) {
      return res.status(400).json({ error: 'prNumber is required' });
    }

    // Validate PR number
    const validatedPRNumber = validatePRNumber(prNumber);

    // Check if OpenCode is installed
    const installed = await opencodeManager.isInstalled();
    if (!installed) {
      return res.status(503).json({
        error: 'OpenCode is not installed',
        message: 'Please install OpenCode to use AI chat features',
        installUrl: 'https://opencode.ai',
      });
    }

    // Get repo path from working directory
    const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
      stdout: 'pipe',
    });
    const repoPath = await new Response(proc.stdout).text();
    const cleanRepoPath = repoPath.trim();

    // Ensure OpenCode server is running
    const status = opencodeManager.getStatus();
    if (!status.running) {
      console.log('Starting OpenCode server...');
      await opencodeManager.startServer(cleanRepoPath);
    }

    // Fetch PR details
    const pr = await githubService.getPRDetail(validatedPRNumber);
    const comments = await githubService.getPRComments(validatedPRNumber);

    // Debug: Log PR structure to understand file format
    console.log('PR files sample:', JSON.stringify(pr.files?.[0], null, 2));

    // Build rich context prompt
    const prompt = buildContextPrompt(pr, comments);

    console.log('Generated PR context prompt:');
    console.log('='.repeat(80));
    console.log(prompt.substring(0, 500) + '...');
    console.log('='.repeat(80));

    // Spawn OpenCode TUI with context
    await opencodeManager.spawnTUI(prompt);

    res.json({
      success: true,
      message: 'OpenCode chat session started',
    });
  } catch (error: any) {
    console.error('Failed to start AI chat:', error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: error.message,
      });
    }
    
    // Handle OpenCode service errors with appropriate status codes
    if (error instanceof OpenCodeServiceError) {
      let statusCode = 500;
      switch (error.code) {
        case 'NOT_INSTALLED':
        case 'NOT_FOUND':
          statusCode = 503; // Service Unavailable
          break;
        case 'NO_PORT':
        case 'STARTUP_TIMEOUT':
        case 'STARTUP_FAILED':
          statusCode = 500;
          break;
        default:
          statusCode = 500;
      }
      
      return res.status(statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    
    // Handle GitHub service errors with appropriate status codes
    if (error instanceof GitHubServiceError) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to start AI chat',
      details: errorMessage,
    });
  }
});

/**
 * GET /api/opencode/status
 * Get OpenCode server status
 */
router.get('/status', async (req, res) => {
  const installed = await opencodeManager.isInstalled();
  const version = installed ? await opencodeManager.getVersion() : null;
  const status = opencodeManager.getStatus();

  res.json({
    installed,
    version,
    serverRunning: status.running,
    serverUrl: status.url,
  });
});

/**
 * Build context prompt for PR review
 */
function buildContextPrompt(pr: any, comments: any[]): string {
  const lines: string[] = [];

  lines.push(`# Code Review Assistance for PR #${pr.number}`);
  lines.push('');
  
  // PR metadata
  lines.push('## PR Details');
  lines.push(`- **Title:** ${pr.title}`);
  lines.push(`- **Author:** @${pr.author.login}`);
  lines.push(`- **Status:** ${pr.state}`);
  lines.push(`- **Branch:** ${pr.headRefName} → ${pr.baseRefName}`);
  
  if (pr.labels && pr.labels.length > 0) {
    lines.push(`- **Labels:** ${pr.labels.map((l: any) => l.name).join(', ')}`);
  }
  
  if (pr.isDraft) {
    lines.push('- **Draft:** Yes');
  }
  
  lines.push('');
  
  // Description
  if (pr.body && pr.body.trim()) {
    lines.push('## Description');
    lines.push(pr.body.trim());
    lines.push('');
  }
  
  // File changes
  if (pr.files && pr.files.length > 0) {
    lines.push('## Changed Files');
    const totalAdditions = pr.files.reduce((sum: number, f: any) => sum + (f.additions || 0), 0);
    const totalDeletions = pr.files.reduce((sum: number, f: any) => sum + (f.deletions || 0), 0);
    lines.push(`${pr.files.length} files changed, +${totalAdditions} additions, -${totalDeletions} deletions`);
    lines.push('');
    
    pr.files.forEach((file: any) => {
      // GitHub CLI returns different fields - handle both 'path' and other possible variations
      const filePath = file.path || file.name || 'unknown';
      const additions = file.additions || 0;
      const deletions = file.deletions || 0;
      lines.push(`- \`${filePath}\` (+${additions}, -${deletions})`);
    });
    lines.push('');
  }
  
  // Review comments
  if (comments.length > 0) {
    lines.push('## Review Comments');
    lines.push(`${comments.length} comments`);
    lines.push('');
    
    // Group comments by file
    const commentsByFile = comments.reduce((acc: any, comment: any) => {
      if (!comment.path) return acc;
      if (!acc[comment.path]) acc[comment.path] = [];
      acc[comment.path].push(comment);
      return acc;
    }, {});
    
    Object.entries(commentsByFile).forEach(([path, fileComments]: [string, any]) => {
      lines.push(`### ${path}`);
      fileComments.forEach((comment: any) => {
        const lineInfo = comment.line ? `:${comment.line}` : '';
        lines.push(`**@${comment.author.login}${lineInfo}:** ${comment.body.split('\n')[0]}`);
        
        // Include diff hunk context if available
        if (comment.diffHunk) {
          lines.push('```diff');
          lines.push(comment.diffHunk.trim());
          lines.push('```');
        }
      });
      lines.push('');
    });
  }
  
  // Helpful instructions
  lines.push('---');
  lines.push('');
  lines.push('## How I can help');
  lines.push('- Review the code changes and suggest improvements');
  lines.push('- Explain complex code sections');
  lines.push('- Check for potential bugs or security issues');
  lines.push('- Suggest test cases');
  lines.push('- Help with code formatting and best practices');
  lines.push('');
  lines.push('Use `@` to reference specific files from this PR for detailed analysis.');

  return lines.join('\n');
}

export default router;

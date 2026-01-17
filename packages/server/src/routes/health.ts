import { Router } from 'express';
import { githubService } from '../services/github.ts';
import { opencodeManager } from '../services/opencode.ts';
import { isAuthenticated } from '../services/auth.ts';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint with GitHub authentication and OpenCode status
 */
router.get('/', async (req, res) => {
  // Check GitHub authentication (uses Octokit now)
  const ghAuthenticated = await isAuthenticated();

  let repoInfo = null;
  if (ghAuthenticated) {
    try {
      repoInfo = await githubService.getRepoInfo();
    } catch {
      // Not in a repo, that's okay
    }
  }

  // Check OpenCode status
  const opencodeInstalled = await opencodeManager.isInstalled();
  const opencodeVersion = opencodeInstalled ? await opencodeManager.getVersion() : null;
  const opencodeStatus = opencodeManager.getStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    github: {
      authenticated: ghAuthenticated,
      usingOctokit: true,
    },
    opencode: {
      installed: opencodeInstalled,
      version: opencodeVersion,
      serverRunning: opencodeStatus.running,
      serverUrl: opencodeStatus.url,
    },
    repo: repoInfo,
  });
});

export default router;

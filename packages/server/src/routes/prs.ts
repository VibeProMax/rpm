import { Router } from 'express';
import { githubService, GitHubServiceError } from '../services/github.ts';
import { cache } from '../services/cache.ts';
import { validatePRNumber, validateState } from '../utils/validation.ts';

const router = Router();

/**
 * GET /api/prs
 * List pull requests
 */
router.get('/', async (req, res) => {
  try {
    const state = validateState(req.query.state);
    const cacheKey = `prs:${state}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const prs = await githubService.listPRs(state);
    cache.set(cacheKey, prs);

    res.json(prs);
  } catch (error) {
    console.error('Error fetching PRs:', error);
    
    // Handle GitHub service errors with appropriate status codes
    if (error instanceof GitHubServiceError) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch pull requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/prs/:number
 * Get PR details
 */
router.get('/:number', async (req, res) => {
  try {
    const prNumber = validatePRNumber(req.params.number);
    const cacheKey = `pr:${prNumber}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pr = await githubService.getPRDetail(prNumber);
    cache.set(cacheKey, pr);

    res.json(pr);
  } catch (error) {
    console.error(`Error fetching PR #${req.params.number}:`, error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: error.message,
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
      error: 'Failed to fetch pull request details',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/prs/:number/diff
 * Get PR diff
 */
router.get('/:number/diff', async (req, res) => {
  try {
    const prNumber = validatePRNumber(req.params.number);
    const cacheKey = `pr:${prNumber}:diff`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const diff = await githubService.getPRDiff(prNumber);
    const response = { diff };
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error(`Error fetching diff for PR #${req.params.number}:`, error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: error.message,
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
      error: 'Failed to fetch pull request diff',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/prs/:number/comments
 * Get PR comments
 */
router.get('/:number/comments', async (req, res) => {
  try {
    const prNumber = validatePRNumber(req.params.number);
    const cacheKey = `pr:${prNumber}:comments`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const comments = await githubService.getPRComments(prNumber);
    cache.set(cacheKey, comments);

    res.json(comments);
  } catch (error) {
    console.error(`Error fetching comments for PR #${req.params.number}:`, error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: error.message,
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
      error: 'Failed to fetch pull request comments',
      message: errorMessage,
    });
  }
});

export default router;

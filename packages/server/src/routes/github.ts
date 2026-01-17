import { Router } from 'express';
import * as auth from '../services/auth.ts';

const router = Router();

/**
 * GET /api/github/user
 * Get current authenticated user info
 */
router.get('/user', async (req, res) => {
  try {
    const user = await auth.getCurrentUser();
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/github/rate-limit
 * Get API rate limit info
 */
router.get('/rate-limit', async (req, res) => {
  try {
    const rateLimit = await auth.getRateLimit();
    res.json(rateLimit);
  } catch (error) {
    console.error('Error fetching rate limit:', error);
    res.status(500).json({
      error: 'Failed to fetch rate limit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/github/auth/status
 * Check authentication status
 */
router.get('/auth/status', async (req, res) => {
  try {
    const authenticated = await auth.isAuthenticated();
    if (authenticated) {
      const user = await auth.getCurrentUser();
      res.json({ authenticated: true, user });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

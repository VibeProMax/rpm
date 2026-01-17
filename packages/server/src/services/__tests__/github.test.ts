import { describe, test, expect } from 'vitest';
import { GitHubServiceError } from '../github';

describe('GitHub Service', () => {
  describe('GitHubServiceError', () => {
    test('creates error with message and code', () => {
      const error = new GitHubServiceError('Test error', 'TEST_CODE', 404);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('GitHubServiceError');
    });

    test('creates error without statusCode', () => {
      const error = new GitHubServiceError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBeUndefined();
    });

    test('is instanceof Error', () => {
      const error = new GitHubServiceError('Test', 'CODE');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof GitHubServiceError).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('error has proper structure for 401', () => {
      const error = new GitHubServiceError(
        'GitHub authentication failed',
        'AUTH_FAILED',
        401
      );
      
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTH_FAILED');
    });

    test('error has proper structure for 404', () => {
      const error = new GitHubServiceError(
        'Resource not found',
        'NOT_FOUND',
        404
      );
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    test('error has proper structure for rate limit', () => {
      const error = new GitHubServiceError(
        'Rate limit exceeded',
        'RATE_LIMIT',
        403
      );
      
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('RATE_LIMIT');
    });
  });
});

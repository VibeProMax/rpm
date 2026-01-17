import { describe, test, expect } from 'vitest';
import { OpenCodeServiceError } from '../opencode';

describe('OpenCode Service', () => {
  describe('OpenCodeServiceError', () => {
    test('creates error with message and code', () => {
      const error = new OpenCodeServiceError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('OpenCodeServiceError');
    });

    test('creates error with details', () => {
      const error = new OpenCodeServiceError('Test error', 'TEST_CODE', 'Additional details');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toBe('Additional details');
    });

    test('is instanceof Error', () => {
      const error = new OpenCodeServiceError('Test', 'CODE');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof OpenCodeServiceError).toBe(true);
    });
  });

  describe('Error Codes', () => {
    test('NOT_INSTALLED error', () => {
      const error = new OpenCodeServiceError(
        'OpenCode CLI not found',
        'NOT_INSTALLED'
      );
      
      expect(error.code).toBe('NOT_INSTALLED');
      expect(error.message).toContain('not found');
    });

    test('NO_PORT error', () => {
      const error = new OpenCodeServiceError(
        'Could not find available port',
        'NO_PORT'
      );
      
      expect(error.code).toBe('NO_PORT');
      expect(error.message).toContain('port');
    });

    test('STARTUP_TIMEOUT error', () => {
      const error = new OpenCodeServiceError(
        'Server failed to start within timeout',
        'STARTUP_TIMEOUT'
      );
      
      expect(error.code).toBe('STARTUP_TIMEOUT');
      expect(error.message).toContain('timeout');
    });

    test('STARTUP_FAILED error with details', () => {
      const error = new OpenCodeServiceError(
        'Failed to start server',
        'STARTUP_FAILED',
        'Permission denied'
      );
      
      expect(error.code).toBe('STARTUP_FAILED');
      expect(error.details).toBe('Permission denied');
    });
  });
});

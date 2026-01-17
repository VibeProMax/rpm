import { describe, test, expect } from 'vitest';
import {
  validatePRNumber,
  validateFilePath,
  validateState,
  validateLineNumber,
} from '../validation';

describe('Validation Utils', () => {
  describe('validatePRNumber', () => {
    test('accepts valid PR numbers', () => {
      expect(validatePRNumber('123')).toBe(123);
      expect(validatePRNumber('1')).toBe(1);
      expect(validatePRNumber('999999')).toBe(999999);
      expect(validatePRNumber(456)).toBe(456);
    });

    test('throws on invalid PR numbers', () => {
      expect(() => validatePRNumber('abc')).toThrow('Invalid PR number');
      expect(() => validatePRNumber('-1')).toThrow('Invalid PR number');
      expect(() => validatePRNumber('0')).toThrow('Invalid PR number');
      expect(() => validatePRNumber('1000000')).toThrow('Invalid PR number');
      expect(() => validatePRNumber(null)).toThrow('Invalid PR number');
      expect(() => validatePRNumber(undefined)).toThrow('Invalid PR number');
    });

    test('parses numbers from strings with extra characters', () => {
      // parseInt stops at first non-numeric character
      expect(validatePRNumber('123abc')).toBe(123);
      expect(validatePRNumber('456 extra')).toBe(456);
    });
  });

  describe('validateFilePath', () => {
    test('accepts valid file paths', () => {
      expect(validateFilePath('src/app.ts')).toBe('src/app.ts');
      expect(validateFilePath('packages/server/index.ts')).toBe('packages/server/index.ts');
      expect(validateFilePath('README.md')).toBe('README.md');
    });

    test('throws on directory traversal attempts', () => {
      expect(() => validateFilePath('../../../etc/passwd')).toThrow('Invalid file path');
      expect(() => validateFilePath('src/../../../secret')).toThrow('Invalid file path');
      expect(() => validateFilePath('/etc/passwd')).toThrow('Invalid file path');
      expect(() => validateFilePath('/absolute/path')).toThrow('Invalid file path');
    });

    test('throws on null byte injection', () => {
      expect(() => validateFilePath('file\x00.txt')).toThrow('Invalid file path');
    });

    test('throws on paths that are too long', () => {
      const longPath = 'a'.repeat(1001);
      expect(() => validateFilePath(longPath)).toThrow('File path too long');
    });
  });

  describe('validateState', () => {
    test('accepts valid states', () => {
      expect(validateState('open')).toBe('open');
      expect(validateState('closed')).toBe('closed');
      expect(validateState('all')).toBe('all');
    });

    test('returns default for invalid states', () => {
      expect(validateState('invalid')).toBe('open');
      expect(validateState('')).toBe('open');
      expect(validateState(null)).toBe('open');
      expect(validateState(undefined)).toBe('open');
      expect(validateState(123)).toBe('open');
    });
  });

  describe('validateLineNumber', () => {
    test('accepts valid line numbers', () => {
      expect(validateLineNumber('1')).toBe(1);
      expect(validateLineNumber('100')).toBe(100);
      expect(validateLineNumber('1000000')).toBe(1000000);
      expect(validateLineNumber(42)).toBe(42);
    });

    test('returns undefined for invalid line numbers', () => {
      expect(validateLineNumber('0')).toBeUndefined();
      expect(validateLineNumber('-5')).toBeUndefined();
      expect(validateLineNumber('abc')).toBeUndefined();
      expect(validateLineNumber('1000001')).toBeUndefined();
    });
  });
});

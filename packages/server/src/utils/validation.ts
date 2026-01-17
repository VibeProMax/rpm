/**
 * Input validation utilities for API endpoints
 * Prevents injection attacks and ensures data integrity
 */

/**
 * Validates a PR number
 * @param value - The value to validate (string or number)
 * @returns The validated PR number as a number
 * @throws Error if validation fails
 */
export function validatePRNumber(value: any): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 999999) {
    throw new Error('Invalid PR number');
  }
  return num;
}

/**
 * Validates a file path to prevent directory traversal attacks
 * @param path - The file path to validate
 * @returns The validated file path
 * @throws Error if validation fails
 */
export function validateFilePath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid file path');
  }

  // Prevent directory traversal
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path: directory traversal not allowed');
  }

  // Ensure it's within reasonable bounds
  if (path.length > 1000) {
    throw new Error('File path too long');
  }

  // Prevent null bytes
  if (path.includes('\0')) {
    throw new Error('Invalid file path: null bytes not allowed');
  }

  return path;
}

/**
 * Validates PR state parameter
 * @param state - The state value to validate
 * @returns A valid state value
 */
export function validateState(state: any): 'open' | 'closed' | 'all' {
  if (!state || typeof state !== 'string') {
    return 'open'; // Safe default
  }

  const normalized = state.toLowerCase().trim();
  if (!['open', 'closed', 'all'].includes(normalized)) {
    return 'open'; // Safe default
  }

  return normalized as 'open' | 'closed' | 'all';
}

/**
 * Validates a line number for editor navigation
 * @param value - The line number to validate
 * @returns The validated line number or undefined
 */
export function validateLineNumber(value: any): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 1000000) {
    return undefined; // Return undefined for invalid values
  }

  return num;
}

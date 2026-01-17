import type { PR, PRDetail, PRComment, DiffResponse, HealthResponse } from '../types/index.ts';

const API_BASE = '/api';

/**
 * Enhanced error class with code support
 */
export class APIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Map error codes to user-friendly messages
 */
function getFriendlyErrorMessage(error: { message?: string; code?: string }, statusCode: number): string {
  const code = error.code;
  
  // Map specific error codes to friendly messages
  if (code === 'NOT_FOUND') {
    return 'Pull request not found. It may have been deleted or the number is incorrect.';
  }
  
  if (code === 'UNAUTHORIZED') {
    return 'GitHub authentication failed. Please check your credentials and try again.';
  }
  
  if (code === 'FORBIDDEN') {
    return 'Access denied. You may not have permission to view this repository.';
  }
  
  if (code === 'RATE_LIMITED') {
    return 'GitHub API rate limit exceeded. Please try again later.';
  }
  
  if (code === 'NOT_INSTALLED') {
    return 'OpenCode is not installed. Visit https://opencode.ai to install.';
  }
  
  if (code === 'INVALID_INPUT' || code === 'VALIDATION_ERROR') {
    return error.message || 'Invalid input. Please check your request and try again.';
  }
  
  if (code === 'NO_PORT') {
    return 'Unable to start OpenCode server. No available ports found.';
  }
  
  // Map status codes to friendly messages
  if (statusCode === 429) {
    return 'Too many requests. Please slow down and try again.';
  }
  
  if (statusCode === 503) {
    return 'Service temporarily unavailable. Please try again in a moment.';
  }
  
  if (statusCode >= 500) {
    return 'Server error occurred. Please try again or contact support if the issue persists.';
  }
  
  if (statusCode === 404) {
    return 'The requested resource was not found.';
  }
  
  if (statusCode >= 400 && statusCode < 500) {
    return error.message || 'Request failed. Please check your input and try again.';
  }
  
  // Fallback to original message or generic error
  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Don't retry AbortError (request was cancelled)
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }
  
  // Don't retry 4xx errors (client errors)
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return false;
  }
  
  // Retry 5xx errors (server errors)
  if (statusCode && statusCode >= 500) {
    return true;
  }
  
  // Retry network errors (no status code)
  if (!statusCode) {
    return true;
  }
  
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry on failure (exponential backoff)
 */
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Get status code if it's an APIError
      const statusCode = error instanceof APIError ? error.statusCode : undefined;
      
      // Check if we should retry
      if (!isRetryableError(error, statusCode)) {
        throw error;
      }
      
      // Don't sleep after the last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = 1000 * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
  }
  
  // All retries failed
  throw lastError;
}

async function fetchAPI<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, { signal });
  if (!response.ok) {
    const error = await response.json() as { message?: string; code?: string };
    const friendlyMessage = getFriendlyErrorMessage(error, response.status);
    throw new APIError(friendlyMessage, error.code, response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => fetchWithRetry(() => fetchAPI<HealthResponse>('/health')),
  
  prs: {
    list: (state: 'open' | 'closed' | 'all' = 'open', signal?: AbortSignal) =>
      fetchWithRetry(() => fetchAPI<PR[]>(`/prs?state=${state}`, signal)),
    
    get: (number: number, signal?: AbortSignal) =>
      fetchWithRetry(() => fetchAPI<PRDetail>(`/prs/${number}`, signal)),
    
    diff: (number: number, signal?: AbortSignal) =>
      fetchWithRetry(() => fetchAPI<DiffResponse>(`/prs/${number}/diff`, signal)),
    
    comments: (number: number, signal?: AbortSignal) =>
      fetchWithRetry(() => fetchAPI<PRComment[]>(`/prs/${number}/comments`, signal)),
  },
};

import { Octokit } from '@octokit/rest';
import { createOctokit, isAuthenticated as checkAuth } from './auth.ts';
import type { PR, PRDetail, PRComment, RepoInfo } from '../types/index.ts';

export class GitHubServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GitHubServiceError';
  }
}

let octokitInstance: Octokit | null = null;

/**
 * Get or create Octokit instance (singleton pattern)
 */
async function getOctokit(): Promise<Octokit> {
  if (!octokitInstance) {
    octokitInstance = await createOctokit();
  }
  return octokitInstance;
}

/**
 * Service for interacting with GitHub via Octokit SDK
 */
export class GitHubService {
  /**
   * Check if user is authenticated with GitHub
   */
  async isAuthenticated(): Promise<boolean> {
    return checkAuth();
  }

  /**
   * Get current repository info from git config
   */
  async getRepoInfo(): Promise<RepoInfo> {
    try {
      // Use git command to get repo info from local directory
      const proc = Bun.spawn(['git', 'config', '--get', 'remote.origin.url'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      await proc.exited;

      if (proc.exitCode !== 0) {
        throw new Error('Not in a git repository');
      }

      // Parse GitHub URL (handles both HTTPS and SSH)
      // https://github.com/owner/repo.git
      // git@github.com:owner/repo.git
      const match = output.trim().match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);

      if (!match) {
        throw new Error('Could not parse GitHub repository URL');
      }

      const owner = match[1] || '';
      const repo = match[2] || '';

      if (!owner || !repo) {
        throw new Error('Could not extract owner/repo from URL');
      }

      return {
        owner,
        repo,
        nameWithOwner: `${owner}/${repo}`,
      };
    } catch (error) {
      throw new GitHubServiceError(
        'Not a GitHub repository or no remote configured',
        'INVALID_REPO'
      );
    }
  }

  /**
   * List pull requests
   */
  async listPRs(state: 'open' | 'closed' | 'all' = 'open', limit = 100): Promise<PR[]> {
    try {
      const octokit = await getOctokit();
      const { owner, repo } = await this.getRepoInfo();

      // Fetch PRs with pagination (auto-handled by Octokit)
      const { data } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: state === 'all' ? 'all' : state,
        per_page: Math.min(limit, 100),
        sort: 'updated',
        direction: 'desc',
      });

      // Transform to our PR type
      return data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state as 'open' | 'closed',
        author: {
          login: pr.user?.login || 'unknown',
          avatarUrl: pr.user?.avatar_url,
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        headRefName: pr.head.ref,
        baseRefName: pr.base.ref,
        labels: pr.labels.map((label) => ({
          name: typeof label === 'string' ? label : label.name || '',
          color: typeof label === 'object' ? label.color || undefined : undefined,
        })),
        isDraft: pr.draft || false,
        url: pr.html_url,
      }));
    } catch (error) {
      throw handleOctokitError(error);
    }
  }

  /**
   * Get PR details
   */
  async getPRDetail(prNumber: number): Promise<PRDetail> {
    try {
      const octokit = await getOctokit();
      const { owner, repo } = await this.getRepoInfo();

      // Fetch PR details, files, and commits in parallel
      const [prResponse, filesResponse, commitsResponse] = await Promise.all([
        octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: prNumber,
        }),
        octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber,
          per_page: 100,
        }),
        octokit.rest.pulls.listCommits({
          owner,
          repo,
          pull_number: prNumber,
          per_page: 100,
        }),
      ]);

      const pr = prResponse.data;
      const files = filesResponse.data;
      const commits = commitsResponse.data;

      // Transform to our PRDetail type
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state as 'open' | 'closed',
        author: {
          login: pr.user?.login || 'unknown',
          avatarUrl: pr.user?.avatar_url,
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at || undefined,
        closedAt: pr.closed_at || undefined,
        headRefName: pr.head.ref,
        baseRefName: pr.base.ref,
        labels: pr.labels.map((label) => ({
          name: typeof label === 'string' ? label : label.name || '',
          color: typeof label === 'object' ? label.color || undefined : undefined,
        })),
        isDraft: pr.draft || false,
        mergeable: pr.mergeable,
        url: pr.html_url,
        files: files.map((file) => ({
          filename: file.filename,
          status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
          previousFilename: file.previous_filename,
        })),
        commits: commits.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: {
            name: commit.commit.author?.name || 'unknown',
            email: commit.commit.author?.email || '',
            date: commit.commit.author?.date || '',
          },
        })),
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
      };
    } catch (error) {
      throw handleOctokitError(error);
    }
  }

  /**
   * Get PR diff
   */
  async getPRDiff(prNumber: number): Promise<string> {
    try {
      const octokit = await getOctokit();
      const { owner, repo } = await this.getRepoInfo();

      // Request diff format
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return data as unknown as string;
    } catch (error) {
      throw handleOctokitError(error);
    }
  }

  /**
   * Get PR comments (review comments on code)
   */
  async getPRComments(prNumber: number): Promise<PRComment[]> {
    try {
      const octokit = await getOctokit();
      const { owner, repo } = await this.getRepoInfo();

      // Get review comments (line-specific comments)
      const { data: reviewComments } = await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      // Transform to our comment type
      return reviewComments.map((comment) => ({
        id: comment.id,
        author: {
          login: comment.user?.login || 'unknown',
          avatarUrl: comment.user?.avatar_url,
        },
        body: comment.body,
        path: comment.path,
        line: comment.line,
        originalLine: comment.original_line,
        position: comment.position,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        inReplyToId: comment.in_reply_to_id,
        diffHunk: comment.diff_hunk,
        startLine: comment.start_line,
        side: comment.side as 'LEFT' | 'RIGHT',
      }));
    } catch (error) {
      throw handleOctokitError(error);
    }
  }

  /**
   * Get PR conversation comments (general comments, not line-specific)
   */
  async getPRConversation(prNumber: number) {
    try {
      const octokit = await getOctokit();
      const { owner, repo } = await this.getRepoInfo();

      const { data } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber, // PRs are issues in GitHub API
        per_page: 100,
      });

      return data.map((comment) => ({
        id: comment.id,
        body: comment.body || '',
        user: {
          login: comment.user?.login || 'unknown',
          avatarUrl: comment.user?.avatar_url,
        },
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      }));
    } catch (error) {
      throw handleOctokitError(error);
    }
  }

  /**
   * Search pull requests
   */
  async searchPRs(query: string) {
    try {
      const octokit = await getOctokit();
      const { owner, repo } = await this.getRepoInfo();

      const searchQuery = `repo:${owner}/${repo} is:pr ${query}`;

      const { data } = await octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 50,
      });

      return data.items.map((item) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        url: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      throw handleOctokitError(error);
    }
  }
}

/**
 * Handle Octokit errors and convert to our error type
 */
function handleOctokitError(error: any): GitHubServiceError {
  // Octokit wraps HTTP errors
  if (error.status) {
    switch (error.status) {
      case 401:
        return new GitHubServiceError(
          'GitHub authentication failed. Run: gh auth login',
          'AUTH_FAILED',
          401
        );
      case 403:
        if (error.response?.headers?.['x-ratelimit-remaining'] === '0') {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          const resetDate = new Date(parseInt(resetTime) * 1000);
          return new GitHubServiceError(
            `Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`,
            'RATE_LIMIT',
            403
          );
        }
        return new GitHubServiceError(
          'Access forbidden. Check repository permissions.',
          'FORBIDDEN',
          403
        );
      case 404:
        return new GitHubServiceError(
          'Pull request or repository not found',
          'NOT_FOUND',
          404
        );
      case 422:
        return new GitHubServiceError(
          'Invalid request parameters',
          'INVALID_REQUEST',
          422
        );
      default:
        return new GitHubServiceError(
          `GitHub API error: ${error.message}`,
          'API_ERROR',
          error.status
        );
    }
  }

  // Network or unknown errors
  if (error.message?.includes('ENOTFOUND')) {
    return new GitHubServiceError(
      'Network error. Check your internet connection.',
      'NETWORK_ERROR'
    );
  }

  return new GitHubServiceError(`Unexpected error: ${error.message}`, 'UNKNOWN');
}

export const githubService = new GitHubService();

import { Octokit } from '@octokit/rest';

export class GitHubAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

/**
 * Extracts the GitHub token from gh CLI config
 * This uses the user's existing gh auth, so no global API key needed
 */
export async function getGitHubToken(): Promise<string> {
  try {
    // Method 1: Get token from gh CLI directly
    const proc = Bun.spawn(['gh', 'auth', 'token'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode === 0) {
      const token = output.trim();
      if (token && token.length >= 20) {
        return token;
      }
    }
  } catch (error) {
    // Fall through to Method 2
  }

  // Method 2: Read from gh CLI config file (fallback)
  try {
    const homedir = process.env.HOME || process.env.USERPROFILE;
    const configPath = `${homedir}/.config/gh/hosts.yml`;
    const fs = await import('fs');
    const yaml = await import('js-yaml');

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent) as any;
    const token = config['github.com']?.oauth_token;

    if (token) {
      return token;
    }
  } catch (error) {
    // Fall through to error
  }

  // Method 3: Check for GITHUB_TOKEN environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  throw new GitHubAuthError(
    'Could not get GitHub token. Please run: gh auth login',
    'AUTH_REQUIRED'
  );
}

/**
 * Creates an authenticated Octokit instance using the user's gh token
 */
export async function createOctokit(): Promise<Octokit> {
  const token = await getGitHubToken();

  return new Octokit({
    auth: token,
    userAgent: 'RPM-GitHub-PR-Reviewer/1.0',
    // Add retry logic
    retry: {
      enabled: true,
    },
    // Add request timeout
    request: {
      timeout: 10000, // 10 seconds
    },
  });
}

/**
 * Check if user is authenticated with GitHub
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const octokit = await createOctokit();
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get authenticated user info
 */
export async function getCurrentUser() {
  const octokit = await createOctokit();
  const { data } = await octokit.rest.users.getAuthenticated();
  return {
    login: data.login,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url,
  };
}

/**
 * Get rate limit info
 */
export async function getRateLimit() {
  const octokit = await createOctokit();
  const { data } = await octokit.rest.rateLimit.get();

  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
    used: data.rate.used,
  };
}

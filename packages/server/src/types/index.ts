// Common types used across the server
export interface Author {
  login: string;
  avatarUrl?: string;
}

export interface Label {
  name: string;
  color?: string;
}

export interface PR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: Author;
  createdAt: string;
  updatedAt: string;
  headRefName: string;
  baseRefName: string;
  labels: Label[];
  isDraft: boolean;
  url?: string;
}

export interface Commit {
  sha: string;
  message: string;
  author?: {
    name: string;
    email: string;
    date: string;
  };
}

export interface FileChange {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
}

export interface Review {
  author: Author;
  state: string;
  submittedAt: string;
}

export interface PRDetail extends PR {
  body: string;
  commits: Commit[];
  files: FileChange[];
  reviews?: Review[];
  assignees?: Author[];
  mergedAt?: string;
  closedAt?: string;
  mergeable?: boolean | null;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

export interface PRComment {
  id: number;
  author: Author;
  body: string;
  path: string;
  line?: number | null;
  originalLine?: number;
  position?: number | null;
  createdAt: string;
  updatedAt: string;
  inReplyToId?: number;
  diffHunk?: string;
  startLine?: number | null;
  side?: 'LEFT' | 'RIGHT';
}

export interface DiffResponse {
  diff: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  nameWithOwner?: string;
}

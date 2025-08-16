/**
 * Core Git data models and interfaces
 */

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  shortHash: string;
}

export interface Branch {
  name: string;
  fullName: string;
  type: 'local' | 'remote';
  isActive: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
  lastCommit?: CommitInfo;
}

export interface BranchGroup {
  prefix: string;
  branches: Branch[];
  isCollapsed: boolean;
}

export interface Remote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  branches: string[];
}

export interface StashEntry {
  index: number;
  message: string;
  branch: string;
  timestamp: Date;
}

export interface DiffResult {
  filePath: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  hasConflicts: boolean;
  conflicts?: ConflictRegion[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'conflict';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ConflictRegion {
  startLine: number;
  endLine: number;
  currentContent: string;
  incomingContent: string;
  baseContent?: string;
  isResolved: boolean;
  resolution?: 'current' | 'incoming' | 'both' | 'manual';
  autoResolved?: boolean;
  autoResolveReason?: string;
}

export type ResetMode = 'soft' | 'mixed' | 'hard';

export class GitError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: 'git' | 'filesystem' | 'vscode',
    public recoverable: boolean = true,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'GitError';
  }
}

/**
 * Common Git error codes
 */
export const GitErrorCodes = {
  // Repository errors
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  GIT_EXTENSION_NOT_FOUND: 'GIT_EXTENSION_NOT_FOUND',
  
  // Branch errors
  BRANCH_NOT_FOUND: 'BRANCH_NOT_FOUND',
  BRANCH_ALREADY_EXISTS: 'BRANCH_ALREADY_EXISTS',
  INVALID_BRANCH_NAME: 'INVALID_BRANCH_NAME',
  NO_CURRENT_BRANCH: 'NO_CURRENT_BRANCH',
  NO_BRANCH_SPECIFIED: 'NO_BRANCH_SPECIFIED',
  SELF_MERGE_ATTEMPT: 'SELF_MERGE_ATTEMPT',
  SELF_REBASE_ATTEMPT: 'SELF_REBASE_ATTEMPT',
  
  // Conflict errors
  MERGE_CONFLICTS: 'MERGE_CONFLICTS',
  REBASE_CONFLICTS: 'REBASE_CONFLICTS',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  
  // Commit errors
  NO_CHANGES_TO_COMMIT: 'NO_CHANGES_TO_COMMIT',
  EMPTY_COMMIT_MESSAGE: 'EMPTY_COMMIT_MESSAGE',
  
  // Reset errors
  INVALID_RESET_MODE: 'INVALID_RESET_MODE',
  
  // Stash errors
  INVALID_STASH_INDEX: 'INVALID_STASH_INDEX',
  NO_STASHES_AVAILABLE: 'NO_STASHES_AVAILABLE',
  
  // Remote errors
  REMOTE_NOT_FOUND: 'REMOTE_NOT_FOUND',
  REMOTE_ALREADY_EXISTS: 'REMOTE_ALREADY_EXISTS',
  INVALID_REMOTE_URL: 'INVALID_REMOTE_URL',
  
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  
  // Operation errors
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;
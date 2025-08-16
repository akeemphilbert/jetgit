import * as types from '../../../src/types/index';
import { 
  Branch, 
  Remote, 
  CommitInfo, 
  DiffResult, 
  ConflictRegion, 
  GitStatus,
  StashEntry,
  BranchGroup,
  GitError,
  DiffHunk,
  DiffLine
} from '../../../src/types/index';

describe('Types Index', () => {
  describe('exports', () => {
    it('should export all required types', () => {
      expect(types.Branch).toBeDefined();
      expect(types.Remote).toBeDefined();
      expect(types.CommitInfo).toBeDefined();
      expect(types.DiffResult).toBeDefined();
      expect(types.ConflictRegion).toBeDefined();
      expect(types.GitStatus).toBeDefined();
      expect(types.StashEntry).toBeDefined();
      expect(types.BranchGroup).toBeDefined();
      expect(types.GitError).toBeDefined();
      expect(types.DiffHunk).toBeDefined();
      expect(types.DiffLine).toBeDefined();
    });
  });

  describe('Branch interface', () => {
    it('should create valid Branch object', () => {
      const branch: Branch = {
        name: 'feature/test',
        fullName: 'refs/heads/feature/test',
        type: 'local',
        isActive: true,
        upstream: 'origin/feature/test',
        ahead: 2,
        behind: 1,
        lastCommit: {
          hash: 'abc123',
          message: 'Test commit',
          author: 'Test Author',
          date: new Date(),
          shortHash: 'abc123'
        }
      };

      expect(branch.name).toBe('feature/test');
      expect(branch.type).toBe('local');
      expect(branch.isActive).toBe(true);
      expect(branch.ahead).toBe(2);
      expect(branch.behind).toBe(1);
    });

    it('should create minimal Branch object', () => {
      const branch: Branch = {
        name: 'main',
        fullName: 'refs/heads/main',
        type: 'local',
        isActive: false
      };

      expect(branch.name).toBe('main');
      expect(branch.upstream).toBeUndefined();
      expect(branch.ahead).toBeUndefined();
      expect(branch.behind).toBeUndefined();
    });
  });

  describe('Remote interface', () => {
    it('should create valid Remote object', () => {
      const remote: Remote = {
        name: 'origin',
        fetchUrl: 'https://github.com/user/repo.git',
        pushUrl: 'https://github.com/user/repo.git',
        branches: ['main', 'develop']
      };

      expect(remote.name).toBe('origin');
      expect(remote.fetchUrl).toBe('https://github.com/user/repo.git');
      expect(remote.branches).toHaveLength(2);
    });

    it('should handle different fetch and push URLs', () => {
      const remote: Remote = {
        name: 'upstream',
        fetchUrl: 'https://github.com/original/repo.git',
        pushUrl: 'git@github.com:fork/repo.git',
        branches: ['main']
      };

      expect(remote.fetchUrl).not.toBe(remote.pushUrl);
    });
  });

  describe('CommitInfo interface', () => {
    it('should create valid CommitInfo object', () => {
      const commit: CommitInfo = {
        hash: 'abcdef123456',
        shortHash: 'abcdef1',
        message: 'Add new feature',
        author: 'John Doe',
        date: new Date('2023-01-01'),
        parents: ['parent1', 'parent2']
      };

      expect(commit.hash).toBe('abcdef123456');
      expect(commit.shortHash).toBe('abcdef1');
      expect(commit.parents).toHaveLength(2);
    });

    it('should create CommitInfo without optional fields', () => {
      const commit: CommitInfo = {
        hash: 'abcdef123456',
        shortHash: 'abcdef1',
        message: 'Initial commit',
        author: 'Jane Doe',
        date: new Date()
      };

      expect(commit.parents).toBeUndefined();
    });
  });

  describe('DiffResult interface', () => {
    it('should create valid DiffResult object', () => {
      const diff: DiffResult = {
        filePath: 'src/test.ts',
        oldContent: 'old content',
        newContent: 'new content',
        hunks: [],
        hasConflicts: false
      };

      expect(diff.filePath).toBe('src/test.ts');
      expect(diff.hasConflicts).toBe(false);
      expect(diff.conflicts).toBeUndefined();
    });

    it('should create DiffResult with conflicts', () => {
      const conflict: ConflictRegion = {
        startLine: 10,
        endLine: 15,
        currentContent: 'current version',
        incomingContent: 'incoming version',
        isResolved: false
      };

      const diff: DiffResult = {
        filePath: 'src/conflict.ts',
        oldContent: 'old',
        newContent: 'new',
        hunks: [],
        hasConflicts: true,
        conflicts: [conflict]
      };

      expect(diff.hasConflicts).toBe(true);
      expect(diff.conflicts).toHaveLength(1);
      expect(diff.conflicts![0].isResolved).toBe(false);
    });
  });

  describe('ConflictRegion interface', () => {
    it('should create unresolved conflict', () => {
      const conflict: ConflictRegion = {
        startLine: 5,
        endLine: 10,
        currentContent: 'current code',
        incomingContent: 'incoming code',
        isResolved: false
      };

      expect(conflict.isResolved).toBe(false);
      expect(conflict.resolution).toBeUndefined();
    });

    it('should create resolved conflict', () => {
      const conflict: ConflictRegion = {
        startLine: 5,
        endLine: 10,
        currentContent: 'current code',
        incomingContent: 'incoming code',
        baseContent: 'base code',
        isResolved: true,
        resolution: 'both'
      };

      expect(conflict.isResolved).toBe(true);
      expect(conflict.resolution).toBe('both');
      expect(conflict.baseContent).toBe('base code');
    });
  });

  describe('GitStatus interface', () => {
    it('should create basic git status', () => {
      const status: GitStatus = {
        branch: 'main',
        ahead: 0,
        behind: 0,
        hasChanges: false
      };

      expect(status.branch).toBe('main');
      expect(status.detached).toBeUndefined();
    });

    it('should create detached HEAD status', () => {
      const status: GitStatus = {
        branch: 'HEAD',
        ahead: 0,
        behind: 0,
        hasChanges: true,
        detached: true,
        commit: 'abc1234'
      };

      expect(status.detached).toBe(true);
      expect(status.commit).toBe('abc1234');
    });
  });

  describe('StashEntry interface', () => {
    it('should create valid stash entry', () => {
      const stash: StashEntry = {
        index: 0,
        message: 'WIP: working on feature',
        branch: 'feature/test',
        timestamp: new Date()
      };

      expect(stash.index).toBe(0);
      expect(stash.message).toBe('WIP: working on feature');
    });
  });

  describe('BranchGroup interface', () => {
    it('should create branch group', () => {
      const branches: Branch[] = [
        { name: 'feature/auth', fullName: 'refs/heads/feature/auth', type: 'local', isActive: false },
        { name: 'feature/ui', fullName: 'refs/heads/feature/ui', type: 'local', isActive: true }
      ];

      const group: BranchGroup = {
        prefix: 'feature/',
        branches: branches,
        isCollapsed: false
      };

      expect(group.prefix).toBe('feature/');
      expect(group.branches).toHaveLength(2);
      expect(group.isCollapsed).toBe(false);
    });
  });

  describe('GitError class', () => {
    it('should create GitError with all properties', () => {
      const error = new GitError('Test error', 'TEST_ERROR', 'git', false);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.category).toBe('git');
      expect(error.recoverable).toBe(false);
      expect(error instanceof Error).toBe(true);
    });

    it('should create GitError with default recoverable value', () => {
      const error = new GitError('Test error', 'TEST_ERROR', 'filesystem');

      expect(error.recoverable).toBe(true);
    });

    it('should handle different error categories', () => {
      const gitError = new GitError('Git failed', 'GIT_ERROR', 'git');
      const fsError = new GitError('File not found', 'FS_ERROR', 'filesystem');
      const vscodeError = new GitError('API failed', 'API_ERROR', 'vscode');

      expect(gitError.category).toBe('git');
      expect(fsError.category).toBe('filesystem');
      expect(vscodeError.category).toBe('vscode');
    });
  });

  describe('DiffHunk interface', () => {
    it('should create valid diff hunk', () => {
      const lines: DiffLine[] = [
        { type: 'unchanged', content: 'unchanged line', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'removed', content: 'removed line', oldLineNumber: 2 },
        { type: 'added', content: 'added line', newLineNumber: 2 }
      ];

      const hunk: DiffHunk = {
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: lines
      };

      expect(hunk.oldStart).toBe(1);
      expect(hunk.lines).toHaveLength(3);
    });
  });

  describe('DiffLine interface', () => {
    it('should create different types of diff lines', () => {
      const unchangedLine: DiffLine = {
        type: 'unchanged',
        content: 'same content',
        oldLineNumber: 5,
        newLineNumber: 5
      };

      const addedLine: DiffLine = {
        type: 'added',
        content: 'new content',
        newLineNumber: 6
      };

      const removedLine: DiffLine = {
        type: 'removed',
        content: 'old content',
        oldLineNumber: 6
      };

      const conflictLine: DiffLine = {
        type: 'conflict',
        content: '<<<<<<< HEAD',
        oldLineNumber: 7,
        newLineNumber: 7
      };

      expect(unchangedLine.type).toBe('unchanged');
      expect(addedLine.oldLineNumber).toBeUndefined();
      expect(removedLine.newLineNumber).toBeUndefined();
      expect(conflictLine.type).toBe('conflict');
    });
  });

  describe('type compatibility', () => {
    it('should allow optional properties to be undefined', () => {
      const minimalBranch: Branch = {
        name: 'test',
        fullName: 'refs/heads/test',
        type: 'local',
        isActive: false
      };

      const minimalCommit: CommitInfo = {
        hash: 'abc123',
        shortHash: 'abc123',
        message: 'test',
        author: 'test',
        date: new Date()
      };

      expect(minimalBranch.upstream).toBeUndefined();
      expect(minimalCommit.parents).toBeUndefined();
    });

    it('should enforce required properties', () => {
      // These should compile without errors
      const branch: Branch = {
        name: 'required',
        fullName: 'required',
        type: 'local',
        isActive: true
      };

      const remote: Remote = {
        name: 'required',
        fetchUrl: 'required',
        pushUrl: 'required',
        branches: []
      };

      expect(branch.name).toBeDefined();
      expect(remote.name).toBeDefined();
    });
  });
});
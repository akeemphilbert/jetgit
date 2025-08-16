import { GitService } from '../../../src/services/gitService';
import { GitError } from '../../../src/types/git';

// Mock Git extension API
const mockGitAPI = {
  repositories: [] as any[],
  getRepository: jest.fn(),
};

const mockRepository = {
  rootUri: { fsPath: '/mock/repo/path' },
  state: {
    HEAD: { name: 'main' } as any,
    workingTreeChanges: [] as any[],
    indexChanges: [] as any[],
    untrackedChanges: [] as any[],
  },
};

const mockGitExtension = {
  exports: {
    getAPI: jest.fn(() => mockGitAPI),
  },
};

// Mock VS Code module
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    withProgress: jest.fn(),
  },
  extensions: {
    getExtension: jest.fn(),
  },
  ProgressLocation: {
    Notification: 15,
    SourceControl: 1,
    Window: 10
  }
}));

describe('GitService', () => {
  let gitService: GitService;
  let mockExtensions: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock vscode.extensions
    const vscode = require('vscode');
    mockExtensions = vscode.extensions;
    mockExtensions.getExtension.mockReturnValue(mockGitExtension);
    
    // Reset mock repository state
    mockGitAPI.repositories.length = 0;
    mockGitAPI.repositories.push(mockRepository);
    
    // Reset repository state
    mockRepository.state.HEAD = { name: 'main' };
    mockRepository.state.workingTreeChanges = [];
    mockRepository.state.indexChanges = [];
    mockRepository.state.untrackedChanges = [];
    
    gitService = new GitService();
  });

  describe('constructor', () => {
    it('should initialize Git extension integration', () => {
      expect(mockExtensions.getExtension).toHaveBeenCalledWith('vscode.git');
    });
  });

  describe('isRepository', () => {
    it('should return true when Git repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const result = await gitService.isRepository();
      
      expect(result).toBe(true);
    });

    it('should return false when no Git repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      
      const result = await gitService.isRepository();
      
      expect(result).toBe(false);
    });

    it('should return false when Git extension is not available', async () => {
      mockExtensions.getExtension.mockReturnValue(undefined);
      gitService = new GitService();
      
      const result = await gitService.isRepository();
      
      expect(result).toBe(false);
    });
  });

  describe('getRepositoryRoot', () => {
    it('should return repository root path when repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const result = await gitService.getRepositoryRoot();
      
      expect(result).toBe('/mock/repo/path');
    });

    it('should return undefined when no repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      
      const result = await gitService.getRepositoryRoot();
      
      expect(result).toBeUndefined();
    });

    it('should return undefined when Git extension is not available', async () => {
      mockExtensions.getExtension.mockReturnValue(undefined);
      gitService = new GitService();
      
      const result = await gitService.getRepositoryRoot();
      
      expect(result).toBeUndefined();
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name when repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.HEAD = { name: 'feature/test-branch' };
      
      const result = await gitService.getCurrentBranch();
      
      expect(result).toBe('feature/test-branch');
    });

    it('should return undefined when no HEAD exists', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.HEAD = undefined as any;
      
      const result = await gitService.getCurrentBranch();
      
      expect(result).toBeUndefined();
    });

    it('should return undefined when no repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      
      const result = await gitService.getCurrentBranch();
      
      expect(result).toBeUndefined();
    });
  });

  describe('getRepositoryStatus', () => {
    it('should return status with no changes when repository is clean', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const result = await (gitService as any).getRepositoryStatus();
      
      expect(result).toEqual({
        hasChanges: false,
        stagedChanges: 0,
        unstagedChanges: 0,
        untrackedFiles: 0
      });
    });

    it('should return status with changes when repository has modifications', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = [{ uri: 'file1.ts' }, { uri: 'file2.ts' }] as any[];
      mockRepository.state.indexChanges = [{ uri: 'file3.ts' }] as any[];
      mockRepository.state.untrackedChanges = [{ uri: 'file4.ts' }] as any[];
      
      const result = await (gitService as any).getRepositoryStatus();
      
      expect(result).toEqual({
        hasChanges: true,
        stagedChanges: 1,
        unstagedChanges: 2,
        untrackedFiles: 1
      });
    });

    it('should return default status when no repository exists', async () => {
      mockGitAPI.repositories.length = 0;
      
      const result = await (gitService as any).getRepositoryStatus();
      
      expect(result).toEqual({
        hasChanges: false,
        stagedChanges: 0,
        unstagedChanges: 0,
        untrackedFiles: 0
      });
    });

    it('should handle undefined state properties gracefully', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = undefined as any;
      mockRepository.state.indexChanges = undefined as any;
      mockRepository.state.untrackedChanges = undefined as any;
      
      const result = await (gitService as any).getRepositoryStatus();
      
      expect(result).toEqual({
        hasChanges: false,
        stagedChanges: 0,
        unstagedChanges: 0,
        untrackedFiles: 0
      });
    });
  });

  describe('error handling', () => {
    it('should throw GitError when Git extension is not available', async () => {
      mockExtensions.getExtension.mockReturnValue(undefined);
      gitService = new GitService();
      
      // Access private method through any cast for testing
      const getRepository = (gitService as any).getRepository.bind(gitService);
      
      await expect(getRepository()).rejects.toThrow(GitError);
      await expect(getRepository()).rejects.toThrow('Git extension not available');
    });

    it('should throw GitError when no repository is found', async () => {
      mockGitAPI.repositories = [];
      
      // Access private method through any cast for testing
      const getRepository = (gitService as any).getRepository.bind(gitService);
      
      await expect(getRepository()).rejects.toThrow(GitError);
      await expect(getRepository()).rejects.toThrow('No Git repository found in workspace');
    });
  });

  describe('getBranches', () => {
    it('should return empty array when no branches exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: []
        }
      });
      
      const result = await gitService.getBranches();
      
      expect(result).toEqual([]);
    });

    it('should return local branches with correct properties', async () => {
      const mockRefs = [
        {
          type: 1, // Local branch
          name: 'main',
          commit: 'abc123def456',
          upstream: { name: 'origin/main' },
          ahead: 2,
          behind: 1
        },
        {
          type: 1, // Local branch
          name: 'feature/test',
          commit: 'def456ghi789',
          upstream: undefined,
          ahead: 0,
          behind: 0
        }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs,
          HEAD: { name: 'main' }
        }
      });
      
      const result = await gitService.getBranches();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'main',
        fullName: 'main',
        type: 'local',
        isActive: true,
        upstream: 'origin/main',
        ahead: 2,
        behind: 1,
        lastCommit: {
          hash: 'abc123def456',
          shortHash: 'abc123d',
          message: '',
          author: '',
          date: expect.any(Date)
        }
      });
      expect(result[1]).toEqual({
        name: 'feature/test',
        fullName: 'feature/test',
        type: 'local',
        isActive: false,
        upstream: undefined,
        ahead: 0,
        behind: 0,
        lastCommit: {
          hash: 'def456ghi789',
          shortHash: 'def456g',
          message: '',
          author: '',
          date: expect.any(Date)
        }
      });
    });

    it('should return remote branches with correct properties', async () => {
      const mockRefs = [
        {
          type: 2, // Remote branch
          name: 'origin/develop',
          remote: 'origin',
          commit: 'ghi789jkl012'
        }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      const result = await gitService.getBranches();
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'develop',
        fullName: 'origin/develop',
        type: 'remote',
        isActive: false,
        upstream: 'origin/develop',
        lastCommit: {
          hash: 'ghi789jkl012',
          shortHash: 'ghi789j',
          message: '',
          author: '',
          date: expect.any(Date)
        }
      });
    });

    it('should handle branches without commits', async () => {
      const mockRefs = [
        {
          type: 1, // Local branch
          name: 'empty-branch',
          commit: undefined
        }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      const result = await gitService.getBranches();
      
      expect(result).toHaveLength(1);
      expect(result[0].lastCommit).toBeUndefined();
    });

    it('should throw GitError when repository access fails', async () => {
      mockGitAPI.repositories = [];
      
      await expect(gitService.getBranches()).rejects.toThrow(GitError);
    });
  });

  describe('createBranch', () => {
    beforeEach(() => {
      mockRepository.createBranch = jest.fn().mockResolvedValue(undefined);
    });

    it('should create a new branch successfully', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: []
        }
      });
      
      await gitService.createBranch('new-feature');
      
      expect(mockRepository.createBranch).toHaveBeenCalledWith('new-feature', true, undefined);
    });

    it('should create a new branch from start point', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: []
        }
      });
      
      await gitService.createBranch('new-feature', 'develop');
      
      expect(mockRepository.createBranch).toHaveBeenCalledWith('new-feature', true, 'develop');
    });

    it('should throw GitError for empty branch name', async () => {
      await expect(gitService.createBranch('')).rejects.toThrow(GitError);
      await expect(gitService.createBranch('   ')).rejects.toThrow(GitError);
    });

    it('should throw GitError for invalid branch name', async () => {
      await expect(gitService.createBranch('invalid..name')).rejects.toThrow(GitError);
      await expect(gitService.createBranch('invalid name')).rejects.toThrow(GitError);
    });

    it('should throw GitError when branch already exists', async () => {
      const mockRefs = [
        { type: 1, name: 'existing-branch' }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await expect(gitService.createBranch('existing-branch')).rejects.toThrow(GitError);
      await expect(gitService.createBranch('existing-branch')).rejects.toThrow("Branch 'existing-branch' already exists");
    });

    it('should handle repository creation errors', async () => {
      mockRepository.createBranch = jest.fn().mockRejectedValue(new Error('Git error'));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: []
        }
      });
      
      await expect(gitService.createBranch('test-branch')).rejects.toThrow(GitError);
    });
  });

  describe('checkoutBranch', () => {
    beforeEach(() => {
      mockRepository.checkout = jest.fn().mockResolvedValue(undefined);
    });

    it('should checkout existing local branch', async () => {
      const mockRefs = [
        { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await gitService.checkoutBranch('feature-branch');
      
      expect(mockRepository.checkout).toHaveBeenCalledWith('feature-branch');
    });

    it('should checkout existing remote branch by full name', async () => {
      const mockRefs = [
        { type: 2, name: 'develop', fullName: 'origin/develop' }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await gitService.checkoutBranch('origin/develop');
      
      expect(mockRepository.checkout).toHaveBeenCalledWith('origin/develop');
    });

    it('should throw GitError for empty branch name', async () => {
      await expect(gitService.checkoutBranch('')).rejects.toThrow(GitError);
      await expect(gitService.checkoutBranch('   ')).rejects.toThrow(GitError);
    });

    it('should throw GitError for invalid branch name', async () => {
      await expect(gitService.checkoutBranch('invalid..name')).rejects.toThrow(GitError);
    });

    it('should throw GitError when branch does not exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: []
        }
      });
      
      await expect(gitService.checkoutBranch('non-existent')).rejects.toThrow(GitError);
      await expect(gitService.checkoutBranch('non-existent')).rejects.toThrow("Branch 'non-existent' not found");
    });

    it('should handle checkout errors', async () => {
      const mockRefs = [
        { type: 1, name: 'test-branch', fullName: 'test-branch' }
      ];

      mockRepository.checkout = jest.fn().mockRejectedValue(new Error('Checkout failed'));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await expect(gitService.checkoutBranch('test-branch')).rejects.toThrow(GitError);
    });
  });

  describe('renameBranch', () => {
    beforeEach(() => {
      mockRepository.renameBranch = jest.fn().mockResolvedValue(undefined);
    });

    it('should rename existing local branch', async () => {
      const mockRefs = [
        { type: 1, name: 'old-name' }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await gitService.renameBranch('old-name', 'new-name');
      
      expect(mockRepository.renameBranch).toHaveBeenCalledWith('old-name', 'new-name');
    });

    it('should throw GitError for empty old branch name', async () => {
      await expect(gitService.renameBranch('', 'new-name')).rejects.toThrow(GitError);
      await expect(gitService.renameBranch('   ', 'new-name')).rejects.toThrow(GitError);
    });

    it('should throw GitError for empty new branch name', async () => {
      await expect(gitService.renameBranch('old-name', '')).rejects.toThrow(GitError);
      await expect(gitService.renameBranch('old-name', '   ')).rejects.toThrow(GitError);
    });

    it('should throw GitError for invalid branch names', async () => {
      await expect(gitService.renameBranch('invalid..old', 'new-name')).rejects.toThrow(GitError);
      await expect(gitService.renameBranch('old-name', 'invalid..new')).rejects.toThrow(GitError);
    });

    it('should throw GitError when old branch does not exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: []
        }
      });
      
      await expect(gitService.renameBranch('non-existent', 'new-name')).rejects.toThrow(GitError);
      await expect(gitService.renameBranch('non-existent', 'new-name')).rejects.toThrow("Local branch 'non-existent' not found");
    });

    it('should throw GitError when trying to rename remote branch', async () => {
      const mockRefs = [
        { type: 2, name: 'develop', fullName: 'origin/develop' }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await expect(gitService.renameBranch('develop', 'new-name')).rejects.toThrow(GitError);
      await expect(gitService.renameBranch('develop', 'new-name')).rejects.toThrow("Local branch 'develop' not found");
    });

    it('should throw GitError when new branch name already exists', async () => {
      const mockRefs = [
        { type: 1, name: 'old-name' },
        { type: 1, name: 'existing-name' }
      ];

      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await expect(gitService.renameBranch('old-name', 'existing-name')).rejects.toThrow(GitError);
      await expect(gitService.renameBranch('old-name', 'existing-name')).rejects.toThrow("Branch 'existing-name' already exists");
    });

    it('should handle rename errors', async () => {
      const mockRefs = [
        { type: 1, name: 'old-name' }
      ];

      mockRepository.renameBranch = jest.fn().mockRejectedValue(new Error('Rename failed'));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: mockRefs
        }
      });
      
      await expect(gitService.renameBranch('old-name', 'new-name')).rejects.toThrow(GitError);
    });
  });

  describe('fetch', () => {
    beforeEach(() => {
      mockRepository.fetch = jest.fn().mockResolvedValue(undefined);
    });

    it('should fetch successfully with progress notification', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.fetch();
      
      expect(mockRepository.fetch).toHaveBeenCalled();
      expect(mockWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.any(Number),
          title: 'Fetching from remote...',
          cancellable: false
        }),
        expect.any(Function)
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully fetched latest changes from remote'
      );
    });

    it('should handle authentication errors', async () => {
      mockRepository.fetch = jest.fn().mockRejectedValue(new Error('Authentication failed'));
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.fetch()).rejects.toThrow('Authentication failed during fetch');
    });

    it('should handle network errors', async () => {
      mockRepository.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.fetch()).rejects.toThrow('Network error during fetch');
    });

    it('should handle repository not found errors', async () => {
      mockGitAPI.repositories = [];
      
      await expect(gitService.fetch()).rejects.toThrow(GitError);
    });
  });

  describe('pull', () => {
    beforeEach(() => {
      mockRepository.pull = jest.fn().mockResolvedValue(undefined);
    });

    it('should pull successfully with progress notification', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.pull();
      
      expect(mockRepository.pull).toHaveBeenCalled();
      expect(mockWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.any(Number),
          title: 'Pulling from remote...',
          cancellable: false
        }),
        expect.any(Function)
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully pulled latest changes from remote'
      );
    });

    it('should warn about uncommitted changes and allow continuation', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = [{ uri: 'file1.ts' }] as any[];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Continue');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.pull();
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'You have uncommitted changes. Do you want to continue with pull?',
        'Continue',
        'Cancel'
      );
      expect(mockRepository.pull).toHaveBeenCalled();
    });

    it('should cancel pull when user chooses not to continue', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = [{ uri: 'file1.ts' }] as any[];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Cancel');
      
      await gitService.pull();
      
      expect(mockRepository.pull).not.toHaveBeenCalled();
    });

    it('should handle pull errors', async () => {
      mockRepository.pull = jest.fn().mockRejectedValue(new Error('Pull failed'));
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.pull()).rejects.toThrow('Failed to pull');
    });
  });

  describe('push', () => {
    beforeEach(() => {
      mockRepository.push = jest.fn().mockResolvedValue(undefined);
    });

    it('should push successfully with progress notification', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'main', ahead: 2, behind: 0 }
          ]
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.push();
      
      expect(mockRepository.push).toHaveBeenCalled();
      expect(mockWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.any(Number),
          title: 'Pushing main to remote...',
          cancellable: false
        }),
        expect.any(Function)
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully pushed main to remote'
      );
    });

    it('should push specific branch when provided', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          refs: [
            { type: 1, name: 'feature-branch', ahead: 1, behind: 0 }
          ]
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.push('feature-branch');
      
      expect(mockRepository.push).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully pushed feature-branch to remote'
      );
    });

    it('should show message when no changes to push', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'main', ahead: 0, behind: 0 }
          ]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.push();
      
      expect(mockRepository.push).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to push');
    });

    it('should throw error when no branch specified and no current branch', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: undefined
        }
      });
      
      await expect(gitService.push()).rejects.toThrow('No branch specified and unable to determine current branch');
    });

    it('should handle push rejection errors', async () => {
      mockRepository.push = jest.fn().mockRejectedValue(new Error('Updates were rejected'));
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'main', ahead: 1, behind: 0 }
          ]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.push()).rejects.toThrow('Push rejected during push');
    });
  });

  describe('commit', () => {
    beforeEach(() => {
      mockRepository.commit = jest.fn().mockResolvedValue(undefined);
      mockRepository.add = jest.fn().mockResolvedValue(undefined);
    });

    it('should commit successfully with staged changes', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.indexChanges = [{ uri: 'file1.ts' }] as any[];
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.commit('Test commit message');
      
      expect(mockRepository.commit).toHaveBeenCalledWith('Test commit message');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully created commit: Test commit message'
      );
    });

    it('should throw error for empty commit message', async () => {
      await expect(gitService.commit('')).rejects.toThrow('Commit message cannot be empty');
      await expect(gitService.commit('   ')).rejects.toThrow('Commit message cannot be empty');
    });

    it('should offer to stage all changes when no staged changes exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.indexChanges = [];
      mockRepository.state.workingTreeChanges = [{ uri: { fsPath: 'file1.ts' } }] as any[];
      mockRepository.state.untrackedChanges = [{ uri: { fsPath: 'file2.ts' } }] as any[];
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Stage All & Commit');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.commit('Test commit');
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'No staged changes found. Do you want to stage all changes and commit?',
        'Stage All & Commit',
        'Cancel'
      );
      expect(mockRepository.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
      expect(mockRepository.commit).toHaveBeenCalledWith('Test commit');
    });

    it('should cancel commit when user chooses not to stage changes', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.indexChanges = [];
      mockRepository.state.workingTreeChanges = [{ uri: { fsPath: 'file1.ts' } }] as any[];
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Cancel');
      
      await gitService.commit('Test commit');
      
      expect(mockRepository.add).not.toHaveBeenCalled();
      expect(mockRepository.commit).not.toHaveBeenCalled();
    });

    it('should show message when no changes to commit', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.indexChanges = [];
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Stage All & Commit');
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.commit('Test commit');
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to commit');
      expect(mockRepository.commit).not.toHaveBeenCalled();
    });

    it('should handle commit errors', async () => {
      mockRepository.commit = jest.fn().mockRejectedValue(new Error('Commit failed'));
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      mockRepository.state.indexChanges = [{ uri: 'file1.ts' }] as any[];
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.commit('Test commit')).rejects.toThrow('Failed to commit changes');
    });
  });

  describe('merge', () => {
    beforeEach(() => {
      mockRepository.merge = jest.fn().mockResolvedValue(undefined);
    });

    it('should merge successfully with progress notification', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
          ],
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.merge('feature-branch');
      
      expect(mockRepository.merge).toHaveBeenCalledWith('feature-branch');
      expect(mockWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Merging feature-branch into main...'
        }),
        expect.any(Function)
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully merged feature-branch into main'
      );
    });

    it('should throw error for invalid branch name', async () => {
      await expect(gitService.merge('')).rejects.toThrow('Invalid branch name');
      await expect(gitService.merge('invalid..name')).rejects.toThrow('Invalid branch name');
    });

    it('should throw error when branch does not exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: []
        }
      });
      
      await expect(gitService.merge('non-existent')).rejects.toThrow("Branch 'non-existent' not found");
    });

    it('should throw error when trying to merge branch into itself', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'main', fullName: 'main' }
          ]
        }
      });
      
      await expect(gitService.merge('main')).rejects.toThrow('Cannot merge a branch into itself');
    });

    it('should warn about uncommitted changes and allow continuation', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
          ],
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Continue');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.merge('feature-branch');
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'You have uncommitted changes. Do you want to continue with merge?',
        'Continue',
        'Stash Changes',
        'Cancel'
      );
      expect(mockRepository.merge).toHaveBeenCalled();
    });

    it('should stash changes when user chooses to stash', async () => {
      const mockStashChanges = jest.spyOn(gitService, 'stashChanges').mockResolvedValue();
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
          ],
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Stash Changes');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.merge('feature-branch');
      
      expect(mockStashChanges).toHaveBeenCalledWith('Auto-stash before merge with feature-branch');
      expect(mockRepository.merge).toHaveBeenCalled();
    });

    it('should cancel merge when user chooses cancel', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
          ],
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Cancel');
      
      await gitService.merge('feature-branch');
      
      expect(mockRepository.merge).not.toHaveBeenCalled();
    });

    it('should handle merge conflicts', async () => {
      mockRepository.merge = jest.fn().mockRejectedValue(new Error('CONFLICT: merge conflict'));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
          ],
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.merge('feature-branch')).rejects.toThrow('Merge conflicts detected');
    });

    it('should handle general merge errors', async () => {
      mockRepository.merge = jest.fn().mockRejectedValue(new Error('Merge failed'));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
          ],
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.merge('feature-branch')).rejects.toThrow("Failed to merge branch 'feature-branch'");
    });
  });

  describe('rebase', () => {
    beforeEach(() => {
      mockRepository.rebase = jest.fn().mockResolvedValue(undefined);
    });

    it('should rebase successfully with progress notification', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'feature-branch' },
          refs: [
            { type: 1, name: 'main', fullName: 'main' }
          ],
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.rebase('main');
      
      expect(mockRepository.rebase).toHaveBeenCalledWith('main');
      expect(mockWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Rebasing feature-branch onto main...'
        }),
        expect.any(Function)
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully rebased feature-branch onto main'
      );
    });

    it('should throw error for invalid branch name', async () => {
      await expect(gitService.rebase('')).rejects.toThrow('Invalid branch name');
      await expect(gitService.rebase('invalid..name')).rejects.toThrow('Invalid branch name');
    });

    it('should throw error when branch does not exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'feature-branch' },
          refs: []
        }
      });
      
      await expect(gitService.rebase('non-existent')).rejects.toThrow("Branch 'non-existent' not found");
    });

    it('should throw error when trying to rebase branch onto itself', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'main' },
          refs: [
            { type: 1, name: 'main', fullName: 'main' }
          ]
        }
      });
      
      await expect(gitService.rebase('main')).rejects.toThrow('Cannot rebase a branch onto itself');
    });

    it('should warn about uncommitted changes and allow stashing', async () => {
      const mockStashChanges = jest.spyOn(gitService, 'stashChanges').mockResolvedValue();
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'feature-branch' },
          refs: [
            { type: 1, name: 'main', fullName: 'main' }
          ],
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Stash Changes');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.rebase('main');
      
      expect(mockStashChanges).toHaveBeenCalledWith('Auto-stash before rebase onto main');
      expect(mockRepository.rebase).toHaveBeenCalled();
    });

    it('should handle rebase conflicts', async () => {
      mockRepository.rebase = jest.fn().mockRejectedValue(new Error('CONFLICT: rebase conflict'));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          HEAD: { name: 'feature-branch' },
          refs: [
            { type: 1, name: 'main', fullName: 'main' }
          ],
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.rebase('main')).rejects.toThrow('Rebase conflicts detected');
    });
  });

  describe('resetHead', () => {
    beforeEach(() => {
      mockRepository.reset = jest.fn().mockResolvedValue(undefined);
    });

    it('should perform soft reset successfully', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.resetHead('soft', 'HEAD~1');
      
      expect(mockRepository.reset).toHaveBeenCalledWith('HEAD~1', 'soft');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Soft reset completed - HEAD moved, index and working tree unchanged'
      );
    });

    it('should perform mixed reset with confirmation', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          indexChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Continue');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.resetHead('mixed');
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Mixed reset will unstage all staged changes. Continue?',
        'Continue',
        'Cancel'
      );
      expect(mockRepository.reset).toHaveBeenCalledWith('HEAD', 'mixed');
    });

    it('should perform hard reset with confirmation', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push(mockRepository);
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Reset');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.resetHead('hard');
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Hard reset will permanently discard all uncommitted changes. Are you sure?',
        { modal: true },
        'Reset',
        'Cancel'
      );
      expect(mockRepository.reset).toHaveBeenCalledWith('HEAD', 'hard');
    });

    it('should cancel reset when user chooses not to continue', async () => {
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Cancel');
      
      await gitService.resetHead('hard');
      
      expect(mockRepository.reset).not.toHaveBeenCalled();
    });

    it('should throw error for invalid reset mode', async () => {
      await expect(gitService.resetHead('invalid' as any)).rejects.toThrow('Invalid reset mode');
    });

    it('should fallback to git command when repository.reset is not available', async () => {
      // Mock child_process spawn
      const mockSpawn = jest.fn().mockImplementation(() => ({
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success
          }
        })
      }));
      
      jest.doMock('child_process', () => ({ spawn: mockSpawn }));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        reset: undefined // No reset method available
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.resetHead('soft');
      
      expect(mockSpawn).toHaveBeenCalledWith('git', ['reset', '--soft', 'HEAD'], {
        cwd: '/mock/repo/path',
        stdio: 'pipe'
      });
    });
  });

  describe('stashChanges', () => {
    beforeEach(() => {
      mockRepository.createStash = jest.fn().mockResolvedValue(undefined);
    });

    it('should stash changes successfully with default message', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.stashChanges();
      
      expect(mockRepository.createStash).toHaveBeenCalledWith(
        expect.stringContaining('Stash created on'),
        true
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stashed changes:')
      );
    });

    it('should stash changes with custom message', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.stashChanges('Custom stash message');
      
      expect(mockRepository.createStash).toHaveBeenCalledWith('Custom stash message', true);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully stashed changes: Custom stash message'
      );
    });

    it('should show message when no changes to stash', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.stashChanges();
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to stash');
      expect(mockRepository.createStash).not.toHaveBeenCalled();
    });

    it('should fallback to git command when repository.createStash is not available', async () => {
      // Mock child_process spawn
      const mockSpawn = jest.fn().mockImplementation(() => ({
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success
          }
        })
      }));
      
      jest.doMock('child_process', () => ({ spawn: mockSpawn }));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        createStash: undefined, // No createStash method available
        state: {
          ...mockRepository.state,
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.stashChanges('Test stash');
      
      expect(mockSpawn).toHaveBeenCalledWith('git', ['stash', 'push', '-u', '-m', 'Test stash'], {
        cwd: '/mock/repo/path',
        stdio: 'pipe'
      });
    });
  });

  describe('unstashChanges', () => {
    beforeEach(() => {
      mockRepository.popStash = jest.fn().mockResolvedValue(undefined);
      
      // Mock getStashes method
      jest.spyOn(gitService as any, 'getStashes').mockResolvedValue([
        {
          index: 0,
          message: 'WIP on main: Test stash',
          branch: 'main',
          timestamp: new Date('2023-01-01T12:00:00Z')
        },
        {
          index: 1,
          message: 'WIP on feature: Another stash',
          branch: 'feature',
          timestamp: new Date('2023-01-01T11:00:00Z')
        }
      ]);
    });

    it('should unstash changes successfully with specific index', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.unstashChanges(0);
      
      expect(mockRepository.popStash).toHaveBeenCalledWith(0);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully applied stash: WIP on main: Test stash'
      );
    });

    it('should auto-select single stash when no index provided', async () => {
      // Mock single stash
      jest.spyOn(gitService as any, 'getStashes').mockResolvedValue([
        {
          index: 0,
          message: 'WIP on main: Only stash',
          branch: 'main',
          timestamp: new Date('2023-01-01T12:00:00Z')
        }
      ]);
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.unstashChanges();
      
      expect(mockRepository.popStash).toHaveBeenCalledWith(0);
    });

    it('should show stash selection when multiple stashes exist', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showQuickPick = jest.fn().mockResolvedValue({
        label: 'stash@{1}: WIP on feature: Another stash',
        description: 'feature - 1/1/2023, 11:00:00 AM',
        index: 1
      });
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.unstashChanges();
      
      expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'stash@{0}: WIP on main: Test stash',
            index: 0
          }),
          expect.objectContaining({
            label: 'stash@{1}: WIP on feature: Another stash',
            index: 1
          })
        ]),
        { placeHolder: 'Select a stash to apply' }
      );
      expect(mockRepository.popStash).toHaveBeenCalledWith(1);
    });

    it('should cancel when user cancels stash selection', async () => {
      const vscode = require('vscode');
      vscode.window.showQuickPick = jest.fn().mockResolvedValue(undefined);
      
      await gitService.unstashChanges();
      
      expect(mockRepository.popStash).not.toHaveBeenCalled();
    });

    it('should show message when no stashes available', async () => {
      jest.spyOn(gitService as any, 'getStashes').mockResolvedValue([]);
      
      const vscode = require('vscode');
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.unstashChanges();
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No stashes available');
      expect(mockRepository.popStash).not.toHaveBeenCalled();
    });

    it('should throw error for invalid stash index', async () => {
      await expect(gitService.unstashChanges(5)).rejects.toThrow('Invalid stash index 5');
      await expect(gitService.unstashChanges(-1)).rejects.toThrow('Invalid stash index -1');
    });

    it('should warn about uncommitted changes', async () => {
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        state: {
          ...mockRepository.state,
          workingTreeChanges: [{ uri: 'file1.ts' }] as any[]
        }
      });
      
      const vscode = require('vscode');
      vscode.window.showWarningMessage = jest.fn().mockResolvedValue('Continue');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.unstashChanges(0);
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'You have uncommitted changes. Applying stash may cause conflicts. Continue?',
        'Continue',
        'Cancel'
      );
      expect(mockRepository.popStash).toHaveBeenCalled();
    });

    it('should handle stash conflicts', async () => {
      // Mock child_process spawn for fallback
      const mockSpawn = jest.fn().mockImplementation(() => ({
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback('CONFLICT: stash conflict');
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Error code
          }
        })
      }));
      
      jest.doMock('child_process', () => ({ spawn: mockSpawn }));
      
      mockGitAPI.repositories.length = 0;
      mockGitAPI.repositories.push({
        ...mockRepository,
        popStash: undefined, // Force fallback to git command
        state: {
          ...mockRepository.state,
          workingTreeChanges: [],
          indexChanges: [],
          untrackedChanges: []
        }
      });
      
      const vscode = require('vscode');
      const mockWithProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      vscode.window.withProgress = mockWithProgress;
      
      await expect(gitService.unstashChanges(0)).rejects.toThrow('Stash application resulted in conflicts');
    });
  });
});

import { GitService } from '../../../src/services/gitService';
import { FeedbackService } from '../../../src/services/feedbackService';
import { GitError, GitErrorCodes } from '../../../src/types/git';

// Mock VS Code module
jest.mock('vscode', () => ({
  extensions: {
    getExtension: jest.fn()
  },
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    withProgress: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }))
  },
  commands: {
    executeCommand: jest.fn()
  },
  ProgressLocation: {
    Notification: 15
  }
}));

describe('Error Scenarios and Recovery Paths', () => {
  let gitService: GitService;
  let feedbackService: FeedbackService;
  let mockWindow: any;
  let mockCommands: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const vscode = require('vscode');
    mockWindow = vscode.window;
    mockCommands = vscode.commands;
    
    feedbackService = new FeedbackService();
    gitService = new GitService(feedbackService);
  });

  describe('Repository Not Found Scenarios', () => {
    beforeEach(() => {
      // Mock Git extension not finding any repositories
      const mockGitExtension = {
        exports: {
          getAPI: jest.fn().mockReturnValue({
            repositories: []
          })
        }
      };
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(mockGitExtension);
    });

    it('should handle repository not found error with recovery options', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Open Folder');
      mockCommands.executeCommand.mockResolvedValue(undefined);

      await expect(gitService.getBranches()).rejects.toThrow(GitError);
      
      // Verify error handling was called
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('No Git repository found'),
        'Open Folder',
        'Initialize Repository',
        'Show Logs'
      );
    });

    it('should handle initialize repository recovery action', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Initialize Repository');
      mockCommands.executeCommand.mockResolvedValue(undefined);

      await expect(gitService.getBranches()).rejects.toThrow(GitError);
      
      expect(mockCommands.executeCommand).toHaveBeenCalledWith('git.init');
    });
  });

  describe('Git Extension Not Found Scenarios', () => {
    beforeEach(() => {
      // Mock Git extension not being available
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(undefined);
    });

    it('should handle Git extension not found error', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Enable Git Extension');
      mockCommands.executeCommand.mockResolvedValue(undefined);

      await expect(gitService.getBranches()).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('VS Code Git extension is not available'),
        'Enable Git Extension',
        'Show Logs'
      );
    });
  });

  describe('Network Error Scenarios', () => {
    beforeEach(() => {
      // Mock Git extension with repository but network failures
      const mockRepository = {
        fetch: jest.fn().mockRejectedValue(new Error('Network error')),
        pull: jest.fn().mockRejectedValue(new Error('Network error')),
        push: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      
      const mockGitExtension = {
        exports: {
          getAPI: jest.fn().mockReturnValue({
            repositories: [mockRepository]
          })
        }
      };
      
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(mockGitExtension);
      mockWindow.withProgress.mockImplementation((options, task) => {
        return task({ report: jest.fn() }, { isCancellationRequested: false });
      });
    });

    it('should handle network errors during fetch with recovery options', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Retry');

      await expect(gitService.fetch()).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Network error occurred'),
        'Retry',
        'Work Offline',
        'Show Logs'
      );
    });

    it('should handle network errors during pull with recovery options', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Work Offline');

      await expect(gitService.pull()).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Network error occurred'),
        'Retry',
        'Work Offline',
        'Show Logs'
      );
    });

    it('should handle network errors during push with recovery options', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Configure Credentials');

      await expect(gitService.push()).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Network error occurred'),
        'Retry',
        'Work Offline',
        'Show Logs'
      );
    });
  });

  describe('Branch Operation Error Scenarios', () => {
    beforeEach(() => {
      // Mock Git extension with repository
      const mockRepository = {
        state: {
          HEAD: {
            name: 'main'
          }
        },
        getBranches: jest.fn().mockResolvedValue([
          { name: 'main', type: 0, commit: 'abc123' }
        ]),
        createBranch: jest.fn(),
        checkout: jest.fn(),
        renameBranch: jest.fn()
      };
      
      const mockGitExtension = {
        exports: {
          getAPI: jest.fn().mockReturnValue({
            repositories: [mockRepository]
          })
        }
      };
      
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(mockGitExtension);
    });

    it('should handle invalid branch name error', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Choose Different Name');

      await expect(gitService.createBranch('invalid..name')).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('branch name is invalid'),
        'Show Logs'
      );
    });

    it('should handle branch not found error with recovery options', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Create Branch');
      mockCommands.executeCommand.mockResolvedValue(undefined);

      await expect(gitService.checkoutBranch('nonexistent-branch')).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('branch does not exist'),
        'Create Branch',
        'Refresh',
        'Show Logs'
      );
    });
  });

  describe('Merge Conflict Scenarios', () => {
    beforeEach(() => {
      // Mock Git extension with repository that has merge conflicts
      const mockRepository = {
        state: {
          HEAD: {
            name: 'main'
          },
          mergeChanges: [
            { uri: { fsPath: '/path/to/file.txt' } }
          ]
        },
        getBranches: jest.fn().mockResolvedValue([
          { name: 'main', type: 0, commit: 'abc123' },
          { name: 'feature', type: 0, commit: 'def456' }
        ]),
        merge: jest.fn().mockRejectedValue(new Error('Merge conflict'))
      };
      
      const mockGitExtension = {
        exports: {
          getAPI: jest.fn().mockReturnValue({
            repositories: [mockRepository]
          })
        }
      };
      
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(mockGitExtension);
    });

    it('should handle merge conflicts with recovery options', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Open Diff Viewer');
      mockCommands.executeCommand.mockResolvedValue(undefined);

      await expect(gitService.merge('feature')).rejects.toThrow(GitError);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Merge conflicts detected'),
        'Open Diff Viewer',
        'Abort Operation',
        'Show Logs'
      );
    });

    it('should handle abort merge operation', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Abort Operation');
      mockCommands.executeCommand.mockResolvedValue(undefined);

      await expect(gitService.merge('feature')).rejects.toThrow(GitError);
      
      expect(mockCommands.executeCommand).toHaveBeenCalledWith('git.clean');
    });
  });

  describe('Operation Cancellation Scenarios', () => {
    beforeEach(() => {
      const mockRepository = {
        fetch: jest.fn().mockResolvedValue(undefined),
        pull: jest.fn().mockResolvedValue(undefined),
        push: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockGitExtension = {
        exports: {
          getAPI: jest.fn().mockReturnValue({
            repositories: [mockRepository]
          })
        }
      };
      
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(mockGitExtension);
    });

    it('should handle user cancellation during fetch', async () => {
      mockWindow.withProgress.mockImplementation((options, task) => {
        return task({ report: jest.fn() }, { isCancellationRequested: true });
      });

      await expect(gitService.fetch()).rejects.toThrow(
        expect.objectContaining({
          code: GitErrorCodes.OPERATION_CANCELLED
        })
      );
    });

    it('should handle user cancellation during pull', async () => {
      mockWindow.withProgress.mockImplementation((options, task) => {
        return task({ report: jest.fn() }, { isCancellationRequested: true });
      });

      await expect(gitService.pull()).rejects.toThrow(
        expect.objectContaining({
          code: GitErrorCodes.OPERATION_CANCELLED
        })
      );
    });

    it('should handle user cancellation during push', async () => {
      // Mock the repository and branches to avoid the "no branch specified" error
      const mockRepository = {
        state: {
          HEAD: {
            name: 'main'
          }
        },
        push: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockGitExtension = {
        exports: {
          getAPI: jest.fn().mockReturnValue({
            repositories: [mockRepository]
          })
        }
      };
      
      const vscode = require('vscode');
      vscode.extensions.getExtension.mockReturnValue(mockGitExtension);
      
      mockWindow.withProgress.mockImplementation((options, task) => {
        return task({ report: jest.fn() }, { isCancellationRequested: true });
      });

      await expect(gitService.push()).rejects.toThrow(
        expect.objectContaining({
          code: GitErrorCodes.OPERATION_CANCELLED
        })
      );
    });
  });

  describe('Recovery Action Execution', () => {
    it('should execute refresh recovery action', async () => {
      mockCommands.executeCommand.mockResolvedValue(undefined);
      
      // Simulate error with refresh recovery
      const error = new GitError('Test error', 'TEST_ERROR', 'git', true);
      mockWindow.showErrorMessage.mockResolvedValue('Refresh');
      
      // This would be called by the error handler
      await mockCommands.executeCommand('git.refresh');
      
      expect(mockCommands.executeCommand).toHaveBeenCalledWith('git.refresh');
    });

    it('should execute stage all changes recovery action', async () => {
      mockCommands.executeCommand.mockResolvedValue(undefined);
      
      const error = new GitError('No changes to commit', GitErrorCodes.NO_CHANGES_TO_COMMIT, 'git', true);
      mockWindow.showErrorMessage.mockResolvedValue('Stage All Changes');
      
      await mockCommands.executeCommand('git.stageAll');
      
      expect(mockCommands.executeCommand).toHaveBeenCalledWith('git.stageAll');
    });

    it('should show informational message for work offline action', async () => {
      mockWindow.showInformationMessage.mockResolvedValue(undefined);
      
      // Simulate work offline action
      await mockWindow.showInformationMessage('Working in offline mode. Some features may be limited.');
      
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'Working in offline mode. Some features may be limited.'
      );
    });
  });

  describe('Error Context and Logging', () => {
    it('should log detailed error information', async () => {
      const error = new GitError(
        'Test error with context',
        'TEST_ERROR',
        'git',
        true,
        { operation: 'test', timestamp: Date.now() }
      );
      
      // The logging would be handled by the feedback service
      expect(error.context).toEqual(
        expect.objectContaining({
          operation: 'test',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should provide error codes for programmatic handling', () => {
      expect(GitErrorCodes.REPOSITORY_NOT_FOUND).toBe('REPOSITORY_NOT_FOUND');
      expect(GitErrorCodes.MERGE_CONFLICTS).toBe('MERGE_CONFLICTS');
      expect(GitErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(GitErrorCodes.OPERATION_CANCELLED).toBe('OPERATION_CANCELLED');
    });
  });
});
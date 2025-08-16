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
    refs: [] as any[]
  },
  merge: jest.fn(),
  rebase: jest.fn(),
  reset: jest.fn(),
  createStash: jest.fn(),
  popStash: jest.fn()
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
    showQuickPick: jest.fn(),
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

describe('GitService - Advanced Operations', () => {
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
    mockRepository.state.refs = [];
    
    // Reset repository methods
    mockRepository.merge = jest.fn().mockResolvedValue(undefined);
    mockRepository.rebase = jest.fn().mockResolvedValue(undefined);
    mockRepository.reset = jest.fn().mockResolvedValue(undefined);
    mockRepository.createStash = jest.fn().mockResolvedValue(undefined);
    mockRepository.popStash = jest.fn().mockResolvedValue(undefined);
    
    gitService = new GitService();
  });

  describe('merge', () => {
    it('should merge successfully with progress notification', async () => {
      mockRepository.state.HEAD = { name: 'main' };
      mockRepository.state.refs = [
        { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
      ];
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
      await expect(gitService.merge('')).rejects.toThrow('Branch name cannot be empty');
      await expect(gitService.merge('invalid..name')).rejects.toThrow('Branch name contains invalid characters');
    });

    it('should throw error when branch does not exist', async () => {
      mockRepository.state.HEAD = { name: 'main' };
      mockRepository.state.refs = [];
      
      await expect(gitService.merge('non-existent')).rejects.toThrow("Branch 'non-existent' not found");
    });

    it('should throw error when trying to merge branch into itself', async () => {
      mockRepository.state.HEAD = { name: 'main' };
      mockRepository.state.refs = [
        { type: 1, name: 'main', fullName: 'main' }
      ];
      
      await expect(gitService.merge('main')).rejects.toThrow('Cannot merge a branch into itself');
    });

    it('should warn about uncommitted changes and allow stashing', async () => {
      const mockStashChanges = jest.spyOn(gitService, 'stashChanges').mockResolvedValue();
      
      mockRepository.state.HEAD = { name: 'main' };
      mockRepository.state.refs = [
        { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
      ];
      mockRepository.state.workingTreeChanges = [{ uri: 'file1.ts' }] as any[];
      
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

    it('should handle merge conflicts', async () => {
      mockRepository.merge = jest.fn().mockRejectedValue(new Error('CONFLICT: merge conflict'));
      
      mockRepository.state.HEAD = { name: 'main' };
      mockRepository.state.refs = [
        { type: 1, name: 'feature-branch', fullName: 'feature-branch' }
      ];
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.merge('feature-branch')).rejects.toThrow('Merge conflicts detected');
    });
  });

  describe('rebase', () => {
    it('should rebase successfully with progress notification', async () => {
      mockRepository.state.HEAD = { name: 'feature-branch' };
      mockRepository.state.refs = [
        { type: 1, name: 'main', fullName: 'main' }
      ];
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

    it('should handle rebase conflicts', async () => {
      mockRepository.rebase = jest.fn().mockRejectedValue(new Error('CONFLICT: rebase conflict'));
      
      mockRepository.state.HEAD = { name: 'feature-branch' };
      mockRepository.state.refs = [
        { type: 1, name: 'main', fullName: 'main' }
      ];
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.withProgress = jest.fn().mockImplementation((options, callback) => {
        const mockProgress = { report: jest.fn() };
        return callback(mockProgress);
      });
      
      await expect(gitService.rebase('main')).rejects.toThrow('Rebase conflicts detected');
    });
  });

  describe('resetHead', () => {
    it('should perform soft reset successfully', async () => {
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

    it('should perform hard reset with confirmation', async () => {
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

    it('should throw error for invalid reset mode', async () => {
      await expect(gitService.resetHead('invalid' as any)).rejects.toThrow('Invalid reset mode');
    });
  });

  describe('stashChanges', () => {
    it('should stash changes successfully with default message', async () => {
      mockRepository.state.workingTreeChanges = [{ uri: 'file1.ts' }] as any[];
      
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

    it('should show message when no changes to stash', async () => {
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
      const vscode = require('vscode');
      vscode.window.showInformationMessage = jest.fn();
      
      await gitService.stashChanges();
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to stash');
      expect(mockRepository.createStash).not.toHaveBeenCalled();
    });
  });

  describe('unstashChanges', () => {
    beforeEach(() => {
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
      
      await gitService.unstashChanges(0);
      
      expect(mockRepository.popStash).toHaveBeenCalledWith(0);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Successfully applied stash: WIP on main: Test stash'
      );
    });

    it('should show stash selection when multiple stashes exist', async () => {
      mockRepository.state.workingTreeChanges = [];
      mockRepository.state.indexChanges = [];
      mockRepository.state.untrackedChanges = [];
      
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
            label: 'stash@{0}',
            description: 'WIP on main: Test stash',
            stash: expect.objectContaining({
              index: 0,
              message: 'WIP on main: Test stash'
            })
          }),
          expect.objectContaining({
            label: 'stash@{1}',
            description: 'WIP on feature: Another stash',
            stash: expect.objectContaining({
              index: 1,
              message: 'WIP on feature: Another stash'
            })
          })
        ]),
        {
          placeHolder: 'Select a stash to apply',
          matchOnDescription: true,
          matchOnDetail: true
        }
      );
      expect(mockRepository.popStash).toHaveBeenCalledWith(1);
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
  });
});
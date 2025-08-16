import { StatusIntegrationService } from '../../../src/services/statusIntegrationService';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  commands: {
    executeCommand: jest.fn()
  }
}));

describe('StatusIntegrationService', () => {
  let service: StatusIntegrationService;
  let mockStatusBarItem: any;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusBarItem = {
      text: '',
      tooltip: '',
      command: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    };
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);
    
    mockContext = {
      subscriptions: []
    } as any;
    
    service = new StatusIntegrationService(mockContext);
  });

  describe('constructor', () => {
    it('should create status bar item', () => {
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 100);
      expect(mockContext.subscriptions).toContain(mockStatusBarItem);
    });

    it('should initialize status bar item with default values', () => {
      expect(mockStatusBarItem.text).toBe('$(source-control) Git');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Git Operations');
      expect(mockStatusBarItem.command).toBe('jetgit.showGitMenu');
    });
  });

  describe('updateGitStatus', () => {
    it('should update status with branch information', () => {
      const status = {
        branch: 'main',
        ahead: 2,
        behind: 1,
        hasChanges: true
      };

      service.updateGitStatus(status);

      expect(mockStatusBarItem.text).toBe('$(source-control) main ↑2↓1*');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: main (2 ahead, 1 behind, uncommitted changes)');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should update status without ahead/behind counts', () => {
      const status = {
        branch: 'feature/test',
        ahead: 0,
        behind: 0,
        hasChanges: false
      };

      service.updateGitStatus(status);

      expect(mockStatusBarItem.text).toBe('$(source-control) feature/test');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: feature/test');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should handle status with only ahead commits', () => {
      const status = {
        branch: 'develop',
        ahead: 3,
        behind: 0,
        hasChanges: false
      };

      service.updateGitStatus(status);

      expect(mockStatusBarItem.text).toBe('$(source-control) develop ↑3');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: develop (3 ahead)');
    });

    it('should handle status with only behind commits', () => {
      const status = {
        branch: 'hotfix',
        ahead: 0,
        behind: 5,
        hasChanges: true
      };

      service.updateGitStatus(status);

      expect(mockStatusBarItem.text).toBe('$(source-control) hotfix ↓5*');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: hotfix (5 behind, uncommitted changes)');
    });

    it('should handle detached HEAD state', () => {
      const status = {
        branch: 'HEAD',
        ahead: 0,
        behind: 0,
        hasChanges: false,
        detached: true,
        commit: 'abc1234'
      };

      service.updateGitStatus(status);

      expect(mockStatusBarItem.text).toBe('$(source-control) abc1234');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Detached HEAD at abc1234');
    });
  });

  describe('showOperationProgress', () => {
    it('should show progress for git operations', () => {
      service.showOperationProgress('Fetching from origin...');

      expect(mockStatusBarItem.text).toBe('$(sync~spin) Fetching from origin...');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Fetching from origin...');
    });

    it('should handle empty operation message', () => {
      service.showOperationProgress('');

      expect(mockStatusBarItem.text).toBe('$(sync~spin) Git operation in progress...');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Git operation in progress...');
    });
  });

  describe('hideOperationProgress', () => {
    it('should restore previous status after operation', () => {
      // Set initial status
      const status = {
        branch: 'main',
        ahead: 1,
        behind: 0,
        hasChanges: true
      };
      service.updateGitStatus(status);

      // Show progress
      service.showOperationProgress('Pushing...');
      expect(mockStatusBarItem.text).toBe('$(sync~spin) Pushing...');

      // Hide progress
      service.hideOperationProgress();
      expect(mockStatusBarItem.text).toBe('$(source-control) main ↑1*');
    });

    it('should show default status if no previous status exists', () => {
      service.showOperationProgress('Testing...');
      service.hideOperationProgress();

      expect(mockStatusBarItem.text).toBe('$(source-control) Git');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Git Operations');
    });
  });

  describe('showMessage', () => {
    it('should show information message', async () => {
      const message = 'Operation completed successfully';
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('OK');

      const result = await service.showMessage(message, 'info');

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(message);
      expect(result).toBe('OK');
    });

    it('should show warning message', async () => {
      const message = 'This operation may take a while';
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Continue');

      const result = await service.showMessage(message, 'warning');

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(message);
      expect(result).toBe('Continue');
    });

    it('should show error message', async () => {
      const message = 'Git operation failed';
      (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Retry');

      const result = await service.showMessage(message, 'error');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(message);
      expect(result).toBe('Retry');
    });

    it('should show message with action buttons', async () => {
      const message = 'Confirm operation';
      const actions = ['Yes', 'No', 'Cancel'];
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Yes');

      const result = await service.showMessage(message, 'info', actions);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(message, ...actions);
      expect(result).toBe('Yes');
    });

    it('should default to info type for invalid message type', async () => {
      const message = 'Test message';
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      await service.showMessage(message, 'invalid' as any);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(message);
    });
  });

  describe('refreshGitStatus', () => {
    it('should execute git refresh command', async () => {
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      await service.refreshGitStatus();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('git.refresh');
    });

    it('should handle refresh command errors', async () => {
      const error = new Error('Refresh failed');
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(error);

      await expect(service.refreshGitStatus()).rejects.toThrow('Refresh failed');
    });
  });

  describe('setStatusBarVisibility', () => {
    it('should show status bar when visible is true', () => {
      service.setStatusBarVisibility(true);

      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should hide status bar when visible is false', () => {
      service.setStatusBarVisibility(false);

      expect(mockStatusBarItem.hide).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose status bar item', () => {
      service.dispose();

      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });

    it('should handle disposal errors gracefully', () => {
      mockStatusBarItem.dispose.mockImplementation(() => {
        throw new Error('Disposal failed');
      });

      expect(() => service.dispose()).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid status updates', () => {
      const statuses = [
        { branch: 'main', ahead: 0, behind: 0, hasChanges: false },
        { branch: 'main', ahead: 1, behind: 0, hasChanges: true },
        { branch: 'main', ahead: 1, behind: 2, hasChanges: true }
      ];

      statuses.forEach(status => service.updateGitStatus(status));

      expect(mockStatusBarItem.text).toBe('$(source-control) main ↑1↓2*');
      expect(mockStatusBarItem.show).toHaveBeenCalledTimes(3);
    });

    it('should handle progress operations during status updates', () => {
      // Initial status
      service.updateGitStatus({ branch: 'main', ahead: 0, behind: 0, hasChanges: false });
      
      // Show progress
      service.showOperationProgress('Pushing...');
      expect(mockStatusBarItem.text).toBe('$(sync~spin) Pushing...');
      
      // Update status during progress (should be ignored)
      service.updateGitStatus({ branch: 'main', ahead: 1, behind: 0, hasChanges: true });
      expect(mockStatusBarItem.text).toBe('$(sync~spin) Pushing...');
      
      // Hide progress
      service.hideOperationProgress();
      expect(mockStatusBarItem.text).toBe('$(source-control) main');
    });
  });
});
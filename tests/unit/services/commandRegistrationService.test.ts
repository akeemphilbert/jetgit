import { CommandRegistrationService } from '../../../src/services/commandRegistrationService';
import { GitService } from '../../../src/services/gitService';
import { GitMenuController } from '../../../src/providers/gitMenuController';
import { ContextMenuProvider } from '../../../src/providers/contextMenuProvider';
import { DiffViewer } from '../../../src/views/diffViewer';
import { DialogService } from '../../../src/services/dialogService';
import { StatusBarService } from '../../../src/services/statusBarService';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    activeTextEditor: null,
  },
  workspace: {
    asRelativePath: jest.fn((uri) => uri.fsPath || uri),
  },
  env: {
    openExternal: jest.fn(),
  },
  Uri: {
    parse: jest.fn(),
  },
  Disposable: {
    from: jest.fn()
  }
}));

describe('CommandRegistrationService', () => {
  let service: CommandRegistrationService;
  let mockContext: vscode.ExtensionContext;
  let mockGitService: jest.Mocked<GitService>;
  let mockGitMenuController: jest.Mocked<GitMenuController>;
  let mockContextMenuProvider: jest.Mocked<ContextMenuProvider>;
  let mockDiffViewer: jest.Mocked<DiffViewer>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockStatusService: jest.Mocked<StatusBarService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      subscriptions: []
    } as any;

    // Create mocked dependencies
    mockGitService = {
      pull: jest.fn(),
      commit: jest.fn(),
      push: jest.fn(),
      fetch: jest.fn(),
      createBranch: jest.fn(),
      checkoutBranch: jest.fn(),
      getCurrentBranch: jest.fn(),
      renameBranch: jest.fn(),
      getBranches: jest.fn(),
      getFileDiff: jest.fn(),
    } as any;

    mockGitMenuController = {
      showGitMenu: jest.fn(),
    } as any;

    mockContextMenuProvider = {
      registerCommands: jest.fn(),
    } as any;

    mockDiffViewer = {
      showDiff: jest.fn(),
    } as any;

    mockDialogService = {
      promptForCommitMessage: jest.fn(),
      promptForBranchName: jest.fn(),
      promptForRevision: jest.fn(),
      selectBranchForComparison: jest.fn(),
    } as any;

    mockStatusService = {
      notifyGitOperation: jest.fn(),
    } as any;

    service = new CommandRegistrationService(
      mockGitService,
      mockGitMenuController,
      mockContextMenuProvider,
      mockDiffViewer,
      mockDialogService,
      mockStatusService
    );
  });

  describe('registerAllCommands', () => {
    it('should register all extension commands', () => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);

      service.registerAllCommands(mockContext);

      // Should register main commands, branch commands, file commands, and utility commands
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(16); // 7 main + 5 branch + 2 file + 2 utility (removed duplicate jetgit.showGitMenu)
      expect(mockContextMenuProvider.registerCommands).toHaveBeenCalledWith(mockContext);
    });

    it('should add all commands to context subscriptions', () => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);

      service.registerAllCommands(mockContext);

      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('command execution', () => {
    beforeEach(() => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);
      service.registerAllCommands(mockContext);
    });

    it('should execute updateProject command successfully', async () => {
      mockGitService.pull.mockResolvedValue();
      mockStatusService.notifyGitOperation.mockResolvedValue();

      // Get the registered command handler
      const updateProjectCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.updateProject');
      
      expect(updateProjectCall).toBeDefined();
      
      if (updateProjectCall) {
        await updateProjectCall[1](); // Execute the handler
        
        expect(mockGitService.pull).toHaveBeenCalled();
        expect(mockStatusService.notifyGitOperation).toHaveBeenCalledWith('Update Project');
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Project updated successfully');
      }
    });

    it('should handle updateProject command errors', async () => {
      const error = new Error('Pull failed');
      mockGitService.pull.mockRejectedValue(error);

      const updateProjectCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.updateProject');
      
      if (updateProjectCall) {
        await updateProjectCall[1]();
        
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to update project: Pull failed');
      }
    });

    it('should execute commitChanges command successfully', async () => {
      const commitMessage = 'Test commit message';
      mockDialogService.promptForCommitMessage.mockResolvedValue(commitMessage);
      mockGitService.commit.mockResolvedValue();
      mockStatusService.notifyGitOperation.mockResolvedValue();

      const commitCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.commitChanges');
      
      if (commitCall) {
        await commitCall[1]();
        
        expect(mockDialogService.promptForCommitMessage).toHaveBeenCalled();
        expect(mockGitService.commit).toHaveBeenCalledWith(commitMessage);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Changes committed successfully');
      }
    });

    it('should cancel commitChanges when no message provided', async () => {
      mockDialogService.promptForCommitMessage.mockResolvedValue(undefined);

      const commitCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.commitChanges');
      
      if (commitCall) {
        await commitCall[1]();
        
        expect(mockGitService.commit).not.toHaveBeenCalled();
      }
    });
  });

  describe('branch commands', () => {
    beforeEach(() => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);
      service.registerAllCommands(mockContext);
    });

    it('should execute newBranchFrom command successfully', async () => {
      const sourceBranch = 'main';
      const newBranchName = 'feature/new-feature';
      mockDialogService.promptForBranchName.mockResolvedValue(newBranchName);
      mockGitService.createBranch.mockResolvedValue();
      mockStatusService.notifyGitOperation.mockResolvedValue();

      const newBranchFromCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.newBranchFrom');
      
      if (newBranchFromCall) {
        await newBranchFromCall[1](sourceBranch);
        
        expect(mockDialogService.promptForBranchName).toHaveBeenCalledWith(
          `Create new branch from ${sourceBranch}`,
          'Enter new branch name'
        );
        expect(mockGitService.createBranch).toHaveBeenCalledWith(newBranchName, sourceBranch);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
          `Successfully created branch '${newBranchName}' from '${sourceBranch}'`
        );
      }
    });

    it('should execute renameBranch command successfully', async () => {
      const oldBranchName = 'old-branch';
      const newBranchName = 'new-branch';
      mockDialogService.promptForBranchName.mockResolvedValue(newBranchName);
      mockGitService.renameBranch.mockResolvedValue();
      mockStatusService.notifyGitOperation.mockResolvedValue();

      const renameBranchCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.renameBranch');
      
      if (renameBranchCall) {
        await renameBranchCall[1](oldBranchName);
        
        expect(mockGitService.renameBranch).toHaveBeenCalledWith(oldBranchName, newBranchName);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
          `Successfully renamed branch '${oldBranchName}' to '${newBranchName}'`
        );
      }
    });
  });

  describe('file commands', () => {
    beforeEach(() => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);
      service.registerAllCommands(mockContext);
    });

    it('should execute compareWithBranch command successfully', async () => {
      const filePath = 'src/test.ts';
      const mockBranches = [
        { name: 'main', fullName: 'refs/heads/main', type: 'local' as const, isActive: true },
        { name: 'develop', fullName: 'refs/heads/develop', type: 'local' as const, isActive: false }
      ];
      const selectedBranch = mockBranches[1];
      const mockDiff = {
        filePath,
        oldContent: 'old',
        newContent: 'new',
        hunks: [],
        hasConflicts: false
      };

      // Mock active editor
      (vscode.window as any).activeTextEditor = {
        document: { uri: { fsPath: filePath } }
      };
      (vscode.workspace.asRelativePath as jest.Mock).mockReturnValue(filePath);
      
      mockGitService.getBranches.mockResolvedValue(mockBranches);
      mockDialogService.selectBranchForComparison.mockResolvedValue(selectedBranch);
      mockGitService.getFileDiff.mockResolvedValue(mockDiff);
      mockDiffViewer.showDiff.mockResolvedValue();

      const compareCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.compareWithBranch');
      
      if (compareCall) {
        await compareCall[1]();
        
        expect(mockGitService.getBranches).toHaveBeenCalled();
        expect(mockDialogService.selectBranchForComparison).toHaveBeenCalledWith(mockBranches);
        expect(mockGitService.getFileDiff).toHaveBeenCalledWith(filePath, selectedBranch.name, undefined);
        expect(mockDiffViewer.showDiff).toHaveBeenCalledWith(
          mockDiff,
          `${filePath} (${selectedBranch.name} ↔ Working Tree)`
        );
      }
    });

    it('should handle compareWithBranch when no active editor', async () => {
      (vscode.window as any).activeTextEditor = null;

      const compareCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.compareWithBranch');
      
      if (compareCall) {
        await compareCall[1]();
        
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No active file to compare');
        expect(mockGitService.getBranches).not.toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('should dispose all registered commands', () => {
      const mockDisposable1 = { dispose: jest.fn() };
      const mockDisposable2 = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable1);
      
      service.registerAllCommands(mockContext);
      service.dispose();

      // Should dispose all internal disposables
      expect(mockDisposable1.dispose).toHaveBeenCalled();
    });

    it('should handle disposal errors gracefully', () => {
      const mockDisposable = { 
        dispose: jest.fn().mockImplementation(() => { throw new Error('Disposal failed'); })
      };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);
      
      service.registerAllCommands(mockContext);
      
      expect(() => service.dispose()).not.toThrow();
      expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('should clear disposables array after disposal', () => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);
      
      service.registerAllCommands(mockContext);
      service.dispose();
      
      // Calling dispose again should not throw
      expect(() => service.dispose()).not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      const mockDisposable = { dispose: jest.fn() };
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue(mockDisposable);
      service.registerAllCommands(mockContext);
    });

    it('should handle Git service errors gracefully', async () => {
      const error = new Error('Git operation failed');
      mockGitService.push.mockRejectedValue(error);

      const pushCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.push');
      
      if (pushCall) {
        await pushCall[1]();
        
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to push changes: Git operation failed');
      }
    });

    it('should handle unknown errors gracefully', async () => {
      mockGitService.fetch.mockRejectedValue('Unknown error');

      const fetchCall = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'jetgit.fetch');
      
      if (fetchCall) {
        await fetchCall[1]();
        
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to fetch: Unknown error');
      }
    });
  });
});
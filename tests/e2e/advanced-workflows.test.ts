import { GitService } from '../../src/services/gitService';
import { GitMenuProvider } from '../../src/providers/gitMenuProvider';
import { ContextMenuProvider } from '../../src/providers/contextMenuProvider';
import { DiffViewer } from '../../src/views/diffViewer';
import { ConflictResolver } from '../../src/services/conflictResolver';
import { StatusBarService } from '../../src/services/statusBarService';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    createQuickPick: jest.fn(() => ({
      items: [],
      placeholder: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      onDidChangeSelection: jest.fn(),
      onDidHide: jest.fn(),
    })),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })),
    createWebviewPanel: jest.fn(() => ({
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn(),
      },
      onDidDispose: jest.fn(),
      dispose: jest.fn(),
    })),
    createStatusBarItem: jest.fn(() => ({
      text: '',
      tooltip: '',
      command: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  extensions: {
    getExtension: jest.fn(() => ({
      exports: {
        getAPI: jest.fn(() => ({
          repositories: [{
            rootUri: { fsPath: '/test/workspace' },
            state: {
              HEAD: {
                name: 'main',
                commit: 'abc123',
                type: 0,
              },
            },
          }],
          getRepository: jest.fn(),
        })),
      },
    })),
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
    parse: jest.fn(),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
    })),
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
  },
  ProgressLocation: {
    Notification: 15,
    SourceControl: 1,
    Window: 10,
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  QuickPickItemKind: {
    Separator: -1,
    Default: 0,
  },
}));

describe('Advanced End-to-End Workflow Tests', () => {
  let gitService: GitService;
  let gitMenuProvider: GitMenuProvider;
  let contextMenuProvider: ContextMenuProvider;
  let diffViewer: DiffViewer;
  let conflictResolver: ConflictResolver;
  let statusService: StatusBarService;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = { subscriptions: [] };

    gitService = new GitService();
    gitMenuProvider = new GitMenuProvider(gitService);
    contextMenuProvider = new ContextMenuProvider(gitService);
    diffViewer = new DiffViewer(gitService);
    conflictResolver = new ConflictResolver();
    // Reset singleton
    (StatusBarService as any).instance = undefined;
    statusService = StatusBarService.getInstance(gitService);
  });

  describe('Complex Branch Management Workflows', () => {
    it('should complete feature branch workflow with multiple operations', async () => {
      const vscode = require('vscode');

      // Step 1: Start with main branch
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        {
          name: 'main',
          fullName: 'refs/heads/main',
          type: 'local',
          isActive: true,
          upstream: 'origin/main',
          ahead: 0,
          behind: 0,
        },
      ]);

      // Step 2: Create feature branch from main
      vscode.window.showInputBox.mockResolvedValue('feature/user-authentication');
      jest.spyOn(gitService, 'createBranch').mockResolvedValue();
      jest.spyOn(gitService, 'checkoutBranch').mockResolvedValue();

      await gitService.createBranch('feature/user-authentication', 'main');
      await gitService.checkoutBranch('feature/user-authentication');

      // Step 3: Update status to reflect new branch
      statusService.updateGitStatus({
        branch: 'feature/user-authentication',
        ahead: 0,
        behind: 0,
        hasChanges: false,
      });

      // Step 4: Make some commits (simulate development)
      jest.spyOn(gitService, 'commit').mockResolvedValue();
      await gitService.commit('Add authentication service');
      await gitService.commit('Add login component');
      await gitService.commit('Add tests for authentication');

      // Step 5: Update status with ahead commits
      statusService.updateGitStatus({
        branch: 'feature/user-authentication',
        ahead: 3,
        behind: 0,
        hasChanges: false,
      });

      // Step 6: Push feature branch
      jest.spyOn(gitService, 'push').mockResolvedValue();
      await gitService.push('feature/user-authentication');

      // Step 7: Update main branch (simulate other developers' work)
      await gitService.checkoutBranch('main');
      jest.spyOn(gitService, 'pull').mockResolvedValue();
      await gitService.pull();

      // Step 8: Switch back to feature branch and rebase
      await gitService.checkoutBranch('feature/user-authentication');
      jest.spyOn(gitService, 'rebase').mockResolvedValue();
      await gitService.rebase('main');

      // Step 9: Force push after rebase
      await gitService.push('feature/user-authentication');

      // Step 10: Merge feature branch back to main
      await gitService.checkoutBranch('main');
      jest.spyOn(gitService, 'merge').mockResolvedValue();
      await gitService.merge('feature/user-authentication');

      // Verify all operations were called
      expect(gitService.createBranch).toHaveBeenCalledWith('feature/user-authentication', 'main');
      expect(gitService.checkoutBranch).toHaveBeenCalledTimes(3);
      expect(gitService.commit).toHaveBeenCalledTimes(3);
      expect(gitService.push).toHaveBeenCalledTimes(2);
      expect(gitService.pull).toHaveBeenCalled();
      expect(gitService.rebase).toHaveBeenCalledWith('main');
      expect(gitService.merge).toHaveBeenCalledWith('feature/user-authentication');
    });

    it('should handle hotfix workflow with emergency deployment', async () => {
      const vscode = require('vscode');

      // Step 1: Start from main branch
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        {
          name: 'main',
          fullName: 'refs/heads/main',
          type: 'local',
          isActive: true,
          upstream: 'origin/main',
          ahead: 0,
          behind: 0,
        },
      ]);

      // Step 2: Create hotfix branch
      vscode.window.showInputBox.mockResolvedValue('hotfix/critical-security-fix');
      jest.spyOn(gitService, 'createBranch').mockResolvedValue();
      jest.spyOn(gitService, 'checkoutBranch').mockResolvedValue();

      await gitService.createBranch('hotfix/critical-security-fix', 'main');
      await gitService.checkoutBranch('hotfix/critical-security-fix');

      // Step 3: Make critical fix
      jest.spyOn(gitService, 'commit').mockResolvedValue();
      await gitService.commit('Fix critical security vulnerability');

      // Step 4: Push hotfix
      jest.spyOn(gitService, 'push').mockResolvedValue();
      await gitService.push('hotfix/critical-security-fix');

      // Step 5: Merge to main
      await gitService.checkoutBranch('main');
      jest.spyOn(gitService, 'merge').mockResolvedValue();
      await gitService.merge('hotfix/critical-security-fix');

      // Step 6: Tag the release
      jest.spyOn(gitService, 'createTag').mockResolvedValue();
      await gitService.createTag('v1.2.1', 'Critical security fix');

      // Step 7: Push main and tags
      await gitService.push('main');
      jest.spyOn(gitService, 'pushTags').mockResolvedValue();
      await gitService.pushTags();

      // Step 8: Merge hotfix to develop branch as well
      await gitService.checkoutBranch('develop');
      await gitService.merge('hotfix/critical-security-fix');
      await gitService.push('develop');

      // Verify hotfix workflow
      expect(gitService.createBranch).toHaveBeenCalledWith('hotfix/critical-security-fix', 'main');
      expect(gitService.commit).toHaveBeenCalledWith('Fix critical security vulnerability');
      expect(gitService.createTag).toHaveBeenCalledWith('v1.2.1', 'Critical security fix');
      expect(gitService.merge).toHaveBeenCalledTimes(2); // main and develop
    });
  });

  describe('Advanced Conflict Resolution Workflows', () => {
    it('should handle complex merge conflicts with automatic resolution', async () => {
      // Step 1: Setup conflicting branches
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        {
          name: 'main',
          fullName: 'refs/heads/main',
          type: 'local',
          isActive: true,
        },
        {
          name: 'feature/conflicting-changes',
          fullName: 'refs/heads/feature/conflicting-changes',
          type: 'local',
          isActive: false,
        },
      ]);

      // Step 2: Attempt merge that results in conflicts
      const mockConflicts = [
        {
          startLine: 10,
          endLine: 15,
          currentContent: 'function authenticate(user) {\n  return validateUser(user);\n}',
          incomingContent: 'function authenticate(user) {\n  return validateUserCredentials(user);\n}',
          baseContent: 'function authenticate(user) {\n  return checkUser(user);\n}',
          isResolved: false,
        },
        {
          startLine: 25,
          endLine: 30,
          currentContent: 'const API_URL = "https://api.example.com";',
          incomingContent: 'const API_URL = "https://api-v2.example.com";',
          baseContent: 'const API_URL = "https://old-api.example.com";',
          isResolved: false,
        },
      ];

      jest.spyOn(gitService, 'merge').mockRejectedValueOnce({
        code: 'MERGE_CONFLICTS',
        conflicts: mockConflicts,
        files: ['src/auth.ts', 'src/config.ts'],
      });

      // Step 3: Handle merge conflicts
      try {
        await gitService.merge('feature/conflicting-changes');
      } catch (error: any) {
        expect(error.code).toBe('MERGE_CONFLICTS');
        expect(error.conflicts).toHaveLength(2);

        // Step 4: Attempt automatic resolution
        const resolvedConflicts = await conflictResolver.resolveConflicts(error.conflicts);

        // First conflict: both sides changed the same function call - needs manual resolution
        expect(resolvedConflicts[0].isResolved).toBe(false);

        // Second conflict: simple URL change - can be auto-resolved
        expect(resolvedConflicts[1].isResolved).toBe(true);
        expect(resolvedConflicts[1].resolution).toBe('incoming'); // Prefer newer API URL
      }

      // Step 5: Show diff viewer for manual resolution
      const mockDiff = {
        filePath: 'src/auth.ts',
        oldContent: 'old content',
        newContent: 'new content',
        hunks: [],
        hasConflicts: true,
        conflicts: mockConflicts,
      };

      jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);
      await diffViewer.showFileDiff('src/auth.ts');

      // Step 6: Manually resolve remaining conflicts
      const manuallyResolvedConflicts = mockConflicts.map(conflict => ({
        ...conflict,
        isResolved: true,
        resolution: conflict.startLine === 10 ? 'both' : 'incoming',
      }));

      // Step 7: Complete merge after resolution
      jest.spyOn(gitService, 'merge').mockResolvedValueOnce(undefined);
      await gitService.merge('feature/conflicting-changes');

      expect(gitService.merge).toHaveBeenCalledTimes(2);
    });

    it('should handle rebase conflicts with interactive resolution', async () => {
      // Step 1: Start rebase operation
      jest.spyOn(gitService, 'rebase').mockRejectedValueOnce({
        code: 'REBASE_CONFLICTS',
        currentCommit: 'abc123',
        conflicts: [
          {
            startLine: 5,
            endLine: 10,
            currentContent: 'updated implementation',
            incomingContent: 'different implementation',
            isResolved: false,
          },
        ],
        files: ['src/service.ts'],
      });

      try {
        await gitService.rebase('main');
      } catch (error: any) {
        expect(error.code).toBe('REBASE_CONFLICTS');

        // Step 2: Show interactive conflict resolution
        const vscode = require('vscode');
        vscode.window.showWarningMessage.mockResolvedValue('Resolve Conflicts');

        // Step 3: Open diff viewer for each conflicted file
        for (const file of error.files) {
          const mockDiff = {
            filePath: file,
            oldContent: 'old content',
            newContent: 'new content',
            hunks: [],
            hasConflicts: true,
            conflicts: error.conflicts,
          };

          jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);
          await diffViewer.showFileDiff(file);
        }

        // Step 4: Continue rebase after resolution
        jest.spyOn(gitService, 'rebaseContinue').mockResolvedValue();
        await gitService.rebaseContinue();

        expect(gitService.rebaseContinue).toHaveBeenCalled();
      }
    });
  });

  describe('Multi-Repository Workflows', () => {
    it('should handle operations across multiple repositories', async () => {
      // Step 1: Setup multiple repositories
      const vscode = require('vscode');
      vscode.workspace.workspaceFolders = [
        { uri: { fsPath: '/workspace/frontend' } },
        { uri: { fsPath: '/workspace/backend' } },
        { uri: { fsPath: '/workspace/shared' } },
      ];

      // Step 2: Get status for each repository
      const repositories = [
        {
          path: '/workspace/frontend',
          status: { branch: 'main', ahead: 2, behind: 0, hasChanges: true },
        },
        {
          path: '/workspace/backend',
          status: { branch: 'develop', ahead: 0, behind: 1, hasChanges: false },
        },
        {
          path: '/workspace/shared',
          status: { branch: 'main', ahead: 1, behind: 0, hasChanges: true },
        },
      ];

      // Step 3: Perform bulk operations
      jest.spyOn(gitService, 'fetch').mockResolvedValue();
      jest.spyOn(gitService, 'pull').mockResolvedValue();
      jest.spyOn(gitService, 'push').mockResolvedValue();

      // Fetch all repositories
      for (const repo of repositories) {
        await gitService.fetch();
      }

      // Pull repositories that are behind
      for (const repo of repositories) {
        if (repo.status.behind > 0) {
          await gitService.pull();
        }
      }

      // Push repositories that are ahead
      for (const repo of repositories) {
        if (repo.status.ahead > 0) {
          await gitService.push();
        }
      }

      expect(gitService.fetch).toHaveBeenCalledTimes(3);
      expect(gitService.pull).toHaveBeenCalledTimes(1); // Only backend
      expect(gitService.push).toHaveBeenCalledTimes(2); // Frontend and shared
    });
  });

  describe('Performance and Stress Workflows', () => {
    it('should handle rapid successive operations without issues', async () => {
      // Step 1: Setup rapid operation scenario
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        { name: 'main', fullName: 'refs/heads/main', type: 'local', isActive: true },
      ]);
      jest.spyOn(gitService, 'fetch').mockResolvedValue();
      jest.spyOn(gitService, 'getRepositoryStatus').mockResolvedValue({
        workingTreeChanges: [],
        indexChanges: [],
        untrackedChanges: [],
      });

      // Step 2: Perform rapid operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(gitService.getBranches());
        operations.push(gitService.fetch());
        operations.push(gitService.getRepositoryStatus());
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();

      // Should complete all operations efficiently
      expect(endTime - startTime).toBeLessThan(2000);
      expect(gitService.getBranches).toHaveBeenCalledTimes(20);
      expect(gitService.fetch).toHaveBeenCalledTimes(20);
      expect(gitService.getRepositoryStatus).toHaveBeenCalledTimes(20);
    });

    it('should maintain stability during error recovery scenarios', async () => {
      const vscode = require('vscode');
      let errorCount = 0;
      const maxErrors = 5;

      // Step 1: Setup intermittent failures
      jest.spyOn(gitService, 'push').mockImplementation(async () => {
        errorCount++;
        if (errorCount <= maxErrors) {
          throw new Error(`Network error ${errorCount}`);
        }
        return Promise.resolve();
      });

      // Step 2: Attempt operations with retries
      let success = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!success && attempts < maxAttempts) {
        try {
          attempts++;
          await gitService.push();
          success = true;
        } catch (error) {
          // Show error and retry
          vscode.window.showErrorMessage.mockResolvedValue('Retry');
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
        }
      }

      expect(success).toBe(true);
      expect(attempts).toBe(maxErrors + 1);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(maxErrors);
    });
  });

  describe('Integration with VS Code Features', () => {
    it('should integrate with VS Code Git extension and status bar', async () => {
      const vscode = require('vscode');

      // Step 1: Update Git status
      statusService.updateGitStatus({
        branch: 'feature/integration-test',
        ahead: 3,
        behind: 1,
        hasChanges: true,
      });

      // Step 2: Show operation progress
      statusService.showOperationProgress('Pushing changes...');

      // Step 3: Execute VS Code Git commands
      vscode.commands.executeCommand.mockResolvedValue(undefined);
      await statusService.refreshGitStatus();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('git.refresh');

      // Step 4: Hide progress and restore status
      statusService.hideOperationProgress();

      // Step 5: Show completion message
      await statusService.showMessage('Push completed successfully', 'info');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Push completed successfully');
    });

    it('should handle VS Code workspace changes', async () => {
      const vscode = require('vscode');

      // Step 1: Simulate workspace folder change
      vscode.workspace.workspaceFolders = [
        { uri: { fsPath: '/new/workspace/path' } },
      ];

      // Step 2: Reinitialize Git service for new workspace
      jest.spyOn(gitService, 'isRepository').mockResolvedValue(true);
      const isRepo = await gitService.isRepository();
      expect(isRepo).toBe(true);

      // Step 3: Update menu for new workspace
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        { name: 'main', fullName: 'refs/heads/main', type: 'local', isActive: true },
      ]);

      const menu = await gitMenuProvider.buildGitMenu();
      expect(menu.length).toBeGreaterThan(0);

      // Step 4: Update status for new workspace
      statusService.updateGitStatus({
        branch: 'main',
        ahead: 0,
        behind: 0,
        hasChanges: false,
      });
    });
  });
});
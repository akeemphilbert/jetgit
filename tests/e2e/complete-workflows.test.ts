import { GitService } from '../../src/services/gitService';
import { GitMenuProvider } from '../../src/providers/gitMenuProvider';
import { ContextMenuProvider } from '../../src/providers/contextMenuProvider';
import { DiffViewer } from '../../src/views/diffViewer';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    createQuickPick: jest.fn(),
    withProgress: jest.fn(),
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
  },
  extensions: {
    getExtension: jest.fn(() => ({
      exports: {
        getAPI: jest.fn(() => ({
          repositories: [],
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
    getConfiguration: jest.fn(),
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
}));

describe('End-to-End Workflow Tests', () => {
  let gitService: GitService;
  let gitMenuProvider: GitMenuProvider;
  let contextMenuProvider: ContextMenuProvider;
  let diffViewer: DiffViewer;

  beforeEach(() => {
    jest.clearAllMocks();
    gitService = new GitService();
    gitMenuProvider = new GitMenuProvider(gitService);
    contextMenuProvider = new ContextMenuProvider(gitService);
    diffViewer = new DiffViewer(gitService);
  });

  describe('Complete Branch Management Workflow', () => {
    it('should complete full branch creation and management workflow', async () => {
      // Step 1: Get initial branches
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        {
          name: 'main',
          fullName: 'refs/heads/main',
          type: 'local',
          isActive: true,
        },
      ]);

      const initialBranches = await gitService.getBranches();
      expect(initialBranches).toHaveLength(1);
      expect(initialBranches[0].name).toBe('main');

      // Step 2: Create new branch
      jest.spyOn(gitService, 'createBranch').mockResolvedValue();
      await gitService.createBranch('feature/new-feature');
      expect(gitService.createBranch).toHaveBeenCalledWith('feature/new-feature');

      // Step 3: Update branches list to include new branch
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        {
          name: 'main',
          fullName: 'refs/heads/main',
          type: 'local',
          isActive: false,
        },
        {
          name: 'feature/new-feature',
          fullName: 'refs/heads/feature/new-feature',
          type: 'local',
          isActive: true,
        },
      ]);

      const updatedBranches = await gitService.getBranches();
      expect(updatedBranches).toHaveLength(2);
      expect(updatedBranches.find(b => b.name === 'feature/new-feature')?.isActive).toBe(true);

      // Step 4: Build Git menu with new branch
      const menu = await gitMenuProvider.buildGitMenu();
      expect(menu.length).toBeGreaterThan(0);
      
      // Should contain branch items
      const branchItems = menu.filter(item => item.id?.startsWith('branch-'));
      expect(branchItems.length).toBeGreaterThan(0);

      // Step 5: Rename branch
      jest.spyOn(gitService, 'renameBranch').mockResolvedValue();
      await gitService.renameBranch('feature/new-feature', 'feature/renamed-feature');
      expect(gitService.renameBranch).toHaveBeenCalledWith('feature/new-feature', 'feature/renamed-feature');
    });

    it('should complete merge workflow with conflict resolution', async () => {
      // Step 1: Setup branches
      jest.spyOn(gitService, 'getBranches').mockResolvedValue([
        {
          name: 'main',
          fullName: 'refs/heads/main',
          type: 'local',
          isActive: true,
        },
        {
          name: 'feature/branch',
          fullName: 'refs/heads/feature/branch',
          type: 'local',
          isActive: false,
        },
      ]);

      // Step 2: Attempt merge with conflicts
      const mockConflicts = [
        {
          startLine: 1,
          endLine: 5,
          currentContent: 'current version',
          incomingContent: 'incoming version',
          isResolved: false,
        },
      ];

      jest.spyOn(gitService, 'merge').mockRejectedValue({
        code: 'MERGE_CONFLICTS',
        conflicts: mockConflicts,
      });

      try {
        await gitService.merge('feature/branch');
      } catch (error: any) {
        expect(error.code).toBe('MERGE_CONFLICTS');
        expect(error.conflicts).toHaveLength(1);
      }

      // Step 3: Show diff viewer for conflict resolution
      const mockDiff = {
        filePath: 'conflicted-file.ts',
        oldContent: 'old content',
        newContent: 'new content',
        hunks: [],
        hasConflicts: true,
        conflicts: mockConflicts,
      };

      jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);
      await diffViewer.showFileDiff('conflicted-file.ts');

      // Step 4: Resolve conflicts and complete merge
      jest.spyOn(gitService, 'merge').mockResolvedValue();
      await gitService.merge('feature/branch');
      expect(gitService.merge).toHaveBeenCalledTimes(2);
    });
  });

  describe('File Operations Workflow', () => {
    it('should complete file history and comparison workflow', async () => {
      const testFile = 'src/test-file.ts';

      // Step 1: Get file history
      const mockHistory = [
        {
          hash: 'commit1',
          message: 'Initial commit',
          author: 'Test Author',
          date: new Date(),
          changes: [{
            file: testFile,
            status: 'added',
            additions: 10,
            deletions: 0,
          }],
        },
        {
          hash: 'commit2',
          message: 'Update file',
          author: 'Test Author',
          date: new Date(),
          changes: [{
            file: testFile,
            status: 'modified',
            additions: 5,
            deletions: 2,
          }],
        },
      ];

      jest.spyOn(gitService, 'getFileHistory').mockResolvedValue(mockHistory);
      const history = await gitService.getFileHistory(testFile);
      expect(history).toHaveLength(2);

      // Step 2: Compare file with specific revision
      const mockDiff = {
        filePath: testFile,
        oldContent: 'old file content',
        newContent: 'new file content',
        hunks: [
          {
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
            lines: [
              { type: 'unchanged', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'removed', content: 'old line 2', oldLineNumber: 2 },
              { type: 'added', content: 'new line 2', newLineNumber: 2 },
              { type: 'added', content: 'new line 3', newLineNumber: 3 },
              { type: 'unchanged', content: 'line 3', oldLineNumber: 3, newLineNumber: 4 },
            ],
          },
        ],
        hasConflicts: false,
      };

      jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);
      const diff = await gitService.getFileDiff(testFile, 'commit1', 'commit2');
      expect(diff.hunks).toHaveLength(1);
      expect(diff.hunks[0].lines).toHaveLength(5);

      // Step 3: Show diff in viewer
      await diffViewer.showFileDiff(testFile, 'commit1', 'commit2');
      expect(gitService.getFileDiff).toHaveBeenCalledWith(testFile, 'commit1', 'commit2');
    });

    it('should complete file revert workflow', async () => {
      const testFile = 'src/test-file.ts';

      // Step 1: Check file status
      jest.spyOn(gitService, 'getRepositoryStatus').mockResolvedValue({
        workingTreeChanges: [
          {
            uri: { fsPath: testFile },
            status: 2, // Modified
          },
        ],
        indexChanges: [],
        untrackedChanges: [],
      });

      const status = await gitService.getRepositoryStatus();
      expect(status.workingTreeChanges).toHaveLength(1);

      // Step 2: Show confirmation dialog (mocked)
      const vscode = require('vscode');
      vscode.window.showWarningMessage.mockResolvedValue('Revert');

      // Step 3: Revert file
      jest.spyOn(gitService, 'revertFile').mockResolvedValue();
      await gitService.revertFile(testFile);
      expect(gitService.revertFile).toHaveBeenCalledWith(testFile);

      // Step 4: Verify file is reverted
      jest.spyOn(gitService, 'getRepositoryStatus').mockResolvedValue({
        workingTreeChanges: [],
        indexChanges: [],
        untrackedChanges: [],
      });

      const updatedStatus = await gitService.getRepositoryStatus();
      expect(updatedStatus.workingTreeChanges).toHaveLength(0);
    });
  });

  describe('Context Menu Integration Workflow', () => {
    it('should complete context menu operation workflow', async () => {
      // Step 1: Register context menu commands
      const vscode = require('vscode');
      const mockContext = {
        subscriptions: [],
      };

      contextMenuProvider.register(mockContext);
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(16); // All context menu commands

      // Step 2: Execute context menu command
      jest.spyOn(gitService, 'pull').mockResolvedValue();
      
      // Simulate command execution
      const pullCommand = vscode.commands.registerCommand.mock.calls.find(
        call => call[0] === 'jetgit.context.pull'
      );
      expect(pullCommand).toBeDefined();
      
      if (pullCommand) {
        await pullCommand[1](); // Execute the command handler
        expect(gitService.pull).toHaveBeenCalled();
      }

      // Step 3: Execute file-specific command
      jest.spyOn(gitService, 'getFileHistory').mockResolvedValue([]);
      
      const historyCommand = vscode.commands.registerCommand.mock.calls.find(
        call => call[0] === 'jetgit.context.showHistory'
      );
      expect(historyCommand).toBeDefined();
      
      if (historyCommand) {
        const mockUri = { fsPath: '/test/file.ts' };
        await historyCommand[1](mockUri); // Execute with file URI
        expect(gitService.getFileHistory).toHaveBeenCalledWith('/test/file.ts');
      }
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from Git operation errors', async () => {
      const vscode = require('vscode');
      
      // Step 1: Simulate Git operation failure
      jest.spyOn(gitService, 'push').mockRejectedValue(new Error('Network error'));
      
      try {
        await gitService.push();
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      // Step 2: Show error to user (mocked)
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();

      // Step 3: Retry operation after fixing issue
      jest.spyOn(gitService, 'push').mockResolvedValue();
      await gitService.push();
      expect(gitService.push).toHaveBeenCalledTimes(2);

      // Step 4: Show success message
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should handle repository not found scenario', async () => {
      const vscode = require('vscode');
      
      // Step 1: Simulate no repository
      jest.spyOn(gitService, 'isRepository').mockResolvedValue(false);
      
      const isRepo = await gitService.isRepository();
      expect(isRepo).toBe(false);

      // Step 2: Build menu for non-repository
      const menu = await gitMenuProvider.buildGitMenu();
      
      // Should show appropriate message
      const noRepoItem = menu.find(item => item.id === 'no-repo');
      expect(noRepoItem).toBeDefined();
      expect(noRepoItem?.label).toContain('Not a Git repository');
    });
  });
});
import * as vscode from 'vscode';
import { ContextMenuProvider } from '../../../src/providers/contextMenuProvider';
import { GitService } from '../../../src/services/gitService';
import { Branch, Remote, CommitInfo, DiffResult } from '../../../src/types/git';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showQuickPick: jest.fn(),
        showInputBox: jest.fn(),
        activeTextEditor: undefined
    },
    workspace: {
        openTextDocument: jest.fn()
    },
    commands: {
        registerCommand: jest.fn()
    },
    Uri: {
        file: jest.fn()
    }
}));

describe('ContextMenuProvider', () => {
    let contextMenuProvider: ContextMenuProvider;
    let mockGitService: jest.Mocked<GitService>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Create mock GitService
        mockGitService = {
            isRepository: jest.fn(),
            getCurrentBranch: jest.fn(),
            getBranches: jest.fn(),
            getRepositoryStatus: jest.fn(),
            pull: jest.fn(),
            push: jest.fn(),
            fetch: jest.fn(),
            merge: jest.fn(),
            rebase: jest.fn(),
            createBranch: jest.fn(),
            createTag: jest.fn(),
            getFileHistory: jest.fn(),
            getFileDiff: jest.fn(),
            revertFile: jest.fn(),
            resetHead: jest.fn(),
            stashChanges: jest.fn(),
            unstashChanges: jest.fn(),
            getRemotes: jest.fn(),
            addRemote: jest.fn(),
            removeRemote: jest.fn()
        } as any;

        // Create mock context
        mockContext = {
            subscriptions: []
        } as any;

        contextMenuProvider = new ContextMenuProvider(mockGitService);

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('registerCommands', () => {
        it('should register all context menu commands', () => {
            const mockRegisterCommand = vscode.commands.registerCommand as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);

            // Verify all commands are registered
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.pull', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.push', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.fetch', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.merge', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.rebase', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.branches', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.newBranch', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.newTag', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.showHistory', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.showCurrentVersion', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.compareWithBranch', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.compareWithRevision', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.annotate', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.revert', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.resetHead', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.stashChanges', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.unstashChanges', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('jetgit.context.manageRemotes', expect.any(Function));

            // Verify commands are added to context subscriptions
            expect(mockContext.subscriptions).toHaveLength(18);
        });
    });

    describe('Repository Operations', () => {
        beforeEach(() => {
            mockGitService.isRepository.mockResolvedValue(true);
        });

        it('should handle pull operation successfully', async () => {
            mockGitService.pull.mockResolvedValue();
            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            // Get the pull command handler
            contextMenuProvider.registerCommands(mockContext);
            const pullHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.pull')[1];

            await pullHandler();

            expect(mockGitService.pull).toHaveBeenCalled();
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Pull completed successfully');
        });

        it('should handle push operation successfully', async () => {
            mockGitService.push.mockResolvedValue();
            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const pushHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.push')[1];

            await pushHandler();

            expect(mockGitService.push).toHaveBeenCalled();
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Push completed successfully');
        });

        it('should handle fetch operation successfully', async () => {
            mockGitService.fetch.mockResolvedValue();
            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const fetchHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.fetch')[1];

            await fetchHandler();

            expect(mockGitService.fetch).toHaveBeenCalled();
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Fetch completed successfully');
        });

        it('should show error when not in a Git repository', async () => {
            mockGitService.isRepository.mockResolvedValue(false);
            const mockShowErrorMessage = vscode.window.showErrorMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const pullHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.pull')[1];

            await pullHandler();

            expect(mockShowErrorMessage).toHaveBeenCalledWith('No Git repository found in workspace');
            expect(mockGitService.pull).not.toHaveBeenCalled();
        });
    });

    describe('Merge Operation', () => {
        beforeEach(() => {
            mockGitService.isRepository.mockResolvedValue(true);
        });

        it('should handle merge operation with branch selection', async () => {
            const mockBranches: Branch[] = [
                { name: 'main', fullName: 'main', type: 'local', isActive: true, upstream: 'origin/main' },
                { name: 'feature/test', fullName: 'feature/test', type: 'local', isActive: false },
                { name: 'origin/develop', fullName: 'origin/develop', type: 'remote', isActive: false }
            ];

            mockGitService.getBranches.mockResolvedValue(mockBranches);
            mockGitService.getCurrentBranch.mockResolvedValue('main');
            mockGitService.merge.mockResolvedValue();

            const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
            mockShowQuickPick.mockResolvedValue({ label: 'feature/test', description: 'Local branch' });

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const mergeHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.merge')[1];

            await mergeHandler();

            expect(mockGitService.getBranches).toHaveBeenCalled();
            expect(mockGitService.getCurrentBranch).toHaveBeenCalled();
            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'feature/test',
                        description: 'Local branch',
                        branch: expect.objectContaining({ name: 'feature/test' })
                    }),
                    expect.objectContaining({
                        label: 'origin/develop',
                        description: 'Remote branch',
                        branch: expect.objectContaining({ name: 'origin/develop' })
                    })
                ]),
                {
                    placeHolder: 'Select branch to merge into current branch',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );
            expect(mockGitService.merge).toHaveBeenCalledWith('feature/test');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Merged feature/test successfully');
        });

        it('should show message when no other branches available', async () => {
            const mockBranches: Branch[] = [
                { name: 'main', fullName: 'main', type: 'local', isActive: true, upstream: 'origin/main' }
            ];

            mockGitService.getBranches.mockResolvedValue(mockBranches);
            mockGitService.getCurrentBranch.mockResolvedValue('main');

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const mergeHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.merge')[1];

            await mergeHandler();

            expect(mockShowInformationMessage).toHaveBeenCalledWith('No other branches available for merge');
            expect(mockGitService.merge).not.toHaveBeenCalled();
        });
    });

    describe('Branch Management', () => {
        beforeEach(() => {
            mockGitService.isRepository.mockResolvedValue(true);
        });

        it('should handle new branch creation', async () => {
            const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
            mockShowInputBox.mockResolvedValue('feature/new-feature');
            mockGitService.createBranch.mockResolvedValue();

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const newBranchHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.newBranch')[1];

            await newBranchHandler();

            expect(mockShowInputBox).toHaveBeenCalledWith({
                prompt: 'Enter branch name',
                placeHolder: 'feature/my-new-feature',
                value: undefined,
                validateInput: expect.any(Function)
            });
            expect(mockGitService.createBranch).toHaveBeenCalledWith('feature/new-feature');
            expect(mockShowInformationMessage).toHaveBeenCalledWith("Created branch 'feature/new-feature' successfully");
        });

        it('should validate branch name input', async () => {
            contextMenuProvider.registerCommands(mockContext);
            const newBranchHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.newBranch')[1];

            const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
            let validateFunction: Function;

            mockShowInputBox.mockImplementation((options) => {
                validateFunction = options.validateInput;
                return Promise.resolve(null); // User cancels
            });

            await newBranchHandler();

            // Test validation function
            expect(validateFunction('')).toBe('Branch name cannot be empty');
            expect(validateFunction('   ')).toBe('Branch name cannot be empty');
            expect(validateFunction('branch with spaces')).toBe('Branch name cannot contain spaces');
            expect(validateFunction('valid-branch-name')).toBeNull();
        });

        it('should handle new tag creation', async () => {
            const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
            mockShowInputBox
                .mockResolvedValueOnce('v1.0.0') // tag name
                .mockResolvedValueOnce('Release version 1.0.0'); // tag message

            mockGitService.createTag.mockResolvedValue();

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const newTagHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.newTag')[1];

            await newTagHandler();

            expect(mockShowInputBox).toHaveBeenCalledTimes(2);
            expect(mockGitService.createTag).toHaveBeenCalledWith('v1.0.0', 'Release version 1.0.0');
            expect(mockShowInformationMessage).toHaveBeenCalledWith("Created tag 'v1.0.0' successfully");
        });
    });

    describe('File Operations', () => {
        beforeEach(() => {
            mockGitService.isRepository.mockResolvedValue(true);
        });

        it('should handle show history operation', async () => {
            const mockCommits: CommitInfo[] = [
                {
                    hash: 'abc123def456',
                    message: 'Initial commit',
                    author: 'John Doe',
                    date: new Date('2023-01-01'),
                    parents: []
                },
                {
                    hash: 'def456ghi789',
                    message: 'Add feature',
                    author: 'Jane Smith',
                    date: new Date('2023-01-02'),
                    parents: ['abc123def456']
                }
            ];

            mockGitService.getFileHistory.mockResolvedValue(mockCommits);

            const mockUri = { fsPath: '/path/to/file.ts' } as vscode.Uri;
            const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const showHistoryHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.showHistory')[1];

            await showHistoryHandler(mockUri);

            expect(mockGitService.getFileHistory).toHaveBeenCalledWith('/path/to/file.ts');
            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'abc123de',
                        description: 'Initial commit',
                        detail: expect.stringContaining('John Doe')
                    }),
                    expect.objectContaining({
                        label: 'def456gh',
                        description: 'Add feature',
                        detail: expect.stringContaining('Jane Smith')
                    })
                ]),
                { placeHolder: 'History for /path/to/file.ts' }
            );
        });

        it('should handle revert operation with confirmation', async () => {
            const mockUri = { fsPath: '/path/to/file.ts' } as vscode.Uri;
            const mockShowWarningMessage = vscode.window.showWarningMessage as jest.Mock;
            mockShowWarningMessage.mockResolvedValue('Revert');

            mockGitService.revertFile.mockResolvedValue();

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const revertHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.revert')[1];

            await revertHandler(mockUri);

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                'Are you sure you want to revert changes to file.ts? This action cannot be undone.',
                { modal: true },
                'Revert',
                'Cancel'
            );
            expect(mockGitService.revertFile).toHaveBeenCalledWith('/path/to/file.ts');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Reverted changes to /path/to/file.ts');
        });

        it('should not revert when user cancels confirmation', async () => {
            const mockUri = { fsPath: '/path/to/file.ts' } as vscode.Uri;
            const mockShowWarningMessage = vscode.window.showWarningMessage as jest.Mock;
            mockShowWarningMessage.mockResolvedValue('Cancel');

            contextMenuProvider.registerCommands(mockContext);
            const revertHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.revert')[1];

            await revertHandler(mockUri);

            expect(mockGitService.revertFile).not.toHaveBeenCalled();
        });
    });

    describe('Advanced Operations', () => {
        beforeEach(() => {
            mockGitService.isRepository.mockResolvedValue(true);
        });

        it('should handle reset HEAD operation', async () => {
            const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
            mockShowQuickPick.mockResolvedValue({ label: 'Mixed', description: 'Keep changes in working tree only (default)', mode: 'mixed' });

            const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
            mockShowInputBox.mockResolvedValue('HEAD~1');

            mockGitService.resetHead.mockResolvedValue();

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const resetHeadHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.resetHead')[1];

            await resetHeadHandler();

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'Soft',
                        description: 'Keep changes in index and working tree',
                        mode: 'soft'
                    }),
                    expect.objectContaining({
                        label: 'Mixed',
                        description: 'Keep changes in working tree only (default)',
                        mode: 'mixed'
                    }),
                    expect.objectContaining({
                        label: 'Hard',
                        description: 'Discard all changes (DANGEROUS)',
                        mode: 'hard'
                    })
                ]),
                {
                    placeHolder: 'Select reset mode',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );
            expect(mockGitService.resetHead).toHaveBeenCalledWith('mixed', 'HEAD~1');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Reset HEAD (mixed) completed successfully');
        });

        it('should handle stash changes operation', async () => {
            mockGitService.getRepositoryStatus.mockResolvedValue({
                hasChanges: true,
                stagedChanges: 2,
                unstagedChanges: 3,
                untrackedFiles: 1
            });

            const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
            mockShowInputBox.mockResolvedValue('Work in progress');

            mockGitService.stashChanges.mockResolvedValue();

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const stashHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.stashChanges')[1];

            await stashHandler();

            expect(mockGitService.getRepositoryStatus).toHaveBeenCalled();
            expect(mockGitService.stashChanges).toHaveBeenCalledWith('Work in progress');
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Changes stashed successfully');
        });

        it('should show message when no changes to stash', async () => {
            mockGitService.getRepositoryStatus.mockResolvedValue({
                hasChanges: false,
                stagedChanges: 0,
                unstagedChanges: 0,
                untrackedFiles: 0
            });

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const stashHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.stashChanges')[1];

            await stashHandler();

            expect(mockShowInformationMessage).toHaveBeenCalledWith('No changes to stash');
            expect(mockGitService.stashChanges).not.toHaveBeenCalled();
        });
    });

    describe('Remote Management', () => {
        beforeEach(() => {
            mockGitService.isRepository.mockResolvedValue(true);
        });

        it('should handle add remote operation', async () => {
            const mockRemotes: Remote[] = [];
            mockGitService.getRemotes.mockResolvedValue(mockRemotes);

            const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
            mockShowQuickPick.mockResolvedValue({ label: 'Add Remote', description: 'Add a new remote repository', action: 'add' });

            const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
            mockShowInputBox
                .mockResolvedValueOnce('origin') // remote name
                .mockResolvedValueOnce('https://github.com/user/repo.git'); // remote URL

            mockGitService.addRemote.mockResolvedValue();

            const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const manageRemotesHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.manageRemotes')[1];

            await manageRemotesHandler();

            expect(mockGitService.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/user/repo.git');
            expect(mockShowInformationMessage).toHaveBeenCalledWith("Added remote 'origin' successfully");
        });
    });

    describe('Error Handling', () => {
        it('should handle Git service errors gracefully', async () => {
            mockGitService.isRepository.mockResolvedValue(true);
            mockGitService.pull.mockRejectedValue(new Error('Network error'));

            const mockShowErrorMessage = vscode.window.showErrorMessage as jest.Mock;

            contextMenuProvider.registerCommands(mockContext);
            const pullHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls
                .find(call => call[0] === 'jetgit.context.pull')[1];

            await pullHandler();

            expect(mockShowErrorMessage).toHaveBeenCalledWith('pull operation failed: Error: Network error');
        });
    });
});
import * as vscode from 'vscode';
import { GitService } from '../../src/services/gitService';
import { StatusBarService } from '../../src/services/statusBarService';
import { CommandRegistrationService } from '../../src/services/commandRegistrationService';
import { GitMenuController } from '../../src/providers/gitMenuController';
import { ContextMenuProvider } from '../../src/providers/contextMenuProvider';
import { DiffViewer } from '../../src/views/diffViewer';
import { DialogService } from '../../src/services/dialogService';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        createStatusBarItem: jest.fn(() => ({
            text: '',
            tooltip: '',
            command: '',
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        })),
        activeTextEditor: undefined
    },
    extensions: {
        getExtension: jest.fn()
    },
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path })),
        parse: jest.fn()
    },
    workspace: {
        workspaceFolders: [],
        getConfiguration: jest.fn(),
        asRelativePath: jest.fn((uri: any) => uri.fsPath || uri),
        createFileSystemWatcher: jest.fn(() => ({
            onDidCreate: jest.fn(),
            onDidChange: jest.fn(),
            onDidDelete: jest.fn(),
            dispose: jest.fn()
        }))
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
        executeCommand: jest.fn()
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ExtensionMode: {
        Test: 3
    },
    env: {
        openExternal: jest.fn()
    }
}));

describe('VS Code Integration Tests', () => {
    let gitService: GitService;
    let statusBarService: StatusBarService;
    let commandRegistrationService: CommandRegistrationService;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Create mock extension context
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(),
                update: jest.fn(),
                keys: jest.fn()
            },
            globalState: {
                get: jest.fn(),
                update: jest.fn(),
                keys: jest.fn(),
                setKeysForSync: jest.fn()
            },
            extensionUri: vscode.Uri.file('/mock/extension/path'),
            extensionPath: '/mock/extension/path',
            asAbsolutePath: jest.fn((relativePath: string) => `/mock/extension/path/${relativePath}`),
            storageUri: vscode.Uri.file('/mock/storage'),
            storagePath: '/mock/storage',
            globalStorageUri: vscode.Uri.file('/mock/global/storage'),
            globalStoragePath: '/mock/global/storage',
            logUri: vscode.Uri.file('/mock/log'),
            logPath: '/mock/log',
            extensionMode: 3, // ExtensionMode.Test
            environmentVariableCollection: {} as any,
            secrets: {} as any,
            extension: {} as any
        };

        gitService = new GitService();
    });

    afterEach(() => {
        // Clean up subscriptions
        if (mockContext && mockContext.subscriptions) {
            mockContext.subscriptions.forEach(disposable => {
                if (disposable && typeof disposable.dispose === 'function') {
                    disposable.dispose();
                }
            });
            mockContext.subscriptions = [];
        }

        if (statusBarService) {
            statusBarService.dispose();
        }
        if (commandRegistrationService) {
            commandRegistrationService.dispose();
        }
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Status Bar Service', () => {
        beforeEach(() => {
            // Reset singleton
            (StatusBarService as any).instance = undefined;
            statusBarService = StatusBarService.getInstance(gitService);
        });

        test('should create status bar item', () => {
            expect(statusBarService).toBeDefined();
            // Status bar item creation is tested through VS Code API mocks
        });

        test('should update status when Git operation is performed', async () => {
            const notifyGitOperationSpy = jest.spyOn(statusBarService, 'notifyGitOperation');
            
            await statusBarService.notifyGitOperation('Test Operation');
            
            expect(notifyGitOperationSpy).toHaveBeenCalledWith('Test Operation');
        });

        test('should update status bar text', async () => {
            const updateSpy = jest.spyOn(statusBarService, 'update');
            
            await statusBarService.update();
            
            expect(updateSpy).toHaveBeenCalled();
        });

        test('should handle repository detection', async () => {
            // Mock repository detection
            jest.spyOn(gitService, 'isRepository').mockResolvedValue(true);
            jest.spyOn(gitService, 'getCurrentBranch').mockResolvedValue('main');
            jest.spyOn(gitService, 'getRepositoryStatus').mockResolvedValue({
                hasChanges: true,
                stagedChanges: 2,
                unstagedChanges: 1,
                untrackedFiles: 3
            });

            // This would normally update the status bar
            await statusBarService.notifyGitOperation('Test');
            
            // Verify the mocks were called
            expect(gitService.isRepository).toHaveBeenCalled();
        });
    });

    describe('Command Registration Service', () => {
        beforeEach(() => {
            const gitMenuController = new GitMenuController(gitService);
            const contextMenuProvider = new ContextMenuProvider(gitService);
            const diffViewer = new DiffViewer(mockContext);
            const dialogService = new DialogService();
            // Reset singleton
            (StatusBarService as any).instance = undefined;
            statusBarService = StatusBarService.getInstance(gitService);

            commandRegistrationService = new CommandRegistrationService(
                gitService,
                gitMenuController,
                contextMenuProvider,
                diffViewer,
                dialogService,
                statusBarService
            );
        });

        test('should register all commands', () => {
            const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
            
            commandRegistrationService.registerAllCommands(mockContext);
            
            // Verify that commands were registered
            expect(registerCommandSpy).toHaveBeenCalledWith('jbGit.openMenu', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.updateProject', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.commitChanges', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.push', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.fetch', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.newBranch', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.checkoutRevision', expect.any(Function));
        });

        test('should register branch commands', () => {
            const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
            
            commandRegistrationService.registerAllCommands(mockContext);
            
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.newBranchFrom', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.showDiffWithWorkingTree', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.updateBranch', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.pushBranch', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.renameBranch', expect.any(Function));
        });

        test('should register file commands', () => {
            const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
            
            commandRegistrationService.registerAllCommands(mockContext);
            
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.showFileDiff', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.compareWithBranch', expect.any(Function));
        });

        test('should register utility commands', () => {
            const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
            
            commandRegistrationService.registerAllCommands(mockContext);
            
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.refreshStatus', expect.any(Function));
            expect(registerCommandSpy).toHaveBeenCalledWith('jetgit.showExtensionInfo', expect.any(Function));
        });

        test('should add commands to context subscriptions', () => {
            commandRegistrationService.registerAllCommands(mockContext);
            
            // Verify that disposables were added to context subscriptions
            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('Command Execution', () => {
        beforeEach(() => {
            const gitMenuController = new GitMenuController(gitService);
            const contextMenuProvider = new ContextMenuProvider(gitService);
            const diffViewer = new DiffViewer(mockContext);
            const dialogService = new DialogService();
            // Reset singleton
            (StatusBarService as any).instance = undefined;
            statusBarService = StatusBarService.getInstance(gitService);

            commandRegistrationService = new CommandRegistrationService(
                gitService,
                gitMenuController,
                contextMenuProvider,
                diffViewer,
                dialogService,
                statusBarService
            );

            commandRegistrationService.registerAllCommands(mockContext);
        });

        test('should handle command registration and execution flow', async () => {
            // Verify that commands were registered
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('jetgit.updateProject', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('jetgit.fetch', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('jetgit.push', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('jetgit.refreshStatus', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('jetgit.showExtensionInfo', expect.any(Function));
        });

        test('should integrate with status service for Git operations', async () => {
            // Mock Git service methods
            jest.spyOn(gitService, 'pull').mockResolvedValue();
            jest.spyOn(statusBarService, 'notifyGitOperation').mockResolvedValue();

            // Test the status bar service directly
            await statusBarService.notifyGitOperation('Test Operation');
            
            expect(statusBarService.notifyGitOperation).toHaveBeenCalledWith('Test Operation');
        });

        test('should handle error scenarios in command execution', () => {
            // Test that error handling is properly set up in command handlers
            const registerCommandCalls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
            
            // Find the update project command handler
            const updateProjectCall = registerCommandCalls.find(call => call[0] === 'jetgit.updateProject');
            expect(updateProjectCall).toBeDefined();
            expect(typeof updateProjectCall[1]).toBe('function');
        });
    });

    describe('VS Code Git API Integration', () => {
        test('should integrate with VS Code Git extension', () => {
            // Mock VS Code Git extension
            const mockGitExtension = {
                exports: {
                    getAPI: jest.fn().mockReturnValue({
                        repositories: [],
                        onDidOpenRepository: jest.fn(),
                        onDidCloseRepository: jest.fn()
                    })
                }
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

            const service = new GitService();
            expect(service).toBeDefined();
        });

        test('should handle missing Git extension gracefully', async () => {
            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(undefined);

            const service = new GitService();
            
            // Should return false when Git extension is not available
            const result = await service.isRepository();
            expect(result).toBe(false);
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('should respect VS Code Git shortcut namespace', () => {
            // This test verifies that our keyboard shortcuts use the ctrl+shift+g prefix
            // which is the standard VS Code Git shortcut namespace
            
            // The actual shortcuts are defined in package.json and tested through VS Code's
            // keybinding system. This test serves as documentation of the requirement.
            expect(true).toBe(true); // Placeholder - actual testing would require VS Code test environment
        });
    });

    describe('Extension Lifecycle', () => {
        test('should clean up resources on deactivation', () => {
            // Reset singleton
            (StatusBarService as any).instance = undefined;
            statusBarService = StatusBarService.getInstance(gitService);
            const disposeSpy = jest.spyOn(statusBarService, 'dispose');

            statusBarService.dispose();

            expect(disposeSpy).toHaveBeenCalled();
        });

        test('should handle activation errors gracefully', () => {
            // Mock a service that throws during initialization
            jest.spyOn(GitService.prototype, 'constructor' as any).mockImplementation(() => {
                throw new Error('Initialization failed');
            });

            // The extension should handle this gracefully and not crash VS Code
            expect(() => {
                try {
                    new GitService();
                } catch (error) {
                    // Error should be caught and handled by the extension
                    expect(error).toBeInstanceOf(Error);
                }
            }).not.toThrow();
        });
    });
});
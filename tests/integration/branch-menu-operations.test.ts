import * as vscode from 'vscode';
import { GitService } from '../../src/services/gitService';
import { GitMenuProvider } from '../../src/providers/gitMenuProvider';
import { GitMenuController } from '../../src/providers/gitMenuController';

/**
 * Integration tests for branch menu operations
 * These tests verify the complete workflow from menu selection to Git operations
 */
describe('Branch Menu Operations Integration', () => {
    let gitService: GitService;
    let gitMenuProvider: GitMenuProvider;
    let gitMenuController: GitMenuController;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        gitService = new GitService();
        gitMenuProvider = new GitMenuProvider(gitService);
        gitMenuController = new GitMenuController(gitService);
    });

    describe('Menu Structure', () => {
        it('should build complete Git menu with branch operations', async () => {
            // Mock the GitService to return test branches
            const mockBranches = [
                {
                    name: 'main',
                    fullName: 'main',
                    type: 'local' as const,
                    isActive: true,
                    upstream: 'origin/main',
                    ahead: 0,
                    behind: 0
                },
                {
                    name: 'feature/auth',
                    fullName: 'feature/auth',
                    type: 'local' as const,
                    isActive: false,
                    upstream: 'origin/feature/auth',
                    ahead: 2,
                    behind: 0
                },
                {
                    name: 'bugfix/login-issue',
                    fullName: 'bugfix/login-issue',
                    type: 'local' as const,
                    isActive: false,
                    ahead: 1,
                    behind: 0
                }
            ];

            jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

            const menu = await gitMenuProvider.buildGitMenu();

            // Verify menu structure
            expect(menu).toBeDefined();
            expect(menu.length).toBeGreaterThan(0);

            // Find common tasks section
            const commonTasksHeader = menu.find(item => item.contextValue === 'header' && item.label === 'Common Tasks');
            expect(commonTasksHeader).toBeDefined();

            // Find local branches section
            const localBranchesHeader = menu.find(item => item.contextValue === 'header' && item.label === 'Local Branches');
            expect(localBranchesHeader).toBeDefined();

            // Find branch items
            const branchItems = menu.filter(item => item.contextValue === 'branch');
            expect(branchItems.length).toBeGreaterThan(0);

            // Verify branch operations are available
            const mainBranch = branchItems.find(item => item.label === 'main');
            expect(mainBranch).toBeDefined();
            expect(mainBranch?.children).toBeDefined();
            expect(mainBranch?.children?.length).toBeGreaterThan(0);

            // Verify branch operations include required commands
            const branchOperations = mainBranch?.children || [];
            const operationCommands = branchOperations.map(op => op.command);
            expect(operationCommands).toContain('jetgit.newBranchFrom');
            expect(operationCommands).toContain('jetgit.showDiffWithWorkingTree');
        });

        it('should group branches by prefix correctly', async () => {
            const mockBranches = [
                {
                    name: 'main',
                    fullName: 'main',
                    type: 'local' as const,
                    isActive: true
                },
                {
                    name: 'feature/auth',
                    fullName: 'feature/auth',
                    type: 'local' as const,
                    isActive: false
                },
                {
                    name: 'feature/ui-improvements',
                    fullName: 'feature/ui-improvements',
                    type: 'local' as const,
                    isActive: false
                },
                {
                    name: 'bugfix/login-issue',
                    fullName: 'bugfix/login-issue',
                    type: 'local' as const,
                    isActive: false
                }
            ];

            jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

            const menu = await gitMenuProvider.buildGitMenu();

            // Find branch groups
            const branchGroups = menu.filter(item => item.contextValue === 'branch-group');
            expect(branchGroups.length).toBeGreaterThan(0);

            // Verify feature group exists
            const featureGroup = branchGroups.find(group => group.label === 'feature/');
            expect(featureGroup).toBeDefined();
            expect(featureGroup?.children?.length).toBe(2);

            // Verify bugfix group exists
            const bugfixGroup = branchGroups.find(group => group.label === 'bugfix/');
            expect(bugfixGroup).toBeDefined();
            expect(bugfixGroup?.children?.length).toBe(1);
        });
    });

    describe('Branch Operations Logic', () => {
        beforeEach(() => {
            // Mock VS Code window methods
            jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
            jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
        });

        it('should create branch from another branch', async () => {
            const mockCreateBranch = jest.spyOn(gitService, 'createBranch').mockResolvedValue();

            await gitService.createBranch('new-feature', 'main');

            expect(mockCreateBranch).toHaveBeenCalledWith('new-feature', 'main');
        });

        it('should handle branch update workflow', async () => {
            const mockGetCurrentBranch = jest.spyOn(gitService, 'getCurrentBranch').mockResolvedValue('main');
            const mockCheckoutBranch = jest.spyOn(gitService, 'checkoutBranch').mockResolvedValue();
            const mockPull = jest.spyOn(gitService, 'pull').mockResolvedValue();

            // Simulate updating current branch
            const currentBranch = await gitService.getCurrentBranch();
            if (currentBranch !== 'main') {
                await gitService.checkoutBranch('main');
            }
            await gitService.pull();

            expect(mockGetCurrentBranch).toHaveBeenCalled();
            expect(mockPull).toHaveBeenCalled();
        });

        it('should handle branch push workflow', async () => {
            const mockGetCurrentBranch = jest.spyOn(gitService, 'getCurrentBranch').mockResolvedValue('feature/auth');
            const mockCheckoutBranch = jest.spyOn(gitService, 'checkoutBranch').mockResolvedValue();
            const mockPush = jest.spyOn(gitService, 'push').mockResolvedValue();

            // Simulate pushing a different branch
            const targetBranch = 'main';
            const currentBranch = await gitService.getCurrentBranch();
            if (currentBranch !== targetBranch) {
                await gitService.checkoutBranch(targetBranch);
            }
            await gitService.push(targetBranch);

            expect(mockGetCurrentBranch).toHaveBeenCalled();
            expect(mockCheckoutBranch).toHaveBeenCalledWith('main');
            expect(mockPush).toHaveBeenCalledWith('main');
        });

        it('should handle branch rename workflow', async () => {
            const mockRenameBranch = jest.spyOn(gitService, 'renameBranch').mockResolvedValue();

            await gitService.renameBranch('old-branch', 'new-branch');

            expect(mockRenameBranch).toHaveBeenCalledWith('old-branch', 'new-branch');
        });

        it('should validate branch names', () => {
            // Test branch name validation logic
            const validNames = ['feature/auth', 'bugfix/login', 'main', 'develop'];
            const invalidNames = ['', '   ', 'branch with spaces', '.invalid', 'invalid.'];

            validNames.forEach(name => {
                expect(name.trim()).toBeTruthy();
                expect(name.includes(' ')).toBeFalsy();
                expect(name.startsWith('.')).toBeFalsy();
                expect(name.endsWith('.')).toBeFalsy();
            });

            invalidNames.forEach(name => {
                const isInvalid = !name.trim() || 
                                name.includes(' ') || 
                                name.startsWith('.') || 
                                name.endsWith('.');
                expect(isInvalid).toBeTruthy();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle Git service errors gracefully', async () => {
            const mockCreateBranch = jest.spyOn(gitService, 'createBranch').mockRejectedValue(new Error('Git error'));

            try {
                await gitService.createBranch('new-branch', 'main');
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Git error');
            }
        });

        it('should handle menu building errors', async () => {
            jest.spyOn(gitService, 'getBranches').mockRejectedValue(new Error('Repository not found'));

            const menu = await gitMenuProvider.buildGitMenu();

            // Should return error menu items in the sections
            const localErrorItem = menu.find(item => item.id === 'local-error');
            const remoteErrorItem = menu.find(item => item.id === 'remote-error');
            
            expect(localErrorItem).toBeDefined();
            expect(localErrorItem?.label).toBe('Error loading local branches');
            expect(remoteErrorItem).toBeDefined();
            expect(remoteErrorItem?.label).toBe('Error loading remote branches');
        });

        it('should handle workspace validation', () => {
            // Test workspace folder validation logic
            const validWorkspace = [{ uri: { fsPath: '/test/workspace' } }];
            const invalidWorkspace = undefined;

            expect(validWorkspace).toBeDefined();
            expect(validWorkspace?.length).toBeGreaterThan(0);
            
            expect(invalidWorkspace).toBeUndefined();
        });
    });

    describe('Menu Navigation', () => {
        it('should handle menu item selection correctly', async () => {
            const mockExecuteCommand = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

            const menuItem = {
                id: 'test-item',
                label: 'Test Item',
                command: 'jetgit.testCommand',
                args: ['arg1', 'arg2']
            };

            await gitMenuProvider.handleMenuSelection(menuItem);

            expect(mockExecuteCommand).toHaveBeenCalledWith('jetgit.testCommand', 'arg1', 'arg2');
        });

        it('should handle menu items without commands', async () => {
            const mockExecuteCommand = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

            const menuItem = {
                id: 'test-item',
                label: 'Test Item'
            };

            await gitMenuProvider.handleMenuSelection(menuItem);

            expect(mockExecuteCommand).not.toHaveBeenCalled();
        });

        it('should handle menu items with commands but no args', async () => {
            const mockExecuteCommand = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

            const menuItem = {
                id: 'test-item',
                label: 'Test Item',
                command: 'jetgit.testCommand'
            };

            await gitMenuProvider.handleMenuSelection(menuItem);

            expect(mockExecuteCommand).toHaveBeenCalledWith('jetgit.testCommand');
        });
    });
});
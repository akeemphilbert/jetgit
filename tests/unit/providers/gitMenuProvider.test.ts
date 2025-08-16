import { GitMenuProvider } from '../../../src/providers/gitMenuProvider';
import { GitService } from '../../../src/services/gitService';
import { Branch } from '../../../src/types/git';

// Mock VS Code module
jest.mock('vscode', () => ({
    ThemeIcon: jest.fn().mockImplementation((id: string) => ({ id })),
    window: {
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn()
    },
    commands: {
        executeCommand: jest.fn()
    }
}));

// Mock GitService
jest.mock('../../../src/services/gitService');

describe('GitMenuProvider', () => {
    let gitMenuProvider: GitMenuProvider;
    let mockGitService: jest.Mocked<GitService>;

    beforeEach(() => {
        mockGitService = new GitService() as jest.Mocked<GitService>;
        gitMenuProvider = new GitMenuProvider(mockGitService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('buildGitMenu', () => {
        it('should return "not a repository" message when not in a Git repository', async () => {
            mockGitService.isRepository.mockResolvedValue(false);

            const menu = await gitMenuProvider.buildGitMenu();

            expect(menu).toHaveLength(1);
            expect(menu[0].id).toBe('no-repo');
            expect(menu[0].label).toBe('Not a Git repository');
        });

        it('should build complete menu structure when in a Git repository', async () => {
            mockGitService.isRepository.mockResolvedValue(true);
            mockGitService.getRepositoryStatus.mockResolvedValue({
                hasChanges: true,
                stagedChanges: 2,
                unstagedChanges: 3,
                untrackedFiles: 1
            });
            mockGitService.getCurrentBranch.mockResolvedValue('main');

            const menu = await gitMenuProvider.buildGitMenu();

            // Should have common tasks, separator, and branch sections
            expect(menu.length).toBeGreaterThan(5);
            
            // Check for common tasks section
            const commonTasksHeader = menu.find(item => item.id === 'common-tasks-header');
            expect(commonTasksHeader).toBeDefined();
            expect(commonTasksHeader?.label).toBe('Common Tasks');

            // Check for specific common task items
            const updateProject = menu.find(item => item.id === 'update-project');
            expect(updateProject).toBeDefined();
            expect(updateProject?.command).toBe('jetgit.updateProject');

            const commitChanges = menu.find(item => item.id === 'commit-changes');
            expect(commitChanges).toBeDefined();
            expect(commitChanges?.description).toBe('5 changes');

            // Check for separator
            const separator = menu.find(item => item.contextValue === 'separator');
            expect(separator).toBeDefined();

            // Check for branch sections
            const localBranchesHeader = menu.find(item => item.id === 'local-branches-header');
            expect(localBranchesHeader).toBeDefined();
            expect(localBranchesHeader?.label).toBe('Local Branches');
        });

        it('should handle errors gracefully', async () => {
            mockGitService.isRepository.mockRejectedValue(new Error('Test error'));

            const menu = await gitMenuProvider.buildGitMenu();

            expect(menu).toHaveLength(1);
            expect(menu[0].id).toBe('error');
            expect(menu[0].label).toContain('Error: Error: Test error');
        });
    });

    describe('buildCommonTasksSection', () => {
        it('should build common tasks with correct status information', async () => {
            mockGitService.isRepository.mockResolvedValue(true);
            mockGitService.getRepositoryStatus.mockResolvedValue({
                hasChanges: true,
                stagedChanges: 1,
                unstagedChanges: 2,
                untrackedFiles: 1
            });
            mockGitService.getCurrentBranch.mockResolvedValue('main');

            const provider = new GitMenuProvider(mockGitService);
            const menu = await provider.buildGitMenu();
            
            // Find commit changes item
            const commitChanges = menu.find(item => item.id === 'commit-changes');
            expect(commitChanges).toBeDefined();
            expect(commitChanges?.description).toBe('3 changes');
        });

        it('should show "No changes" when repository is clean', async () => {
            mockGitService.isRepository.mockResolvedValue(true);
            mockGitService.getRepositoryStatus.mockResolvedValue({
                hasChanges: false,
                stagedChanges: 0,
                unstagedChanges: 0,
                untrackedFiles: 0
            });
            mockGitService.getCurrentBranch.mockResolvedValue('main');

            const provider = new GitMenuProvider(mockGitService);
            const menu = await provider.buildGitMenu();
            
            // Find commit changes item
            const commitChanges = menu.find(item => item.id === 'commit-changes');
            expect(commitChanges).toBeDefined();
            expect(commitChanges?.description).toBe('No changes');
        });
    });

    describe('groupBranches', () => {
        it('should group branches by prefix correctly', async () => {
            const branches: Branch[] = [
                {
                    name: 'main',
                    fullName: 'main',
                    type: 'local',
                    isActive: true
                },
                {
                    name: 'feature/auth',
                    fullName: 'feature/auth',
                    type: 'local',
                    isActive: false
                },
                {
                    name: 'feature/ui',
                    fullName: 'feature/ui',
                    type: 'local',
                    isActive: false
                },
                {
                    name: 'bugfix/login',
                    fullName: 'bugfix/login',
                    type: 'local',
                    isActive: false
                }
            ];

            // Access private method for testing
            const groupBranches = (gitMenuProvider as any).groupBranches.bind(gitMenuProvider);
            const groups = groupBranches(branches);

            expect(groups).toHaveLength(3); // ungrouped, feature/, bugfix/
            
            // Check ungrouped branches
            const ungrouped = groups.find((g: any) => g.prefix === '');
            expect(ungrouped?.branches).toHaveLength(1);
            expect(ungrouped?.branches[0].name).toBe('main');

            // Check feature group
            const featureGroup = groups.find((g: any) => g.prefix === 'feature/');
            expect(featureGroup?.branches).toHaveLength(2);
            expect(featureGroup?.branches.map((b: Branch) => b.name)).toContain('feature/auth');
            expect(featureGroup?.branches.map((b: Branch) => b.name)).toContain('feature/ui');

            // Check bugfix group
            const bugfixGroup = groups.find((g: any) => g.prefix === 'bugfix/');
            expect(bugfixGroup?.branches).toHaveLength(1);
            expect(bugfixGroup?.branches[0].name).toBe('bugfix/login');
        });
    });

    describe('buildBranchMenuItem', () => {
        it('should build branch menu item with correct formatting for active branch', async () => {
            const branch: Branch = {
                name: 'main',
                fullName: 'main',
                type: 'local',
                isActive: true,
                ahead: 2,
                behind: 1
            };

            // Access private method for testing
            const buildBranchMenuItem = (gitMenuProvider as any).buildBranchMenuItem.bind(gitMenuProvider);
            const menuItem = buildBranchMenuItem(branch, 'main');

            expect(menuItem.id).toBe('branch-main');
            expect(menuItem.label).toBe('● main');
            expect(menuItem.description).toBe('↑2 ↓1');
            expect(menuItem.contextValue).toBe('branch');
            expect(menuItem.children).toHaveLength(5); // 5 branch operations
        });

        it('should build branch menu item with correct formatting for inactive branch', async () => {
            const branch: Branch = {
                name: 'feature/auth',
                fullName: 'feature/auth',
                type: 'local',
                isActive: false,
                ahead: 3
            };

            // Access private method for testing
            const buildBranchMenuItem = (gitMenuProvider as any).buildBranchMenuItem.bind(gitMenuProvider);
            const menuItem = buildBranchMenuItem(branch, 'main');

            expect(menuItem.id).toBe('branch-feature/auth');
            expect(menuItem.label).toBe('feature/auth');
            expect(menuItem.description).toBe('↑3');
            expect(menuItem.contextValue).toBe('branch');
        });
    });

    describe('handleMenuSelection', () => {
        it('should execute command when menu item has a command', async () => {
            const vscode = require('vscode');
            const menuItem = {
                id: 'test',
                label: 'Test',
                command: 'test.command',
                args: ['arg1', 'arg2']
            };

            await gitMenuProvider.handleMenuSelection(menuItem);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('test.command', 'arg1', 'arg2');
        });

        it('should execute command without args when no args provided', async () => {
            const vscode = require('vscode');
            const menuItem = {
                id: 'test',
                label: 'Test',
                command: 'test.command'
            };

            await gitMenuProvider.handleMenuSelection(menuItem);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('test.command');
        });

        it('should handle command execution errors', async () => {
            const vscode = require('vscode');
            vscode.commands.executeCommand.mockRejectedValue(new Error('Command failed'));
            
            const menuItem = {
                id: 'test',
                label: 'Test',
                command: 'test.command'
            };

            await gitMenuProvider.handleMenuSelection(menuItem);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to execute command: Error: Command failed');
        });
    });
});
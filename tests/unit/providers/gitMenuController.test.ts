import { MenuController } from '../../../src/providers/gitMenuController';
import { GitService } from '../../../src/services/gitService';
import { RepoContextService } from '../../../src/services/repoContextService';
import { Repository, Branch } from '../../../src/types/git';

// Mock VS Code module
const mockQuickPick = {
    title: '',
    placeholder: '',
    canSelectMany: false,
    matchOnDescription: true,
    matchOnDetail: true,
    items: [],
    buttons: [],
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
    onDidChangeSelection: jest.fn(),
    onDidTriggerButton: jest.fn(),
    onDidHide: jest.fn()
};

jest.mock('vscode', () => ({
    ThemeIcon: jest.fn().mockImplementation((id: string) => ({ id })),
    window: {
        createQuickPick: jest.fn(() => mockQuickPick),
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn()
    },
    QuickPickItemKind: {
        Separator: -1
    },
    commands: {
        executeCommand: jest.fn()
    },
    Uri: {
        parse: jest.fn()
    }
}));

// Mock services
jest.mock('../../../src/services/gitService');
jest.mock('../../../src/services/repoContextService');

describe('MenuController', () => {
    let menuController: MenuController;
    let mockGitService: jest.Mocked<GitService>;
    let mockRepoContextService: jest.Mocked<RepoContextService>;

    beforeEach(() => {
        mockGitService = new GitService() as jest.Mocked<GitService>;
        mockRepoContextService = {
            listRepositories: jest.fn(),
            getActiveRepository: jest.fn(),
            setActiveRepository: jest.fn(),
            getMRUBranches: jest.fn(),
            addToMRU: jest.fn()
        } as any;
        
        menuController = new MenuController(mockGitService, mockRepoContextService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('open', () => {
        it('should show single-repo layout when one repository exists', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue([]);
            mockGitService.getBranches.mockResolvedValue([]);

            await menuController.open();

            expect(mockQuickPick.title).toBe('Git (test-repo)');
            expect(mockQuickPick.placeholder).toBe('Search for branches and actions');
            expect(mockQuickPick.show).toHaveBeenCalled();
        });

        it('should show multi-repo layout when multiple repositories exist', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: { fsPath: '/test/repo1' } as any,
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: { fsPath: '/test/repo2' } as any,
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: true
                }
            ];

            mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);

            await menuController.open();

            expect(mockQuickPick.title).toBe('Git (2 repositories)');
            expect(mockQuickPick.placeholder).toBe('Search for branches and actions');
            expect(mockQuickPick.show).toHaveBeenCalled();
        });

        it('should show info message when no repositories exist', async () => {
            const vscode = require('vscode');
            mockRepoContextService.listRepositories.mockReturnValue([]);

            await menuController.open();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No Git repositories found in workspace');
            expect(mockQuickPick.show).not.toHaveBeenCalled();
        });

        it('should handle errors when opening menu', async () => {
            const vscode = require('vscode');
            mockRepoContextService.listRepositories.mockImplementation(() => {
                throw new Error('Failed to list repositories');
            });

            await menuController.open();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to open Git menu: Error: Failed to list repositories');
        });
    });

    describe('single-repo layout', () => {
        it('should create top actions correctly', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue([]);
            mockGitService.getBranches.mockResolvedValue([]);

            await menuController.open();

            const items = mockQuickPick.items;
            
            // Check that top actions are present
            expect(items.some((item: any) => item.label?.includes('Update Project'))).toBe(true);
            expect(items.some((item: any) => item.label?.includes('Commit'))).toBe(true);
            expect(items.some((item: any) => item.label?.includes('Push'))).toBe(true);
            expect(items.some((item: any) => item.label?.includes('New Branch'))).toBe(true);
            expect(items.some((item: any) => item.label?.includes('Checkout Tag or Revision'))).toBe(true);
        });

        it('should include recent branches when available', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            const mockBranches: Branch[] = [
                {
                    name: 'feature/auth',
                    fullName: 'feature/auth',
                    type: 'local',
                    isActive: false
                }
            ];

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue(['feature/auth']);
            mockGitService.getBranches.mockResolvedValue(mockBranches);

            await menuController.open();

            const items = mockQuickPick.items;
            expect(items.some((item: any) => item.label === 'Recent')).toBe(true);
            expect(items.some((item: any) => item.label?.includes('feature/auth'))).toBe(true);
        });
    });

    describe('multi-repo layout', () => {
        it('should show divergence warning when repositories have diverged', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: { fsPath: '/test/repo1' } as any,
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 2,
                    behind: 0
                },
                {
                    rootUri: { fsPath: '/test/repo2' } as any,
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: true,
                    ahead: 0,
                    behind: 1
                }
            ];

            mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);

            await menuController.open();

            const items = mockQuickPick.items;
            expect(items.some((item: any) => item.label?.includes('Branches have diverged'))).toBe(true);
        });

        it('should show repository grid with current branches', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: { fsPath: '/test/repo1' } as any,
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: { fsPath: '/test/repo2' } as any,
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: true
                }
            ];

            mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);

            await menuController.open();

            const items = mockQuickPick.items;
            expect(items.some((item: any) => item.label?.includes('repo1') && item.label?.includes('main'))).toBe(true);
            expect(items.some((item: any) => item.label?.includes('repo2') && item.label?.includes('develop'))).toBe(true);
        });
    });

    describe('performance', () => {
        it('should open within reasonable time', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue([]);
            mockGitService.getBranches.mockResolvedValue([]);

            const startTime = Date.now();
            await menuController.open();
            const elapsed = Date.now() - startTime;

            // Should open quickly (within 1 second for tests)
            expect(elapsed).toBeLessThan(1000);
            expect(mockQuickPick.show).toHaveBeenCalled();
        });
    });
});
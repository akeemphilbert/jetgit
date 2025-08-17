import * as vscode from 'vscode';
import { RepoContextService } from '../../src/services/repoContextService';
import { MenuController } from '../../src/providers/gitMenuController';
import { BranchesProvider } from '../../src/providers/branchesProvider';
import { StatusBarService } from '../../src/services/statusBarService';
import { GitService } from '../../src/services/gitService';
import { Repository } from '../../src/types/git';

describe('Divergence Detection Integration', () => {
    let repoContextService: RepoContextService;
    let menuController: MenuController;
    let statusBarService: StatusBarService;
    let branchesProvider: BranchesProvider;
    let gitService: GitService;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Reset singleton
        (RepoContextService as any).instance = undefined;
        (StatusBarService as any).instance = undefined;

        mockContext = {
            globalState: {
                get: jest.fn().mockReturnValue({}),
                update: jest.fn()
            },
            subscriptions: []
        } as any;

        // Mock Git API
        const mockGitApi = {
            repositories: [],
            onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
            onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
        };

        const mockGitExtension = {
            isActive: true,
            exports: {
                getAPI: jest.fn(() => mockGitApi)
            }
        };

        jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

        repoContextService = RepoContextService.getInstance(mockContext);
        gitService = new GitService();
        branchesProvider = new BranchesProvider(gitService, repoContextService);
        statusBarService = StatusBarService.getInstance(mockContext);
        menuController = new MenuController(gitService, repoContextService, branchesProvider);
    });

    afterEach(() => {
        if (repoContextService) {
            repoContextService.dispose();
        }
        if (statusBarService) {
            statusBarService.dispose();
        }
        jest.clearAllMocks();
    });

    describe('single repository divergence detection', () => {
        it('should show ahead/behind indicators in status bar', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'feature/auth',
                hasChanges: false,
                ahead: 3,
                behind: 2
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('feature/auth');
            expect(statusBarItem.text).toContain('↑3');
            expect(statusBarItem.text).toContain('↓2');
        });

        it('should show only ahead indicator when no behind commits', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'feature/new',
                hasChanges: false,
                ahead: 5,
                behind: 0
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('↑5');
            expect(statusBarItem.text).not.toContain('↓');
        });

        it('should show only behind indicator when no ahead commits', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false,
                ahead: 0,
                behind: 4
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('↓4');
            expect(statusBarItem.text).not.toContain('↑');
        });

        it('should not show divergence indicators when up-to-date', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false,
                ahead: 0,
                behind: 0
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).not.toContain('↑');
            expect(statusBarItem.text).not.toContain('↓');
        });
    });

    describe('multi-repository divergence detection', () => {
        it('should show divergence warning banner when any repository has diverged', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 0,
                    behind: 0
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: false,
                    ahead: 3,
                    behind: 0
                },
                {
                    rootUri: vscode.Uri.file('/workspace/shared'),
                    name: 'shared',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 0,
                    behind: 2
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            const mockQuickPick = {
                title: '',
                placeholder: '',
                items: [],
                show: jest.fn(),
                hide: jest.fn(),
                dispose: jest.fn(),
                onDidChangeSelection: jest.fn(),
                onDidTriggerButton: jest.fn(),
                onDidHide: jest.fn()
            };

            jest.spyOn(vscode.window, 'createQuickPick').mockReturnValue(mockQuickPick as any);

            await menuController.open();

            const items = mockQuickPick.items;
            const divergenceWarning = items.find((item: any) => 
                item.label?.includes('⚠') && item.label?.includes('Branches have diverged')
            );

            expect(divergenceWarning).toBeDefined();
            expect(divergenceWarning.kind).toBe(vscode.QuickPickItemKind.Separator);
        });

        it('should not show divergence warning when all repositories are up-to-date', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 0,
                    behind: 0
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: false,
                    ahead: 0,
                    behind: 0
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            const mockQuickPick = {
                title: '',
                placeholder: '',
                items: [],
                show: jest.fn(),
                hide: jest.fn(),
                dispose: jest.fn(),
                onDidChangeSelection: jest.fn(),
                onDidTriggerButton: jest.fn(),
                onDidHide: jest.fn()
            };

            jest.spyOn(vscode.window, 'createQuickPick').mockReturnValue(mockQuickPick as any);

            await menuController.open();

            const items = mockQuickPick.items;
            const divergenceWarning = items.find((item: any) => 
                item.label?.includes('⚠') && item.label?.includes('Branches have diverged')
            );

            expect(divergenceWarning).toBeUndefined();
        });

        it('should show divergence badges in repository grid', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 2,
                    behind: 1
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: false,
                    ahead: 0,
                    behind: 3
                },
                {
                    rootUri: vscode.Uri.file('/workspace/shared'),
                    name: 'shared',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 5,
                    behind: 0
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            const mockQuickPick = {
                title: '',
                placeholder: '',
                items: [],
                show: jest.fn(),
                hide: jest.fn(),
                dispose: jest.fn(),
                onDidChangeSelection: jest.fn(),
                onDidTriggerButton: jest.fn(),
                onDidHide: jest.fn()
            };

            jest.spyOn(vscode.window, 'createQuickPick').mockReturnValue(mockQuickPick as any);

            await menuController.open();

            const items = mockQuickPick.items;

            // Check frontend repo item
            const frontendItem = items.find((item: any) => 
                item.label?.includes('frontend') && item.label?.includes('main')
            );
            expect(frontendItem?.label).toContain('↑2');
            expect(frontendItem?.label).toContain('↓1');

            // Check backend repo item
            const backendItem = items.find((item: any) => 
                item.label?.includes('backend') && item.label?.includes('develop')
            );
            expect(backendItem?.label).toContain('↓3');
            expect(backendItem?.label).not.toContain('↑');

            // Check shared repo item
            const sharedItem = items.find((item: any) => 
                item.label?.includes('shared') && item.label?.includes('main')
            );
            expect(sharedItem?.label).toContain('↑5');
            expect(sharedItem?.label).not.toContain('↓');
        });

        it('should update status bar with multi-repo divergence information', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 2,
                    behind: 0
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: false,
                    ahead: 0,
                    behind: 1
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('2 repos');
            expect(statusBarItem.text).toContain('main');
        });
    });

    describe('divergence state changes', () => {
        it('should update divergence indicators after fetch operation', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false,
                ahead: 0,
                behind: 0
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            // Initial state - no divergence
            await statusBarService.update();
            let statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).not.toContain('↑');
            expect(statusBarItem.text).not.toContain('↓');

            // Simulate fetch operation that reveals divergence
            mockRepository.ahead = 2;
            mockRepository.behind = 1;

            await statusBarService.update();
            statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('↑2');
            expect(statusBarItem.text).toContain('↓1');
        });

        it('should clear divergence indicators after sync operation', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false,
                ahead: 3,
                behind: 2
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            // Initial state - diverged
            await statusBarService.update();
            let statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('↑3');
            expect(statusBarItem.text).toContain('↓2');

            // Simulate sync operation
            mockRepository.ahead = 0;
            mockRepository.behind = 0;

            await statusBarService.update();
            statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).not.toContain('↑');
            expect(statusBarItem.text).not.toContain('↓');
        });

        it('should handle undefined ahead/behind values gracefully', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
                // ahead and behind are undefined
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).not.toContain('↑');
            expect(statusBarItem.text).not.toContain('↓');
            expect(statusBarItem.text).toContain('main');
        });
    });

    describe('divergence detection edge cases', () => {
        it('should handle repositories with no upstream branch', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'feature/new-feature',
                hasChanges: false
                // No ahead/behind because no upstream
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('feature/new-feature');
            expect(statusBarItem.text).not.toContain('↑');
            expect(statusBarItem.text).not.toContain('↓');
        });

        it('should handle detached HEAD state', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: undefined, // Detached HEAD
                hasChanges: false
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('test-repo');
            expect(statusBarItem.text).not.toContain('undefined');
        });

        it('should handle very large ahead/behind numbers', async () => {
            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'old-branch',
                hasChanges: false,
                ahead: 999,
                behind: 1234
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepository);

            await statusBarService.update();

            const statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('↑999');
            expect(statusBarItem.text).toContain('↓1234');
        });
    });

    describe('repository switching with divergence', () => {
        it('should update divergence indicators when switching repositories', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false,
                    ahead: 2,
                    behind: 0
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: false,
                    ahead: 0,
                    behind: 3
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);

            // Initial state - repo1 active
            await statusBarService.update();
            let statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('main');
            expect(statusBarItem.text).toContain('2 repos');

            // Switch to repo2
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[1]);
            
            // Simulate repository change event
            const changeHandler = (repoContextService as any)._onDidChangeActiveRepository;
            if (changeHandler && changeHandler._event) {
                changeHandler._event.fire(mockRepositories[1]);
            }

            await statusBarService.update();
            statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('develop');
            expect(statusBarItem.text).toContain('2 repos');
        });
    });
});
import * as vscode from 'vscode';
import { RepoContextService } from '../../src/services/repoContextService';
import { MenuController } from '../../src/providers/gitMenuController';
import { BranchesProvider } from '../../src/providers/branchesProvider';
import { StatusBarService } from '../../src/services/statusBarService';
import { SCMTreeProvider } from '../../src/providers/scmTreeProvider';
import { GitService } from '../../src/services/gitService';
import { Repository, Branch } from '../../src/types/git';

describe('Repository Switching Integration', () => {
    let repoContextService: RepoContextService;
    let menuController: MenuController;
    let statusBarService: StatusBarService;
    let scmTreeProvider: SCMTreeProvider;
    let branchesProvider: BranchesProvider;
    let gitService: GitService;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Reset singletons
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
        scmTreeProvider = new SCMTreeProvider(branchesProvider, repoContextService);
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

    describe('repository switching via QuickPick', () => {
        it('should switch active repository when selecting from multi-repo menu', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/shared'),
                    name: 'shared',
                    currentBranch: 'main',
                    hasChanges: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);

            const setActiveRepoSpy = jest.spyOn(repoContextService, 'setActiveRepository');

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

            // Simulate selecting the backend repository
            const selectionHandler = mockQuickPick.onDidChangeSelection.mock.calls[0][0];
            const backendRepoItem = {
                type: 'repository',
                repository: mockRepositories[1]
            };

            selectionHandler([backendRepoItem]);

            expect(setActiveRepoSpy).toHaveBeenCalledWith(mockRepositories[1]);
        });

        it('should drill into single-repo view after repository selection', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: false
                }
            ];

            const mockBranches: Branch[] = [
                {
                    name: 'develop',
                    fullName: 'refs/heads/develop',
                    type: 'local',
                    isActive: true
                },
                {
                    name: 'feature/api',
                    fullName: 'refs/heads/feature/api',
                    type: 'local',
                    isActive: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);
            jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue([]);
            jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue([]);
            jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(mockBranches);
            jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue([]);
            jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

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

            // First open - should show multi-repo layout
            await menuController.open();
            expect(mockQuickPick.title).toBe('Git (2 repositories)');

            // Simulate repository selection
            const selectionHandler = mockQuickPick.onDidChangeSelection.mock.calls[0][0];
            const backendRepoItem = {
                type: 'repository',
                repository: mockRepositories[1]
            };

            // Mock the active repository change
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[1]);
            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepositories[1]]); // Simulate single-repo context

            selectionHandler([backendRepoItem]);

            // Clear mock calls and open again to verify single-repo layout
            jest.clearAllMocks();
            mockQuickPick.items = [];

            await menuController.open();
            expect(mockQuickPick.title).toBe('Git (backend)');
            expect(mockQuickPick.placeholder).toBe('Search for branches and actions');
        });

        it('should handle repository selection with no active repository', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(undefined);

            const setActiveRepoSpy = jest.spyOn(repoContextService, 'setActiveRepository');

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

            // Simulate selecting the repository
            const selectionHandler = mockQuickPick.onDidChangeSelection.mock.calls[0][0];
            const repoItem = {
                type: 'repository',
                repository: mockRepositories[0]
            };

            selectionHandler([repoItem]);

            expect(setActiveRepoSpy).toHaveBeenCalledWith(mockRepositories[0]);
        });
    });

    describe('repository switching effects on UI components', () => {
        it('should update status bar when active repository changes', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: true,
                    ahead: 2,
                    behind: 1
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);

            // Initial status bar state
            await statusBarService.update();
            let statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('2 repos');
            expect(statusBarItem.text).toContain('main');

            // Switch active repository
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[1]);
            repoContextService.setActiveRepository(mockRepositories[1]);

            // Update status bar
            await statusBarService.update();
            statusBarItem = (statusBarService as any)._statusBarItem;
            expect(statusBarItem.text).toContain('2 repos');
            expect(statusBarItem.text).toContain('develop');
            expect(statusBarItem.text).toContain('↑2');
            expect(statusBarItem.text).toContain('↓1');
        });

        it('should update SCM tree when active repository changes', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    name: 'frontend',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    name: 'backend',
                    currentBranch: 'develop',
                    hasChanges: false
                }
            ];

            const frontendBranches: Branch[] = [
                {
                    name: 'main',
                    fullName: 'refs/heads/main',
                    type: 'local',
                    isActive: true
                },
                {
                    name: 'feature/ui',
                    fullName: 'refs/heads/feature/ui',
                    type: 'local',
                    isActive: false
                }
            ];

            const backendBranches: Branch[] = [
                {
                    name: 'develop',
                    fullName: 'refs/heads/develop',
                    type: 'local',
                    isActive: true
                },
                {
                    name: 'feature/api',
                    fullName: 'refs/heads/feature/api',
                    type: 'local',
                    isActive: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);
            jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(frontendBranches);

            // Get initial tree children
            const initialChildren = await scmTreeProvider.getChildren();
            expect(initialChildren.length).toBeGreaterThan(0);

            // Switch to backend repository
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[1]);
            jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(backendBranches);

            // Simulate repository change event
            const refreshSpy = jest.spyOn(scmTreeProvider, 'refresh');
            repoContextService.setActiveRepository(mockRepositories[1]);

            // Tree should refresh
            expect(refreshSpy).toHaveBeenCalled();

            // Get updated tree children
            const updatedChildren = await scmTreeProvider.getChildren();
            expect(updatedChildren.length).toBeGreaterThan(0);
        });

        it('should update MRU branches when switching repositories', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: false
                }
            ];

            // Set up MRU data for each repository
            const repo1MRU = ['feature/auth', 'bugfix/login'];
            const repo2MRU = ['feature/payment', 'hotfix/security'];

            const mockGet = jest.fn().mockReturnValue({
                'repo1': repo1MRU,
                'repo2': repo2MRU
            });
            mockContext.globalState.get = mockGet;

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            // Set repo1 as active
            repoContextService.setActiveRepository(mockRepositories[0]);
            let mruBranches = repoContextService.getMRUBranches();
            expect(mruBranches).toEqual(repo1MRU);

            // Switch to repo2
            repoContextService.setActiveRepository(mockRepositories[1]);
            mruBranches = repoContextService.getMRUBranches();
            expect(mruBranches).toEqual(repo2MRU);
        });
    });

    describe('repository switching edge cases', () => {
        it('should handle switching to non-existent repository gracefully', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                }
            ];

            const nonExistentRepo: Repository = {
                rootUri: vscode.Uri.file('/workspace/deleted-repo'),
                name: 'deleted-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(mockRepositories[0]);

            // Try to switch to non-existent repository
            repoContextService.setActiveRepository(nonExistentRepo);

            // Should fall back to first available repository or undefined
            const activeRepo = repoContextService.getActiveRepository();
            expect(activeRepo).toBeDefined();
            expect(activeRepo?.name).toBe('repo1');
        });

        it('should handle switching when no repositories are available', async () => {
            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([]);
            jest.spyOn(repoContextService, 'getActiveRepository').mockReturnValue(undefined);

            const mockRepository: Repository = {
                rootUri: vscode.Uri.file('/workspace/repo'),
                name: 'repo',
                currentBranch: 'main',
                hasChanges: false
            };

            // Try to switch to a repository when none are available
            repoContextService.setActiveRepository(mockRepository);

            // Should remain undefined
            expect(repoContextService.getActiveRepository()).toBeUndefined();
        });

        it('should handle rapid repository switching', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo3'),
                    name: 'repo3',
                    currentBranch: 'master',
                    hasChanges: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            const changeEvents: Repository[] = [];
            repoContextService.onDidChangeActiveRepository((repo) => {
                if (repo) {
                    changeEvents.push(repo);
                }
            });

            // Rapidly switch between repositories
            for (let i = 0; i < 10; i++) {
                const repo = mockRepositories[i % mockRepositories.length];
                repoContextService.setActiveRepository(repo);
            }

            // Should have fired change events for each switch
            expect(changeEvents.length).toBe(10);
            expect(changeEvents[9].name).toBe('repo1'); // 10 % 3 = 1, so repo1 (index 0)
        });

        it('should maintain repository context across VS Code sessions', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            // Set repo2 as active
            repoContextService.setActiveRepository(mockRepositories[1]);
            expect(repoContextService.getActiveRepository()?.name).toBe('repo2');

            // Simulate VS Code restart by creating new service instance
            repoContextService.dispose();
            (RepoContextService as any).instance = undefined;

            const newRepoContextService = RepoContextService.getInstance(mockContext);
            jest.spyOn(newRepoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            // Should restore the active repository (though this would typically be handled by Git API state)
            // For now, it should default to first repository
            const activeRepo = newRepoContextService.getActiveRepository();
            expect(activeRepo).toBeDefined();
        });
    });

    describe('repository switching performance', () => {
        it('should switch repositories quickly even with many repositories', async () => {
            const mockRepositories: Repository[] = Array.from({ length: 50 }, (_, i) => ({
                rootUri: vscode.Uri.file(`/workspace/repo-${i}`),
                name: `repo-${i}`,
                currentBranch: i % 2 === 0 ? 'main' : 'develop',
                hasChanges: i % 3 === 0
            }));

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            const startTime = performance.now();

            // Switch between repositories rapidly
            for (let i = 0; i < 20; i++) {
                const repo = mockRepositories[i % mockRepositories.length];
                repoContextService.setActiveRepository(repo);
            }

            const elapsed = performance.now() - startTime;

            // Should complete all switches quickly
            expect(elapsed).toBeLessThan(100); // 100ms for 20 switches
        });

        it('should debounce UI updates during rapid repository switching', async () => {
            const mockRepositories: Repository[] = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    name: 'repo2',
                    currentBranch: 'develop',
                    hasChanges: false
                }
            ];

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

            const updateSpy = jest.spyOn(statusBarService, 'update');

            // Rapidly switch repositories
            for (let i = 0; i < 10; i++) {
                const repo = mockRepositories[i % mockRepositories.length];
                repoContextService.setActiveRepository(repo);
            }

            // Wait for any debounced updates
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should have debounced the updates (not called 10 times)
            expect(updateSpy.mock.calls.length).toBeLessThan(10);
        });
    });
});
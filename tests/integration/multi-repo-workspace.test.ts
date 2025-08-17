import * as vscode from 'vscode';
import { RepoContextService } from '../../src/services/repoContextService';
import { MenuController } from '../../src/providers/gitMenuController';
import { BranchesProvider } from '../../src/providers/branchesProvider';
import { GitService } from '../../src/services/gitService';
import { Repository, Branch } from '../../src/types/git';

describe('Multi-Repo Workspace Integration', () => {
    let repoContextService: RepoContextService;
    let menuController: MenuController;
    let branchesProvider: BranchesProvider;
    let gitService: GitService;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Reset singleton
        (RepoContextService as any).instance = undefined;

        mockContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as any;

        // Mock Git API with multiple repositories
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
        menuController = new MenuController(gitService, repoContextService, branchesProvider);
    });

    afterEach(() => {
        if (repoContextService) {
            repoContextService.dispose();
        }
        jest.clearAllMocks();
    });

    describe('repository detection and management', () => {
        it('should detect multiple repositories in workspace', async () => {
            const mockRepos = [
                {
                    rootUri: vscode.Uri.file('/workspace/frontend'),
                    state: {
                        HEAD: { name: 'main', ahead: 0, behind: 0 },
                        workingTreeChanges: [],
                        indexChanges: []
                    }
                },
                {
                    rootUri: vscode.Uri.file('/workspace/backend'),
                    state: {
                        HEAD: { name: 'develop', ahead: 2, behind: 1 },
                        workingTreeChanges: [{ uri: vscode.Uri.file('/workspace/backend/src/app.ts') }],
                        indexChanges: []
                    }
                },
                {
                    rootUri: vscode.Uri.file('/workspace/shared'),
                    state: {
                        HEAD: { name: 'main', ahead: 0, behind: 0 },
                        workingTreeChanges: [],
                        indexChanges: []
                    }
                }
            ];

            // Simulate Git API returning multiple repositories
            const gitApi = (repoContextService as any)._gitApi;
            if (gitApi) {
                gitApi.repositories = mockRepos;
            }

            await (repoContextService as any).refreshRepositories();

            const repositories = repoContextService.listRepositories();
            expect(repositories).toHaveLength(3);

            expect(repositories[0].name).toBe('frontend');
            expect(repositories[0].currentBranch).toBe('main');
            expect(repositories[0].hasChanges).toBe(false);

            expect(repositories[1].name).toBe('backend');
            expect(repositories[1].currentBranch).toBe('develop');
            expect(repositories[1].hasChanges).toBe(true);
            expect(repositories[1].ahead).toBe(2);
            expect(repositories[1].behind).toBe(1);

            expect(repositories[2].name).toBe('shared');
            expect(repositories[2].currentBranch).toBe('main');
            expect(repositories[2].hasChanges).toBe(false);
        });

        it('should handle repository addition and removal dynamically', async () => {
            let repositoryOpenCallback: (repo: any) => void;
            let repositoryCloseCallback: (repo: any) => void;

            const mockGitApi = {
                repositories: [],
                onDidOpenRepository: jest.fn((callback) => {
                    repositoryOpenCallback = callback;
                    return { dispose: jest.fn() };
                }),
                onDidCloseRepository: jest.fn((callback) => {
                    repositoryCloseCallback = callback;
                    return { dispose: jest.fn() };
                })
            };

            const mockGitExtension = {
                isActive: true,
                exports: {
                    getAPI: jest.fn(() => mockGitApi)
                }
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

            // Reinitialize with new mock
            repoContextService.dispose();
            (RepoContextService as any).instance = undefined;
            repoContextService = RepoContextService.getInstance(mockContext);

            // Initially no repositories
            expect(repoContextService.listRepositories()).toHaveLength(0);

            // Add first repository
            const repo1 = {
                rootUri: vscode.Uri.file('/workspace/repo1'),
                state: {
                    HEAD: { name: 'main' },
                    workingTreeChanges: [],
                    indexChanges: []
                }
            };

            mockGitApi.repositories.push(repo1);
            repositoryOpenCallback!(repo1);

            await new Promise(resolve => setTimeout(resolve, 10)); // Allow refresh
            expect(repoContextService.listRepositories()).toHaveLength(1);

            // Add second repository
            const repo2 = {
                rootUri: vscode.Uri.file('/workspace/repo2'),
                state: {
                    HEAD: { name: 'develop' },
                    workingTreeChanges: [],
                    indexChanges: []
                }
            };

            mockGitApi.repositories.push(repo2);
            repositoryOpenCallback!(repo2);

            await new Promise(resolve => setTimeout(resolve, 10)); // Allow refresh
            expect(repoContextService.listRepositories()).toHaveLength(2);

            // Remove first repository
            mockGitApi.repositories.splice(0, 1);
            repositoryCloseCallback!(repo1);

            await new Promise(resolve => setTimeout(resolve, 10)); // Allow refresh
            expect(repoContextService.listRepositories()).toHaveLength(1);
            expect(repoContextService.listRepositories()[0].name).toBe('repo2');
        });

        it('should maintain active repository across repository changes', async () => {
            const mockRepos = [
                {
                    rootUri: vscode.Uri.file('/workspace/repo1'),
                    state: {
                        HEAD: { name: 'main' },
                        workingTreeChanges: [],
                        indexChanges: []
                    }
                },
                {
                    rootUri: vscode.Uri.file('/workspace/repo2'),
                    state: {
                        HEAD: { name: 'develop' },
                        workingTreeChanges: [],
                        indexChanges: []
                    }
                }
            ];

            const gitApi = (repoContextService as any)._gitApi;
            if (gitApi) {
                gitApi.repositories = mockRepos;
            }

            await (repoContextService as any).refreshRepositories();

            const repositories = repoContextService.listRepositories();
            expect(repositories).toHaveLength(2);

            // Set active repository
            repoContextService.setActiveRepository(repositories[1]);
            expect(repoContextService.getActiveRepository()?.name).toBe('repo2');

            // Simulate repository refresh (e.g., branch change)
            await (repoContextService as any).refreshRepositories();

            // Active repository should be maintained
            expect(repoContextService.getActiveRepository()?.name).toBe('repo2');
        });
    });

    describe('MRU persistence across repositories', () => {
        it('should persist MRU branches per repository in globalState', async () => {
            const mockRepo1: Repository = {
                rootUri: vscode.Uri.file('/workspace/repo1'),
                name: 'repo1',
                currentBranch: 'main',
                hasChanges: false
            };

            const mockRepo2: Repository = {
                rootUri: vscode.Uri.file('/workspace/repo2'),
                name: 'repo2',
                currentBranch: 'develop',
                hasChanges: false
            };

            // Mock globalState to track calls
            const mockGet = jest.fn().mockReturnValue({});
            const mockUpdate = jest.fn();
            mockContext.globalState.get = mockGet;
            mockContext.globalState.update = mockUpdate;

            // Add branches to MRU for repo1
            repoContextService.setActiveRepository(mockRepo1);
            repoContextService.addToMRU('feature/auth');
            repoContextService.addToMRU('bugfix/login');

            // Switch to repo2 and add different branches
            repoContextService.setActiveRepository(mockRepo2);
            repoContextService.addToMRU('feature/payment');
            repoContextService.addToMRU('hotfix/security');

            // Verify separate MRU lists were persisted
            expect(mockUpdate).toHaveBeenCalledWith(
                'jbGit.mruBranches',
                expect.objectContaining({
                    'repo1': expect.arrayContaining(['bugfix/login', 'feature/auth']),
                    'repo2': expect.arrayContaining(['hotfix/security', 'feature/payment'])
                })
            );
        });

        it('should load MRU branches from globalState on initialization', async () => {
            const persistedMRU = {
                'repo1': ['feature/auth', 'bugfix/login'],
                'repo2': ['feature/payment', 'hotfix/security']
            };

            mockContext.globalState.get = jest.fn().mockReturnValue(persistedMRU);

            // Reinitialize service to test loading
            repoContextService.dispose();
            (RepoContextService as any).instance = undefined;
            repoContextService = RepoContextService.getInstance(mockContext);

            const mockRepo1: Repository = {
                rootUri: vscode.Uri.file('/workspace/repo1'),
                name: 'repo1',
                currentBranch: 'main',
                hasChanges: false
            };

            repoContextService.setActiveRepository(mockRepo1);
            const mruBranches = repoContextService.getMRUBranches();

            expect(mruBranches).toEqual(['feature/auth', 'bugfix/login']);
        });

        it('should limit MRU branches to 20 per repository', async () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/workspace/repo'),
                name: 'repo',
                currentBranch: 'main',
                hasChanges: false
            };

            repoContextService.setActiveRepository(mockRepo);

            // Add 25 branches to exceed the limit
            for (let i = 0; i < 25; i++) {
                repoContextService.addToMRU(`branch-${i}`);
            }

            const mruBranches = repoContextService.getMRUBranches();
            expect(mruBranches).toHaveLength(20);

            // Should contain the most recent 20 branches
            expect(mruBranches[0]).toBe('branch-24');
            expect(mruBranches[19]).toBe('branch-5');
        });

        it('should handle MRU branch cleanup when branches are deleted', async () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/workspace/repo'),
                name: 'repo',
                currentBranch: 'main',
                hasChanges: false
            };

            repoContextService.setActiveRepository(mockRepo);

            // Add branches to MRU
            repoContextService.addToMRU('feature/auth');
            repoContextService.addToMRU('feature/payment');
            repoContextService.addToMRU('bugfix/login');

            // Mock git service to return only some branches (simulating deletion)
            const existingBranches: Branch[] = [
                {
                    name: 'main',
                    fullName: 'refs/heads/main',
                    type: 'local',
                    isActive: true
                },
                {
                    name: 'feature/auth',
                    fullName: 'refs/heads/feature/auth',
                    type: 'local',
                    isActive: false
                }
                // feature/payment and bugfix/login are "deleted"
            ];

            jest.spyOn(gitService, 'getBranches').mockResolvedValue(existingBranches);

            // Trigger MRU cleanup
            await branchesProvider.refresh();

            const mruBranches = repoContextService.getMRUBranches();
            expect(mruBranches).toEqual(['feature/auth']); // Only existing branch remains
        });
    });

    describe('menu controller multi-repo integration', () => {
        it('should show divergence warning when any repository has diverged', async () => {
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
            const hasDivergenceWarning = items.some((item: any) => 
                item.label?.includes('⚠') && item.label?.includes('Branches have diverged')
            );

            expect(hasDivergenceWarning).toBe(true);
        });

        it('should not show divergence warning when no repositories have diverged', async () => {
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
            const hasDivergenceWarning = items.some((item: any) => 
                item.label?.includes('⚠') && item.label?.includes('Branches have diverged')
            );

            expect(hasDivergenceWarning).toBe(false);
        });

        it('should handle repository switching from multi-repo menu', async () => {
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

            jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);
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

            // Simulate repository selection
            const selectionHandler = mockQuickPick.onDidChangeSelection.mock.calls[0][0];
            const mockRepoItem = {
                type: 'repository',
                repository: mockRepositories[1]
            };

            selectionHandler([mockRepoItem]);

            expect(setActiveRepoSpy).toHaveBeenCalledWith(mockRepositories[1]);
        });
    });

    describe('performance with multiple repositories', () => {
        it('should handle large number of repositories efficiently', async () => {
            const mockRepositories: Repository[] = Array.from({ length: 50 }, (_, i) => ({
                rootUri: vscode.Uri.file(`/workspace/repo-${i}`),
                name: `repo-${i}`,
                currentBranch: i % 2 === 0 ? 'main' : 'develop',
                hasChanges: i % 3 === 0,
                ahead: i % 5,
                behind: i % 7
            }));

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

            const startTime = performance.now();
            await menuController.open();
            const elapsed = performance.now() - startTime;

            // Should handle 50 repositories within reasonable time
            expect(elapsed).toBeLessThan(500); // 500ms
            expect(mockQuickPick.show).toHaveBeenCalled();
            expect(mockQuickPick.items.length).toBeGreaterThan(50); // Repositories + sections
        });

        it('should debounce repository state updates', async () => {
            const mockRepo = {
                rootUri: vscode.Uri.file('/workspace/repo'),
                state: {
                    HEAD: { name: 'main' },
                    workingTreeChanges: [],
                    indexChanges: []
                }
            };

            let stateChangeCallback: () => void;

            const mockGitApi = {
                repositories: [mockRepo],
                onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
                onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
            };

            // Mock state change events
            Object.defineProperty(mockRepo.state, 'onDidChange', {
                value: jest.fn((callback) => {
                    stateChangeCallback = callback;
                    return { dispose: jest.fn() };
                })
            });

            const mockGitExtension = {
                isActive: true,
                exports: {
                    getAPI: jest.fn(() => mockGitApi)
                }
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

            // Reinitialize with new mock
            repoContextService.dispose();
            (RepoContextService as any).instance = undefined;
            repoContextService = RepoContextService.getInstance(mockContext);

            const refreshSpy = jest.spyOn(repoContextService as any, 'refreshRepositories');

            // Trigger multiple rapid state changes
            for (let i = 0; i < 10; i++) {
                stateChangeCallback!();
            }

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 300));

            // Should have debounced the calls (not called 10 times)
            expect(refreshSpy.mock.calls.length).toBeLessThan(10);
        });
    });
});
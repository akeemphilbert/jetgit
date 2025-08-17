import { MenuController } from '../../../src/providers/gitMenuController';
import { GitService } from '../../../src/services/gitService';
import { RepoContextService } from '../../../src/services/repoContextService';
import { BranchesProvider } from '../../../src/providers/branchesProvider';
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
jest.mock('../../../src/providers/branchesProvider');

describe('MenuController', () => {
    let menuController: MenuController;
    let mockGitService: jest.Mocked<GitService>;
    let mockRepoContextService: jest.Mocked<RepoContextService>;
    let mockBranchesProvider: jest.Mocked<BranchesProvider>;

    beforeEach(() => {
        mockGitService = new GitService() as jest.Mocked<GitService>;
        mockRepoContextService = {
            listRepositories: jest.fn(),
            getActiveRepository: jest.fn(),
            setActiveRepository: jest.fn(),
            getMRUBranches: jest.fn(),
            addToMRU: jest.fn(),
            onDidChangeActiveRepository: jest.fn(() => ({ dispose: jest.fn() }))
        } as any;
        
        mockBranchesProvider = {
            getRecent: jest.fn(),
            getLocal: jest.fn(),
            getRemotes: jest.fn(),
            getTags: jest.fn(),
            refresh: jest.fn()
        } as any;
        
        menuController = new MenuController(mockGitService, mockRepoContextService, mockBranchesProvider);
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
            mockBranchesProvider.getRecent.mockResolvedValue([]);
            mockBranchesProvider.getLocal.mockResolvedValue([]);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            const startTime = Date.now();
            await menuController.open();
            const elapsed = Date.now() - startTime;

            // Should open quickly (within 1 second for tests)
            expect(elapsed).toBeLessThan(1000);
            expect(mockQuickPick.show).toHaveBeenCalled();
        });

        it('should meet 150ms requirement for repositories with ≤5k commits', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            // Mock large but reasonable branch set
            const largeBranchSet = Array.from({ length: 100 }, (_, i) => ({
                name: `branch-${i}`,
                fullName: `refs/heads/branch-${i}`,
                type: 'local' as const,
                isActive: i === 0,
                ahead: 0,
                behind: 0
            }));

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue(['branch-1', 'branch-2']);
            mockBranchesProvider.getRecent.mockResolvedValue(largeBranchSet.slice(0, 10));
            mockBranchesProvider.getLocal.mockResolvedValue(largeBranchSet);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            const startTime = performance.now();
            await menuController.open();
            const elapsed = performance.now() - startTime;

            // Should meet performance requirement
            expect(elapsed).toBeLessThan(150);
            expect(mockQuickPick.show).toHaveBeenCalled();
        });
    });

    describe('menu modeling - single vs multi-repo scenarios', () => {
        describe('single repository scenarios', () => {
            it('should create correct single-repo layout with search placeholder', async () => {
                const mockRepository: Repository = {
                    rootUri: { fsPath: '/test/repo' } as any,
                    name: 'test-repo',
                    currentBranch: 'main',
                    hasChanges: false
                };

                mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
                mockRepoContextService.getMRUBranches.mockReturnValue([]);
                mockBranchesProvider.getRecent.mockResolvedValue([]);
                mockBranchesProvider.getLocal.mockResolvedValue([]);
                mockBranchesProvider.getRemotes.mockResolvedValue([]);
                mockBranchesProvider.getTags.mockResolvedValue([]);

                await menuController.open();

                expect(mockQuickPick.title).toBe('Git (test-repo)');
                expect(mockQuickPick.placeholder).toBe('Search for branches and actions');
            });

            it('should include top actions section in single-repo layout', async () => {
                const mockRepository: Repository = {
                    rootUri: { fsPath: '/test/repo' } as any,
                    name: 'test-repo',
                    currentBranch: 'main',
                    hasChanges: false
                };

                mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
                mockRepoContextService.getMRUBranches.mockReturnValue([]);
                mockBranchesProvider.getRecent.mockResolvedValue([]);
                mockBranchesProvider.getLocal.mockResolvedValue([]);
                mockBranchesProvider.getRemotes.mockResolvedValue([]);
                mockBranchesProvider.getTags.mockResolvedValue([]);

                await menuController.open();

                const items = mockQuickPick.items;
                const topActions = ['Update Project…', 'Commit…', 'Push…', 'New Branch…', 'Checkout Tag or Revision…'];
                
                topActions.forEach(action => {
                    expect(items.some((item: any) => item.label?.includes(action))).toBe(true);
                });
            });

            it('should show sections: Recent, Local, Remote, Tags in single-repo layout', async () => {
                const mockRepository: Repository = {
                    rootUri: { fsPath: '/test/repo' } as any,
                    name: 'test-repo',
                    currentBranch: 'main',
                    hasChanges: false
                };

                const mockBranches: Branch[] = [
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
                ];

                const mockRemoteBranches: Branch[] = [
                    {
                        name: 'origin/main',
                        fullName: 'refs/remotes/origin/main',
                        type: 'remote',
                        isActive: false
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
                mockRepoContextService.getMRUBranches.mockReturnValue(['feature/auth']);
                mockBranchesProvider.getRecent.mockResolvedValue([mockBranches[1]]);
                mockBranchesProvider.getLocal.mockResolvedValue(mockBranches);
                mockBranchesProvider.getRemotes.mockResolvedValue(mockRemoteBranches);
                mockBranchesProvider.getTags.mockResolvedValue([]);

                await menuController.open();

                const items = mockQuickPick.items;
                const sections = ['Recent', 'Local', 'Remote', 'Tags'];
                
                sections.forEach(section => {
                    expect(items.some((item: any) => item.label === section)).toBe(true);
                });
            });

            it('should mark current branch with star icon', async () => {
                const mockRepository: Repository = {
                    rootUri: { fsPath: '/test/repo' } as any,
                    name: 'test-repo',
                    currentBranch: 'main',
                    hasChanges: false
                };

                const mockBranches: Branch[] = [
                    {
                        name: 'main',
                        fullName: 'refs/heads/main',
                        type: 'local',
                        isActive: true
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
                mockRepoContextService.getMRUBranches.mockReturnValue([]);
                mockBranchesProvider.getRecent.mockResolvedValue([]);
                mockBranchesProvider.getLocal.mockResolvedValue(mockBranches);
                mockBranchesProvider.getRemotes.mockResolvedValue([]);
                mockBranchesProvider.getTags.mockResolvedValue([]);

                await menuController.open();

                const items = mockQuickPick.items;
                expect(items.some((item: any) => 
                    item.label?.includes('main') && item.label?.includes('⭐')
                )).toBe(true);
            });
        });

        describe('multi-repository scenarios', () => {
            it('should create correct multi-repo layout with repo count in title', async () => {
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
            });

            it('should show repository grid with folder icons and current branches', async () => {
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
                expect(items.some((item: any) => 
                    item.label?.includes('repo1') && item.label?.includes('main')
                )).toBe(true);
                expect(items.some((item: any) => 
                    item.label?.includes('repo2') && item.label?.includes('develop')
                )).toBe(true);
            });

            it('should show Common Local Branches and Common Remote Branches sections', async () => {
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
                        hasChanges: false
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);

                await menuController.open();

                const items = mockQuickPick.items;
                expect(items.some((item: any) => item.label === 'Common Local Branches')).toBe(true);
                expect(items.some((item: any) => item.label === 'Common Remote Branches')).toBe(true);
            });

            it('should show divergence warning banner when repositories have diverged', async () => {
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
                        hasChanges: false,
                        ahead: 0,
                        behind: 1
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);

                await menuController.open();

                const items = mockQuickPick.items;
                expect(items.some((item: any) => 
                    item.label?.includes('⚠') && item.label?.includes('Branches have diverged')
                )).toBe(true);
            });

            it('should show divergence badges (↑n/↓m) for repositories', async () => {
                const mockRepositories: Repository[] = [
                    {
                        rootUri: { fsPath: '/test/repo1' } as any,
                        name: 'repo1',
                        currentBranch: 'main',
                        hasChanges: false,
                        ahead: 3,
                        behind: 1
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);

                await menuController.open();

                const items = mockQuickPick.items;
                expect(items.some((item: any) => 
                    item.label?.includes('↑3') && item.label?.includes('↓1')
                )).toBe(true);
            });

            it('should handle repository selection to drill into single-repo view', async () => {
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
                        hasChanges: false
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue(mockRepositories);
                mockRepoContextService.setActiveRepository.mockImplementation(() => {});

                await menuController.open();

                // Simulate repository selection
                const onDidChangeSelection = mockQuickPick.onDidChangeSelection;
                expect(onDidChangeSelection).toHaveBeenCalled();

                // Verify that selecting a repository would set it as active
                const selectionHandler = onDidChangeSelection.mock.calls[0][0];
                const mockRepoItem = {
                    type: 'repository',
                    repository: mockRepositories[0]
                };

                selectionHandler([mockRepoItem]);

                expect(mockRepoContextService.setActiveRepository).toHaveBeenCalledWith(mockRepositories[0]);
            });
        });

        describe('adaptive layout behavior', () => {
            it('should switch from single-repo to multi-repo layout when repositories are added', async () => {
                // Start with single repo
                const singleRepo: Repository = {
                    rootUri: { fsPath: '/test/repo1' } as any,
                    name: 'repo1',
                    currentBranch: 'main',
                    hasChanges: false
                };

                mockRepoContextService.listRepositories.mockReturnValue([singleRepo]);
                mockBranchesProvider.getRecent.mockResolvedValue([]);
                mockBranchesProvider.getLocal.mockResolvedValue([]);
                mockBranchesProvider.getRemotes.mockResolvedValue([]);
                mockBranchesProvider.getTags.mockResolvedValue([]);

                await menuController.open();
                expect(mockQuickPick.title).toBe('Git (repo1)');

                // Clear and simulate multi-repo
                jest.clearAllMocks();
                const multiRepos: Repository[] = [
                    singleRepo,
                    {
                        rootUri: { fsPath: '/test/repo2' } as any,
                        name: 'repo2',
                        currentBranch: 'develop',
                        hasChanges: false
                    }
                ];

                mockRepoContextService.listRepositories.mockReturnValue(multiRepos);

                await menuController.open();
                expect(mockQuickPick.title).toBe('Git (2 repositories)');
            });

            it('should handle empty repository list gracefully', async () => {
                const vscode = require('vscode');
                mockRepoContextService.listRepositories.mockReturnValue([]);

                await menuController.open();

                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No Git repositories found in workspace');
                expect(mockQuickPick.show).not.toHaveBeenCalled();
            });
        });
    });

    describe('MRU (Most Recently Used) branch handling', () => {
        it('should populate Recent section with MRU branches', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            const mockBranches: Branch[] = [
                {
                    name: 'feature/auth',
                    fullName: 'refs/heads/feature/auth',
                    type: 'local',
                    isActive: false,
                    lastAccessed: new Date(Date.now() - 3600000) // 1 hour ago
                },
                {
                    name: 'bugfix/login',
                    fullName: 'refs/heads/bugfix/login',
                    type: 'local',
                    isActive: false,
                    lastAccessed: new Date(Date.now() - 1800000) // 30 minutes ago
                }
            ];

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue(['bugfix/login', 'feature/auth']);
            mockBranchesProvider.getRecent.mockResolvedValue(mockBranches.reverse()); // Most recent first
            mockBranchesProvider.getLocal.mockResolvedValue(mockBranches);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            await menuController.open();

            const items = mockQuickPick.items;
            const recentSectionIndex = items.findIndex((item: any) => item.label === 'Recent');
            expect(recentSectionIndex).toBeGreaterThan(-1);

            // Check that MRU branches appear in Recent section
            const itemsAfterRecent = items.slice(recentSectionIndex + 1);
            expect(itemsAfterRecent.some((item: any) => item.label?.includes('bugfix/login'))).toBe(true);
            expect(itemsAfterRecent.some((item: any) => item.label?.includes('feature/auth'))).toBe(true);
        });

        it('should not show Recent section when no MRU branches exist', async () => {
            const mockRepository: Repository = {
                rootUri: { fsPath: '/test/repo' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepository]);
            mockRepoContextService.getMRUBranches.mockReturnValue([]);
            mockBranchesProvider.getRecent.mockResolvedValue([]);
            mockBranchesProvider.getLocal.mockResolvedValue([]);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            await menuController.open();

            const items = mockQuickPick.items;
            expect(items.some((item: any) => item.label === 'Recent')).toBe(false);
        });
    });
});
import * as vscode from 'vscode';
import { RepoContextService } from '../../src/services/repoContextService';
import { Repository } from '../../src/types/git';

describe('RepoContextService Integration', () => {
    let service: RepoContextService;
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
    });

    afterEach(() => {
        if (service) {
            service.dispose();
        }
    });

    describe('Git API integration', () => {
        it('should integrate with VS Code Git API when available', async () => {
            // Mock Git API with repositories
            const mockGitRepo = {
                rootUri: vscode.Uri.file('/test/repo'),
                state: {
                    HEAD: {
                        name: 'main',
                        ahead: 2,
                        behind: 1
                    },
                    workingTreeChanges: [{ uri: vscode.Uri.file('/test/repo/file.txt') }],
                    indexChanges: []
                }
            };

            const mockGitApi = {
                repositories: [mockGitRepo],
                onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
                onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
            };

            const mockGitExtension = {
                isActive: true,
                exports: {
                    getAPI: jest.fn(() => mockGitApi)
                },
                activate: jest.fn()
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

            service = RepoContextService.getInstance(mockContext);

            // Allow time for initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            const repositories = service.listRepositories();
            expect(repositories).toHaveLength(1);

            const repo = repositories[0];
            expect(repo.name).toBe('repo');
            expect(repo.currentBranch).toBe('main');
            expect(repo.ahead).toBe(2);
            expect(repo.behind).toBe(1);
            expect(repo.hasChanges).toBe(true);
        });

        it('should handle inactive Git extension', async () => {
            const mockGitExtension = {
                isActive: false,
                exports: {
                    getAPI: jest.fn(() => ({
                        repositories: [],
                        onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
                        onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
                    }))
                },
                activate: jest.fn().mockResolvedValue(undefined)
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

            service = RepoContextService.getInstance(mockContext);

            expect(mockGitExtension.activate).toHaveBeenCalled();
        });

        it('should handle repository state changes', async () => {
            const mockGitRepo = {
                rootUri: vscode.Uri.file('/test/repo'),
                state: {
                    HEAD: { name: 'main' },
                    workingTreeChanges: [],
                    indexChanges: []
                }
            };

            let repositoryChangeCallback: () => void;

            const mockGitApi = {
                repositories: [mockGitRepo],
                onDidOpenRepository: jest.fn((callback) => {
                    repositoryChangeCallback = callback;
                    return { dispose: jest.fn() };
                }),
                onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
            };

            const mockGitExtension = {
                isActive: true,
                exports: {
                    getAPI: jest.fn(() => mockGitApi)
                }
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

            service = RepoContextService.getInstance(mockContext);

            // Simulate repository change
            mockGitApi.repositories.push({
                rootUri: vscode.Uri.file('/test/repo2'),
                state: {
                    HEAD: { name: 'develop' },
                    workingTreeChanges: [],
                    indexChanges: []
                }
            });

            // Trigger the callback
            repositoryChangeCallback!();

            // Allow time for refresh
            await new Promise(resolve => setTimeout(resolve, 10));

            const repositories = service.listRepositories();
            expect(repositories).toHaveLength(2);
        });
    });

    describe('repository name extraction', () => {
        beforeEach(() => {
            const mockGitExtension = {
                isActive: true,
                exports: {
                    getAPI: jest.fn(() => ({
                        repositories: [],
                        onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
                        onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
                    }))
                }
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);
            service = RepoContextService.getInstance(mockContext);
        });

        it('should extract repository name from Unix path', () => {
            const getRepositoryName = (service as any).getRepositoryName;
            const name = getRepositoryName(vscode.Uri.file('/home/user/projects/my-repo'));
            expect(name).toBe('my-repo');
        });

        it('should extract repository name from Windows path', () => {
            const getRepositoryName = (service as any).getRepositoryName;
            const name = getRepositoryName(vscode.Uri.file('C:\\Users\\user\\projects\\my-repo'));
            expect(name).toBe('my-repo');
        });

        it('should handle root directory', () => {
            const getRepositoryName = (service as any).getRepositoryName;
            const name = getRepositoryName(vscode.Uri.file('/'));
            expect(name).toBe('Unknown');
        });
    });

    describe('active repository management', () => {
        let changeEventFired: boolean;
        let lastChangeEvent: Repository | undefined;

        beforeEach(() => {
            const mockGitExtension = {
                isActive: true,
                exports: {
                    getAPI: jest.fn(() => ({
                        repositories: [],
                        onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
                        onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
                    }))
                }
            };

            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);
            service = RepoContextService.getInstance(mockContext);

            changeEventFired = false;
            lastChangeEvent = undefined;

            service.onDidChangeActiveRepository((repo) => {
                changeEventFired = true;
                lastChangeEvent = repo;
            });
        });

        it('should automatically set first repository as active', async () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            // Simulate repository detection by setting up the Git API mock
            const mockGitRepo = {
                rootUri: vscode.Uri.file('/test/repo'),
                state: {
                    HEAD: { name: 'main' },
                    workingTreeChanges: [],
                    indexChanges: []
                }
            };

            const mockGitApi = (service as any)._gitApi;
            if (mockGitApi) {
                mockGitApi.repositories = [mockGitRepo];
            }

            await (service as any).refreshRepositories();

            const activeRepo = service.getActiveRepository();
            expect(activeRepo).toBeDefined();
            expect(activeRepo?.name).toBe('repo');
            expect(changeEventFired).toBe(true);
        });

        it('should clear active repository when no repositories available', async () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            service.setActiveRepository(mockRepo);
            changeEventFired = false;

            // Simulate all repositories being removed
            (service as any)._repositories = [];
            await (service as any).refreshRepositories();

            expect(service.getActiveRepository()).toBeUndefined();
            expect(changeEventFired).toBe(true);
            expect(lastChangeEvent).toBeUndefined();
        });
    });
});
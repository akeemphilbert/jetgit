import * as vscode from 'vscode';
import { RepoContextService } from '../../../src/services/repoContextService';
import { Repository } from '../../../src/types/git';

// Mock VS Code API
jest.mock('vscode', () => ({
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path }))
    },
    extensions: {
        getExtension: jest.fn()
    }
}));

describe('RepoContextService', () => {
    let mockContext: vscode.ExtensionContext;
    let mockGlobalState: any;
    let service: RepoContextService;

    beforeEach(() => {
        // Reset singleton
        (RepoContextService as any).instance = undefined;

        mockGlobalState = {
            get: jest.fn(),
            update: jest.fn()
        };

        mockContext = {
            globalState: mockGlobalState
        } as any;

        // Mock Git extension
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

        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGitExtension);
    });

    afterEach(() => {
        if (service) {
            service.dispose();
        }
    });

    describe('getInstance', () => {
        it('should create singleton instance', () => {
            const instance1 = RepoContextService.getInstance(mockContext);
            const instance2 = RepoContextService.getInstance();
            
            expect(instance1).toBe(instance2);
        });

        it('should throw error if context not provided for first call', () => {
            expect(() => RepoContextService.getInstance()).toThrow(
                'Extension context is required for first initialization of RepoContextService'
            );
        });
    });

    describe('repository management', () => {
        beforeEach(() => {
            service = RepoContextService.getInstance(mockContext);
        });

        it('should initialize with empty repository list', () => {
            const repos = service.listRepositories();
            expect(repos).toEqual([]);
        });

        it('should return undefined for active repository initially', () => {
            const activeRepo = service.getActiveRepository();
            expect(activeRepo).toBeUndefined();
        });

        it('should set and get active repository', () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            service.setActiveRepository(mockRepo);
            const activeRepo = service.getActiveRepository();
            
            expect(activeRepo).toBe(mockRepo);
        });

        it('should emit change event when active repository changes', () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            const eventEmitter = (service as any)._onDidChangeActiveRepository;
            const fireSpy = jest.spyOn(eventEmitter, 'fire');

            service.setActiveRepository(mockRepo);
            
            expect(fireSpy).toHaveBeenCalledWith(mockRepo);
        });

        it('should not emit change event when setting same repository', () => {
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            service.setActiveRepository(mockRepo);
            
            const eventEmitter = (service as any)._onDidChangeActiveRepository;
            const fireSpy = jest.spyOn(eventEmitter, 'fire');
            fireSpy.mockClear();

            service.setActiveRepository(mockRepo);
            
            expect(fireSpy).not.toHaveBeenCalled();
        });
    });

    describe('MRU branch tracking', () => {
        let mockRepo: Repository;

        beforeEach(() => {
            service = RepoContextService.getInstance(mockContext);
            mockRepo = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };
        });

        it('should initialize with empty MRU list', () => {
            const mruBranches = service.getMRUBranches(mockRepo);
            expect(mruBranches).toEqual([]);
        });

        it('should add branch to MRU list', () => {
            service.addToMRU(mockRepo, 'feature/test');
            
            const mruBranches = service.getMRUBranches(mockRepo);
            expect(mruBranches).toEqual(['feature/test']);
        });

        it('should move existing branch to front of MRU list', () => {
            service.addToMRU(mockRepo, 'feature/test1');
            service.addToMRU(mockRepo, 'feature/test2');
            service.addToMRU(mockRepo, 'feature/test1'); // Move to front
            
            const mruBranches = service.getMRUBranches(mockRepo);
            expect(mruBranches).toEqual(['feature/test1', 'feature/test2']);
        });

        it('should limit MRU list to maximum branches', () => {
            // Add more than max branches
            for (let i = 0; i < 25; i++) {
                service.addToMRU(mockRepo, `branch-${i}`);
            }
            
            const mruBranches = service.getMRUBranches(mockRepo);
            expect(mruBranches.length).toBe(20); // Max is 20
            expect(mruBranches[0]).toBe('branch-24'); // Most recent first
        });

        it('should persist MRU data to global state', () => {
            service.addToMRU(mockRepo, 'feature/test');
            
            expect(mockGlobalState.update).toHaveBeenCalledWith(
                'jbGit.mruBranches',
                expect.objectContaining({
                    [mockRepo.rootUri.fsPath]: expect.objectContaining({
                        branches: ['feature/test']
                    })
                })
            );
        });

        it('should load MRU data from global state', () => {
            const storedData = {
                [mockRepo.rootUri.fsPath]: {
                    branches: ['stored/branch1', 'stored/branch2'],
                    lastUpdated: Date.now()
                }
            };
            
            mockGlobalState.get.mockReturnValue(storedData);
            
            // Create new service instance to trigger loading
            service.dispose();
            service = RepoContextService.getInstance(mockContext);
            
            const mruBranches = service.getMRUBranches(mockRepo);
            expect(mruBranches).toEqual(['stored/branch1', 'stored/branch2']);
        });

        it('should clear MRU data for repository', () => {
            service.addToMRU(mockRepo, 'feature/test');
            service.clearMRU(mockRepo);
            
            const mruBranches = service.getMRUBranches(mockRepo);
            expect(mruBranches).toEqual([]);
        });

        it('should handle different repositories separately', () => {
            const mockRepo2: Repository = {
                rootUri: vscode.Uri.file('/test/repo2'),
                name: 'test-repo2',
                currentBranch: 'main',
                hasChanges: false
            };

            service.addToMRU(mockRepo, 'feature/repo1');
            service.addToMRU(mockRepo2, 'feature/repo2');
            
            expect(service.getMRUBranches(mockRepo)).toEqual(['feature/repo1']);
            expect(service.getMRUBranches(mockRepo2)).toEqual(['feature/repo2']);
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            service = RepoContextService.getInstance(mockContext);
        });

        it('should handle missing Git extension gracefully', () => {
            (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);
            
            // Should not throw
            expect(() => RepoContextService.getInstance(mockContext)).not.toThrow();
        });

        it('should handle MRU data loading errors gracefully', () => {
            mockGlobalState.get.mockImplementation(() => {
                throw new Error('Storage error');
            });
            
            // Should not throw and should initialize with empty MRU data
            expect(() => RepoContextService.getInstance(mockContext)).not.toThrow();
            
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };
            
            expect(service.getMRUBranches(mockRepo)).toEqual([]);
        });

        it('should handle MRU data saving errors gracefully', () => {
            mockGlobalState.update.mockImplementation(() => {
                throw new Error('Storage error');
            });
            
            const mockRepo: Repository = {
                rootUri: vscode.Uri.file('/test/repo'),
                name: 'test-repo',
                currentBranch: 'main',
                hasChanges: false
            };
            
            // Should not throw
            expect(() => service.addToMRU(mockRepo, 'feature/test')).not.toThrow();
        });
    });

    describe('disposal', () => {
        beforeEach(() => {
            service = RepoContextService.getInstance(mockContext);
        });

        it('should dispose of all resources', () => {
            const eventEmitter = (service as any)._onDidChangeActiveRepository;
            const disposeSpy = jest.spyOn(eventEmitter, 'dispose');
            
            service.dispose();
            
            expect(disposeSpy).toHaveBeenCalled();
            expect((RepoContextService as any).instance).toBeUndefined();
        });
    });
});
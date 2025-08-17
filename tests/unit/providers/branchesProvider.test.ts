import { BranchesProvider, BranchItem, BranchGroup, TagItem } from '../../../src/providers/branchesProvider';
import { IGitService } from '../../../src/services/gitService';
import { RepoContextService } from '../../../src/services/repoContextService';
import { Branch, Repository, Remote } from '../../../src/types/git';
import * as vscode from 'vscode';

// Mock VS Code
jest.mock('vscode', () => ({
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: 'file', path })
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    Disposable: {
        from: jest.fn()
    }
}));

describe('BranchesProvider', () => {
    let branchesProvider: BranchesProvider;
    let mockGitService: jest.Mocked<IGitService>;
    let mockRepoContextService: jest.Mocked<RepoContextService>;
    let mockRepository: Repository;
    let mockBranches: Branch[];
    let mockRemotes: Remote[];

    beforeEach(() => {
        // Create mock repository
        mockRepository = {
            rootUri: vscode.Uri.file('/test/repo'),
            name: 'test-repo',
            currentBranch: 'main',
            ahead: 0,
            behind: 0,
            hasChanges: false
        };

        // Create mock branches
        mockBranches = [
            {
                name: 'main',
                fullName: 'main',
                type: 'local',
                isActive: true,
                ahead: 0,
                behind: 0,
                lastAccessed: new Date('2023-01-01')
            },
            {
                name: 'develop',
                fullName: 'develop',
                type: 'local',
                isActive: false,
                ahead: 2,
                behind: 1,
                lastAccessed: new Date('2023-01-02')
            },
            {
                name: 'feature/auth',
                fullName: 'feature/auth',
                type: 'local',
                isActive: false,
                ahead: 1,
                behind: 0,
                lastAccessed: new Date('2023-01-03')
            },
            {
                name: 'feature/ui',
                fullName: 'feature/ui',
                type: 'local',
                isActive: false,
                ahead: 0,
                behind: 2,
                lastAccessed: new Date('2023-01-04')
            },
            {
                name: 'origin/main',
                fullName: 'origin/main',
                type: 'remote',
                isActive: false,
                ahead: 0,
                behind: 0
            },
            {
                name: 'origin/develop',
                fullName: 'origin/develop',
                type: 'remote',
                isActive: false,
                ahead: 0,
                behind: 0
            }
        ];

        // Create mock remotes
        mockRemotes = [
            {
                name: 'origin',
                fetchUrl: 'https://github.com/test/repo.git',
                pushUrl: 'https://github.com/test/repo.git',
                branches: ['main', 'develop']
            }
        ];

        // Create mock GitService
        mockGitService = {
            getBranches: jest.fn().mockResolvedValue(mockBranches),
            getRemotes: jest.fn().mockResolvedValue(mockRemotes),
            createBranch: jest.fn(),
            checkoutBranch: jest.fn(),
            renameBranch: jest.fn(),
            fetch: jest.fn(),
            pull: jest.fn(),
            push: jest.fn(),
            commit: jest.fn(),
            merge: jest.fn(),
            rebase: jest.fn(),
            resetHead: jest.fn(),
            stashChanges: jest.fn(),
            unstashChanges: jest.fn(),
            createTag: jest.fn(),
            addRemote: jest.fn(),
            removeRemote: jest.fn(),
            getFileHistory: jest.fn(),
            getFileDiff: jest.fn(),
            revertFile: jest.fn(),
            getFileAnnotation: jest.fn(),
            getCurrentBranch: jest.fn(),
            getRepositoryRoot: jest.fn(),
            isRepository: jest.fn(),
            getRepositoryStatus: jest.fn(),
            getStashes: jest.fn(),
            detectMergeConflicts: jest.fn(),
            getConflictedFiles: jest.fn(),
            getFileConflicts: jest.fn(),
            resolveConflicts: jest.fn(),
            isInMergeState: jest.fn(),
            isInRebaseState: jest.fn()
        };

        // Create mock RepoContextService
        mockRepoContextService = {
            listRepositories: jest.fn().mockReturnValue([mockRepository]),
            getActiveRepository: jest.fn().mockReturnValue(mockRepository),
            setActiveRepository: jest.fn(),
            addToMRU: jest.fn(),
            getMRUBranches: jest.fn().mockReturnValue(['feature/auth', 'develop']),
            clearMRU: jest.fn(),
            onDidChangeActiveRepository: jest.fn().mockReturnValue({
                dispose: jest.fn()
            }),
            dispose: jest.fn()
        } as any;

        // Create BranchesProvider instance
        branchesProvider = new BranchesProvider(mockGitService, mockRepoContextService);
    });

    afterEach(() => {
        if (branchesProvider) {
            branchesProvider.dispose();
        }
        jest.clearAllMocks();
    });

    describe('getRecent', () => {
        it('should return recent branches based on MRU tracking', async () => {
            const recentBranches = await branchesProvider.getRecent();

            expect(recentBranches).toHaveLength(2);
            expect(recentBranches[0].branch.name).toBe('feature/auth');
            expect(recentBranches[0].isMRU).toBe(true);
            expect(recentBranches[0].divergenceBadge).toBe('↑1');
            
            expect(recentBranches[1].branch.name).toBe('develop');
            expect(recentBranches[1].isMRU).toBe(true);
            expect(recentBranches[1].divergenceBadge).toBe('↑2 ↓1');
        });

        it('should return empty array when no active repository', async () => {
            mockRepoContextService.getActiveRepository.mockReturnValue(undefined);

            const recentBranches = await branchesProvider.getRecent();

            expect(recentBranches).toEqual([]);
        });

        it('should limit recent branches to maximum count', async () => {
            const manyMRUBranches = Array.from({ length: 15 }, (_, i) => `branch-${i}`);
            mockRepoContextService.getMRUBranches.mockReturnValue(manyMRUBranches);

            const recentBranches = await branchesProvider.getRecent();

            expect(recentBranches.length).toBeLessThanOrEqual(10);
        });

        it('should handle repository parameter', async () => {
            const customRepo: Repository = {
                rootUri: vscode.Uri.file('/custom/repo'),
                name: 'custom-repo',
                currentBranch: 'main',
                hasChanges: false
            };

            await branchesProvider.getRecent(customRepo);

            expect(mockRepoContextService.getMRUBranches).toHaveBeenCalledWith(customRepo);
        });
    });

    describe('getLocal', () => {
        it('should return grouped local branches with divergence badges', async () => {
            const localGroups = await branchesProvider.getLocal();

            expect(localGroups).toHaveLength(2);
            
            // First group should be ungrouped branches (main, develop)
            const ungroupedGroup = localGroups.find(g => g.prefix === '');
            expect(ungroupedGroup).toBeDefined();
            expect(ungroupedGroup!.branches).toHaveLength(2);
            expect(ungroupedGroup!.branches.map(b => b.branch.name)).toContain('main');
            expect(ungroupedGroup!.branches.map(b => b.branch.name)).toContain('develop');

            // Second group should be feature branches
            const featureGroup = localGroups.find(g => g.prefix === 'feature/');
            expect(featureGroup).toBeDefined();
            expect(featureGroup!.branches).toHaveLength(2);
            expect(featureGroup!.branches.map(b => b.branch.name)).toContain('feature/auth');
            expect(featureGroup!.branches.map(b => b.branch.name)).toContain('feature/ui');
        });

        it('should calculate correct divergence badges', async () => {
            const localGroups = await branchesProvider.getLocal();
            
            const allBranches = localGroups.flatMap(g => g.branches);
            
            const mainBranch = allBranches.find(b => b.branch.name === 'main');
            expect(mainBranch?.divergenceBadge).toBeUndefined();
            
            const developBranch = allBranches.find(b => b.branch.name === 'develop');
            expect(developBranch?.divergenceBadge).toBe('↑2 ↓1');
            
            const featureAuthBranch = allBranches.find(b => b.branch.name === 'feature/auth');
            expect(featureAuthBranch?.divergenceBadge).toBe('↑1');
            
            const featureUiBranch = allBranches.find(b => b.branch.name === 'feature/ui');
            expect(featureUiBranch?.divergenceBadge).toBe('↓2');
        });

        it('should mark MRU branches correctly', async () => {
            const localGroups = await branchesProvider.getLocal();
            const allBranches = localGroups.flatMap(g => g.branches);
            
            const featureAuthBranch = allBranches.find(b => b.branch.name === 'feature/auth');
            expect(featureAuthBranch?.isMRU).toBe(true);
            
            const developBranch = allBranches.find(b => b.branch.name === 'develop');
            expect(developBranch?.isMRU).toBe(true);
            
            const mainBranch = allBranches.find(b => b.branch.name === 'main');
            expect(mainBranch?.isMRU).toBe(false);
        });

        it('should return empty array when no active repository', async () => {
            mockRepoContextService.getActiveRepository.mockReturnValue(undefined);

            const localGroups = await branchesProvider.getLocal();

            expect(localGroups).toEqual([]);
        });
    });

    describe('getRemotes', () => {
        it('should return remote branches grouped by remote name', async () => {
            const remoteGroups = await branchesProvider.getRemotes();

            expect(remoteGroups).toHaveLength(1);
            expect(remoteGroups[0].prefix).toBe('origin');
            expect(remoteGroups[0].branches).toHaveLength(2);
            expect(remoteGroups[0].branches.map(b => b.branch.name)).toContain('origin/main');
            expect(remoteGroups[0].branches.map(b => b.branch.name)).toContain('origin/develop');
        });

        it('should not mark remote branches as MRU', async () => {
            const remoteGroups = await branchesProvider.getRemotes();
            const allRemoteBranches = remoteGroups.flatMap(g => g.branches);

            allRemoteBranches.forEach(branch => {
                expect(branch.isMRU).toBe(false);
            });
        });

        it('should return empty array when no active repository', async () => {
            mockRepoContextService.getActiveRepository.mockReturnValue(undefined);

            const remoteGroups = await branchesProvider.getRemotes();

            expect(remoteGroups).toEqual([]);
        });
    });

    describe('getTags', () => {
        it('should return tags for the repository', async () => {
            const tags = await branchesProvider.getTags();

            expect(tags).toEqual([]);
            expect(mockGitService.getBranches).toHaveBeenCalled();
        });

        it('should return empty array when no active repository', async () => {
            mockRepoContextService.getActiveRepository.mockReturnValue(undefined);

            const tags = await branchesProvider.getTags();

            expect(tags).toEqual([]);
        });
    });

    describe('caching', () => {
        it('should cache branch data and reuse it', async () => {
            // First call
            await branchesProvider.getLocal();
            expect(mockGitService.getBranches).toHaveBeenCalledTimes(1);

            // Second call should use cache
            await branchesProvider.getLocal();
            expect(mockGitService.getBranches).toHaveBeenCalledTimes(1);
        });

        it('should refresh cache when explicitly requested', async () => {
            // First call
            await branchesProvider.getLocal();
            expect(mockGitService.getBranches).toHaveBeenCalledTimes(1);

            // Refresh cache
            await branchesProvider.refresh();

            // Next call should fetch fresh data
            await branchesProvider.getLocal();
            expect(mockGitService.getBranches).toHaveBeenCalledTimes(2);
        });

        it('should invalidate cache on repository change', async () => {
            // First call
            await branchesProvider.getLocal();
            expect(mockGitService.getBranches).toHaveBeenCalledTimes(1);

            // Simulate repository change
            branchesProvider.invalidateCache();

            // Next call should fetch fresh data
            await branchesProvider.getLocal();
            expect(mockGitService.getBranches).toHaveBeenCalledTimes(2);
        });
    });

    describe('divergence badge calculation', () => {
        it('should return undefined for branches with no divergence', () => {
            const provider = branchesProvider as any;
            const branch: Branch = {
                name: 'test',
                fullName: 'test',
                type: 'local',
                isActive: false,
                ahead: 0,
                behind: 0
            };

            const badge = provider.calculateDivergenceBadge(branch);
            expect(badge).toBeUndefined();
        });

        it('should return correct badge for ahead only', () => {
            const provider = branchesProvider as any;
            const branch: Branch = {
                name: 'test',
                fullName: 'test',
                type: 'local',
                isActive: false,
                ahead: 3,
                behind: 0
            };

            const badge = provider.calculateDivergenceBadge(branch);
            expect(badge).toBe('↑3');
        });

        it('should return correct badge for behind only', () => {
            const provider = branchesProvider as any;
            const branch: Branch = {
                name: 'test',
                fullName: 'test',
                type: 'local',
                isActive: false,
                ahead: 0,
                behind: 2
            };

            const badge = provider.calculateDivergenceBadge(branch);
            expect(badge).toBe('↓2');
        });

        it('should return correct badge for both ahead and behind', () => {
            const provider = branchesProvider as any;
            const branch: Branch = {
                name: 'test',
                fullName: 'test',
                type: 'local',
                isActive: false,
                ahead: 5,
                behind: 3
            };

            const badge = provider.calculateDivergenceBadge(branch);
            expect(badge).toBe('↑5 ↓3');
        });
    });

    describe('branch grouping', () => {
        it('should extract correct branch prefixes', () => {
            const provider = branchesProvider as any;

            expect(provider.extractBranchPrefix('feature/auth')).toBe('feature/');
            expect(provider.extractBranchPrefix('bugfix/login-issue')).toBe('bugfix/');
            expect(provider.extractBranchPrefix('hotfix/critical-bug')).toBe('hotfix/');
            expect(provider.extractBranchPrefix('main')).toBeNull();
            expect(provider.extractBranchPrefix('develop')).toBeNull();
        });

        it('should extract correct remote names', () => {
            const provider = branchesProvider as any;

            expect(provider.extractRemoteName('origin/main')).toBe('origin');
            expect(provider.extractRemoteName('upstream/develop')).toBe('upstream');
            expect(provider.extractRemoteName('fork/feature')).toBe('fork');
            expect(provider.extractRemoteName('main')).toBe('origin'); // fallback
        });
    });

    describe('error handling', () => {
        it('should handle GitService errors gracefully', async () => {
            mockGitService.getBranches.mockRejectedValue(new Error('Git error'));

            const localGroups = await branchesProvider.getLocal();

            expect(localGroups).toEqual([]);
        });

        it('should handle missing repository gracefully', async () => {
            mockRepoContextService.getActiveRepository.mockReturnValue(undefined);

            const recentBranches = await branchesProvider.getRecent();
            const localGroups = await branchesProvider.getLocal();
            const remoteGroups = await branchesProvider.getRemotes();
            const tags = await branchesProvider.getTags();

            expect(recentBranches).toEqual([]);
            expect(localGroups).toEqual([]);
            expect(remoteGroups).toEqual([]);
            expect(tags).toEqual([]);
        });
    });

    describe('performance', () => {
        it('should complete operations within reasonable time', async () => {
            const startTime = Date.now();

            // Make a single call to test performance
            await branchesProvider.getLocal();

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (including debounce delay)
            expect(duration).toBeLessThan(500);
        });
    });

    describe('disposal', () => {
        it('should clean up resources on dispose', () => {
            const disposeSpy = jest.spyOn(branchesProvider, 'dispose');

            branchesProvider.dispose();

            expect(disposeSpy).toHaveBeenCalled();
        });
    });
});
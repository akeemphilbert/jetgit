import * as vscode from 'vscode';
import { SCMTreeProvider, SCMTreeItem, SCMTreeItemType } from '../../../src/providers/scmTreeProvider';
import { IGitService } from '../../../src/services/gitService';
import { RepoContextService } from '../../../src/services/repoContextService';
import { BranchesProvider } from '../../../src/providers/branchesProvider';
import { Branch, Repository } from '../../../src/types/git';

// Mock VS Code API
jest.mock('vscode', () => ({
    TreeItem: class MockTreeItem {
        public label: string;
        public collapsibleState: any;
        public contextValue?: string;
        public tooltip?: string;
        public iconPath?: any;
        public description?: string;

        constructor(label: string, collapsibleState?: any) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
    },
    ThemeIcon: jest.fn().mockImplementation((id) => ({ id })),
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue(false)
        }),
        onDidChangeConfiguration: jest.fn().mockReturnValue({
            dispose: jest.fn()
        })
    },
    window: {
        showInputBox: jest.fn()
    }
}));

describe('SCMTreeProvider', () => {
    let provider: SCMTreeProvider;
    let mockGitService: jest.Mocked<IGitService>;
    let mockRepoContextService: jest.Mocked<RepoContextService>;
    let mockBranchesProvider: jest.Mocked<BranchesProvider>;
    let mockRepository: Repository;

    beforeEach(() => {
        // Create mock services
        mockGitService = {
            getBranches: jest.fn(),
            getRemotes: jest.fn(),
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
            revertFile: jest.fn()
        } as any;

        mockRepoContextService = {
            getActiveRepository: jest.fn(),
            listRepositories: jest.fn(),
            setActiveRepository: jest.fn(),
            getMRUBranches: jest.fn(),
            onDidChangeActiveRepository: jest.fn().mockReturnValue({
                dispose: jest.fn()
            }),
            dispose: jest.fn()
        } as any;

        mockBranchesProvider = {
            getRecent: jest.fn(),
            getLocal: jest.fn(),
            getRemotes: jest.fn(),
            getTags: jest.fn(),
            refresh: jest.fn(),
            invalidateCache: jest.fn(),
            dispose: jest.fn()
        } as any;

        mockRepository = {
            rootUri: { fsPath: '/test/repo' } as vscode.Uri,
            name: 'test-repo',
            currentBranch: 'main',
            ahead: 0,
            behind: 0,
            hasChanges: false
        };

        // Setup default mocks
        mockRepoContextService.getActiveRepository.mockReturnValue(mockRepository);
        mockBranchesProvider.getRecent.mockResolvedValue([]);
        mockBranchesProvider.getLocal.mockResolvedValue([]);
        mockBranchesProvider.getRemotes.mockResolvedValue([]);
        mockBranchesProvider.getTags.mockResolvedValue([]);

        provider = new SCMTreeProvider(mockGitService, mockRepoContextService, mockBranchesProvider);
    });

    afterEach(() => {
        provider.dispose();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct dependencies', () => {
            expect(provider).toBeDefined();
            expect(mockRepoContextService.onDidChangeActiveRepository).toHaveBeenCalled();
        });

        it('should listen for configuration changes', () => {
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });
    });

    describe('getTreeItem', () => {
        it('should return the tree item as-is', () => {
            const mockBranch: Branch = {
                name: 'test',
                fullName: 'test',
                type: 'local',
                isActive: false,
                ahead: 0,
                behind: 0
            };
            const item = new SCMTreeItem('test', vscode.TreeItemCollapsibleState.None, SCMTreeItemType.Branch, mockBranch);
            const result = provider.getTreeItem(item);
            expect(result).toBe(item);
        });
    });

    describe('getChildren', () => {
        it('should return root sections when no element provided', async () => {
            const children = await provider.getChildren();
            
            expect(children).toHaveLength(4); // Recent, Local, Remote, Tags (changelists disabled by default)
            expect(children[0].label).toBe('Recent');
            expect(children[1].label).toBe('Local');
            expect(children[2].label).toBe('Remote');
            expect(children[3].label).toBe('Tags');
        });

        it('should return empty array when no active repository', async () => {
            mockRepoContextService.getActiveRepository.mockReturnValue(undefined);
            
            const children = await provider.getChildren();
            expect(children).toHaveLength(0);
        });

        it('should include changelists section when enabled', async () => {
            // Mock configuration to enable changelists
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn().mockReturnValue(true)
            });

            // Create new provider with changelists enabled
            const providerWithChangelists = new SCMTreeProvider(mockGitService, mockRepoContextService, mockBranchesProvider);
            
            const children = await providerWithChangelists.getChildren();
            expect(children).toHaveLength(5); // Recent, Local, Remote, Tags, Changelists
            expect(children[4].label).toBe('Changelists');
            
            providerWithChangelists.dispose();
        });
    });

    describe('section children', () => {
        it('should get recent branches for recent section', async () => {
            const mockBranch: Branch = {
                name: 'feature/test',
                fullName: 'feature/test',
                type: 'local',
                isActive: false,
                ahead: 1,
                behind: 0
            };

            mockBranchesProvider.getRecent.mockResolvedValue([
                { branch: mockBranch, divergenceBadge: '↑1', isMRU: true }
            ]);

            const recentSection = new SCMTreeItem(
                'Recent',
                vscode.TreeItemCollapsibleState.Expanded,
                SCMTreeItemType.Section,
                { sectionType: 'recent' }
            );

            const children = await provider.getChildren(recentSection);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('feature/test');
            expect(children[0].itemType).toBe(SCMTreeItemType.Branch);
        });

        it('should get local branches for local section', async () => {
            const mockBranch: Branch = {
                name: 'main',
                fullName: 'main',
                type: 'local',
                isActive: true,
                ahead: 0,
                behind: 0
            };

            mockBranchesProvider.getLocal.mockResolvedValue([
                {
                    prefix: '',
                    branches: [{ branch: mockBranch, divergenceBadge: undefined, isMRU: false }],
                    isCollapsed: false
                }
            ]);

            const localSection = new SCMTreeItem(
                'Local',
                vscode.TreeItemCollapsibleState.Expanded,
                SCMTreeItemType.Section,
                { sectionType: 'local' }
            );

            const children = await provider.getChildren(localSection);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('main');
            expect(children[0].itemType).toBe(SCMTreeItemType.Branch);
        });

        it('should create groups for prefixed branches', async () => {
            const mockBranch: Branch = {
                name: 'feature/auth',
                fullName: 'feature/auth',
                type: 'local',
                isActive: false,
                ahead: 0,
                behind: 0
            };

            mockBranchesProvider.getLocal.mockResolvedValue([
                {
                    prefix: 'feature/',
                    branches: [{ branch: mockBranch, divergenceBadge: undefined, isMRU: false }],
                    isCollapsed: false
                }
            ]);

            const localSection = new SCMTreeItem(
                'Local',
                vscode.TreeItemCollapsibleState.Expanded,
                SCMTreeItemType.Section,
                { sectionType: 'local' }
            );

            const children = await provider.getChildren(localSection);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('feature/');
            expect(children[0].itemType).toBe(SCMTreeItemType.Group);
        });

        it('should get remote branches for remote section', async () => {
            const mockBranch: Branch = {
                name: 'origin/main',
                fullName: 'origin/main',
                type: 'remote',
                isActive: false,
                ahead: 0,
                behind: 0
            };

            mockBranchesProvider.getRemotes.mockResolvedValue([
                {
                    prefix: 'origin',
                    branches: [{ branch: mockBranch, divergenceBadge: undefined, isMRU: false }],
                    isCollapsed: false
                }
            ]);

            const remoteSection = new SCMTreeItem(
                'Remote',
                vscode.TreeItemCollapsibleState.Expanded,
                SCMTreeItemType.Section,
                { sectionType: 'remote' }
            );

            const children = await provider.getChildren(remoteSection);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('origin');
            expect(children[0].itemType).toBe(SCMTreeItemType.Group);
        });

        it('should get tags for tags section', async () => {
            mockBranchesProvider.getTags.mockResolvedValue([
                { name: 'v1.0.0', commit: 'abc123', message: 'Release v1.0.0' }
            ]);

            const tagsSection = new SCMTreeItem(
                'Tags',
                vscode.TreeItemCollapsibleState.Collapsed,
                SCMTreeItemType.Section,
                { sectionType: 'tags' }
            );

            const children = await provider.getChildren(tagsSection);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('v1.0.0');
            expect(children[0].itemType).toBe(SCMTreeItemType.Tag);
        });
    });

    describe('group children', () => {
        it('should get branches for a group', async () => {
            const mockBranch: Branch = {
                name: 'feature/auth',
                fullName: 'feature/auth',
                type: 'local',
                isActive: false,
                ahead: 0,
                behind: 0
            };

            const groupItem = new SCMTreeItem(
                'feature/',
                vscode.TreeItemCollapsibleState.Collapsed,
                SCMTreeItemType.Group,
                { branches: [mockBranch] }
            );

            const children = await provider.getChildren(groupItem);
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('feature/auth');
            expect(children[0].itemType).toBe(SCMTreeItemType.Branch);
        });

        it('should return empty array for group without branches', async () => {
            const groupItem = new SCMTreeItem(
                'empty/',
                vscode.TreeItemCollapsibleState.Collapsed,
                SCMTreeItemType.Group,
                {}
            );

            const children = await provider.getChildren(groupItem);
            expect(children).toHaveLength(0);
        });
    });

    describe('refresh', () => {
        it('should fire tree data change event', () => {
            const mockEventEmitter = {
                fire: jest.fn(),
                event: jest.fn(),
                dispose: jest.fn()
            };
            
            (vscode.EventEmitter as jest.Mock).mockReturnValue(mockEventEmitter);
            
            const newProvider = new SCMTreeProvider(mockGitService, mockRepoContextService, mockBranchesProvider);
            newProvider.refresh();
            
            expect(mockEventEmitter.fire).toHaveBeenCalled();
            newProvider.dispose();
        });
    });

    describe('error handling', () => {
        it('should handle errors when getting recent branches', async () => {
            mockBranchesProvider.getRecent.mockRejectedValue(new Error('Test error'));
            
            const recentSection = new SCMTreeItem(
                'Recent',
                vscode.TreeItemCollapsibleState.Expanded,
                SCMTreeItemType.Section,
                { sectionType: 'recent' }
            );

            const children = await provider.getChildren(recentSection);
            expect(children).toHaveLength(0);
        });

        it('should handle errors when getting local branches', async () => {
            mockBranchesProvider.getLocal.mockRejectedValue(new Error('Test error'));
            
            const localSection = new SCMTreeItem(
                'Local',
                vscode.TreeItemCollapsibleState.Expanded,
                SCMTreeItemType.Section,
                { sectionType: 'local' }
            );

            const children = await provider.getChildren(localSection);
            expect(children).toHaveLength(0);
        });
    });

    describe('dispose', () => {
        it('should dispose of all resources', () => {
            const mockEventEmitter = {
                fire: jest.fn(),
                event: jest.fn(),
                dispose: jest.fn()
            };
            
            (vscode.EventEmitter as jest.Mock).mockReturnValue(mockEventEmitter);
            
            const newProvider = new SCMTreeProvider(mockGitService, mockRepoContextService, mockBranchesProvider);
            newProvider.dispose();
            
            expect(mockEventEmitter.dispose).toHaveBeenCalled();
        });
    });
});
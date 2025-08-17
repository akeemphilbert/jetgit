import { MenuController } from '../../../src/providers/gitMenuController';
import { GitService } from '../../../src/services/gitService';
import { RepoContextService } from '../../../src/services/repoContextService';
import { BranchesProvider } from '../../../src/providers/branchesProvider';
import { Branch, Repository } from '../../../src/types/git';

// Mock VS Code API
const mockVscode = {
    window: {
        createQuickPick: jest.fn(),
        showQuickPick: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        }))
    },
    commands: {
        executeCommand: jest.fn()
    },
    QuickPickItemKind: {
        Separator: -1
    },
    ExtensionContext: jest.fn(),
    workspace: {
        onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
        getConfiguration: jest.fn(() => ({
            get: jest.fn()
        }))
    },
    extensions: {
        getExtension: jest.fn(() => ({
            exports: {
                getAPI: jest.fn(() => ({
                    repositories: []
                }))
            }
        }))
    }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('UI Polish Tests', () => {
    let menuController: MenuController;
    let mockGitService: jest.Mocked<GitService>;
    let mockRepoContextService: jest.Mocked<RepoContextService>;
    let mockBranchesProvider: jest.Mocked<BranchesProvider>;
    let mockQuickPick: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create mock QuickPick
        mockQuickPick = {
            items: [],
            matchOnDescription: false,
            matchOnDetail: false,
            canSelectMany: false,
            ignoreFocusOut: false,
            selectedItems: [],
            onDidChangeSelection: jest.fn(),
            onDidHide: jest.fn(),
            onDidAccept: jest.fn(),
            onDidChangeValue: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        };

        mockVscode.window.createQuickPick.mockReturnValue(mockQuickPick);

        // Create mock services
        mockGitService = {
            getBranches: jest.fn()
        } as any;

        mockRepoContextService = {
            listRepositories: jest.fn(),
            getActiveRepository: jest.fn(),
            setActiveRepository: jest.fn(),
            getMRUBranches: jest.fn(),
            addToMRU: jest.fn()
        } as any;

        mockBranchesProvider = {
            getRecent: jest.fn(),
            getLocal: jest.fn(),
            getRemotes: jest.fn(),
            getTags: jest.fn()
        } as any;

        menuController = new MenuController(
            mockGitService,
            mockRepoContextService,
            mockBranchesProvider
        );
    });

    describe('JetBrains-style Menu Items', () => {
        it('should create top actions with proper JetBrains-style labels and icons', async () => {
            const mockRepo: Repository = {
                rootUri: { fsPath: '/test' } as any,
                name: 'test-repo',
                currentBranch: 'main'
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepo]);
            mockBranchesProvider.getRecent.mockResolvedValue([]);
            mockBranchesProvider.getLocal.mockResolvedValue([]);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            await menuController.open();

            // Verify QuickPick configuration
            expect(mockQuickPick.matchOnDescription).toBe(true);
            expect(mockQuickPick.matchOnDetail).toBe(true);
            expect(mockQuickPick.canSelectMany).toBe(false);
            expect(mockQuickPick.ignoreFocusOut).toBe(false);

            // Verify event handlers are set up
            expect(mockQuickPick.onDidChangeSelection).toHaveBeenCalled();
            expect(mockQuickPick.onDidHide).toHaveBeenCalled();
            expect(mockQuickPick.onDidAccept).toHaveBeenCalled();
            expect(mockQuickPick.onDidChangeValue).toHaveBeenCalled();

            // Check that items include JetBrains-style labels
            const items = mockQuickPick.items;
            const actionLabels = items
                .filter((item: any) => item.type === 'action')
                .map((item: any) => item.label);

            expect(actionLabels).toContain('$(sync) Update Project…');
            expect(actionLabels).toContain('$(git-commit) Commit…');
            expect(actionLabels).toContain('$(arrow-up) Push…');
            expect(actionLabels).toContain('$(git-branch) New Branch…');
            expect(actionLabels).toContain('$(tag) Checkout Tag or Revision…');
        });

        it('should use proper VS Code icons for branches', async () => {
            const mockRepo: Repository = {
                rootUri: { fsPath: '/test' } as any,
                name: 'test-repo',
                currentBranch: 'main'
            };

            const mockBranches: Branch[] = [
                {
                    name: 'main',
                    fullName: 'main',
                    type: 'local',
                    isActive: true,
                    ahead: 2,
                    behind: 1
                },
                {
                    name: 'feature/test',
                    fullName: 'feature/test',
                    type: 'local',
                    isActive: false,
                    ahead: 0,
                    behind: 0
                }
            ];

            mockRepoContextService.listRepositories.mockReturnValue([mockRepo]);
            mockBranchesProvider.getRecent.mockResolvedValue([]);
            mockBranchesProvider.getLocal.mockResolvedValue([{
                prefix: '',
                branches: mockBranches.map(branch => ({ branch, divergenceBadge: '' }))
            }]);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            await menuController.open();

            const items = mockQuickPick.items;
            const branchItems = items.filter((item: any) => item.type === 'branch');

            // Check active branch uses star-full icon
            const activeBranch = branchItems.find((item: any) => item.branch?.isActive);
            expect(activeBranch?.label).toContain('$(star-full)');

            // Check inactive branch uses git-branch icon
            const inactiveBranch = branchItems.find((item: any) => !item.branch?.isActive);
            expect(inactiveBranch?.label).toContain('$(git-branch)');
        });

        it('should use proper VS Code icons for divergence indicators', async () => {
            const mockRepo: Repository = {
                rootUri: { fsPath: '/test' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                ahead: 2,
                behind: 1
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepo, mockRepo]);

            await menuController.open();

            const items = mockQuickPick.items;
            const repoItems = items.filter((item: any) => item.type === 'repository');

            // Check repository item uses proper icons for divergence
            const repoItem = repoItems[0];
            expect(repoItem?.description).toContain('$(arrow-up)2');
            expect(repoItem?.description).toContain('$(arrow-down)1');
        });

        it('should use proper warning icon for divergence banner', async () => {
            const mockRepo: Repository = {
                rootUri: { fsPath: '/test' } as any,
                name: 'test-repo',
                currentBranch: 'main',
                ahead: 2,
                behind: 0
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepo, mockRepo]);

            await menuController.open();

            const items = mockQuickPick.items;
            const warningItem = items.find((item: any) => item.type === 'warning');

            expect(warningItem?.label).toBe('$(warning) Branches have diverged');
        });
    });

    describe('Type-ahead Filtering', () => {
        it('should filter items based on search value', async () => {
            const mockRepo: Repository = {
                rootUri: { fsPath: '/test' } as any,
                name: 'test-repo',
                currentBranch: 'main'
            };

            mockRepoContextService.listRepositories.mockReturnValue([mockRepo]);
            mockBranchesProvider.getRecent.mockResolvedValue([]);
            mockBranchesProvider.getLocal.mockResolvedValue([]);
            mockBranchesProvider.getRemotes.mockResolvedValue([]);
            mockBranchesProvider.getTags.mockResolvedValue([]);

            await menuController.open();

            // Simulate typing in the QuickPick
            const onDidChangeValueCallback = mockQuickPick.onDidChangeValue.mock.calls[0][0];
            
            // Set initial items
            mockQuickPick.items = [
                { type: 'action', label: '$(sync) Update Project…', description: 'Pull latest changes' },
                { type: 'action', label: '$(git-commit) Commit…', description: 'Commit changes' },
                { type: 'separator', label: '' }
            ];

            // Simulate search for "update"
            onDidChangeValueCallback('update');

            // The filtering should keep items that match "update"
            const filteredItems = mockQuickPick.items;
            const actionItems = filteredItems.filter((item: any) => item.type === 'action');
            
            expect(actionItems.length).toBeGreaterThan(0);
            expect(actionItems.some((item: any) => 
                item.label.toLowerCase().includes('update') || 
                item.description?.toLowerCase().includes('update')
            )).toBe(true);
        });
    });
});
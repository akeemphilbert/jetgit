import { GitMenuController } from '../../../src/providers/gitMenuController';
import { GitService } from '../../../src/services/gitService';
import { GitMenuProvider } from '../../../src/providers/gitMenuProvider';

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
    }
}));

// Mock GitService and GitMenuProvider
jest.mock('../../../src/services/gitService');
jest.mock('../../../src/providers/gitMenuProvider');

describe('GitMenuController', () => {
    let gitMenuController: GitMenuController;
    let mockGitService: jest.Mocked<GitService>;
    let mockGitMenuProvider: jest.Mocked<GitMenuProvider>;

    beforeEach(() => {
        mockGitService = new GitService() as jest.Mocked<GitService>;
        gitMenuController = new GitMenuController(mockGitService);
        
        // Get the mocked GitMenuProvider instance
        mockGitMenuProvider = (GitMenuProvider as jest.MockedClass<typeof GitMenuProvider>).mock.instances[0] as jest.Mocked<GitMenuProvider>;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('showGitMenu', () => {
        it('should create and show QuickPick with menu items', async () => {
            const mockMenuItems = [
                {
                    id: 'update-project',
                    label: 'Update Project',
                    command: 'jetgit.updateProject'
                },
                {
                    id: 'commit-changes',
                    label: 'Commit Changes',
                    description: '3 changes'
                }
            ];

            mockGitMenuProvider.buildGitMenu.mockResolvedValue(mockMenuItems);

            await gitMenuController.showGitMenu();

            expect(mockGitMenuProvider.buildGitMenu).toHaveBeenCalled();
            expect(mockQuickPick.title).toBe('Git Menu');
            expect(mockQuickPick.placeholder).toBe('Select a Git operation');
            expect(mockQuickPick.canSelectMany).toBe(false);
            expect(mockQuickPick.matchOnDescription).toBe(true);
            expect(mockQuickPick.matchOnDetail).toBe(true);
            expect(mockQuickPick.show).toHaveBeenCalled();
        });

        it('should handle errors when building menu', async () => {
            const vscode = require('vscode');
            mockGitMenuProvider.buildGitMenu.mockRejectedValue(new Error('Menu build failed'));

            await gitMenuController.showGitMenu();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to show Git menu: Error: Menu build failed');
        });
    });

    describe('convertToQuickPickItems', () => {
        it('should convert menu items to QuickPick items correctly', async () => {
            const mockMenuItems = [
                {
                    id: 'update-project',
                    label: 'Update Project',
                    description: 'Pull latest changes',
                    icon: { id: 'sync' },
                    command: 'jetgit.updateProject'
                },
                {
                    id: 'separator-1',
                    label: '─────────────────',
                    contextValue: 'separator'
                },
                {
                    id: 'branch-main',
                    label: '● main',
                    contextValue: 'branch',
                    children: [
                        {
                            id: 'branch-main-checkout',
                            label: 'Checkout',
                            command: 'jetgit.checkout'
                        }
                    ]
                }
            ];

            mockGitMenuProvider.buildGitMenu.mockResolvedValue(mockMenuItems);

            await gitMenuController.showGitMenu();

            // Check that items were converted correctly (separators should be filtered out)
            expect(mockQuickPick.items).toHaveLength(2); // separator should be filtered out
            
            const items = mockQuickPick.items;
            expect(items[0].label).toBe('$(sync) Update Project');
            expect(items[0].description).toBe('Pull latest changes');
            
            expect(items[1].label).toBe('● main →'); // Should have arrow for children
        });
    });

    describe('formatLabel', () => {
        it('should format label with icon correctly', async () => {
            const controller = gitMenuController as any;
            
            const item = {
                id: 'test',
                label: 'Test Item',
                icon: { id: 'sync' }
            };

            const formatted = controller.formatLabel(item);
            expect(formatted).toBe('$(sync) Test Item');
        });

        it('should format header labels correctly', async () => {
            const controller = gitMenuController as any;
            
            const item = {
                id: 'header',
                label: 'Common Tasks',
                contextValue: 'header'
            };

            const formatted = controller.formatLabel(item);
            expect(formatted).toBe('── COMMON TASKS ──');
        });

        it('should add arrow for items with children', async () => {
            const controller = gitMenuController as any;
            
            const item = {
                id: 'branch',
                label: 'main',
                children: [{ id: 'child', label: 'Child' }]
            };

            const formatted = controller.formatLabel(item);
            expect(formatted).toBe('main →');
        });
    });

    describe('getItemDetail', () => {
        it('should return correct detail for branch items', async () => {
            const controller = gitMenuController as any;
            
            const item = {
                id: 'branch',
                label: 'main',
                contextValue: 'branch',
                children: [
                    { id: 'op1', label: 'Operation 1' },
                    { id: 'op2', label: 'Operation 2' }
                ]
            };

            const detail = controller.getItemDetail(item);
            expect(detail).toBe('2 operations available');
        });

        it('should return correct detail for branch group items', async () => {
            const controller = gitMenuController as any;
            
            const item = {
                id: 'group',
                label: 'feature/',
                contextValue: 'branch-group',
                children: [
                    { id: 'branch1', label: 'feature/auth' },
                    { id: 'branch2', label: 'feature/ui' }
                ]
            };

            const detail = controller.getItemDetail(item);
            expect(detail).toBe('2 branches');
        });

        it('should return undefined for other items', async () => {
            const controller = gitMenuController as any;
            
            const item = {
                id: 'command',
                label: 'Update Project'
            };

            const detail = controller.getItemDetail(item);
            expect(detail).toBeUndefined();
        });
    });
});
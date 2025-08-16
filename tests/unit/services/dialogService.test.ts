import * as vscode from 'vscode';
import { DialogService } from '../../../src/services/dialogService';
import { Branch, StashEntry, Remote, ResetMode } from '../../../src/types/git';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        showInputBox: jest.fn(),
        showQuickPick: jest.fn(),
        showWarningMessage: jest.fn(),
        showInformationMessage: jest.fn()
    }
}));

describe('DialogService', () => {
    let dialogService: DialogService;
    let mockShowInputBox: jest.MockedFunction<typeof vscode.window.showInputBox>;
    let mockShowQuickPick: jest.MockedFunction<typeof vscode.window.showQuickPick>;
    let mockShowWarningMessage: jest.MockedFunction<typeof vscode.window.showWarningMessage>;
    let mockShowInformationMessage: jest.MockedFunction<typeof vscode.window.showInformationMessage>;

    beforeEach(() => {
        dialogService = new DialogService();
        mockShowInputBox = vscode.window.showInputBox as jest.MockedFunction<typeof vscode.window.showInputBox>;
        mockShowQuickPick = vscode.window.showQuickPick as jest.MockedFunction<typeof vscode.window.showQuickPick>;
        mockShowWarningMessage = vscode.window.showWarningMessage as jest.MockedFunction<typeof vscode.window.showWarningMessage>;
        mockShowInformationMessage = vscode.window.showInformationMessage as jest.MockedFunction<typeof vscode.window.showInformationMessage>;
        
        jest.clearAllMocks();
    });

    describe('promptForBranchName', () => {
        it('should prompt for branch name with default values', async () => {
            mockShowInputBox.mockResolvedValue('feature/new-branch');

            const result = await dialogService.promptForBranchName();

            expect(mockShowInputBox).toHaveBeenCalledWith({
                prompt: 'Enter branch name',
                placeHolder: 'feature/my-new-feature',
                value: undefined,
                validateInput: expect.any(Function)
            });
            expect(result).toBe('feature/new-branch');
        });

        it('should prompt for branch name with custom values', async () => {
            mockShowInputBox.mockResolvedValue('custom-branch');

            const result = await dialogService.promptForBranchName(
                'Custom prompt',
                'custom-placeholder',
                'existing-branch'
            );

            expect(mockShowInputBox).toHaveBeenCalledWith({
                prompt: 'Custom prompt',
                placeHolder: 'custom-placeholder',
                value: 'existing-branch',
                validateInput: expect.any(Function)
            });
            expect(result).toBe('custom-branch');
        });

        it('should validate branch name input', async () => {
            mockShowInputBox.mockImplementation(async (options) => {
                const validator = options?.validateInput;
                if (validator) {
                    // Test empty name
                    expect(validator('')).toBe('Branch name cannot be empty');
                    expect(validator('   ')).toBe('Branch name cannot be empty');
                    
                    // Test spaces
                    expect(validator('branch with spaces')).toBe('Branch name cannot contain spaces');
                    
                    // Test invalid characters
                    expect(validator('-branch')).toBe('Branch name cannot start or end with a dash');
                    expect(validator('branch-')).toBe('Branch name cannot start or end with a dash');
                    expect(validator('branch..name')).toBe('Branch name contains invalid characters');
                    expect(validator('branch~name')).toBe('Branch name contains invalid characters');
                    expect(validator('branch^name')).toBe('Branch name contains invalid characters');
                    expect(validator('branch:name')).toBe('Branch name contains invalid characters');
                    
                    // Test valid name
                    expect(validator('feature/valid-branch')).toBeNull();
                }
                return 'valid-branch';
            });

            await dialogService.promptForBranchName();
            expect(mockShowInputBox).toHaveBeenCalled();
        });
    });

    describe('promptForTagName', () => {
        it('should prompt for tag name with validation', async () => {
            mockShowInputBox.mockResolvedValue('v1.0.0');

            const result = await dialogService.promptForTagName();

            expect(mockShowInputBox).toHaveBeenCalledWith({
                prompt: 'Enter tag name',
                placeHolder: 'v1.0.0',
                validateInput: expect.any(Function)
            });
            expect(result).toBe('v1.0.0');
        });

        it('should validate tag name input', async () => {
            mockShowInputBox.mockImplementation(async (options) => {
                const validator = options?.validateInput;
                if (validator) {
                    expect(validator('')).toBe('Tag name cannot be empty');
                    expect(validator('tag with spaces')).toBe('Tag name cannot contain spaces');
                    expect(validator('v1.0.0')).toBeNull();
                }
                return 'v1.0.0';
            });

            await dialogService.promptForTagName();
            expect(mockShowInputBox).toHaveBeenCalled();
        });
    });

    describe('promptForCommitMessage', () => {
        it('should prompt for commit message with validation', async () => {
            mockShowInputBox.mockResolvedValue('Add new feature');

            const result = await dialogService.promptForCommitMessage();

            expect(mockShowInputBox).toHaveBeenCalledWith({
                prompt: 'Enter commit message',
                placeHolder: 'Add new feature',
                validateInput: expect.any(Function)
            });
            expect(result).toBe('Add new feature');
        });

        it('should validate commit message input', async () => {
            mockShowInputBox.mockImplementation(async (options) => {
                const validator = options?.validateInput;
                if (validator) {
                    expect(validator('')).toBe('Commit message cannot be empty');
                    expect(validator('ab')).toBe('Commit message must be at least 3 characters long');
                    expect(validator('Valid commit message')).toBeNull();
                }
                return 'Valid commit message';
            });

            await dialogService.promptForCommitMessage();
            expect(mockShowInputBox).toHaveBeenCalled();
        });
    });

    describe('promptForRemoteUrl', () => {
        it('should validate remote URL input', async () => {
            mockShowInputBox.mockImplementation(async (options) => {
                const validator = options?.validateInput;
                if (validator) {
                    expect(validator('')).toBe('Remote URL cannot be empty');
                    expect(validator('invalid-url')).toBe('Invalid URL format');
                    expect(validator('https://github.com/user/repo.git')).toBeNull();
                    expect(validator('git@github.com:user/repo.git')).toBeNull();
                }
                return 'https://github.com/user/repo.git';
            });

            await dialogService.promptForRemoteUrl();
            expect(mockShowInputBox).toHaveBeenCalled();
        });
    });

    describe('selectBranchForMerge', () => {
        const mockBranches: Branch[] = [
            {
                name: 'main',
                fullName: 'main',
                type: 'local',
                isActive: true,
                upstream: 'origin/main'
            },
            {
                name: 'feature/test',
                fullName: 'feature/test',
                type: 'local',
                isActive: false,
                ahead: 2,
                behind: 1
            },
            {
                name: 'develop',
                fullName: 'origin/develop',
                type: 'remote',
                isActive: false
            }
        ];

        it('should show branch selection for merge', async () => {
            const mockSelection = {
                label: 'feature/test',
                description: 'Local branch',
                detail: '↑2 ↓1',
                branch: mockBranches[1]
            };
            mockShowQuickPick.mockResolvedValue(mockSelection);

            const result = await dialogService.selectBranchForMerge(mockBranches, 'main');

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'feature/test',
                        description: 'Local branch'
                    }),
                    expect.objectContaining({
                        label: 'develop',
                        description: 'Remote branch'
                    })
                ]),
                {
                    placeHolder: 'Select branch to merge into current branch',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );
            expect(result).toBe(mockBranches[1]);
        });

        it('should filter out current branch', async () => {
            mockShowQuickPick.mockResolvedValue(undefined);

            await dialogService.selectBranchForMerge(mockBranches, 'main');

            const callArgs = mockShowQuickPick.mock.calls[0][0] as any[];
            expect(callArgs).not.toContainEqual(
                expect.objectContaining({ label: 'main' })
            );
        });

        it('should show message when no branches available', async () => {
            const singleBranch = [mockBranches[0]];

            const result = await dialogService.selectBranchForMerge(singleBranch, 'main');

            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                'No other branches available for merge'
            );
            expect(result).toBeUndefined();
        });
    });

    describe('selectResetMode', () => {
        it('should show reset mode selection', async () => {
            const mockSelection = {
                label: 'Soft',
                description: 'Keep changes in index and working tree',
                detail: 'Moves HEAD but keeps all changes staged',
                mode: 'soft' as ResetMode
            };
            mockShowQuickPick.mockResolvedValue(mockSelection);

            const result = await dialogService.selectResetMode();

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'Soft',
                        mode: 'soft'
                    }),
                    expect.objectContaining({
                        label: 'Mixed',
                        mode: 'mixed'
                    }),
                    expect.objectContaining({
                        label: 'Hard',
                        mode: 'hard'
                    })
                ]),
                {
                    placeHolder: 'Select reset mode',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );
            expect(result).toBe('soft');
        });
    });

    describe('selectStashForUnstash', () => {
        const mockStashes: StashEntry[] = [
            {
                index: 0,
                message: 'WIP: working on feature',
                branch: 'feature/test',
                timestamp: new Date('2023-01-01T10:00:00Z')
            },
            {
                index: 1,
                message: 'Temporary changes',
                branch: 'main',
                timestamp: new Date('2023-01-01T09:00:00Z')
            }
        ];

        it('should show stash selection', async () => {
            const mockSelection = {
                label: 'stash@{0}',
                description: 'WIP: working on feature',
                detail: 'feature/test • 1/1/2023, 10:00:00 AM',
                stash: mockStashes[0]
            };
            mockShowQuickPick.mockResolvedValue(mockSelection);

            const result = await dialogService.selectStashForUnstash(mockStashes);

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'stash@{0}',
                        description: 'WIP: working on feature'
                    }),
                    expect.objectContaining({
                        label: 'stash@{1}',
                        description: 'Temporary changes'
                    })
                ]),
                {
                    placeHolder: 'Select a stash to apply',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );
            expect(result).toBe(mockStashes[0]);
        });

        it('should show message when no stashes available', async () => {
            const result = await dialogService.selectStashForUnstash([]);

            expect(mockShowInformationMessage).toHaveBeenCalledWith('No stashes available');
            expect(result).toBeUndefined();
        });
    });

    describe('confirmDestructiveOperation', () => {
        it('should show confirmation dialog and return true when confirmed', async () => {
            mockShowWarningMessage.mockResolvedValue('Continue');

            const result = await dialogService.confirmDestructiveOperation(
                'This is dangerous',
                'Continue'
            );

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                'This is dangerous',
                { modal: true },
                'Continue',
                'Cancel'
            );
            expect(result).toBe(true);
        });

        it('should return false when cancelled', async () => {
            mockShowWarningMessage.mockResolvedValue('Cancel');

            const result = await dialogService.confirmDestructiveOperation(
                'This is dangerous',
                'Continue'
            );

            expect(result).toBe(false);
        });

        it('should return false when dialog is dismissed', async () => {
            mockShowWarningMessage.mockResolvedValue(undefined);

            const result = await dialogService.confirmDestructiveOperation(
                'This is dangerous',
                'Continue'
            );

            expect(result).toBe(false);
        });
    });

    describe('showUncommittedChangesWarning', () => {
        it('should show uncommitted changes warning with stash option', async () => {
            mockShowWarningMessage.mockResolvedValue('Stash Changes');

            const result = await dialogService.showUncommittedChangesWarning('merge');

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                'You have uncommitted changes. Do you want to continue with merge?',
                'Continue',
                'Stash Changes',
                'Cancel'
            );
            expect(result).toBe('stash');
        });

        it('should return continue when selected', async () => {
            mockShowWarningMessage.mockResolvedValue('Continue');

            const result = await dialogService.showUncommittedChangesWarning('merge');

            expect(result).toBe('continue');
        });

        it('should return cancel when selected', async () => {
            mockShowWarningMessage.mockResolvedValue('Cancel');

            const result = await dialogService.showUncommittedChangesWarning('merge');

            expect(result).toBe('cancel');
        });

        it('should return undefined when dismissed', async () => {
            mockShowWarningMessage.mockResolvedValue(undefined);

            const result = await dialogService.showUncommittedChangesWarning('merge');

            expect(result).toBeUndefined();
        });
    });

    describe('showNoStagedChangesWarning', () => {
        it('should show no staged changes warning', async () => {
            mockShowWarningMessage.mockResolvedValue('Stage All & Commit');

            const result = await dialogService.showNoStagedChangesWarning();

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                'No staged changes found. Do you want to stage all changes and commit?',
                'Stage All & Commit',
                'Cancel'
            );
            expect(result).toBe('stage-all');
        });
    });

    describe('selectRemoteManagementAction', () => {
        it('should show remote management action selection', async () => {
            const mockSelection = {
                label: 'Add Remote',
                description: 'Add a new remote repository',
                action: 'add' as const
            };
            mockShowQuickPick.mockResolvedValue(mockSelection);

            const result = await dialogService.selectRemoteManagementAction();

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'Add Remote',
                        action: 'add'
                    }),
                    expect.objectContaining({
                        label: 'Remove Remote',
                        action: 'remove'
                    }),
                    expect.objectContaining({
                        label: 'List Remotes',
                        action: 'list'
                    })
                ]),
                {
                    placeHolder: 'Select remote management action',
                    matchOnDescription: true
                }
            );
            expect(result).toBe('add');
        });
    });
});
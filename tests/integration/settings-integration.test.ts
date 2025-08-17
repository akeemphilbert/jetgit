import * as vscode from 'vscode';
import { SettingsService } from '../../src/services/settingsService';
import { StatusBarService } from '../../src/services/statusBarService';
import { GitService } from '../../src/services/gitService';
import { FeedbackService } from '../../src/services/feedbackService';

// Mock VS Code API
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(),
        onDidChangeConfiguration: jest.fn(),
        createFileSystemWatcher: jest.fn()
    },
    window: {
        createStatusBarItem: jest.fn(),
        createOutputChannel: jest.fn(),
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn()
    },
    commands: {
        executeCommand: jest.fn()
    },
    extensions: {
        getExtension: jest.fn()
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    }
}));

describe('Settings Integration Tests', () => {
    let settingsService: SettingsService;
    let statusBarService: StatusBarService;
    let gitService: GitService;
    let feedbackService: FeedbackService;
    let mockConfig: any;
    let mockStatusBarItem: any;
    let mockDisposable: { dispose: jest.Mock };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock configuration
        mockConfig = {
            get: jest.fn(),
            update: jest.fn()
        };

        mockStatusBarItem = {
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            text: '',
            tooltip: '',
            command: ''
        };

        mockDisposable = { dispose: jest.fn() };

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
        (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue(mockDisposable);
        (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);
        (vscode.window.createOutputChannel as jest.Mock).mockReturnValue({ dispose: jest.fn() });
        (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(mockDisposable);
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(null);

        // Initialize services
        feedbackService = new FeedbackService();
        gitService = new GitService(feedbackService);
        settingsService = SettingsService.getInstance();
        statusBarService = StatusBarService.getInstance(gitService);
    });

    afterEach(() => {
        // Clean up services
        if (settingsService) {
            settingsService.dispose();
        }
        if (statusBarService) {
            statusBarService.dispose();
        }
        if (feedbackService) {
            feedbackService.dispose();
        }

        // Reset singleton instances
        (SettingsService as any).instance = undefined;
        (StatusBarService as any).instance = undefined;
    });

    describe('StatusBar Settings Integration', () => {
        it('should show status bar when enabled in settings', () => {
            // Mock settings to enable status bar
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                if (key === 'statusBar.enabled') return true;
                return defaultValue;
            });

            statusBarService.init();
            statusBarService.updateVisibility();

            // Status bar should be shown (update called)
            expect(mockStatusBarItem.show).toHaveBeenCalled();
        });

        it('should hide status bar when disabled in settings', () => {
            // Mock settings to disable status bar
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                if (key === 'statusBar.enabled') return false;
                return defaultValue;
            });

            statusBarService.init();
            statusBarService.updateVisibility();

            // Status bar should be hidden
            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });

        it('should respond to settings changes', () => {
            // Initially enabled
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                if (key === 'statusBar.enabled') return true;
                return defaultValue;
            });

            statusBarService.init();

            // Clear previous calls
            mockStatusBarItem.show.mockClear();
            mockStatusBarItem.hide.mockClear();

            // Change settings to disabled
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                if (key === 'statusBar.enabled') return false;
                return defaultValue;
            });

            // Trigger settings change
            const settingsChangeListener = settingsService.onDidChangeSettings;
            if (settingsChangeListener) {
                // Simulate settings change event
                statusBarService.updateVisibility();
            }

            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });
    });

    describe('Context Keys Integration', () => {
        it('should set context keys based on settings', () => {
            const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock;

            // Mock specific settings
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                switch (key) {
                    case 'statusBar.enabled': return false;
                    case 'scmView.enabled': return true;
                    case 'showChangelists': return true;
                    case 'updateProject.mode': return 'fetchRebaseInteractive';
                    default: return defaultValue;
                }
            });

            // Create new settings service to trigger context key setting
            settingsService.dispose();
            (SettingsService as any).instance = undefined;
            const newSettingsService = SettingsService.getInstance();

            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.statusBar.enabled', false);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.scmView.enabled', true);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.showChangelists', true);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.updateProject.mode', 'fetchRebaseInteractive');

            newSettingsService.dispose();
        });

        it('should update context keys when settings change', () => {
            const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock;

            // Initial settings
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                switch (key) {
                    case 'statusBar.enabled': return true;
                    case 'scmView.enabled': return false;
                    case 'showChangelists': return false;
                    case 'updateProject.mode': return 'pull';
                    default: return defaultValue;
                }
            });

            // Clear initial calls
            mockExecuteCommand.mockClear();

            // Change settings
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                switch (key) {
                    case 'statusBar.enabled': return false;
                    case 'scmView.enabled': return true;
                    case 'showChangelists': return true;
                    case 'updateProject.mode': return 'pullRebase';
                    default: return defaultValue;
                }
            });

            // Simulate configuration change event
            const configListener = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
            const mockEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true)
            };

            configListener(mockEvent);

            expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('jbGit');
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.statusBar.enabled', false);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.scmView.enabled', true);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.showChangelists', true);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.updateProject.mode', 'pullRebase');
        });
    });

    describe('Settings Convenience Methods', () => {
        beforeEach(() => {
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
                switch (key) {
                    case 'statusBar.enabled': return false;
                    case 'scmView.enabled': return true;
                    case 'showChangelists': return true;
                    case 'updateProject.mode': return 'fetchRebaseInteractive';
                    default: return defaultValue;
                }
            });
        });

        it('should provide correct convenience method results', () => {
            expect(settingsService.isStatusBarEnabled()).toBe(false);
            expect(settingsService.isSCMViewEnabled()).toBe(true);
            expect(settingsService.shouldShowChangelists()).toBe(true);
            expect(settingsService.getUpdateProjectMode()).toBe('fetchRebaseInteractive');
        });

        it('should return complete settings object', () => {
            const settings = settingsService.getSettings();

            expect(settings).toEqual({
                statusBar: { enabled: false },
                scmView: { enabled: true },
                updateProject: { mode: 'fetchRebaseInteractive' },
                showChangelists: true
            });
        });
    });

    describe('Settings Update', () => {
        it('should update settings through the service', async () => {
            mockConfig.update.mockResolvedValue(undefined);

            await settingsService.updateSetting('statusBar.enabled', false);

            expect(mockConfig.update).toHaveBeenCalledWith('statusBar.enabled', false, undefined);
        });

        it('should update settings with specific target', async () => {
            mockConfig.update.mockResolvedValue(undefined);

            await settingsService.updateSetting('scmView.enabled', true, vscode.ConfigurationTarget.Global);

            expect(mockConfig.update).toHaveBeenCalledWith('scmView.enabled', true, vscode.ConfigurationTarget.Global);
        });
    });
});
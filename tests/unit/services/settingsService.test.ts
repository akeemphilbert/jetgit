import * as vscode from 'vscode';
import { SettingsService, JetGitSettings } from '../../../src/services/settingsService';

// Mock VS Code API
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(),
        onDidChangeConfiguration: jest.fn()
    },
    commands: {
        executeCommand: jest.fn()
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

describe('SettingsService', () => {
    let settingsService: SettingsService;
    let mockConfig: any;
    let mockOnDidChangeConfiguration: jest.Mock;
    let mockExecuteCommand: jest.Mock;
    let mockDisposable: { dispose: jest.Mock };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock configuration
        mockConfig = {
            get: jest.fn(),
            update: jest.fn()
        };

        mockOnDidChangeConfiguration = jest.fn();
        mockExecuteCommand = jest.fn();
        mockDisposable = { dispose: jest.fn() };

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
        (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue(mockDisposable);
        (vscode.commands.executeCommand as jest.Mock).mockImplementation(mockExecuteCommand);

        // Create new instance for each test
        settingsService = SettingsService.getInstance();
    });

    afterEach(() => {
        if (settingsService) {
            settingsService.dispose();
        }
        // Reset singleton instance
        (SettingsService as any).instance = undefined;
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = SettingsService.getInstance();
            const instance2 = SettingsService.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('getSettings', () => {
        it('should return default settings when no configuration exists', () => {
            mockConfig.get
                .mockReturnValueOnce(true)  // statusBar.enabled
                .mockReturnValueOnce(true)  // scmView.enabled
                .mockReturnValueOnce('pullRebase')  // updateProject.mode
                .mockReturnValueOnce(false); // showChangelists

            const settings = settingsService.getSettings();

            expect(settings).toEqual({
                statusBar: { enabled: true },
                scmView: { enabled: true },
                updateProject: { mode: 'pullRebase' },
                showChangelists: false
            });

            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('jbGit');
        });

        it('should return custom settings when configuration exists', () => {
            mockConfig.get
                .mockReturnValueOnce(false)  // statusBar.enabled
                .mockReturnValueOnce(false)  // scmView.enabled
                .mockReturnValueOnce('pull')  // updateProject.mode
                .mockReturnValueOnce(true); // showChangelists

            const settings = settingsService.getSettings();

            expect(settings).toEqual({
                statusBar: { enabled: false },
                scmView: { enabled: false },
                updateProject: { mode: 'pull' },
                showChangelists: true
            });
        });
    });

    describe('getSetting', () => {
        it('should get specific setting value', () => {
            mockConfig.get.mockReturnValue('testValue');

            const result = settingsService.getSetting('test.key', 'defaultValue');

            expect(result).toBe('testValue');
            expect(mockConfig.get).toHaveBeenCalledWith('test.key', 'defaultValue');
        });

        it('should return default value when setting not found', () => {
            mockConfig.get.mockImplementation((key: string, defaultValue: any) => defaultValue);

            const result = settingsService.getSetting('nonexistent.key', 'defaultValue');

            expect(result).toBe('defaultValue');
        });
    });

    describe('updateSetting', () => {
        it('should update setting value', async () => {
            mockConfig.update.mockResolvedValue(undefined);

            await settingsService.updateSetting('test.key', 'newValue');

            expect(mockConfig.update).toHaveBeenCalledWith('test.key', 'newValue', undefined);
        });

        it('should update setting with specific target', async () => {
            mockConfig.update.mockResolvedValue(undefined);

            await settingsService.updateSetting('test.key', 'newValue', vscode.ConfigurationTarget.Global);

            expect(mockConfig.update).toHaveBeenCalledWith('test.key', 'newValue', vscode.ConfigurationTarget.Global);
        });
    });

    describe('convenience methods', () => {
        beforeEach(() => {
            mockConfig.get
                .mockImplementation((key: string, defaultValue: any) => {
                    switch (key) {
                        case 'statusBar.enabled': return false;
                        case 'scmView.enabled': return true;
                        case 'showChangelists': return true;
                        case 'updateProject.mode': return 'fetchRebaseInteractive';
                        default: return defaultValue;
                    }
                });
        });

        it('should check if status bar is enabled', () => {
            expect(settingsService.isStatusBarEnabled()).toBe(false);
        });

        it('should check if SCM view is enabled', () => {
            expect(settingsService.isSCMViewEnabled()).toBe(true);
        });

        it('should check if changelists should be shown', () => {
            expect(settingsService.shouldShowChangelists()).toBe(true);
        });

        it('should get update project mode', () => {
            expect(settingsService.getUpdateProjectMode()).toBe('fetchRebaseInteractive');
        });
    });

    describe('context keys', () => {
        it('should set context keys on initialization', () => {
            // Dispose current instance first
            settingsService.dispose();
            (SettingsService as any).instance = undefined;
            
            mockConfig.get
                .mockReturnValueOnce(true)  // statusBar.enabled
                .mockReturnValueOnce(false)  // scmView.enabled
                .mockReturnValueOnce('pull')  // updateProject.mode
                .mockReturnValueOnce(true); // showChangelists

            // Create new instance to trigger context key setting
            const newService = SettingsService.getInstance();

            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.statusBar.enabled', true);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.scmView.enabled', false);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.showChangelists', true);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'jbGit.updateProject.mode', 'pull');
        });
    });

    describe('configuration change handling', () => {
        it('should setup configuration listener', () => {
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('should dispose of all resources', () => {
            settingsService.dispose();
            expect(mockDisposable.dispose).toHaveBeenCalled();
        });
    });
});
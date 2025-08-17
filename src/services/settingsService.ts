import * as vscode from 'vscode';

/**
 * Settings configuration interface for JetGit extension
 */
export interface JetGitSettings {
    statusBar: {
        enabled: boolean;
    };
    scmView: {
        enabled: boolean;
    };
    updateProject: {
        mode: 'pull' | 'pullRebase' | 'fetchRebaseInteractive';
    };
    showChangelists: boolean;
}

/**
 * Service for managing JetGit extension settings and feature flags
 * 
 * This service handles:
 * - Reading configuration values
 * - Listening for configuration changes
 * - Setting context keys for conditional UI visibility
 * - Notifying other services of setting changes
 */
export class SettingsService implements vscode.Disposable {
    private static instance: SettingsService;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly changeEmitter = new vscode.EventEmitter<JetGitSettings>();
    
    /** Event fired when settings change */
    public readonly onDidChangeSettings = this.changeEmitter.event;
    
    private constructor() {
        this.setupConfigurationListener();
        this.updateContextKeys();
    }
    
    /**
     * Gets the singleton instance of SettingsService
     */
    public static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }
    
    /**
     * Gets the current JetGit settings
     */
    public getSettings(): JetGitSettings {
        const config = vscode.workspace.getConfiguration('jbGit');
        
        return {
            statusBar: {
                enabled: config.get<boolean>('statusBar.enabled', true)
            },
            scmView: {
                enabled: config.get<boolean>('scmView.enabled', true)
            },
            updateProject: {
                mode: config.get<'pull' | 'pullRebase' | 'fetchRebaseInteractive'>('updateProject.mode', 'pullRebase')
            },
            showChangelists: config.get<boolean>('showChangelists', false)
        };
    }
    
    /**
     * Gets a specific setting value
     */
    public getSetting<T>(key: string, defaultValue: T): T {
        const config = vscode.workspace.getConfiguration('jbGit');
        return config.get<T>(key, defaultValue);
    }
    
    /**
     * Updates a specific setting value
     */
    public async updateSetting(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
        const config = vscode.workspace.getConfiguration('jbGit');
        await config.update(key, value, target);
    }
    
    /**
     * Sets up listener for configuration changes
     */
    private setupConfigurationListener(): void {
        const configListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('jbGit')) {
                this.updateContextKeys();
                this.changeEmitter.fire(this.getSettings());
            }
        });
        
        this.disposables.push(configListener);
    }
    
    /**
     * Updates VS Code context keys based on current settings
     * These context keys are used in package.json for conditional UI visibility
     */
    private updateContextKeys(): void {
        const settings = this.getSettings();
        
        // Set context keys for conditional visibility
        vscode.commands.executeCommand('setContext', 'jbGit.statusBar.enabled', settings.statusBar.enabled);
        vscode.commands.executeCommand('setContext', 'jbGit.scmView.enabled', settings.scmView.enabled);
        vscode.commands.executeCommand('setContext', 'jbGit.showChangelists', settings.showChangelists);
        vscode.commands.executeCommand('setContext', 'jbGit.updateProject.mode', settings.updateProject.mode);
    }
    
    /**
     * Checks if status bar is enabled
     */
    public isStatusBarEnabled(): boolean {
        return this.getSetting('statusBar.enabled', true);
    }
    
    /**
     * Checks if SCM view is enabled
     */
    public isSCMViewEnabled(): boolean {
        return this.getSetting('scmView.enabled', true);
    }
    
    /**
     * Checks if changelists should be shown
     */
    public shouldShowChangelists(): boolean {
        return this.getSetting('showChangelists', false);
    }
    
    /**
     * Gets the update project mode
     */
    public getUpdateProjectMode(): 'pull' | 'pullRebase' | 'fetchRebaseInteractive' {
        return this.getSetting('updateProject.mode', 'pullRebase');
    }
    
    /**
     * Disposes of the settings service and cleans up resources
     */
    public dispose(): void {
        this.changeEmitter.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }
}
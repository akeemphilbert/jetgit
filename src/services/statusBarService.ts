import * as vscode from 'vscode';
import { GitService } from './gitService';

/**
 * Service responsible for managing the single status bar entry with JetBrains-style functionality
 * Provides repository-aware text formatting and QuickPick menu integration
 */
export class StatusBarService {
    private static instance: StatusBarService | undefined;
    private gitService: GitService;
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    private repositories: any[] = [];
    private activeRepository: any | undefined;

    private constructor(gitService: GitService) {
        this.gitService = gitService;
        
        // Create single status bar item for JetGit
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'jbGit.openMenu';
        this.statusBarItem.tooltip = 'JetGit: Click to open Git menu';
    }

    /**
     * Get or create the singleton instance
     */
    public static getInstance(gitService?: GitService): StatusBarService {
        if (!StatusBarService.instance) {
            if (!gitService) {
                throw new Error('GitService is required for first initialization');
            }
            StatusBarService.instance = new StatusBarService(gitService);
        }
        return StatusBarService.instance;
    }

    /**
     * Initialize the status bar service
     */
    public init(): void {
        // Update status immediately
        this.update();

        // Listen for Git repository changes
        this.setupGitRepositoryWatcher();

        // Listen for file system changes that might affect Git status
        this.setupFileSystemWatcher();

        // Update status periodically
        this.setupPeriodicStatusUpdate();

        // Listen for settings changes
        this.setupSettingsWatcher();
    }

    /**
     * Update the status bar with current repository information
     */
    public async update(): Promise<void> {
        try {
            await this.refreshRepositoryList();
            
            if (this.repositories.length === 0) {
                this.statusBarItem.hide();
                return;
            }

            // Update status bar text based on single-repo vs multi-repo scenario
            if (this.repositories.length === 1) {
                await this.updateSingleRepoStatus();
            } else {
                await this.updateMultiRepoStatus();
            }

            this.statusBarItem.show();

        } catch (error) {
            console.error('Failed to update status bar:', error);
            this.statusBarItem.text = '$(source-control) JetGit: Error';
            this.statusBarItem.tooltip = 'JetGit: Error updating status';
            this.statusBarItem.show();
        }
    }

    /**
     * Update status bar for single repository scenario
     */
    private async updateSingleRepoStatus(): Promise<void> {
        const repo = this.repositories[0];
        const currentBranch = await this.getCurrentBranch(repo);
        const repoStatus = await this.getRepositoryStatus(repo);
        
        let text = `$(git-branch) ${currentBranch || 'unknown'}`;
        let tooltip = `JetGit: ${currentBranch || 'unknown branch'}`;

        // Add dirty indicator
        if (repoStatus.hasChanges) {
            text += ' $(diff)';
            tooltip += ' (has changes)';
        }

        // Add ahead/behind indicators
        if (repoStatus.ahead > 0) {
            text += ` $(arrow-up)${repoStatus.ahead}`;
            tooltip += ` • ${repoStatus.ahead} ahead`;
        }
        if (repoStatus.behind > 0) {
            text += ` $(arrow-down)${repoStatus.behind}`;
            tooltip += ` • ${repoStatus.behind} behind`;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip + '\n\nClick to open Git menu';
    }

    /**
     * Update status bar for multiple repositories scenario
     */
    private async updateMultiRepoStatus(): Promise<void> {
        const repoCount = this.repositories.length;
        const activeRepo = this.activeRepository || this.repositories[0];
        const activeBranch = await this.getCurrentBranch(activeRepo);
        
        let text = `$(repo) ${repoCount} repos`;
        let tooltip = `JetGit: ${repoCount} repositories`;

        if (activeBranch) {
            text += ` • ${activeBranch}`;
            tooltip += `\nActive: ${activeBranch}`;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip + '\n\nClick to open Git menu';
    }

    /**
     * Get current branch for a repository
     */
    private async getCurrentBranch(repo: any): Promise<string | undefined> {
        try {
            if (repo && repo.state && repo.state.HEAD && repo.state.HEAD.name) {
                return repo.state.HEAD.name;
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Get repository status information
     */
    private async getRepositoryStatus(repo: any): Promise<{
        hasChanges: boolean;
        ahead: number;
        behind: number;
        stagedChanges: number;
        unstagedChanges: number;
        untrackedFiles: number;
    }> {
        try {
            const state = repo.state;
            const workingTreeChanges = state.workingTreeChanges || [];
            const indexChanges = state.indexChanges || [];
            const untrackedChanges = state.untrackedChanges || [];
            
            const ahead = state.HEAD?.ahead || 0;
            const behind = state.HEAD?.behind || 0;
            
            return {
                hasChanges: workingTreeChanges.length > 0 || indexChanges.length > 0 || untrackedChanges.length > 0,
                ahead,
                behind,
                stagedChanges: indexChanges.length,
                unstagedChanges: workingTreeChanges.length,
                untrackedFiles: untrackedChanges.length
            };
        } catch (error) {
            return {
                hasChanges: false,
                ahead: 0,
                behind: 0,
                stagedChanges: 0,
                unstagedChanges: 0,
                untrackedFiles: 0
            };
        }
    }

    /**
     * Refresh the list of repositories from VS Code Git API
     */
    private async refreshRepositoryList(): Promise<void> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension && gitExtension.exports) {
                const git = gitExtension.exports.getAPI(1);
                this.repositories = git.repositories || [];
                
                // Set active repository if not set
                if (!this.activeRepository && this.repositories.length > 0) {
                    this.activeRepository = this.repositories[0];
                }
            } else {
                this.repositories = [];
                this.activeRepository = undefined;
            }
        } catch (error) {
            this.repositories = [];
            this.activeRepository = undefined;
        }
    }

    /**
     * Set up Git repository watcher to detect changes
     */
    private setupGitRepositoryWatcher(): void {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension && gitExtension.exports) {
                const git = gitExtension.exports.getAPI(1);
                
                // Listen for repository state changes
                git.repositories.forEach((repo: any) => {
                    const disposable = repo.state.onDidChange(() => {
                        this.update();
                    });
                    this.disposables.push(disposable);
                });

                // Listen for new repositories
                const repoDisposable = git.onDidOpenRepository((repo: any) => {
                    const disposable = repo.state.onDidChange(() => {
                        this.update();
                    });
                    this.disposables.push(disposable);
                    this.update(); // Update immediately when new repo is added
                });
                this.disposables.push(repoDisposable);

                // Listen for closed repositories
                const closeRepoDisposable = git.onDidCloseRepository(() => {
                    this.update(); // Update immediately when repo is closed
                });
                this.disposables.push(closeRepoDisposable);
            }
        } catch (error) {
            console.error('Failed to setup Git repository watcher:', error);
        }
    }

    /**
     * Set up file system watcher for Git-related files
     */
    private setupFileSystemWatcher(): void {
        try {
            // Watch for changes to Git files that might affect status
            const gitFileWatcher = vscode.workspace.createFileSystemWatcher(
                '**/.git/{HEAD,refs/**,index,MERGE_HEAD,REBASE_HEAD}',
                false, // don't ignore creates
                false, // don't ignore changes
                false  // don't ignore deletes
            );

            gitFileWatcher.onDidCreate(() => this.update());
            gitFileWatcher.onDidChange(() => this.update());
            gitFileWatcher.onDidDelete(() => this.update());

            this.disposables.push(gitFileWatcher);
        } catch (error) {
            console.error('Failed to setup file system watcher:', error);
        }
    }

    /**
     * Set up periodic status updates
     */
    private setupPeriodicStatusUpdate(): void {
        // Update status every 30 seconds to catch any missed changes
        const interval = setInterval(() => {
            this.update();
        }, 30000);

        this.disposables.push({
            dispose: () => clearInterval(interval)
        });
    }

    /**
     * Set up settings change watcher
     */
    private setupSettingsWatcher(): void {
        try {
            const settingsWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration('jbGit.statusBar.enabled')) {
                    this.updateVisibility();
                }
            });

            this.disposables.push(settingsWatcher);
        } catch (error) {
            console.error('Failed to setup settings watcher:', error);
        }
    }

    /**
     * Get the list of repositories
     */
    public getRepositories(): any[] {
        return this.repositories;
    }

    /**
     * Get the active repository
     */
    public getActiveRepository(): any | undefined {
        return this.activeRepository;
    }

    /**
     * Set the active repository
     */
    public setActiveRepository(repo: any): void {
        this.activeRepository = repo;
        this.update();
    }

    /**
     * Check if settings allow status bar to be shown
     */
    private isStatusBarEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('jbGit');
        return config.get('statusBar.enabled', true);
    }

    /**
     * Show or hide status bar based on settings
     */
    public updateVisibility(): void {
        if (this.isStatusBarEnabled()) {
            this.update();
        } else {
            this.statusBarItem.hide();
        }
    }

    /**
     * Notify that a Git operation has been performed
     * This allows immediate status updates after operations
     */
    public async notifyGitOperation(operation: string): Promise<void> {
        console.log(`JetGit operation completed: ${operation}`);
        
        // Update status immediately after operations
        await this.update();

        // Show a brief notification in the status bar
        const originalText = this.statusBarItem.text;
        this.statusBarItem.text = `$(sync~spin) ${operation}...`;
        
        setTimeout(() => {
            this.statusBarItem.text = originalText;
        }, 2000);
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        StatusBarService.instance = undefined;
    }
}
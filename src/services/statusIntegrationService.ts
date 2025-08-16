import * as vscode from 'vscode';
import { GitService } from './gitService';

/**
 * Service responsible for integrating with VS Code's Git status indicators
 * and keeping them synchronized with JetGit operations
 */
export class StatusIntegrationService {
    private gitService: GitService;
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];

    constructor(gitService: GitService) {
        this.gitService = gitService;
        
        // Create status bar item for JetGit
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'jetgit.showGitMenu';
        this.statusBarItem.tooltip = 'JetGit: Click to show Git menu';
        
        this.initialize();
    }

    /**
     * Initialize the status integration service
     */
    private initialize(): void {
        // Update status immediately
        this.updateStatus();

        // Listen for Git repository changes
        this.setupGitRepositoryWatcher();

        // Listen for file system changes that might affect Git status
        this.setupFileSystemWatcher();

        // Update status periodically
        this.setupPeriodicStatusUpdate();
    }

    /**
     * Set up Git repository watcher to detect changes
     */
    private setupGitRepositoryWatcher(): void {
        // Watch for Git extension changes
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension && gitExtension.exports) {
            const git = gitExtension.exports.getAPI(1);
            
            // Listen for repository state changes
            git.repositories.forEach((repo: any) => {
                const disposable = repo.state.onDidChange(() => {
                    this.updateStatus();
                });
                this.disposables.push(disposable);
            });

            // Listen for new repositories
            const repoDisposable = git.onDidOpenRepository((repo: any) => {
                const disposable = repo.state.onDidChange(() => {
                    this.updateStatus();
                });
                this.disposables.push(disposable);
            });
            this.disposables.push(repoDisposable);
        }
    }

    /**
     * Set up file system watcher for Git-related files
     */
    private setupFileSystemWatcher(): void {
        // Watch for changes to Git files that might affect status
        const gitFileWatcher = vscode.workspace.createFileSystemWatcher(
            '**/.git/{HEAD,refs/**,index,MERGE_HEAD,REBASE_HEAD}',
            false, // don't ignore creates
            false, // don't ignore changes
            false  // don't ignore deletes
        );

        gitFileWatcher.onDidCreate(() => this.updateStatus());
        gitFileWatcher.onDidChange(() => this.updateStatus());
        gitFileWatcher.onDidDelete(() => this.updateStatus());

        this.disposables.push(gitFileWatcher);
    }

    /**
     * Set up periodic status updates
     */
    private setupPeriodicStatusUpdate(): void {
        // Update status every 30 seconds to catch any missed changes
        const interval = setInterval(() => {
            this.updateStatus();
        }, 30000);

        this.disposables.push({
            dispose: () => clearInterval(interval)
        });
    }

    /**
     * Update the status bar and VS Code Git indicators
     */
    private async updateStatus(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            
            if (!isRepo) {
                this.statusBarItem.hide();
                return;
            }

            // Get repository status
            const [currentBranch, repoStatus] = await Promise.all([
                this.gitService.getCurrentBranch(),
                this.gitService.getRepositoryStatus()
            ]);

            // Update status bar item
            this.updateStatusBarItem(currentBranch, repoStatus);

            // Trigger VS Code Git extension refresh if needed
            await this.refreshVSCodeGitStatus();

        } catch (error) {
            console.error('Failed to update Git status:', error);
            this.statusBarItem.text = '$(source-control) JetGit: Error';
            this.statusBarItem.show();
        }
    }

    /**
     * Update the status bar item with current Git information
     */
    private updateStatusBarItem(
        currentBranch: string | undefined,
        repoStatus: {
            hasChanges: boolean;
            stagedChanges: number;
            unstagedChanges: number;
            untrackedFiles: number;
        }
    ): void {
        let text = '$(source-control) JetGit';
        let tooltip = 'JetGit: Click to show Git menu';

        if (currentBranch) {
            text += ` $(git-branch) ${currentBranch}`;
            tooltip += `\nCurrent branch: ${currentBranch}`;
        }

        if (repoStatus.hasChanges) {
            const changes: string[] = [];
            if (repoStatus.stagedChanges > 0) {
                changes.push(`${repoStatus.stagedChanges} staged`);
            }
            if (repoStatus.unstagedChanges > 0) {
                changes.push(`${repoStatus.unstagedChanges} unstaged`);
            }
            if (repoStatus.untrackedFiles > 0) {
                changes.push(`${repoStatus.untrackedFiles} untracked`);
            }

            if (changes.length > 0) {
                text += ` $(diff) ${repoStatus.stagedChanges + repoStatus.unstagedChanges + repoStatus.untrackedFiles}`;
                tooltip += `\nChanges: ${changes.join(', ')}`;
            }
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }

    /**
     * Refresh VS Code's built-in Git status
     */
    private async refreshVSCodeGitStatus(): Promise<void> {
        try {
            // Execute VS Code's built-in Git refresh command
            await vscode.commands.executeCommand('git.refresh');
        } catch (error) {
            // Ignore errors - this is a best-effort operation
            console.debug('Could not refresh VS Code Git status:', error);
        }
    }

    /**
     * Notify that a Git operation has been performed
     * This allows immediate status updates after operations
     */
    async notifyGitOperation(operation: string): Promise<void> {
        console.log(`JetGit operation completed: ${operation}`);
        
        // Update status immediately after operations
        await this.updateStatus();

        // Show a brief notification in the status bar
        const originalText = this.statusBarItem.text;
        this.statusBarItem.text = `$(sync~spin) ${operation}...`;
        
        setTimeout(() => {
            this.statusBarItem.text = originalText;
        }, 2000);
    }

    /**
     * Check if we're in a special Git state (merge, rebase, etc.)
     */
    async getSpecialGitState(): Promise<string | undefined> {
        try {
            const [inMerge, inRebase] = await Promise.all([
                this.gitService.isInMergeState(),
                this.gitService.isInRebaseState()
            ]);

            if (inMerge) {
                return 'MERGING';
            }
            if (inRebase) {
                return 'REBASING';
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Update status bar to show special Git states
     */
    async updateSpecialState(): Promise<void> {
        const specialState = await this.getSpecialGitState();
        
        if (specialState) {
            const currentText = this.statusBarItem.text;
            this.statusBarItem.text = `${currentText} $(warning) ${specialState}`;
            this.statusBarItem.tooltip += `\nGit state: ${specialState}`;
        }
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}
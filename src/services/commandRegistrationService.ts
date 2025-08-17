import * as vscode from 'vscode';
import { GitService } from './gitService';
import { MenuController } from '../providers/gitMenuController';
import { ContextMenuProvider } from '../providers/contextMenuProvider';
import { SCMTreeProvider } from '../providers/scmTreeProvider';
import { DiffViewer } from '../views/diffViewer';
import { DialogService } from './dialogService';
import { StatusBarService } from './statusBarService';

/**
 * Service responsible for registering all VS Code commands and managing their lifecycle
 */
export class CommandRegistrationService {
    private gitService: GitService;
    private menuController: MenuController;
    private contextMenuProvider: ContextMenuProvider;
    private scmTreeProvider?: SCMTreeProvider;
    private diffViewer: DiffViewer;
    private dialogService: DialogService;
    private statusBarService: StatusBarService;
    private disposables: vscode.Disposable[] = [];

    constructor(
        gitService: GitService,
        menuController: MenuController,
        contextMenuProvider: ContextMenuProvider,
        diffViewer: DiffViewer,
        dialogService: DialogService,
        statusBarService: StatusBarService,
        scmTreeProvider?: SCMTreeProvider
    ) {
        this.gitService = gitService;
        this.menuController = menuController;
        this.contextMenuProvider = contextMenuProvider;
        this.scmTreeProvider = scmTreeProvider;
        this.diffViewer = diffViewer;
        this.dialogService = dialogService;
        this.statusBarService = statusBarService;
    }

    /**
     * Register all extension commands
     */
    registerAllCommands(context: vscode.ExtensionContext): void {
        // Register main Git menu commands
        this.registerMainCommands(context);
        
        // Register branch-specific commands
        this.registerBranchCommands(context);
        
        // Register file operation commands
        this.registerFileCommands(context);
        
        // Register context menu commands
        this.contextMenuProvider.registerCommands(context);
        
        // Register SCM view commands
        this.registerSCMCommands(context);
        
        // Register utility commands
        this.registerUtilityCommands(context);
    }

    /**
     * Register main Git menu commands
     */
    private registerMainCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jbGit.openMenu',
                handler: async () => {
                    try {
                        await this.menuController.open();
                    } catch (error) {
                        vscode.window.showErrorMessage(`Git operation failed: ${error}`);
                    }
                }
            },
            {
                id: 'jetgit.updateProject',
                handler: async () => {
                    try {
                        await this.gitService.pull();
                        await this.statusBarService.notifyGitOperation('Update Project');
                        vscode.window.showInformationMessage('Project updated successfully');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.commitChanges',
                handler: async () => {
                    try {
                        const message = await this.dialogService.promptForCommitMessage();
                        if (message) {
                            await this.gitService.commit(message);
                            await this.statusBarService.notifyGitOperation('Commit Changes');
                            vscode.window.showInformationMessage('Changes committed successfully');
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.push',
                handler: async () => {
                    try {
                        await this.gitService.push();
                        await this.statusBarService.notifyGitOperation('Push');
                        vscode.window.showInformationMessage('Changes pushed successfully');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to push changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.fetch',
                handler: async () => {
                    try {
                        await this.gitService.fetch();
                        await this.statusBarService.notifyGitOperation('Fetch');
                        vscode.window.showInformationMessage('Fetch completed successfully');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.newBranch',
                handler: async () => {
                    try {
                        const branchName = await this.dialogService.promptForBranchName(
                            'Create new branch',
                            'Enter new branch name'
                        );
                        if (branchName) {
                            await this.gitService.createBranch(branchName.trim());
                            await this.statusBarService.notifyGitOperation('New Branch');
                            vscode.window.showInformationMessage(`Successfully created branch '${branchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.checkoutRevision',
                handler: async () => {
                    try {
                        const revision = await this.dialogService.promptForRevision(
                            'Checkout revision',
                            'Enter branch name, tag, or commit hash'
                        );
                        if (revision) {
                            await this.gitService.checkoutBranch(revision.trim());
                            await this.statusBarService.notifyGitOperation('Checkout Revision');
                            vscode.window.showInformationMessage(`Successfully checked out '${revision}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to checkout revision: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            // New JetBrains-style commands
            {
                id: 'jbGit.updateProject',
                handler: async (repository?: any) => {
                    try {
                        const config = vscode.workspace.getConfiguration('jbGit');
                        const mode = config.get<string>('updateProject.mode', 'pullRebase');
                        
                        switch (mode) {
                            case 'pull':
                                await this.gitService.pull();
                                break;
                            case 'pullRebase':
                                // First fetch, then rebase
                                await this.gitService.fetch();
                                const currentBranch = await this.gitService.getCurrentBranch();
                                if (currentBranch) {
                                    const branches = await this.gitService.getBranches();
                                    const branch = branches.find(b => b.name === currentBranch && b.type === 'local');
                                    if (branch?.upstream) {
                                        await this.gitService.rebase(branch.upstream);
                                    }
                                }
                                break;
                            case 'fetchRebaseInteractive':
                                await this.gitService.fetch();
                                vscode.window.showInformationMessage('Fetch completed. Please manually rebase if needed.');
                                break;
                            default:
                                await this.gitService.pull();
                        }
                        
                        await this.statusBarService.notifyGitOperation('Update Project');
                        vscode.window.showInformationMessage('Project updated successfully');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.commit',
                handler: async (repository?: any) => {
                    try {
                        const message = await this.dialogService.promptForCommitMessage();
                        if (message) {
                            await this.gitService.commit(message);
                            await this.statusBarService.notifyGitOperation('Commit');
                            vscode.window.showInformationMessage('Changes committed successfully');
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.push',
                handler: async (repository?: any) => {
                    try {
                        await this.gitService.push();
                        await this.statusBarService.notifyGitOperation('Push');
                        vscode.window.showInformationMessage('Changes pushed successfully');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to push changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.createBranch',
                handler: async (repository?: any) => {
                    try {
                        const branchName = await this.dialogService.promptForBranchName(
                            'Create new branch',
                            'Enter new branch name'
                        );
                        if (branchName) {
                            await this.gitService.createBranch(branchName.trim());
                            await this.statusBarService.notifyGitOperation('Create Branch');
                            vscode.window.showInformationMessage(`Successfully created branch '${branchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.checkoutRef',
                handler: async (ref?: string) => {
                    try {
                        let revision = ref;
                        if (!revision) {
                            revision = await this.dialogService.promptForRevision(
                                'Checkout tag or revision',
                                'Enter branch name, tag, or commit hash'
                            );
                        }
                        if (revision) {
                            await this.gitService.checkoutBranch(revision.trim());
                            await this.statusBarService.notifyGitOperation('Checkout');
                            vscode.window.showInformationMessage(`Successfully checked out '${revision}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to checkout: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.checkoutBranch',
                handler: async (branchName: string) => {
                    try {
                        await this.gitService.checkoutBranch(branchName);
                        await this.statusBarService.notifyGitOperation('Checkout Branch');
                        vscode.window.showInformationMessage(`Successfully checked out branch '${branchName}'`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to checkout branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        ];

        commands.forEach(({ id, handler }) => {
            const disposable = vscode.commands.registerCommand(id, handler);
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);
        });
    }

    /**
     * Register branch-specific commands
     */
    private registerBranchCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jetgit.newBranchFrom',
                handler: async (branchName: string) => {
                    try {
                        const newBranchName = await this.dialogService.promptForBranchName(
                            `Create new branch from ${branchName}`,
                            'Enter new branch name'
                        );

                        if (newBranchName) {
                            await this.gitService.createBranch(newBranchName.trim(), branchName);
                            await this.statusBarService.notifyGitOperation('New Branch From');
                            vscode.window.showInformationMessage(`Successfully created branch '${newBranchName}' from '${branchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.showDiffWithWorkingTree',
                handler: async (branchName: string) => {
                    try {
                        const activeEditor = vscode.window.activeTextEditor;
                        if (!activeEditor) {
                            vscode.window.showErrorMessage('No active file to compare');
                            return;
                        }

                        const filePath = vscode.workspace.asRelativePath(activeEditor.document.uri);
                        const diff = await this.gitService.getFileDiff(filePath, branchName, 'HEAD');
                        
                        await this.diffViewer.showDiff(diff, `${filePath} (${branchName} ↔ Working Tree)`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.updateBranch',
                handler: async (branchName: string) => {
                    try {
                        const currentBranch = await this.gitService.getCurrentBranch();
                        if (currentBranch !== branchName) {
                            await this.gitService.checkoutBranch(branchName);
                        }

                        await this.gitService.pull();
                        await this.statusBarService.notifyGitOperation('Update Branch');
                        vscode.window.showInformationMessage(`Successfully updated branch '${branchName}'`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to update branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.pushBranch',
                handler: async (branchName: string) => {
                    try {
                        const currentBranch = await this.gitService.getCurrentBranch();
                        if (currentBranch !== branchName) {
                            await this.gitService.checkoutBranch(branchName);
                        }

                        await this.gitService.push(branchName);
                        await this.statusBarService.notifyGitOperation('Push Branch');
                        vscode.window.showInformationMessage(`Successfully pushed branch '${branchName}'`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to push branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.renameBranch',
                handler: async (branchName: string) => {
                    try {
                        const newBranchName = await this.dialogService.promptForBranchName(
                            `Rename branch '${branchName}'`,
                            'Enter new branch name',
                            branchName
                        );

                        if (newBranchName && newBranchName.trim() !== branchName) {
                            await this.gitService.renameBranch(branchName, newBranchName.trim());
                            await this.statusBarService.notifyGitOperation('Rename Branch');
                            vscode.window.showInformationMessage(`Successfully renamed branch '${branchName}' to '${newBranchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to rename branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            // Branch selection actions
            {
                id: 'jbGit.mergeBranch',
                handler: async (branchName: string) => {
                    try {
                        const currentBranch = await this.gitService.getCurrentBranch();
                        if (currentBranch === branchName) {
                            vscode.window.showWarningMessage('Cannot merge a branch into itself');
                            return;
                        }

                        const confirmation = await vscode.window.showWarningMessage(
                            `Merge '${branchName}' into '${currentBranch}'?`,
                            { modal: true },
                            'Merge'
                        );

                        if (confirmation === 'Merge') {
                            await this.gitService.merge(branchName);
                            await this.statusBarService.notifyGitOperation('Merge Branch');
                            vscode.window.showInformationMessage(`Successfully merged '${branchName}' into '${currentBranch}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to merge branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.rebaseBranch',
                handler: async (branchName: string) => {
                    try {
                        const currentBranch = await this.gitService.getCurrentBranch();
                        if (currentBranch === branchName) {
                            vscode.window.showWarningMessage('Cannot rebase a branch onto itself');
                            return;
                        }

                        const confirmation = await vscode.window.showWarningMessage(
                            `Rebase '${currentBranch}' onto '${branchName}'?`,
                            { modal: true },
                            'Rebase'
                        );

                        if (confirmation === 'Rebase') {
                            await this.gitService.rebase(branchName);
                            await this.statusBarService.notifyGitOperation('Rebase Branch');
                            vscode.window.showInformationMessage(`Successfully rebased '${currentBranch}' onto '${branchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to rebase branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.cherryPickBranch',
                handler: async (branchName: string) => {
                    try {
                        // For cherry-pick, we need to get the latest commit from the branch
                        const branches = await this.gitService.getBranches();
                        const targetBranch = branches.find(b => b.name === branchName);
                        
                        if (!targetBranch?.lastCommit) {
                            vscode.window.showErrorMessage('Cannot find commit information for cherry-pick');
                            return;
                        }

                        const confirmation = await vscode.window.showWarningMessage(
                            `Cherry-pick latest commit from '${branchName}'?`,
                            { modal: true },
                            'Cherry-pick'
                        );

                        if (confirmation === 'Cherry-pick') {
                            await this.gitService.cherryPick(targetBranch.lastCommit.hash);
                            await this.statusBarService.notifyGitOperation('Cherry-pick');
                            vscode.window.showInformationMessage(`Successfully cherry-picked from '${branchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to cherry-pick: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.deleteBranch',
                handler: async (branchName: string) => {
                    try {
                        const currentBranch = await this.gitService.getCurrentBranch();
                        if (currentBranch === branchName) {
                            vscode.window.showWarningMessage('Cannot delete the currently active branch');
                            return;
                        }

                        const confirmation = await vscode.window.showWarningMessage(
                            `Delete branch '${branchName}'? This action cannot be undone.`,
                            { modal: true },
                            'Delete'
                        );

                        if (confirmation === 'Delete') {
                            await this.gitService.deleteBranch(branchName);
                            await this.statusBarService.notifyGitOperation('Delete Branch');
                            vscode.window.showInformationMessage(`Successfully deleted branch '${branchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.createBranchFrom',
                handler: async (sourceBranchName: string) => {
                    try {
                        const newBranchName = await this.dialogService.promptForBranchName(
                            `Create new branch from '${sourceBranchName}'`,
                            'Enter new branch name'
                        );

                        if (newBranchName) {
                            await this.gitService.createBranch(newBranchName.trim(), sourceBranchName);
                            
                            // Ask if user wants to checkout the new branch
                            const checkout = await vscode.window.showInformationMessage(
                                `Successfully created branch '${newBranchName}' from '${sourceBranchName}'`,
                                'Checkout New Branch'
                            );

                            if (checkout === 'Checkout New Branch') {
                                await this.gitService.checkoutBranch(newBranchName.trim());
                                await this.statusBarService.notifyGitOperation('Checkout Branch');
                            }
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        ];

        commands.forEach(({ id, handler }) => {
            const disposable = vscode.commands.registerCommand(id, handler);
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);
        });
    }

    /**
     * Register file operation commands
     */
    private registerFileCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jetgit.showFileDiff',
                handler: async (filePath?: string, ref1?: string, ref2?: string) => {
                    try {
                        let targetFilePath = filePath;
                        
                        if (!targetFilePath) {
                            const activeEditor = vscode.window.activeTextEditor;
                            if (!activeEditor) {
                                vscode.window.showErrorMessage('No active file to compare');
                                return;
                            }
                            targetFilePath = vscode.workspace.asRelativePath(activeEditor.document.uri);
                        }

                        if (!ref1) {
                            ref1 = await this.dialogService.promptForRevision(
                                'Enter first revision (branch, tag, or commit hash)',
                                'e.g., main, HEAD~1, abc123'
                            );
                            if (!ref1) {
                                ref1 = 'HEAD';
                            }
                        }

                        if (!ref2) {
                            ref2 = await this.dialogService.promptForRevision(
                                'Enter second revision (branch, tag, or commit hash)',
                                'e.g., main, HEAD~1, abc123, or leave empty for working tree'
                            );
                        }

                        const diff = await this.gitService.getFileDiff(targetFilePath, ref1, ref2 || undefined);
                        const title = ref2 
                            ? `${targetFilePath} (${ref1} ↔ ${ref2})`
                            : `${targetFilePath} (${ref1} ↔ Working Tree)`;
                        
                        await this.diffViewer.showDiff(diff, title);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.compareWithBranch',
                handler: async (filePath?: string) => {
                    try {
                        let targetFilePath = filePath;
                        
                        if (!targetFilePath) {
                            const activeEditor = vscode.window.activeTextEditor;
                            if (!activeEditor) {
                                vscode.window.showErrorMessage('No active file to compare');
                                return;
                            }
                            targetFilePath = vscode.workspace.asRelativePath(activeEditor.document.uri);
                        }

                        const branches = await this.gitService.getBranches();
                        const selectedBranch = await this.dialogService.selectBranchForComparison(branches);

                        if (!selectedBranch) {
                            return;
                        }

                        const diff = await this.gitService.getFileDiff(targetFilePath, selectedBranch.name, undefined);
                        await this.diffViewer.showDiff(diff, `${targetFilePath} (${selectedBranch.name} ↔ Working Tree)`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to compare with branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        ];

        commands.forEach(({ id, handler }) => {
            const disposable = vscode.commands.registerCommand(id, handler);
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);
        });
    }

    /**
     * Register SCM view commands
     */
    private registerSCMCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jbGit.refreshSCM',
                handler: async () => {
                    try {
                        if (this.scmTreeProvider) {
                            this.scmTreeProvider.refresh();
                            vscode.window.showInformationMessage('SCM view refreshed');
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to refresh SCM view: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.switchRepository',
                handler: async () => {
                    try {
                        // This would open a repository picker
                        // For now, just show a message
                        vscode.window.showInformationMessage('Repository switching not yet implemented');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to switch repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jbGit.createChangelist',
                handler: async () => {
                    try {
                        const name = await vscode.window.showInputBox({
                            prompt: 'Enter changelist name',
                            placeHolder: 'Changelist name'
                        });
                        
                        if (name) {
                            // This would create a changelist
                            // For now, just show a message
                            vscode.window.showInformationMessage(`Changelist "${name}" created (placeholder)`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create changelist: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        ];

        commands.forEach(({ id, handler }) => {
            const disposable = vscode.commands.registerCommand(id, handler);
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);
        });
    }

    /**
     * Register utility commands for extension management
     */
    private registerUtilityCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jetgit.refreshStatus',
                handler: async () => {
                    try {
                        await this.statusBarService.notifyGitOperation('Refresh Status');
                        vscode.window.showInformationMessage('Git status refreshed');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to refresh status: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            },
            {
                id: 'jetgit.showExtensionInfo',
                handler: () => {
                    vscode.window.showInformationMessage(
                        'JetGit Extension - JetBrains IDE-style Git functionality for VS Code',
                        'View Documentation'
                    ).then(selection => {
                        if (selection === 'View Documentation') {
                            vscode.env.openExternal(vscode.Uri.parse('https://github.com/jetgit/vscode-extension'));
                        }
                    });
                }
            }
        ];

        commands.forEach(({ id, handler }) => {
            const disposable = vscode.commands.registerCommand(id, handler);
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);
        });
    }

    /**
     * Dispose of all registered commands
     */
    dispose(): void {
        this.disposables.forEach(disposable => {
            try {
                disposable.dispose();
            } catch (error) {
                // Log error but don't throw to allow cleanup to continue
                console.error('Error disposing command:', error);
            }
        });
        this.disposables = [];
    }
}
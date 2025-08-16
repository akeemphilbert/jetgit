import * as vscode from 'vscode';
import { GitService } from './gitService';
import { GitMenuController } from '../providers/gitMenuController';
import { ContextMenuProvider } from '../providers/contextMenuProvider';
import { DiffViewer } from '../views/diffViewer';
import { DialogService } from './dialogService';
import { StatusIntegrationService } from './statusIntegrationService';

/**
 * Service responsible for registering all VS Code commands and managing their lifecycle
 */
export class CommandRegistrationService {
    private gitService: GitService;
    private gitMenuController: GitMenuController;
    private contextMenuProvider: ContextMenuProvider;
    private diffViewer: DiffViewer;
    private dialogService: DialogService;
    private statusIntegrationService: StatusIntegrationService;
    private disposables: vscode.Disposable[] = [];

    constructor(
        gitService: GitService,
        gitMenuController: GitMenuController,
        contextMenuProvider: ContextMenuProvider,
        diffViewer: DiffViewer,
        dialogService: DialogService,
        statusIntegrationService: StatusIntegrationService
    ) {
        this.gitService = gitService;
        this.gitMenuController = gitMenuController;
        this.contextMenuProvider = contextMenuProvider;
        this.diffViewer = diffViewer;
        this.dialogService = dialogService;
        this.statusIntegrationService = statusIntegrationService;
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
        
        // Register utility commands
        this.registerUtilityCommands(context);
    }

    /**
     * Register main Git menu commands
     */
    private registerMainCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jetgit.showGitMenu',
                handler: async () => {
                    try {
                        await this.gitMenuController.showGitMenu();
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
                        await this.statusIntegrationService.notifyGitOperation('Update Project');
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
                            await this.statusIntegrationService.notifyGitOperation('Commit Changes');
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
                        await this.statusIntegrationService.notifyGitOperation('Push');
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
                        await this.statusIntegrationService.notifyGitOperation('Fetch');
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
                            await this.statusIntegrationService.notifyGitOperation('New Branch');
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
                            await this.statusIntegrationService.notifyGitOperation('Checkout Revision');
                            vscode.window.showInformationMessage(`Successfully checked out '${revision}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to checkout revision: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                            await this.statusIntegrationService.notifyGitOperation('New Branch From');
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
                        await this.statusIntegrationService.notifyGitOperation('Update Branch');
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
                        await this.statusIntegrationService.notifyGitOperation('Push Branch');
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
                            await this.statusIntegrationService.notifyGitOperation('Rename Branch');
                            vscode.window.showInformationMessage(`Successfully renamed branch '${branchName}' to '${newBranchName}'`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to rename branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
     * Register utility commands for extension management
     */
    private registerUtilityCommands(context: vscode.ExtensionContext): void {
        const commands = [
            {
                id: 'jetgit.refreshStatus',
                handler: async () => {
                    try {
                        await this.statusIntegrationService.notifyGitOperation('Refresh Status');
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
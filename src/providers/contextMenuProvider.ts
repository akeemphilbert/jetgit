import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { ErrorHandler } from '../utils/errorHandler';
import { DialogService } from '../services/dialogService';

/**
 * Context menu provider for Git operations
 * Provides comprehensive Git functionality through right-click context menus
 */
export class ContextMenuProvider {
    private gitService: GitService;
    private errorHandler: ErrorHandler;
    private dialogService: DialogService;

    constructor(gitService: GitService) {
        this.gitService = gitService;
        this.errorHandler = new ErrorHandler();
        this.dialogService = new DialogService();
    }

    /**
     * Register all context menu commands
     */
    registerCommands(context: vscode.ExtensionContext): void {
        // Repository Operations
        const pullCommand = vscode.commands.registerCommand('jetgit.context.pull', 
            this.handleRepositoryOperation.bind(this, 'pull'));
        const pushCommand = vscode.commands.registerCommand('jetgit.context.push', 
            this.handleRepositoryOperation.bind(this, 'push'));
        const fetchCommand = vscode.commands.registerCommand('jetgit.context.fetch', 
            this.handleRepositoryOperation.bind(this, 'fetch'));
        const mergeCommand = vscode.commands.registerCommand('jetgit.context.merge', 
            this.handleMergeOperation.bind(this));
        const rebaseCommand = vscode.commands.registerCommand('jetgit.context.rebase', 
            this.handleRebaseOperation.bind(this));

        // Branch Management
        const branchesCommand = vscode.commands.registerCommand('jetgit.context.branches', 
            this.handleBranchesOperation.bind(this));
        const newBranchCommand = vscode.commands.registerCommand('jetgit.context.newBranch', 
            this.handleNewBranchOperation.bind(this));
        const newTagCommand = vscode.commands.registerCommand('jetgit.context.newTag', 
            this.handleNewTagOperation.bind(this));

        // File Operations
        const showHistoryCommand = vscode.commands.registerCommand('jetgit.context.showHistory', 
            this.handleShowHistoryOperation.bind(this));
        const showCurrentVersionCommand = vscode.commands.registerCommand('jetgit.context.showCurrentVersion', 
            this.handleShowCurrentVersionOperation.bind(this));
        const compareWithBranchCommand = vscode.commands.registerCommand('jetgit.context.compareWithBranch', 
            this.handleCompareWithBranchOperation.bind(this));
        const compareWithRevisionCommand = vscode.commands.registerCommand('jetgit.context.compareWithRevision', 
            this.handleCompareWithRevisionOperation.bind(this));
        const annotateCommand = vscode.commands.registerCommand('jetgit.context.annotate', 
            this.handleAnnotateOperation.bind(this));
        const revertCommand = vscode.commands.registerCommand('jetgit.context.revert', 
            this.handleRevertOperation.bind(this));

        // Advanced Operations
        const resetHeadCommand = vscode.commands.registerCommand('jetgit.context.resetHead', 
            this.handleResetHeadOperation.bind(this));
        const stashChangesCommand = vscode.commands.registerCommand('jetgit.context.stashChanges', 
            this.handleStashChangesOperation.bind(this));
        const unstashChangesCommand = vscode.commands.registerCommand('jetgit.context.unstashChanges', 
            this.handleUnstashChangesOperation.bind(this));
        const manageRemotesCommand = vscode.commands.registerCommand('jetgit.context.manageRemotes', 
            this.handleManageRemotesOperation.bind(this));

        // Add all commands to context subscriptions
        context.subscriptions.push(
            pullCommand,
            pushCommand,
            fetchCommand,
            mergeCommand,
            rebaseCommand,
            branchesCommand,
            newBranchCommand,
            newTagCommand,
            showHistoryCommand,
            showCurrentVersionCommand,
            compareWithBranchCommand,
            compareWithRevisionCommand,
            annotateCommand,
            revertCommand,
            resetHeadCommand,
            stashChangesCommand,
            unstashChangesCommand,
            manageRemotesCommand
        );
    }

    // Repository Operations Handlers

    private async handleRepositoryOperation(operation: 'pull' | 'push' | 'fetch'): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            switch (operation) {
                case 'pull':
                    await this.gitService.pull();
                    vscode.window.showInformationMessage('Pull completed successfully');
                    break;
                case 'push':
                    await this.gitService.push();
                    vscode.window.showInformationMessage('Push completed successfully');
                    break;
                case 'fetch':
                    await this.gitService.fetch();
                    vscode.window.showInformationMessage('Fetch completed successfully');
                    break;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`${operation} operation failed: ${error}`);
        }
    }

    private async handleMergeOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            // Get available branches for merge selection
            const branches = await this.gitService.getBranches();
            const currentBranch = await this.gitService.getCurrentBranch();
            
            if (!currentBranch) {
                vscode.window.showErrorMessage('Unable to determine current branch');
                return;
            }

            const selectedBranch = await this.dialogService.selectBranchForMerge(branches, currentBranch);

            if (selectedBranch) {
                await this.gitService.merge(selectedBranch.name);
                vscode.window.showInformationMessage(`Merged ${selectedBranch.name} successfully`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Merge operation failed: ${error}`);
        }
    }

    private async handleRebaseOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            // Get available branches for rebase selection
            const branches = await this.gitService.getBranches();
            const currentBranch = await this.gitService.getCurrentBranch();
            
            if (!currentBranch) {
                vscode.window.showErrorMessage('Unable to determine current branch');
                return;
            }

            const selectedBranch = await this.dialogService.selectBranchForRebase(branches, currentBranch);

            if (selectedBranch) {
                await this.gitService.rebase(selectedBranch.name);
                vscode.window.showInformationMessage(`Rebased onto ${selectedBranch.name} successfully`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Rebase operation failed: ${error}`);
        }
    }

    // Branch Management Handlers

    private async handleBranchesOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            // Show branch menu (this will be implemented in task 8)
            vscode.window.showInformationMessage('Branch menu functionality will be implemented in task 8');
        } catch (error) {
            vscode.window.showErrorMessage(`Branch operation failed: ${error}`);
        }
    }

    private async handleNewBranchOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const branchName = await this.dialogService.promptForBranchName();

            if (branchName) {
                await this.gitService.createBranch(branchName.trim());
                vscode.window.showInformationMessage(`Created branch '${branchName}' successfully`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`New branch operation failed: ${error}`);
        }
    }

    private async handleNewTagOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const tagName = await this.dialogService.promptForTagName();

            if (tagName) {
                const tagMessage = await this.dialogService.promptForTagMessage();

                await this.gitService.createTag(tagName.trim(), tagMessage?.trim());
                vscode.window.showInformationMessage(`Created tag '${tagName}' successfully`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`New tag operation failed: ${error}`);
        }
    }

    // File Operations Handlers

    private async handleShowHistoryOperation(uri?: vscode.Uri): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const filePath = this.getFilePathFromUri(uri);
            if (!filePath) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            const history = await this.gitService.getFileHistory(filePath);
            if (history.length === 0) {
                vscode.window.showInformationMessage('No history found for this file');
                return;
            }

            // Display history in a quick pick (future task will implement proper history viewer)
            const historyItems = history.map(commit => ({
                label: commit.hash.substring(0, 8),
                description: commit.message,
                detail: `${commit.author} - ${commit.date.toLocaleDateString()}`
            }));

            await vscode.window.showQuickPick(historyItems, {
                placeHolder: `History for ${filePath}`
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Show history operation failed: ${error}`);
        }
    }

    private async handleShowCurrentVersionOperation(uri?: vscode.Uri): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const filePath = this.getFilePathFromUri(uri);
            if (!filePath) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            // Open the current version of the file
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Show current version operation failed: ${error}`);
        }
    }

    private async handleCompareWithBranchOperation(uri?: vscode.Uri): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const filePath = this.getFilePathFromUri(uri);
            if (!filePath) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            const branches = await this.gitService.getBranches();
            const selectedBranch = await this.dialogService.selectBranchForComparison(branches);

            if (selectedBranch) {
                // Use the new compare with branch command that includes the diff viewer
                await vscode.commands.executeCommand('jetgit.compareWithBranch', filePath);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Compare with branch operation failed: ${error}`);
        }
    }

    private async handleCompareWithRevisionOperation(uri?: vscode.Uri): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const filePath = this.getFilePathFromUri(uri);
            if (!filePath) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            const revision = await this.dialogService.promptForRevision(
                'Enter commit hash, tag, or branch name',
                'HEAD~1, v1.0.0, or branch-name'
            );

            if (revision) {
                // Use the new show file diff command that includes the diff viewer
                await vscode.commands.executeCommand('jetgit.showFileDiff', filePath, 'HEAD', revision);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Compare with revision operation failed: ${error}`);
        }
    }

    private async handleAnnotateOperation(uri?: vscode.Uri): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const filePath = this.getFilePathFromUri(uri);
            if (!filePath) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            // Annotate (blame) functionality will be implemented in task 10
            vscode.window.showInformationMessage(`Annotate functionality for ${filePath} will be implemented in task 10`);
        } catch (error) {
            vscode.window.showErrorMessage(`Annotate operation failed: ${error}`);
        }
    }

    private async handleRevertOperation(uri?: vscode.Uri): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const filePath = this.getFilePathFromUri(uri);
            if (!filePath) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            const confirmed = await this.dialogService.confirmFileRevert(filePath);

            if (confirmed) {
                await this.gitService.revertFile(filePath);
                const fileName = filePath.split('/').pop() || filePath;
                vscode.window.showInformationMessage(`Reverted changes to ${fileName}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Revert operation failed: ${error}`);
        }
    }

    // Advanced Operations Handlers

    private async handleResetHeadOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const selectedMode = await this.dialogService.selectResetMode();

            if (!selectedMode) {
                return;
            }

            const commit = await this.dialogService.promptForRevision(
                'Enter commit to reset to (optional, defaults to HEAD)',
                'HEAD~1, commit-hash, or leave empty for HEAD'
            );

            if (selectedMode === 'hard') {
                const confirmed = await this.dialogService.confirmHardReset();
                if (!confirmed) {
                    return;
                }
            }

            await this.gitService.resetHead(selectedMode, commit?.trim() || undefined);
            vscode.window.showInformationMessage(`Reset HEAD (${selectedMode}) completed successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Reset HEAD operation failed: ${error}`);
        }
    }

    private async handleStashChangesOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const status = await this.gitService.getRepositoryStatus();
            if (!status.hasChanges) {
                vscode.window.showInformationMessage('No changes to stash');
                return;
            }

            const message = await this.dialogService.promptForStashMessage();

            await this.gitService.stashChanges(message?.trim());
            vscode.window.showInformationMessage('Changes stashed successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Stash changes operation failed: ${error}`);
        }
    }

    private async handleUnstashChangesOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            // Get available stashes
            const stashes = await this.gitService.getStashes();
            const selectedStash = await this.dialogService.selectStashForUnstash(stashes);

            if (selectedStash) {
                await this.gitService.unstashChanges(selectedStash.index);
                vscode.window.showInformationMessage('Changes unstashed successfully');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Unstash changes operation failed: ${error}`);
        }
    }

    private async handleManageRemotesOperation(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            if (!isRepo) {
                vscode.window.showErrorMessage('No Git repository found in workspace');
                return;
            }

            const remotes = await this.gitService.getRemotes();
            const selectedAction = await this.dialogService.selectRemoteManagementAction();

            if (!selectedAction) {
                return;
            }

            switch (selectedAction) {
                case 'add':
                    await this.handleAddRemote();
                    break;
                case 'remove':
                    await this.handleRemoveRemote(remotes);
                    break;
                case 'list':
                    await this.handleListRemotes(remotes);
                    break;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Manage remotes operation failed: ${error}`);
        }
    }

    private async handleAddRemote(): Promise<void> {
        const name = await this.dialogService.promptForRemoteName();

        if (!name) {
            return;
        }

        const url = await this.dialogService.promptForRemoteUrl();

        if (url) {
            await this.gitService.addRemote(name.trim(), url.trim());
            vscode.window.showInformationMessage(`Added remote '${name}' successfully`);
        }
    }

    private async handleRemoveRemote(remotes: any[]): Promise<void> {
        const selectedRemote = await this.dialogService.selectRemoteForRemoval(remotes);

        if (selectedRemote) {
            const confirmed = await this.dialogService.confirmRemoteRemoval(selectedRemote.name);

            if (confirmed) {
                await this.gitService.removeRemote(selectedRemote.name);
                vscode.window.showInformationMessage(`Removed remote '${selectedRemote.name}' successfully`);
            }
        }
    }

    private async handleListRemotes(remotes: any[]): Promise<void> {
        if (remotes.length === 0) {
            vscode.window.showInformationMessage('No remotes configured');
            return;
        }

        const remoteItems = remotes.map(remote => ({
            label: remote.name,
            description: remote.fetchUrl,
            detail: remote.pushUrl !== remote.fetchUrl ? `Push: ${remote.pushUrl}` : undefined
        }));

        await vscode.window.showQuickPick(remoteItems, {
            placeHolder: 'Configured remotes'
        });
    }

    // Utility Methods

    private getFilePathFromUri(uri?: vscode.Uri): string | undefined {
        if (uri) {
            return uri.fsPath;
        }

        // Try to get file path from active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            return activeEditor.document.uri.fsPath;
        }

        return undefined;
    }
}
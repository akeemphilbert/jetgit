import * as vscode from 'vscode';
import { Branch, StashEntry, Remote, ResetMode } from '../types/git';

/**
 * Centralized dialog service for all user interactions
 * Provides standardized dialogs for Git operations
 */
export class DialogService {

    /**
     * Show input dialog for branch name with validation
     */
    async promptForBranchName(
        prompt: string = 'Enter branch name',
        placeholder: string = 'feature/my-new-feature',
        currentName?: string
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            value: currentName,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Branch name cannot be empty';
                }
                if (value.includes(' ')) {
                    return 'Branch name cannot contain spaces';
                }
                if (value.startsWith('-') || value.endsWith('-')) {
                    return 'Branch name cannot start or end with a dash';
                }
                if (value.includes('..') || value.includes('~') || value.includes('^') || value.includes(':')) {
                    return 'Branch name contains invalid characters';
                }
                return null;
            }
        });
    }

    /**
     * Show input dialog for tag name with validation
     */
    async promptForTagName(
        prompt: string = 'Enter tag name',
        placeholder: string = 'v1.0.0'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Tag name cannot be empty';
                }
                if (value.includes(' ')) {
                    return 'Tag name cannot contain spaces';
                }
                return null;
            }
        });
    }

    /**
     * Show input dialog for tag message (optional)
     */
    async promptForTagMessage(
        prompt: string = 'Enter tag message (optional)',
        placeholder: string = 'Release notes'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder
        });
    }

    /**
     * Show input dialog for commit message with validation
     */
    async promptForCommitMessage(
        prompt: string = 'Enter commit message',
        placeholder: string = 'Add new feature'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Commit message cannot be empty';
                }
                if (value.trim().length < 3) {
                    return 'Commit message must be at least 3 characters long';
                }
                return null;
            }
        });
    }

    /**
     * Show input dialog for stash message (optional)
     */
    async promptForStashMessage(
        prompt: string = 'Enter stash message (optional)',
        placeholder: string = 'Work in progress'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder
        });
    }

    /**
     * Show input dialog for remote name with validation
     */
    async promptForRemoteName(
        prompt: string = 'Enter remote name',
        placeholder: string = 'origin'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Remote name cannot be empty';
                }
                if (value.includes(' ')) {
                    return 'Remote name cannot contain spaces';
                }
                return null;
            }
        });
    }

    /**
     * Show input dialog for remote URL with validation
     */
    async promptForRemoteUrl(
        prompt: string = 'Enter remote URL',
        placeholder: string = 'https://github.com/user/repo.git'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Remote URL cannot be empty';
                }
                // Basic URL validation
                try {
                    new URL(value.trim());
                    return null;
                } catch {
                    // Check for SSH format
                    if (value.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:[a-zA-Z0-9._/-]+\.git$/)) {
                        return null;
                    }
                    return 'Invalid URL format';
                }
            }
        });
    }

    /**
     * Show input dialog for revision (commit hash, tag, or branch name)
     */
    async promptForRevision(
        prompt: string = 'Enter revision',
        placeholder: string = 'HEAD~1, v1.0.0, or branch-name'
    ): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (value && value.trim().length === 0) {
                    return 'Revision cannot be empty if provided';
                }
                return null;
            }
        });
    }

    /**
     * Show branch selection dialog for merge operations
     */
    async selectBranchForMerge(
        branches: Branch[],
        currentBranch: string
    ): Promise<Branch | undefined> {
        // Filter out current branch from merge options
        const mergeBranches = branches
            .filter(branch => branch.name !== currentBranch)
            .map(branch => ({
                label: branch.name,
                description: branch.type === 'remote' ? 'Remote branch' : 'Local branch',
                detail: this.getBranchDetail(branch),
                branch
            }));

        if (mergeBranches.length === 0) {
            vscode.window.showInformationMessage('No other branches available for merge');
            return undefined;
        }

        const selected = await vscode.window.showQuickPick(mergeBranches, {
            placeHolder: 'Select branch to merge into current branch',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.branch;
    }

    /**
     * Show branch selection dialog for rebase operations
     */
    async selectBranchForRebase(
        branches: Branch[],
        currentBranch: string
    ): Promise<Branch | undefined> {
        // Filter out current branch from rebase options
        const rebaseBranches = branches
            .filter(branch => branch.name !== currentBranch)
            .map(branch => ({
                label: branch.name,
                description: branch.type === 'remote' ? 'Remote branch' : 'Local branch',
                detail: this.getBranchDetail(branch),
                branch
            }));

        if (rebaseBranches.length === 0) {
            vscode.window.showInformationMessage('No other branches available for rebase');
            return undefined;
        }

        const selected = await vscode.window.showQuickPick(rebaseBranches, {
            placeHolder: 'Select branch to rebase current branch onto',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.branch;
    }

    /**
     * Show branch selection dialog for comparison operations
     */
    async selectBranchForComparison(branches: Branch[]): Promise<Branch | undefined> {
        const branchItems = branches.map(branch => ({
            label: branch.name,
            description: branch.type === 'remote' ? 'Remote branch' : 'Local branch',
            detail: this.getBranchDetail(branch),
            branch
        }));

        const selected = await vscode.window.showQuickPick(branchItems, {
            placeHolder: 'Select branch to compare with',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.branch;
    }

    /**
     * Show reset mode selection dialog
     */
    async selectResetMode(): Promise<ResetMode | undefined> {
        const resetModes = [
            {
                label: 'Soft',
                description: 'Keep changes in index and working tree',
                detail: 'Moves HEAD but keeps all changes staged',
                mode: 'soft' as ResetMode
            },
            {
                label: 'Mixed',
                description: 'Keep changes in working tree only (default)',
                detail: 'Moves HEAD and resets index, but keeps working tree changes',
                mode: 'mixed' as ResetMode
            },
            {
                label: 'Hard',
                description: 'Discard all changes (DANGEROUS)',
                detail: 'Moves HEAD, resets index, and discards all working tree changes',
                mode: 'hard' as ResetMode
            }
        ];

        const selected = await vscode.window.showQuickPick(resetModes, {
            placeHolder: 'Select reset mode',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.mode;
    }

    /**
     * Show stash selection dialog for unstash operations
     */
    async selectStashForUnstash(stashes: StashEntry[]): Promise<StashEntry | undefined> {
        if (stashes.length === 0) {
            vscode.window.showInformationMessage('No stashes available');
            return undefined;
        }

        const stashItems = stashes.map(stash => ({
            label: `stash@{${stash.index}}`,
            description: stash.message || 'No message',
            detail: `${stash.branch} • ${stash.timestamp.toLocaleString()}`,
            stash
        }));

        const selected = await vscode.window.showQuickPick(stashItems, {
            placeHolder: 'Select a stash to apply',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.stash;
    }

    /**
     * Show remote selection dialog for removal
     */
    async selectRemoteForRemoval(remotes: Remote[]): Promise<Remote | undefined> {
        if (remotes.length === 0) {
            vscode.window.showInformationMessage('No remotes configured');
            return undefined;
        }

        const remoteItems = remotes.map(remote => ({
            label: remote.name,
            description: remote.fetchUrl,
            detail: remote.pushUrl !== remote.fetchUrl ? `Push: ${remote.pushUrl}` : undefined,
            remote
        }));

        const selected = await vscode.window.showQuickPick(remoteItems, {
            placeHolder: 'Select remote to remove',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.remote;
    }

    /**
     * Show remote management action selection dialog
     */
    async selectRemoteManagementAction(): Promise<'add' | 'remove' | 'list' | undefined> {
        const actions = [
            {
                label: 'Add Remote',
                description: 'Add a new remote repository',
                action: 'add' as const
            },
            {
                label: 'Remove Remote',
                description: 'Remove an existing remote',
                action: 'remove' as const
            },
            {
                label: 'List Remotes',
                description: 'Show all configured remotes',
                action: 'list' as const
            }
        ];

        const selected = await vscode.window.showQuickPick(actions, {
            placeHolder: 'Select remote management action',
            matchOnDescription: true
        });

        return selected?.action;
    }

    /**
     * Show confirmation dialog for destructive operations
     */
    async confirmDestructiveOperation(
        message: string,
        actionLabel: string = 'Continue',
        isModal: boolean = true
    ): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            message,
            { modal: isModal },
            actionLabel,
            'Cancel'
        );

        return result === actionLabel;
    }

    /**
     * Show confirmation dialog for file revert operation
     */
    async confirmFileRevert(filePath: string): Promise<boolean> {
        const fileName = filePath.split('/').pop() || filePath;
        return await this.confirmDestructiveOperation(
            `Are you sure you want to revert changes to ${fileName}? This action cannot be undone.`,
            'Revert'
        );
    }

    /**
     * Show confirmation dialog for hard reset operation
     */
    async confirmHardReset(): Promise<boolean> {
        return await this.confirmDestructiveOperation(
            'Hard reset will permanently discard all uncommitted changes. Are you sure?',
            'Reset'
        );
    }

    /**
     * Show confirmation dialog for remote removal
     */
    async confirmRemoteRemoval(remoteName: string): Promise<boolean> {
        return await this.confirmDestructiveOperation(
            `Are you sure you want to remove remote '${remoteName}'?`,
            'Remove',
            false
        );
    }

    /**
     * Show warning dialog with continue/cancel options
     */
    async showContinueWarning(
        message: string,
        continueLabel: string = 'Continue'
    ): Promise<'continue' | 'cancel' | undefined> {
        const result = await vscode.window.showWarningMessage(
            message,
            continueLabel,
            'Cancel'
        );

        if (result === continueLabel) {
            return 'continue';
        } else if (result === 'Cancel') {
            return 'cancel';
        }
        return undefined;
    }

    /**
     * Show warning dialog with stash option for uncommitted changes
     */
    async showUncommittedChangesWarning(
        operation: string
    ): Promise<'continue' | 'stash' | 'cancel' | undefined> {
        const result = await vscode.window.showWarningMessage(
            `You have uncommitted changes. Do you want to continue with ${operation}?`,
            'Continue',
            'Stash Changes',
            'Cancel'
        );

        switch (result) {
            case 'Continue':
                return 'continue';
            case 'Stash Changes':
                return 'stash';
            case 'Cancel':
                return 'cancel';
            default:
                return undefined;
        }
    }

    /**
     * Show warning dialog for no staged changes with stage all option
     */
    async showNoStagedChangesWarning(): Promise<'stage-all' | 'cancel' | undefined> {
        const result = await vscode.window.showWarningMessage(
            'No staged changes found. Do you want to stage all changes and commit?',
            'Stage All & Commit',
            'Cancel'
        );

        if (result === 'Stage All & Commit') {
            return 'stage-all';
        } else if (result === 'Cancel') {
            return 'cancel';
        }
        return undefined;
    }

    /**
     * Show warning dialog for mixed reset with staged changes
     */
    async showMixedResetWarning(): Promise<boolean> {
        return await this.showContinueWarning(
            'Mixed reset will unstage all staged changes. Continue?'
        ) === 'continue';
    }

    /**
     * Show warning dialog for stash conflicts
     */
    async showStashConflictWarning(): Promise<boolean> {
        return await this.showContinueWarning(
            'You have uncommitted changes. Applying stash may cause conflicts. Continue?'
        ) === 'continue';
    }

    /**
     * Get detailed description for a branch
     */
    private getBranchDetail(branch: Branch): string {
        const parts: string[] = [];

        if (branch.isActive) {
            parts.push('current');
        }

        if (branch.ahead && branch.ahead > 0) {
            parts.push(`↑${branch.ahead}`);
        }

        if (branch.behind && branch.behind > 0) {
            parts.push(`↓${branch.behind}`);
        }

        if (branch.upstream && branch.type === 'local') {
            parts.push(`→ ${branch.upstream}`);
        }

        if (branch.lastCommit) {
            parts.push(`${branch.lastCommit.shortHash} • ${branch.lastCommit.author}`);
        }

        return parts.join(' ');
    }
}
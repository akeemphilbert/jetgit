import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { Branch, BranchGroup } from '../types/git';
import { groupBranches, filterBranchesByType, getBranchDisplayName } from '../utils/branchUtils';

export interface GitMenuItem {
    id: string;
    label: string;
    description?: string;
    icon?: vscode.ThemeIcon;
    command?: string;
    args?: any[];
    children?: GitMenuItem[];
    contextValue?: string;
}

export class GitMenuProvider {
    private gitService: GitService;

    constructor(gitService: GitService) {
        this.gitService = gitService;
    }

    async buildGitMenu(): Promise<GitMenuItem[]> {
        const menuItems: GitMenuItem[] = [];

        try {
            // Add common tasks section
            menuItems.push(...await this.buildCommonTasksSection());

            // Add separator
            menuItems.push({
                id: 'separator-1',
                label: '──────────────',
                contextValue: 'separator'
            });

            // Add local branches section
            menuItems.push(...await this.buildLocalBranchesSection());

            // Add separator
            menuItems.push({
                id: 'separator-2',
                label: '──────────────',
                contextValue: 'separator'
            });

            // Add remote branches section
            menuItems.push(...await this.buildRemoteBranchesSection());

        } catch (error) {
            // If there's an error, show a basic menu
            menuItems.push({
                id: 'error',
                label: 'Error loading Git menu',
                description: error instanceof Error ? error.message : 'Unknown error',
                icon: new vscode.ThemeIcon('error')
            });
        }

        return menuItems;
    }

    private async buildCommonTasksSection(): Promise<GitMenuItem[]> {
        return [
            {
                id: 'header-common',
                label: 'Common Tasks',
                contextValue: 'header'
            },
            {
                id: 'update-project',
                label: 'Update Project…',
                description: 'Pull latest changes',
                icon: new vscode.ThemeIcon('sync'),
                command: 'jetgit.updateProject'
            },
            {
                id: 'commit-changes',
                label: 'Commit…',
                description: 'Commit staged changes',
                icon: new vscode.ThemeIcon('git-commit'),
                command: 'jetgit.commitChanges'
            },
            {
                id: 'push',
                label: 'Push…',
                description: 'Push to remote',
                icon: new vscode.ThemeIcon('arrow-up'),
                command: 'jetgit.push'
            },
            {
                id: 'fetch',
                label: 'Fetch',
                description: 'Fetch from remote',
                icon: new vscode.ThemeIcon('arrow-down'),
                command: 'jetgit.fetch'
            },
            {
                id: 'new-branch',
                label: 'New Branch…',
                description: 'Create new branch',
                icon: new vscode.ThemeIcon('git-branch'),
                command: 'jetgit.newBranch'
            },
            {
                id: 'checkout-revision',
                label: 'Checkout Tag or Revision…',
                description: 'Checkout specific commit/tag',
                icon: new vscode.ThemeIcon('tag'),
                command: 'jetgit.checkoutRevision'
            }
        ];
    }

    private async buildLocalBranchesSection(): Promise<GitMenuItem[]> {
        const menuItems: GitMenuItem[] = [];
        
        menuItems.push({
            id: 'header-local',
            label: 'Local Branches',
            contextValue: 'header'
        });

        try {
            const allBranches = await this.gitService.getBranches();
            const localBranches = filterBranchesByType(allBranches, 'local');
            const { groups, ungrouped } = groupBranches(localBranches);

            // Add ungrouped branches first
            for (const branch of ungrouped) {
                menuItems.push(this.createBranchMenuItem(branch));
            }

            // Add grouped branches
            for (const group of groups) {
                const groupItem: GitMenuItem = {
                    id: `group-${group.prefix}`,
                    label: group.prefix,
                    description: `${group.branches.length} branches`,
                    icon: new vscode.ThemeIcon('folder'),
                    contextValue: 'branch-group',
                    children: group.branches.map(branch => this.createBranchMenuItem(branch, true))
                };
                menuItems.push(groupItem);
            }

        } catch (error) {
            menuItems.push({
                id: 'local-error',
                label: 'Error loading local branches',
                description: error instanceof Error ? error.message : 'Unknown error',
                icon: new vscode.ThemeIcon('error')
            });
        }

        return menuItems;
    }

    private async buildRemoteBranchesSection(): Promise<GitMenuItem[]> {
        const menuItems: GitMenuItem[] = [];
        
        menuItems.push({
            id: 'header-remote',
            label: 'Remote Branches',
            contextValue: 'header'
        });

        try {
            const allBranches = await this.gitService.getBranches();
            const remoteBranches = filterBranchesByType(allBranches, 'remote');
            const { groups, ungrouped } = groupBranches(remoteBranches);

            // Add ungrouped branches first
            for (const branch of ungrouped) {
                menuItems.push(this.createBranchMenuItem(branch));
            }

            // Add grouped branches
            for (const group of groups) {
                const groupItem: GitMenuItem = {
                    id: `remote-group-${group.prefix}`,
                    label: group.prefix,
                    description: `${group.branches.length} remote branches`,
                    icon: new vscode.ThemeIcon('folder'),
                    contextValue: 'branch-group',
                    children: group.branches.map(branch => this.createBranchMenuItem(branch, true))
                };
                menuItems.push(groupItem);
            }

        } catch (error) {
            menuItems.push({
                id: 'remote-error',
                label: 'Error loading remote branches',
                description: error instanceof Error ? error.message : 'Unknown error',
                icon: new vscode.ThemeIcon('error')
            });
        }

        return menuItems;
    }

    private createBranchMenuItem(branch: Branch, isGrouped: boolean = false): GitMenuItem {
        const displayName = getBranchDisplayName(branch, isGrouped);
        const icon = branch.isActive ? 
            new vscode.ThemeIcon('star-full') : 
            new vscode.ThemeIcon('git-branch');

        // Create branch operations submenu
        const branchOperations: GitMenuItem[] = [
            {
                id: `new-branch-from-${branch.name}`,
                label: 'New Branch from Here…',
                description: `Create new branch from ${branch.name}`,
                icon: new vscode.ThemeIcon('git-branch'),
                command: 'jetgit.newBranchFrom',
                args: [branch.name]
            },
            {
                id: `show-diff-${branch.name}`,
                label: 'Show Diff with Working Tree',
                description: `Compare ${branch.name} with working directory`,
                icon: new vscode.ThemeIcon('diff'),
                command: 'jetgit.showDiffWithWorkingTree',
                args: [branch.name]
            }
        ];

        // Add branch-specific operations based on type and status
        if (branch.type === 'local') {
            if (branch.upstream) {
                branchOperations.push({
                    id: `update-${branch.name}`,
                    label: 'Update',
                    description: `Pull latest changes from upstream`,
                    icon: new vscode.ThemeIcon('sync'),
                    command: 'jetgit.updateBranch',
                    args: [branch.name]
                });
            }

            branchOperations.push({
                id: `push-${branch.name}`,
                label: 'Push…',
                description: `Push ${branch.name} to remote`,
                icon: new vscode.ThemeIcon('arrow-up'),
                command: 'jetgit.pushBranch',
                args: [branch.name]
            });

            if (!branch.isActive) {
                branchOperations.push({
                    id: `rename-${branch.name}`,
                    label: 'Rename…',
                    description: `Rename ${branch.name}`,
                    icon: new vscode.ThemeIcon('edit'),
                    command: 'jetgit.renameBranch',
                    args: [branch.name]
                });
            }
        }

        return {
            id: `branch-${branch.name}`,
            label: displayName,
            description: this.getBranchDescription(branch),
            icon: icon,
            contextValue: 'branch',
            children: branchOperations
        };
    }

    private getBranchDescription(branch: Branch): string {
        const parts: string[] = [];

        if (branch.isActive) {
            parts.push('current');
        }

        if (branch.type === 'remote') {
            parts.push('remote');
        }

        if (branch.ahead && branch.ahead > 0) {
            parts.push(`$(arrow-up)${branch.ahead}`);
        }

        if (branch.behind && branch.behind > 0) {
            parts.push(`$(arrow-down)${branch.behind}`);
        }

        if (branch.upstream && branch.type === 'local') {
            parts.push(`→ ${branch.upstream}`);
        }

        return parts.join(' ');
    }

    async handleMenuSelection(item: GitMenuItem): Promise<void> {
        if (item.command) {
            if (item.args && item.args.length > 0) {
                await vscode.commands.executeCommand(item.command, ...item.args);
            } else {
                await vscode.commands.executeCommand(item.command);
            }
        }
    }
}
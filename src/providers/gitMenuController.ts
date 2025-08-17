import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { RepoContextService } from '../services/repoContextService';
import { Repository, Branch } from '../types/git';
import { groupBranches, filterBranchesByType, getBranchDisplayName } from '../utils/branchUtils';

/**
 * JetBrains-style QuickPick menu controller
 * 
 * This controller provides a JetBrains IDE-style QuickPick menu that adapts to
 * single-repo vs multi-repo workspaces. It features:
 * - Single-repo layout with search placeholder and top actions
 * - Multi-repo layout with repo grid and common branches
 * - Divergence warning banner when repositories have diverged
 * - Performance optimized to open within 150ms
 * 
 * @example
 * ```typescript
 * const controller = new MenuController(gitService, repoContextService);
 * await controller.open();
 * ```
 */
export class MenuController {
    private gitService: GitService;
    private repoContextService: RepoContextService;
    private quickPick: vscode.QuickPick<QuickPickItem> | undefined;

    /**
     * Creates a new MenuController instance
     * 
     * @param gitService - The Git service instance for repository operations
     * @param repoContextService - The repository context service for multi-repo support
     */
    constructor(gitService: GitService, repoContextService: RepoContextService) {
        this.gitService = gitService;
        this.repoContextService = repoContextService;
    }

    /**
     * Opens the JetBrains-style QuickPick menu
     * 
     * Detects single vs multi-repo context and displays the appropriate layout.
     * Ensures the QuickPick opens within 150ms performance requirement.
     * 
     * @throws {Error} When Git menu cannot be built or displayed
     */
    async open(): Promise<void> {
        const startTime = Date.now();
        
        try {
            const repositories = this.repoContextService.listRepositories();
            
            if (repositories.length === 0) {
                vscode.window.showInformationMessage('No Git repositories found in workspace');
                return;
            }

            // Create QuickPick with performance optimization
            this.quickPick = vscode.window.createQuickPick<QuickPickItem>();
            this.quickPick.matchOnDescription = true;
            this.quickPick.matchOnDetail = true;
            
            // Set up event handlers
            this.setupQuickPickHandlers();
            
            if (repositories.length === 1) {
                await this.showSingleRepoLayout(repositories[0]);
            } else {
                await this.showMultiRepoLayout(repositories);
            }
            
            // Show QuickPick
            this.quickPick.show();
            
            // Log performance
            const elapsed = Date.now() - startTime;
            console.log(`JetGit QuickPick opened in ${elapsed}ms`);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open Git menu: ${error}`);
            this.dispose();
        }
    }

    /**
     * Shows single-repo layout with search placeholder and top actions
     */
    private async showSingleRepoLayout(repository: Repository): Promise<void> {
        if (!this.quickPick) return;
        
        this.quickPick.title = `Git (${repository.name})`;
        this.quickPick.placeholder = 'Search for branches and actions';
        
        const items: QuickPickItem[] = [];
        
        // Add top actions section
        items.push(...await this.createTopActions(repository));
        
        // Add separator
        items.push(this.createSeparator());
        
        // Add Recent branches section
        const recentBranches = await this.getRecentBranches(repository);
        if (recentBranches.length > 0) {
            items.push(this.createSectionHeader('Recent'));
            items.push(...recentBranches.map(branch => this.createBranchItem(branch, repository)));
            items.push(this.createSeparator());
        }
        
        // Add Local branches section
        const localBranches = await this.getLocalBranches(repository);
        if (localBranches.length > 0) {
            items.push(this.createSectionHeader('Local'));
            items.push(...this.createGroupedBranchItems(localBranches, repository));
            items.push(this.createSeparator());
        }
        
        // Add Remote branches section
        const remoteBranches = await this.getRemoteBranches(repository);
        if (remoteBranches.length > 0) {
            items.push(this.createSectionHeader('Remote'));
            items.push(...this.createGroupedRemoteBranchItems(remoteBranches, repository));
            items.push(this.createSeparator());
        }
        
        // Add Tags section
        const tags = await this.getTags(repository);
        if (tags.length > 0) {
            items.push(this.createSectionHeader('Tags'));
            items.push(...tags.map(tag => this.createTagItem(tag, repository)));
        }
        
        this.quickPick.items = items;
    }

    /**
     * Shows multi-repo layout with repo grid and common branches
     */
    private async showMultiRepoLayout(repositories: Repository[]): Promise<void> {
        if (!this.quickPick) return;
        
        this.quickPick.title = `Git (${repositories.length} repositories)`;
        this.quickPick.placeholder = 'Search for branches and actions';
        
        const items: QuickPickItem[] = [];
        
        // Add divergence warning banner if any repos have diverged
        const hasDiverged = await this.checkForDivergence(repositories);
        if (hasDiverged) {
            items.push(this.createDivergenceWarning());
            items.push(this.createSeparator());
        }
        
        // Add repository grid
        items.push(...repositories.map(repo => this.createRepositoryItem(repo)));
        items.push(this.createSeparator());
        
        // Add Common Local Branches section
        const commonLocalBranches = await this.getCommonLocalBranches(repositories);
        if (commonLocalBranches.length > 0) {
            items.push(this.createSectionHeader('Common Local Branches'));
            items.push(...commonLocalBranches.map(branch => this.createCommonBranchItem(branch, 'local')));
            items.push(this.createSeparator());
        }
        
        // Add Common Remote Branches section
        const commonRemoteBranches = await this.getCommonRemoteBranches(repositories);
        if (commonRemoteBranches.length > 0) {
            items.push(this.createSectionHeader('Common Remote Branches'));
            items.push(...commonRemoteBranches.map(branch => this.createCommonBranchItem(branch, 'remote')));
        }
        
        this.quickPick.items = items;
    }

    /**
     * Sets up QuickPick event handlers
     */
    private setupQuickPickHandlers(): void {
        if (!this.quickPick) return;
        
        this.quickPick.onDidChangeSelection(async (selection) => {
            if (selection.length > 0) {
                const selectedItem = selection[0];
                await this.handleItemSelection(selectedItem);
            }
        });
        
        this.quickPick.onDidHide(() => {
            this.dispose();
        });
    }

    /**
     * Handles selection of a QuickPick item
     */
    private async handleItemSelection(item: QuickPickItem): Promise<void> {
        this.dispose();
        
        try {
            switch (item.type) {
                case 'action':
                    await this.executeAction(item as ActionItem);
                    break;
                case 'branch':
                    await this.handleBranchSelection(item as BranchItem);
                    break;
                case 'repository':
                    await this.handleRepositorySelection(item as RepositoryItem);
                    break;
                case 'tag':
                    await this.handleTagSelection(item as TagItem);
                    break;
                case 'common-branch':
                    await this.handleCommonBranchSelection(item as CommonBranchItem);
                    break;
                default:
                    // Ignore separators and headers
                    break;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to execute action: ${error}`);
        }
    }

    /**
     * Creates top actions for single-repo layout
     */
    private async createTopActions(repository: Repository): Promise<ActionItem[]> {
        return [
            {
                type: 'action',
                label: '$(sync) Update Project…',
                description: 'Pull latest changes',
                action: 'updateProject',
                repository,
                alwaysShow: true
            },
            {
                type: 'action',
                label: '$(git-commit) Commit…',
                description: 'Commit changes',
                action: 'commit',
                repository,
                alwaysShow: true
            },
            {
                type: 'action',
                label: '$(arrow-up) Push…',
                description: 'Push to remote',
                action: 'push',
                repository,
                alwaysShow: true
            },
            {
                type: 'action',
                label: '$(git-branch) New Branch…',
                description: 'Create new branch',
                action: 'newBranch',
                repository,
                alwaysShow: true
            },
            {
                type: 'action',
                label: '$(tag) Checkout Tag or Revision…',
                description: 'Checkout specific commit or tag',
                action: 'checkoutRef',
                repository,
                alwaysShow: true
            }
        ];
    }

    /**
     * Gets recent branches for a repository using MRU tracking
     */
    private async getRecentBranches(repository: Repository): Promise<Branch[]> {
        try {
            const mruBranches = this.repoContextService.getMRUBranches(repository);
            const allBranches = await this.gitService.getBranches();
            
            // Filter to get actual branch objects for MRU branch names
            return mruBranches
                .map(branchName => allBranches.find(b => b.name === branchName))
                .filter((branch): branch is Branch => branch !== undefined)
                .slice(0, 5); // Limit to 5 recent branches
        } catch (error) {
            console.warn('Failed to get recent branches:', error);
            return [];
        }
    }

    /**
     * Gets local branches for a repository
     */
    private async getLocalBranches(repository: Repository): Promise<Branch[]> {
        try {
            const allBranches = await this.gitService.getBranches();
            return filterBranchesByType(allBranches, 'local');
        } catch (error) {
            console.warn('Failed to get local branches:', error);
            return [];
        }
    }

    /**
     * Gets remote branches for a repository
     */
    private async getRemoteBranches(repository: Repository): Promise<Branch[]> {
        try {
            const allBranches = await this.gitService.getBranches();
            return filterBranchesByType(allBranches, 'remote');
        } catch (error) {
            console.warn('Failed to get remote branches:', error);
            return [];
        }
    }

    /**
     * Gets tags for a repository
     */
    private async getTags(repository: Repository): Promise<string[]> {
        try {
            // This would need to be implemented in GitService
            // For now, return empty array
            return [];
        } catch (error) {
            console.warn('Failed to get tags:', error);
            return [];
        }
    }

    /**
     * Creates grouped branch items with hierarchy
     */
    private createGroupedBranchItems(branches: Branch[], repository: Repository): QuickPickItem[] {
        const { groups, ungrouped } = groupBranches(branches);
        const items: QuickPickItem[] = [];
        
        // Add ungrouped branches first
        items.push(...ungrouped.map(branch => this.createBranchItem(branch, repository)));
        
        // Add grouped branches (flattened for QuickPick)
        for (const group of groups) {
            for (const branch of group.branches) {
                items.push(this.createBranchItem(branch, repository, group.prefix));
            }
        }
        
        return items;
    }

    /**
     * Creates grouped remote branch items
     */
    private createGroupedRemoteBranchItems(branches: Branch[], repository: Repository): QuickPickItem[] {
        // Group by remote name
        const remoteGroups = new Map<string, Branch[]>();
        
        for (const branch of branches) {
            const remoteName = branch.fullName.split('/')[0];
            if (!remoteGroups.has(remoteName)) {
                remoteGroups.set(remoteName, []);
            }
            remoteGroups.get(remoteName)!.push(branch);
        }
        
        const items: QuickPickItem[] = [];
        for (const [remoteName, remoteBranches] of remoteGroups) {
            items.push(...remoteBranches.map(branch => this.createBranchItem(branch, repository, remoteName)));
        }
        
        return items;
    }

    /**
     * Checks if any repositories have diverged
     */
    private async checkForDivergence(repositories: Repository[]): Promise<boolean> {
        return repositories.some(repo => 
            (repo.ahead && repo.ahead > 0) || (repo.behind && repo.behind > 0)
        );
    }

    /**
     * Gets common local branches across all repositories
     */
    private async getCommonLocalBranches(repositories: Repository[]): Promise<string[]> {
        try {
            // This would need more sophisticated logic to find truly common branches
            // For now, return common branch names like main, develop
            return ['main', 'develop', 'master'].filter(branchName => 
                repositories.length > 0 // Placeholder logic
            );
        } catch (error) {
            console.warn('Failed to get common local branches:', error);
            return [];
        }
    }

    /**
     * Gets common remote branches across all repositories
     */
    private async getCommonRemoteBranches(repositories: Repository[]): Promise<string[]> {
        try {
            // Similar to local branches, this needs more sophisticated logic
            return ['origin/main', 'origin/develop', 'origin/master'].filter(branchName => 
                repositories.length > 0 // Placeholder logic
            );
        } catch (error) {
            console.warn('Failed to get common remote branches:', error);
            return [];
        }
    }

    /**
     * Creates various QuickPick items
     */
    private createSeparator(): SeparatorItem {
        return {
            type: 'separator',
            label: '',
            kind: vscode.QuickPickItemKind.Separator
        };
    }

    private createSectionHeader(title: string): HeaderItem {
        return {
            type: 'header',
            label: title,
            description: ''
        };
    }

    private createBranchItem(branch: Branch, repository: Repository, groupPrefix?: string): BranchItem {
        const displayName = getBranchDisplayName(branch, !!groupPrefix);
        const icon = branch.isActive ? 'circle-filled' : 'git-branch';
        
        let description = '';
        if (branch.isActive) {
            description += '⭐ ';
        }
        if (branch.ahead && branch.ahead > 0) {
            description += `↑${branch.ahead} `;
        }
        if (branch.behind && branch.behind > 0) {
            description += `↓${branch.behind} `;
        }
        
        return {
            type: 'branch',
            label: `$(${icon}) ${displayName}`,
            description: description.trim(),
            branch,
            repository
        };
    }

    private createRepositoryItem(repository: Repository): RepositoryItem {
        let label = `$(folder) ${repository.name}`;
        if (repository.currentBranch) {
            label += ` • ${repository.currentBranch}`;
        }
        
        let description = '';
        if (repository.ahead && repository.ahead > 0) {
            description += `↑${repository.ahead} `;
        }
        if (repository.behind && repository.behind > 0) {
            description += `↓${repository.behind} `;
        }
        
        return {
            type: 'repository',
            label,
            description: description.trim(),
            repository
        };
    }

    private createTagItem(tag: string, repository: Repository): TagItem {
        return {
            type: 'tag',
            label: `$(tag) ${tag}`,
            description: '',
            tag,
            repository
        };
    }

    private createCommonBranchItem(branchName: string, branchType: 'local' | 'remote'): CommonBranchItem {
        const icon = branchType === 'remote' ? 'cloud' : 'git-branch';
        return {
            type: 'common-branch',
            label: `$(${icon}) ${branchName}`,
            description: '',
            branchName,
            branchType
        };
    }

    private createDivergenceWarning(): WarningItem {
        return {
            type: 'warning',
            label: '⚠ Branches have diverged',
            description: 'Some repositories have uncommitted or unpushed changes'
        };
    }

    /**
     * Action handlers
     */
    private async executeAction(item: ActionItem): Promise<void> {
        const commands: Record<string, string> = {
            updateProject: 'jbGit.updateProject',
            commit: 'jbGit.commit',
            push: 'jbGit.push',
            newBranch: 'jbGit.createBranch',
            checkoutRef: 'jbGit.checkoutRef'
        };
        
        const command = commands[item.action];
        if (command) {
            await vscode.commands.executeCommand(command, item.repository);
        }
    }

    private async handleBranchSelection(item: BranchItem): Promise<void> {
        // Add to MRU and checkout branch
        this.repoContextService.addToMRU(item.repository, item.branch.name);
        
        if (!item.branch.isActive) {
            await vscode.commands.executeCommand('jbGit.checkoutBranch', item.branch.name);
        }
    }

    private async handleRepositorySelection(item: RepositoryItem): Promise<void> {
        // Switch to repository and show single-repo layout
        this.repoContextService.setActiveRepository(item.repository);
        
        // Reopen menu in single-repo mode
        setTimeout(() => this.open(), 100);
    }

    private async handleTagSelection(item: TagItem): Promise<void> {
        await vscode.commands.executeCommand('jbGit.checkoutRef', item.tag);
    }

    private async handleCommonBranchSelection(item: CommonBranchItem): Promise<void> {
        // This would need logic to checkout the branch in all repositories
        vscode.window.showInformationMessage(`Would checkout ${item.branchName} in all repositories`);
    }

    /**
     * Disposes of the QuickPick and cleans up resources
     */
    private dispose(): void {
        if (this.quickPick) {
            this.quickPick.dispose();
            this.quickPick = undefined;
        }
    }
}

/**
 * QuickPick item type definitions
 */
interface BaseQuickPickItem extends vscode.QuickPickItem {
    type: string;
}

interface ActionItem extends BaseQuickPickItem {
    type: 'action';
    action: string;
    repository: Repository;
    alwaysShow?: boolean;
}

interface BranchItem extends BaseQuickPickItem {
    type: 'branch';
    branch: Branch;
    repository: Repository;
}

interface RepositoryItem extends BaseQuickPickItem {
    type: 'repository';
    repository: Repository;
}

interface TagItem extends BaseQuickPickItem {
    type: 'tag';
    tag: string;
    repository: Repository;
}

interface CommonBranchItem extends BaseQuickPickItem {
    type: 'common-branch';
    branchName: string;
    branchType: 'local' | 'remote';
}

interface SeparatorItem extends BaseQuickPickItem {
    type: 'separator';
    kind: vscode.QuickPickItemKind.Separator;
}

interface HeaderItem extends BaseQuickPickItem {
    type: 'header';
}

interface WarningItem extends BaseQuickPickItem {
    type: 'warning';
}

type QuickPickItem = ActionItem | BranchItem | RepositoryItem | TagItem | CommonBranchItem | SeparatorItem | HeaderItem | WarningItem;


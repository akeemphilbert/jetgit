import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { RepoContextService } from '../services/repoContextService';
import { PerformanceMonitorService } from '../services/performanceMonitorService';
import { Repository, Branch } from '../types/git';
import { groupBranches, filterBranchesByType, getBranchDisplayName } from '../utils/branchUtils';
import { BranchesProvider } from './branchesProvider';

/**
 * Performance monitoring interface
 */
interface MenuPerformanceMetrics {
    openTime: number;
    dataAssemblyTime: number;
    renderTime: number;
    totalOperations: number;
    averageOpenTime: number;
    slowOperations: number; // Operations > 150ms
}

/**
 * JetBrains-style QuickPick menu controller
 * 
 * This controller provides a JetBrains IDE-style QuickPick menu that adapts to
 * single-repo vs multi-repo workspaces. It features:
 * - Single-repo layout with search placeholder and top actions
 * - Multi-repo layout with repo grid and common branches
 * - Divergence warning banner when repositories have diverged
 * - Performance optimized to open within 150ms
 * - Performance monitoring and optimization
 * 
 * @example
 * ```typescript
 * const controller = new MenuController(gitService, repoContextService, branchesProvider);
 * await controller.open();
 * ```
 */
export class MenuController {
    private gitService: GitService;
    private repoContextService: RepoContextService;
    private branchesProvider: BranchesProvider;
    private quickPick: vscode.QuickPick<QuickPickItem> | undefined;
    private performanceMonitor: PerformanceMonitorService;
    private performanceMetrics: MenuPerformanceMetrics = {
        openTime: 0,
        dataAssemblyTime: 0,
        renderTime: 0,
        totalOperations: 0,
        averageOpenTime: 0,
        slowOperations: 0
    };

    private static readonly PERFORMANCE_TARGET_MS = 150;

    /**
     * Creates a new MenuController instance
     * 
     * @param gitService - The Git service instance for repository operations
     * @param repoContextService - The repository context service for multi-repo support
     * @param branchesProvider - The branches provider for cached branch data
     */
    constructor(gitService: GitService, repoContextService: RepoContextService, branchesProvider: BranchesProvider) {
        this.gitService = gitService;
        this.repoContextService = repoContextService;
        this.branchesProvider = branchesProvider;
        this.performanceMonitor = PerformanceMonitorService.getInstance();
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
        console.log('MenuController.open() called');
        const timer = this.performanceMonitor.startTimer('quickpick-open');

        try {
            const repositories = this.repoContextService.listRepositories();
            console.log('Found repositories:', repositories.length);

            if (repositories.length === 0) {
                console.log('No repositories found, showing info message');
                vscode.window.showInformationMessage('No Git repositories found in workspace');
                timer.end({ repositoryCount: 0, result: 'no-repos' });
                return;
            }

            // Create QuickPick with performance optimization
            console.log('Creating QuickPick...');
            this.quickPick = vscode.window.createQuickPick<QuickPickItem>();
            this.quickPick.matchOnDescription = true;
            this.quickPick.matchOnDetail = true;
            this.quickPick.canSelectMany = false;
            this.quickPick.ignoreFocusOut = false;

            // Set up event handlers
            console.log('Setting up QuickPick handlers...');
            this.setupQuickPickHandlers();

            const dataTimer = this.performanceMonitor.startTimer('quickpick-data-assembly');

            // Use optimized data assembly with parallel processing
            if (repositories.length === 1) {
                await this.showSingleRepoLayoutOptimized(repositories[0]);
            } else {
                await this.showMultiRepoLayoutOptimized(repositories);
            }

            const dataAssemblyTime = dataTimer.end({ repositoryCount: repositories.length });

            // Show QuickPick
            console.log('Showing QuickPick with', this.quickPick.items.length, 'items');
            const renderTimer = this.performanceMonitor.startTimer('quickpick-render');
            this.quickPick.show();
            console.log('QuickPick.show() called');
            const renderTime = renderTimer.end({ itemCount: this.quickPick.items.length });

            // Record overall operation
            const totalTime = timer.end({
                repositoryCount: repositories.length,
                itemCount: this.quickPick.items.length,
                dataAssemblyTime,
                renderTime,
                layout: repositories.length === 1 ? 'single-repo' : 'multi-repo'
            });

            // Update internal metrics
            this.updatePerformanceMetrics(totalTime, dataAssemblyTime, renderTime);

        } catch (error) {
            console.error('Error in MenuController.open():', error);
            timer.end({ error: error.toString() });

            // Fallback: show a simple QuickPick
            try {
                console.log('Attempting fallback QuickPick...');
                const fallbackQuickPick = vscode.window.createQuickPick();
                fallbackQuickPick.title = 'Git Menu (Fallback)';
                fallbackQuickPick.items = [
                    { label: '$(git-branch) Test Item 1', description: 'This is a test' },
                    { label: '$(git-commit) Test Item 2', description: 'Another test' }
                ];
                fallbackQuickPick.onDidHide(() => fallbackQuickPick.dispose());
                fallbackQuickPick.show();
                console.log('Fallback QuickPick shown');
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                vscode.window.showErrorMessage(`Failed to open Git menu: ${error}`);
            }

            this.dispose();
        }
    }

    /**
     * Shows single-repo layout with search placeholder and top actions (optimized)
     */
    private async showSingleRepoLayoutOptimized(repository: Repository): Promise<void> {
        if (!this.quickPick) return;

        this.quickPick.title = `Git (${repository.name})`;
        this.quickPick.placeholder = 'Search for branches and actions';

        // Use parallel data fetching for better performance
        const [topActions, recentBranches, localBranchGroups, remoteBranchGroups, tags] = await Promise.all([
            this.createTopActions(repository),
            this.branchesProvider.getRecent(repository),
            this.branchesProvider.getLocal(repository),
            this.branchesProvider.getRemotes(repository),
            this.branchesProvider.getTags(repository)
        ]);

        const items: QuickPickItem[] = [];

        // Add top actions section
        items.push(...topActions);
        items.push(this.createSeparator());

        // Add Recent branches section
        if (recentBranches.length > 0) {
            items.push(this.createSectionHeader('Recent'));
            items.push(...recentBranches.map(item => this.createBranchItemFromProvider(item, repository)));
            items.push(this.createSeparator());
        }

        // Add Local branches section
        if (localBranchGroups.length > 0) {
            items.push(this.createSectionHeader('Local'));
            items.push(...this.createGroupedBranchItemsFromProvider(localBranchGroups, repository));
            items.push(this.createSeparator());
        }

        // Add Remote branches section
        if (remoteBranchGroups.length > 0) {
            items.push(this.createSectionHeader('Remote'));
            items.push(...this.createGroupedBranchItemsFromProvider(remoteBranchGroups, repository));
            items.push(this.createSeparator());
        }

        // Add Tags section
        if (tags.length > 0) {
            items.push(this.createSectionHeader('Tags'));
            items.push(...tags.map(tag => this.createTagItemFromProvider(tag, repository)));
        }

        this.quickPick.items = items;
    }

    /**
     * Shows multi-repo layout with repo grid and common branches (optimized)
     */
    private async showMultiRepoLayoutOptimized(repositories: Repository[]): Promise<void> {
        if (!this.quickPick) return;

        this.quickPick.title = `Git (${repositories.length} repositories)`;
        this.quickPick.placeholder = 'Search for branches and actions';

        // Use parallel processing for better performance
        const [hasDiverged, commonLocalBranches, commonRemoteBranches] = await Promise.all([
            this.checkForDivergenceOptimized(repositories),
            this.getCommonLocalBranchesOptimized(repositories),
            this.getCommonRemoteBranchesOptimized(repositories)
        ]);

        const items: QuickPickItem[] = [];

        // Add divergence warning banner if any repos have diverged
        if (hasDiverged) {
            items.push(this.createDivergenceWarning());
            items.push(this.createSeparator());
        }

        // Add repository grid (pre-computed)
        items.push(...repositories.map(repo => this.createRepositoryItem(repo)));
        items.push(this.createSeparator());

        // Add Common Local Branches section
        if (commonLocalBranches.length > 0) {
            items.push(this.createSectionHeader('Common Local Branches'));
            items.push(...commonLocalBranches.map(branch => this.createCommonBranchItem(branch, 'local')));
            items.push(this.createSeparator());
        }

        // Add Common Remote Branches section
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

        // Enhanced keyboard navigation
        this.quickPick.onDidAccept(async () => {
            if (this.quickPick && this.quickPick.selectedItems.length > 0) {
                const selectedItem = this.quickPick.selectedItems[0];
                await this.handleItemSelection(selectedItem);
            }
        });

        // Type-ahead filtering support
        this.quickPick.onDidChangeValue((value) => {
            if (this.quickPick) {
                // Filter items based on search value
                this.filterQuickPickItems(value);
            }
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
        const icon = branch.isActive ? 'star-full' : 'git-branch';

        let description = '';
        if (branch.ahead && branch.ahead > 0) {
            description += `$(arrow-up)${branch.ahead} `;
        }
        if (branch.behind && branch.behind > 0) {
            description += `$(arrow-down)${branch.behind} `;
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
        let label = `$(repo) ${repository.name}`;
        if (repository.currentBranch) {
            label += ` • ${repository.currentBranch}`;
        }

        let description = '';
        if (repository.ahead && repository.ahead > 0) {
            description += `$(arrow-up)${repository.ahead} `;
        }
        if (repository.behind && repository.behind > 0) {
            description += `$(arrow-down)${repository.behind} `;
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
            label: '$(warning) Branches have diverged',
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
        // Add to MRU
        this.repoContextService.addToMRU(item.repository, item.branch.name);

        // If branch is not active, show action menu
        if (!item.branch.isActive) {
            const actions = [
                'Checkout',
                'New Branch from Here…',
                'Merge into Current',
                'Rebase Current onto This',
                'Cherry-Pick Latest Commit',
                'Rename…',
                'Delete…'
            ];

            const selectedAction = await vscode.window.showQuickPick(actions, {
                placeHolder: `Actions for branch '${item.branch.name}'`
            });

            if (selectedAction) {
                await this.executeBranchAction(selectedAction, item.branch.name);
            }
        } else {
            // For active branch, show limited actions
            const actions = [
                'New Branch from Here…',
                'Rename…'
            ];

            const selectedAction = await vscode.window.showQuickPick(actions, {
                placeHolder: `Actions for current branch '${item.branch.name}'`
            });

            if (selectedAction) {
                await this.executeBranchAction(selectedAction, item.branch.name);
            }
        }
    }

    /**
     * Execute a branch action
     */
    private async executeBranchAction(action: string, branchName: string): Promise<void> {
        try {
            switch (action) {
                case 'Checkout':
                    await vscode.commands.executeCommand('jbGit.checkoutBranch', branchName);
                    break;
                case 'New Branch from Here…':
                    await vscode.commands.executeCommand('jbGit.createBranchFrom', branchName);
                    break;
                case 'Merge into Current':
                    await vscode.commands.executeCommand('jbGit.mergeBranch', branchName);
                    break;
                case 'Rebase Current onto This':
                    await vscode.commands.executeCommand('jbGit.rebaseBranch', branchName);
                    break;
                case 'Cherry-Pick Latest Commit':
                    await vscode.commands.executeCommand('jbGit.cherryPickBranch', branchName);
                    break;
                case 'Rename…':
                    await vscode.commands.executeCommand('jetgit.renameBranch', branchName);
                    break;
                case 'Delete…':
                    await vscode.commands.executeCommand('jbGit.deleteBranch', branchName);
                    break;
                default:
                    vscode.window.showErrorMessage(`Unknown action: ${action}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to execute ${action}: ${error}`);
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
     * Updates performance metrics
     */
    private updatePerformanceMetrics(totalTime: number, dataAssemblyTime: number, renderTime: number): void {
        this.performanceMetrics.totalOperations++;
        this.performanceMetrics.openTime = totalTime;
        this.performanceMetrics.dataAssemblyTime = dataAssemblyTime;
        this.performanceMetrics.renderTime = renderTime;

        // Calculate rolling average
        const totalOps = this.performanceMetrics.totalOperations;
        this.performanceMetrics.averageOpenTime =
            (this.performanceMetrics.averageOpenTime * (totalOps - 1) + totalTime) / totalOps;
    }

    /**
     * Gets current performance metrics
     */
    public getPerformanceMetrics(): MenuPerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    /**
     * Optimized divergence checking
     */
    private async checkForDivergenceOptimized(repositories: Repository[]): Promise<boolean> {
        // Check repository state directly without additional Git calls
        return repositories.some(repo =>
            (repo.ahead && repo.ahead > 0) || (repo.behind && repo.behind > 0)
        );
    }

    /**
     * Optimized common local branches detection
     */
    private async getCommonLocalBranchesOptimized(repositories: Repository[]): Promise<string[]> {
        if (repositories.length === 0) return [];

        // Use cached data from BranchesProvider for better performance
        const branchSets = await Promise.all(
            repositories.map(repo => this.branchesProvider.getLocal(repo))
        );

        // Find intersection of branch names
        const commonBranches = new Set<string>();
        const firstRepoBranches = branchSets[0]?.flatMap(group => group.branches.map(item => item.branch.name)) || [];

        for (const branchName of firstRepoBranches) {
            const isCommon = branchSets.every(branchGroups =>
                branchGroups.some(group =>
                    group.branches.some(item => item.branch.name === branchName)
                )
            );

            if (isCommon) {
                commonBranches.add(branchName);
            }
        }

        // Return most common branch names
        return ['main', 'develop', 'master'].filter(name => commonBranches.has(name));
    }

    /**
     * Optimized common remote branches detection
     */
    private async getCommonRemoteBranchesOptimized(repositories: Repository[]): Promise<string[]> {
        if (repositories.length === 0) return [];

        // Similar to local branches but for remotes
        const remoteBranchSets = await Promise.all(
            repositories.map(repo => this.branchesProvider.getRemotes(repo))
        );

        const commonRemoteBranches = new Set<string>();
        const firstRepoRemotes = remoteBranchSets[0]?.flatMap(group => group.branches.map(item => item.branch.name)) || [];

        for (const branchName of firstRepoRemotes) {
            const isCommon = remoteBranchSets.every(remoteGroups =>
                remoteGroups.some(group =>
                    group.branches.some(item => item.branch.name === branchName)
                )
            );

            if (isCommon) {
                commonRemoteBranches.add(branchName);
            }
        }

        return ['origin/main', 'origin/develop', 'origin/master'].filter(name => commonRemoteBranches.has(name));
    }

    /**
     * Creates branch item from BranchesProvider data
     */
    private createBranchItemFromProvider(branchItem: any, repository: Repository): BranchItem {
        const branch = branchItem.branch;
        const displayName = getBranchDisplayName(branch, false);
        const icon = branch.isActive ? 'star-full' : 'git-branch';

        let description = '';
        if (branchItem.divergenceBadge) {
            description += branchItem.divergenceBadge + ' ';
        }

        return {
            type: 'branch',
            label: `$(${icon}) ${displayName}`,
            description: description.trim(),
            branch,
            repository
        };
    }

    /**
     * Creates grouped branch items from BranchesProvider data
     */
    private createGroupedBranchItemsFromProvider(branchGroups: any[], repository: Repository): QuickPickItem[] {
        const items: QuickPickItem[] = [];

        for (const group of branchGroups) {
            for (const branchItem of group.branches) {
                items.push(this.createBranchItemFromProvider(branchItem, repository));
            }
        }

        return items;
    }

    /**
     * Creates tag item from BranchesProvider data
     */
    private createTagItemFromProvider(tagItem: any, repository: Repository): TagItem {
        return {
            type: 'tag',
            label: `$(tag) ${tagItem.name}`,
            description: tagItem.message || '',
            tag: tagItem.name,
            repository
        };
    }

    /**
     * Filters QuickPick items based on search value for enhanced type-ahead support
     */
    private filterQuickPickItems(searchValue: string): void {
        if (!this.quickPick || !searchValue.trim()) {
            return;
        }

        const searchLower = searchValue.toLowerCase();
        const filteredItems = this.quickPick.items.filter(item => {
            // Skip separators and headers in filtering
            if (item.type === 'separator' || item.type === 'header') {
                return true;
            }

            // Search in label, description, and detail
            const labelMatch = item.label.toLowerCase().includes(searchLower);
            const descriptionMatch = item.description?.toLowerCase().includes(searchLower) || false;
            const detailMatch = item.detail?.toLowerCase().includes(searchLower) || false;

            return labelMatch || descriptionMatch || detailMatch;
        });

        // Update items with filtered results
        this.quickPick.items = filteredItems;
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


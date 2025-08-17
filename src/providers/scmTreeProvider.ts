import * as vscode from 'vscode';
import { Branch, Repository, Remote, GitError } from '../types/git';
import { IGitService } from '../services/gitService';
import { RepoContextService } from '../services/repoContextService';
import { SettingsService } from '../services/settingsService';
import { BranchesProvider, BranchItem, BranchGroup, TagItem } from './branchesProvider';

/**
 * Tree item types for the SCM view
 */
export enum SCMTreeItemType {
    Section = 'section',
    Branch = 'branch',
    Remote = 'remote',
    Tag = 'tag',
    Changelist = 'changelist',
    Group = 'group'
}

/**
 * Tree item for the SCM view
 */
export class SCMTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: SCMTreeItemType,
        public readonly data?: any
    ) {
        super(label, collapsibleState);
        
        this.contextValue = itemType;
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.description = this.getDescription();
    }

    public getTooltip(): string {
        switch (this.itemType) {
            case SCMTreeItemType.Branch:
                const branch = this.data as Branch;
                return `${branch.type === 'local' ? 'Local' : 'Remote'} branch: ${branch.fullName}`;
            case SCMTreeItemType.Remote:
                const remote = this.data as Remote;
                return `Remote: ${remote.name} (${remote.fetchUrl})`;
            case SCMTreeItemType.Tag:
                const tag = this.data as TagItem;
                return `Tag: ${tag.name} (${tag.commit})`;
            case SCMTreeItemType.Changelist:
                return `Changelist: ${this.label}`;
            default:
                return this.label;
        }
    }

    public getIcon(): vscode.ThemeIcon | undefined {
        switch (this.itemType) {
            case SCMTreeItemType.Section:
                return new vscode.ThemeIcon('folder');
            case SCMTreeItemType.Branch:
                const branch = this.data as Branch;
                if (branch.isActive) {
                    return new vscode.ThemeIcon('star-full');
                }
                return new vscode.ThemeIcon('git-branch');
            case SCMTreeItemType.Remote:
                return new vscode.ThemeIcon('cloud');
            case SCMTreeItemType.Tag:
                return new vscode.ThemeIcon('tag');
            case SCMTreeItemType.Changelist:
                return new vscode.ThemeIcon('list-unordered');
            case SCMTreeItemType.Group:
                return new vscode.ThemeIcon('folder');
            default:
                return undefined;
        }
    }

    public getDescription(): string | undefined {
        switch (this.itemType) {
            case SCMTreeItemType.Branch:
                const branch = this.data as Branch;
                const parts: string[] = [];
                
                if (branch.ahead && branch.ahead > 0) {
                    parts.push(`$(arrow-up)${branch.ahead}`);
                }
                if (branch.behind && branch.behind > 0) {
                    parts.push(`$(arrow-down)${branch.behind}`);
                }
                
                return parts.length > 0 ? parts.join(' ') : undefined;
            case SCMTreeItemType.Remote:
                const remote = this.data as Remote;
                return `${remote.branches.length} branches`;
            default:
                return undefined;
        }
    }
}

/**
 * SCM Tree Data Provider for JetBrains-style Git view
 * 
 * Provides a tree structure with sections for Recent, Local, Remote, Tags, and Changelists.
 * Integrates with BranchesProvider for data and supports collapsible groups for branch prefixes
 * and remote grouping.
 * 
 * Features:
 * - Tree sections: Recent, Local, Remote, Tags, Changelists (if enabled)
 * - Context menu items that mirror QuickPick actions
 * - Tree item icons and badges for branches, remotes, and tags
 * - Collapsible groups for branch prefixes and remote grouping
 * - Automatic refresh on repository change events
 * 
 * @example
 * ```typescript
 * const provider = new SCMTreeProvider(gitService, repoContextService, branchesProvider);
 * vscode.window.createTreeView('jbGit.explorer', { treeDataProvider: provider });
 * ```
 */
export class SCMTreeProvider implements vscode.TreeDataProvider<SCMTreeItem>, vscode.Disposable {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<SCMTreeItem | undefined | null | void>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly settingsService: SettingsService;

    constructor(
        private readonly gitService: IGitService,
        private readonly repoContextService: RepoContextService,
        private readonly branchesProvider: BranchesProvider
    ) {
        this.settingsService = SettingsService.getInstance();
        // Listen for repository changes to refresh the tree
        this._disposables.push(
            this.repoContextService.onDidChangeActiveRepository(() => {
                this.refresh();
            })
        );

        // Listen for settings changes through SettingsService
        this._disposables.push(
            this.settingsService.onDidChangeSettings(() => {
                this.refresh();
            })
        );
    }

    /**
     * Gets tree item for display
     */
    public getTreeItem(element: SCMTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets children for a tree item
     */
    public async getChildren(element?: SCMTreeItem): Promise<SCMTreeItem[]> {
        if (!element) {
            // Root level - return main sections
            return this.getRootSections();
        }

        switch (element.itemType) {
            case SCMTreeItemType.Section:
                return this.getSectionChildren(element);
            case SCMTreeItemType.Group:
                return Promise.resolve(this.getGroupChildren(element));
            default:
                return [];
        }
    }

    /**
     * Gets the root sections of the tree
     */
    private async getRootSections(): Promise<SCMTreeItem[]> {
        const activeRepo = this.repoContextService.getActiveRepository();
        if (!activeRepo) {
            return [];
        }

        const sections: SCMTreeItem[] = [];

        // Recent section
        sections.push(new SCMTreeItem(
            'Recent',
            vscode.TreeItemCollapsibleState.Expanded,
            SCMTreeItemType.Section,
            { sectionType: 'recent' }
        ));

        // Local section
        sections.push(new SCMTreeItem(
            'Local',
            vscode.TreeItemCollapsibleState.Expanded,
            SCMTreeItemType.Section,
            { sectionType: 'local' }
        ));

        // Remote section
        sections.push(new SCMTreeItem(
            'Remote',
            vscode.TreeItemCollapsibleState.Expanded,
            SCMTreeItemType.Section,
            { sectionType: 'remote' }
        ));

        // Tags section
        sections.push(new SCMTreeItem(
            'Tags',
            vscode.TreeItemCollapsibleState.Collapsed,
            SCMTreeItemType.Section,
            { sectionType: 'tags' }
        ));

        // Changelists section (if enabled)
        if (this.settingsService.shouldShowChangelists()) {
            sections.push(new SCMTreeItem(
                'Changelists',
                vscode.TreeItemCollapsibleState.Collapsed,
                SCMTreeItemType.Section,
                { sectionType: 'changelists' }
            ));
        }

        return sections;
    }

    /**
     * Gets children for a specific section
     */
    private async getSectionChildren(section: SCMTreeItem): Promise<SCMTreeItem[]> {
        const sectionType = section.data?.sectionType;
        
        switch (sectionType) {
            case 'recent':
                return this.getRecentBranches();
            case 'local':
                return this.getLocalBranches();
            case 'remote':
                return this.getRemoteBranches();
            case 'tags':
                return this.getTags();
            case 'changelists':
                return this.getChangelists();
            default:
                return [];
        }
    }

    /**
     * Gets children for a group (e.g., branch prefix group or remote group)
     */
    private getGroupChildren(group: SCMTreeItem): SCMTreeItem[] {
        const branches = group.data?.branches as Branch[];
        if (!branches) {
            return [];
        }

        return branches.map(branch => new SCMTreeItem(
            branch.name,
            vscode.TreeItemCollapsibleState.None,
            SCMTreeItemType.Branch,
            branch
        ));
    }

    /**
     * Gets recent branches
     */
    private async getRecentBranches(): Promise<SCMTreeItem[]> {
        try {
            const recentBranches = await this.branchesProvider.getRecent();
            return recentBranches.map(item => new SCMTreeItem(
                item.branch.name,
                vscode.TreeItemCollapsibleState.None,
                SCMTreeItemType.Branch,
                item.branch
            ));
        } catch (error) {
            console.error('Failed to get recent branches:', error);
            return [];
        }
    }

    /**
     * Gets local branches with grouping
     */
    private async getLocalBranches(): Promise<SCMTreeItem[]> {
        try {
            const localGroups = await this.branchesProvider.getLocal();
            const items: SCMTreeItem[] = [];

            for (const group of localGroups) {
                if (group.prefix === '') {
                    // Ungrouped branches - add directly
                    items.push(...group.branches.map(item => new SCMTreeItem(
                        item.branch.name,
                        vscode.TreeItemCollapsibleState.None,
                        SCMTreeItemType.Branch,
                        item.branch
                    )));
                } else {
                    // Grouped branches - create a group item
                    const groupItem = new SCMTreeItem(
                        group.prefix,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        SCMTreeItemType.Group,
                        { branches: group.branches.map(item => item.branch) }
                    );
                    items.push(groupItem);
                }
            }

            return items;
        } catch (error) {
            console.error('Failed to get local branches:', error);
            return [];
        }
    }

    /**
     * Gets remote branches with grouping by remote
     */
    private async getRemoteBranches(): Promise<SCMTreeItem[]> {
        try {
            const remoteGroups = await this.branchesProvider.getRemotes();
            const items: SCMTreeItem[] = [];

            for (const group of remoteGroups) {
                // Create a group for each remote
                const remoteItem = new SCMTreeItem(
                    group.prefix,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    SCMTreeItemType.Group,
                    { branches: group.branches.map(item => item.branch) }
                );
                items.push(remoteItem);
            }

            return items;
        } catch (error) {
            console.error('Failed to get remote branches:', error);
            return [];
        }
    }

    /**
     * Gets tags
     */
    private async getTags(): Promise<SCMTreeItem[]> {
        try {
            const tags = await this.branchesProvider.getTags();
            return tags.map(tag => new SCMTreeItem(
                tag.name,
                vscode.TreeItemCollapsibleState.None,
                SCMTreeItemType.Tag,
                tag
            ));
        } catch (error) {
            console.error('Failed to get tags:', error);
            return [];
        }
    }

    /**
     * Gets changelists (placeholder implementation)
     */
    private getChangelists(): SCMTreeItem[] {
        // Placeholder implementation for changelists
        // In a full implementation, this would integrate with a changelist service
        return [
            new SCMTreeItem(
                'Default',
                vscode.TreeItemCollapsibleState.None,
                SCMTreeItemType.Changelist,
                { name: 'Default', files: [] }
            )
        ];
    }

    /**
     * Refreshes the entire tree
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Refreshes a specific tree item
     */
    public refreshItem(item: SCMTreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    /**
     * Disposes of the provider and cleans up resources
     */
    public dispose(): void {
        this._onDidChangeTreeData.dispose();
        this._disposables.forEach(disposable => disposable.dispose());
        this._disposables.length = 0;
    }
}
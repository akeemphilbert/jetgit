import * as vscode from 'vscode';
import { GitMenuProvider, GitMenuItem } from './gitMenuProvider';
import { GitService } from '../services/gitService';

/**
 * Controller for managing the Git dropdown menu using VS Code QuickPick
 */
export class GitMenuController {
    private gitMenuProvider: GitMenuProvider;
    private gitService: GitService;

    constructor(gitService: GitService) {
        this.gitService = gitService;
        this.gitMenuProvider = new GitMenuProvider(gitService);
    }

    /**
     * Show the main Git menu using QuickPick
     */
    async showGitMenu(): Promise<void> {
        try {
            const menuItems = await this.gitMenuProvider.buildGitMenu();
            await this.showMenuLevel(menuItems, 'Git Menu');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show Git menu: ${error}`);
        }
    }

    /**
     * Show a specific level of the menu hierarchy
     */
    private async showMenuLevel(items: GitMenuItem[], title: string, parentItem?: GitMenuItem): Promise<void> {
        const quickPick = vscode.window.createQuickPick<GitMenuQuickPickItem>();
        quickPick.title = title;
        quickPick.placeholder = 'Select a Git operation';
        quickPick.canSelectMany = false;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        // Convert menu items to QuickPick items
        const quickPickItems = this.convertToQuickPickItems(items);
        quickPick.items = quickPickItems;

        // Add back button if we're in a submenu
        if (parentItem) {
            quickPick.buttons = [
                {
                    iconPath: new vscode.ThemeIcon('arrow-left'),
                    tooltip: 'Back'
                }
            ];
        }

        quickPick.onDidChangeSelection(async (selection) => {
            if (selection.length > 0) {
                const selectedItem = selection[0];
                quickPick.hide();
                await this.handleItemSelection(selectedItem.menuItem, title);
            }
        });

        quickPick.onDidTriggerButton(async (button) => {
            if (button.tooltip === 'Back' && parentItem) {
                quickPick.hide();
                // Go back to parent menu
                await this.showGitMenu();
            }
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
        });

        quickPick.show();
    }

    /**
     * Handle selection of a menu item
     */
    private async handleItemSelection(item: GitMenuItem, currentTitle: string): Promise<void> {
        // If item has children, show submenu
        if (item.children && item.children.length > 0) {
            const submenuTitle = `${currentTitle} > ${item.label}`;
            await this.showMenuLevel(item.children, submenuTitle, item);
            return;
        }

        // If item has a command, execute it
        if (item.command) {
            await this.gitMenuProvider.handleMenuSelection(item);
            return;
        }

        // Handle special cases
        switch (item.contextValue) {
            case 'separator':
            case 'header':
                // Ignore separators and headers
                await this.showGitMenu();
                break;
            case 'branch-group':
                // Show branch group submenu
                if (item.children) {
                    const submenuTitle = `${currentTitle} > ${item.label}`;
                    await this.showMenuLevel(item.children, submenuTitle, item);
                }
                break;
            case 'branch':
                // Show branch operations submenu
                if (item.children) {
                    const submenuTitle = `${currentTitle} > ${item.label}`;
                    await this.showMenuLevel(item.children, submenuTitle, item);
                }
                break;
            default:
                // Show info message for unhandled items
                vscode.window.showInformationMessage(`Selected: ${item.label}`);
                break;
        }
    }

    /**
     * Convert menu items to QuickPick items
     */
    private convertToQuickPickItems(items: GitMenuItem[]): GitMenuQuickPickItem[] {
        return items
            .filter(item => item.contextValue !== 'separator') // Filter out separators
            .map(item => ({
                label: this.formatLabel(item),
                description: item.description || '',
                detail: this.getItemDetail(item),
                menuItem: item
            }));
    }

    /**
     * Format the label for display in QuickPick
     */
    private formatLabel(item: GitMenuItem): string {
        let label = item.label;

        // Add icon if available
        if (item.icon) {
            const iconName = item.icon.id;
            label = `$(${iconName}) ${label}`;
        }

        // Add special formatting for headers
        if (item.contextValue === 'header') {
            label = `── ${label.toUpperCase()} ──`;
        }

        // Add arrow for items with children
        if (item.children && item.children.length > 0) {
            label = `${label} →`;
        }

        return label;
    }

    /**
     * Get detail text for the item
     */
    private getItemDetail(item: GitMenuItem): string | undefined {
        if (item.contextValue === 'branch' && item.children) {
            return `${item.children.length} operations available`;
        }

        if (item.contextValue === 'branch-group' && item.children) {
            return `${item.children.length} branches`;
        }

        return undefined;
    }
}

/**
 * QuickPick item that wraps a GitMenuItem
 */
interface GitMenuQuickPickItem extends vscode.QuickPickItem {
    menuItem: GitMenuItem;
}
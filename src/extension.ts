import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { MenuController } from './providers/gitMenuController';
import { ContextMenuProvider } from './providers/contextMenuProvider';
import { SCMTreeProvider } from './providers/scmTreeProvider';
import { BranchesProvider } from './providers/branchesProvider';
import { DiffViewer } from './views/diffViewer';
import { DialogService } from './services/dialogService';
import { StatusBarService } from './services/statusBarService';
import { CommandRegistrationService } from './services/commandRegistrationService';
import { FeedbackService } from './services/feedbackService';
import { RepoContextService } from './services/repoContextService';
import { SettingsService } from './services/settingsService';

/**
 * JetGit Extension - JetBrains IDE-style Git functionality for VS Code
 * 
 * This extension provides enhanced Git functionality including:
 * - Hierarchical branch management with intelligent grouping
 * - Comprehensive context menus for Git operations
 * - Advanced diff viewer with automatic conflict resolution
 * - Seamless VS Code integration
 */

/** Core Git service for repository operations */
let gitService: GitService;

/** Controller for the JetBrains-style QuickPick menu */
let menuController: MenuController;

/** Provider for context menu Git operations */
let contextMenuProvider: ContextMenuProvider;

/** Provider for SCM tree view */
let scmTreeProvider: SCMTreeProvider;

/** Provider for branches data with caching and MRU */
let branchesProvider: BranchesProvider;

/** Custom diff viewer with conflict resolution */
let diffViewer: DiffViewer;

/** Service for user input dialogs and prompts */
let dialogService: DialogService;

/** Service for single status bar entry with JetBrains-style functionality */
let statusBarService: StatusBarService;

/** Service for registering and managing VS Code commands */
let commandRegistrationService: CommandRegistrationService;

/** Service for user feedback and progress notifications */
let feedbackService: FeedbackService;

/** Service for repository context management and MRU tracking */
let repoContextService: RepoContextService;

/** Service for managing extension settings and feature flags */
let settingsService: SettingsService;

/**
 * Activates the JetGit extension
 * 
 * This function is called when the extension is activated by VS Code.
 * It initializes all services, registers commands, and sets up the UI components.
 * 
 * @param context - The VS Code extension context providing access to extension APIs
 * @throws Will show an error message to the user if activation fails
 * 
 * @example
 * ```typescript
 * // Called automatically by VS Code when extension activates
 * // Activation events are defined in package.json:
 * // "activationEvents": ["onStartupFinished"]
 * ```
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('JetGit Extension is now active');
    vscode.window.showInformationMessage('JetGit Extension is activating...');

    try {
        // Initialize core services
        feedbackService = new FeedbackService();
        settingsService = SettingsService.getInstance();
        repoContextService = RepoContextService.getInstance(context);
        gitService = new GitService(feedbackService);
        dialogService = new DialogService();

        // Initialize data providers
        branchesProvider = new BranchesProvider(gitService, repoContextService);

        // Initialize UI components
        menuController = new MenuController(gitService, repoContextService, branchesProvider);
        contextMenuProvider = new ContextMenuProvider(gitService);
        scmTreeProvider = new SCMTreeProvider(gitService, repoContextService, branchesProvider);
        diffViewer = new DiffViewer(context);

        // Initialize VS Code integration services
        statusBarService = StatusBarService.getInstance(gitService);
        statusBarService.init();
        
        commandRegistrationService = new CommandRegistrationService(
            gitService,
            menuController,
            contextMenuProvider,
            diffViewer,
            dialogService,
            statusBarService,
            scmTreeProvider
        );

        // Register SCM tree view (visibility controlled by context key)
        const scmTreeView = vscode.window.createTreeView('jbGit.explorer', {
            treeDataProvider: scmTreeProvider,
            showCollapseAll: true
        });

        // Register all commands through the command registration service
        commandRegistrationService.registerAllCommands(context);

        // Add services to context subscriptions for proper cleanup
        context.subscriptions.push(
            feedbackService,
            settingsService,
            repoContextService,
            branchesProvider,
            scmTreeProvider,
            scmTreeView,
            statusBarService,
            commandRegistrationService
        );

        console.log('JetGit Extension activated successfully');
        vscode.window.showInformationMessage('JetGit Extension activated successfully!');
    } catch (error) {
        console.error('Failed to activate JetGit Extension:', error);
        vscode.window.showErrorMessage(`JetGit Extension failed to activate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}



/**
 * Deactivates the JetGit extension
 * 
 * This function is called when the extension is being deactivated or VS Code is shutting down.
 * It performs cleanup of all services, disposes of resources, and clears references to prevent memory leaks.
 * 
 * @remarks
 * The deactivation process includes:
 * - Disposing of all services that implement the Disposable interface
 * - Clearing service references to prevent memory leaks
 * - Logging the deactivation process for debugging
 * 
 * @example
 * ```typescript
 * // Called automatically by VS Code when:
 * // - Extension is disabled
 * // - Extension is uninstalled
 * // - VS Code is shutting down
 * // - Workspace is closed (if extension is workspace-specific)
 * ```
 */
export function deactivate() {
    console.log('JetGit Extension is being deactivated');
    
    try {
        // Clean up all services and resources
        if (feedbackService) {
            feedbackService.dispose();
        }
        
        if (settingsService) {
            settingsService.dispose();
        }
        
        if (statusBarService) {
            statusBarService.dispose();
        }
        
        if (commandRegistrationService) {
            commandRegistrationService.dispose();
        }
        
        if (repoContextService) {
            repoContextService.dispose();
        }
        
        if (branchesProvider) {
            branchesProvider.dispose();
        }
        
        if (scmTreeProvider) {
            scmTreeProvider.dispose();
        }
        
        if (diffViewer) {
            diffViewer.dispose();
        }
        
        // Clear references
        gitService = undefined as any;
        menuController = undefined as any;
        contextMenuProvider = undefined as any;
        scmTreeProvider = undefined as any;
        branchesProvider = undefined as any;
        diffViewer = undefined as any;
        dialogService = undefined as any;
        settingsService = undefined as any;
        repoContextService = undefined as any;
        statusBarService = undefined as any;
        commandRegistrationService = undefined as any;
        
        console.log('JetGit Extension deactivated successfully');
    } catch (error) {
        console.error('Error during JetGit Extension deactivation:', error);
    }
}
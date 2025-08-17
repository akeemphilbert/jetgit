import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { GitMenuController } from './providers/gitMenuController';
import { ContextMenuProvider } from './providers/contextMenuProvider';
import { DiffViewer } from './views/diffViewer';
import { DialogService } from './services/dialogService';
import { StatusIntegrationService } from './services/statusIntegrationService';
import { CommandRegistrationService } from './services/commandRegistrationService';
import { FeedbackService } from './services/feedbackService';

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

/** Controller for the main Git menu and branch hierarchy */
let gitMenuController: GitMenuController;

/** Provider for context menu Git operations */
let contextMenuProvider: ContextMenuProvider;

/** Custom diff viewer with conflict resolution */
let diffViewer: DiffViewer;

/** Service for user input dialogs and prompts */
let dialogService: DialogService;

/** Service for VS Code status bar and Git integration */
let statusIntegrationService: StatusIntegrationService;

/** Service for registering and managing VS Code commands */
let commandRegistrationService: CommandRegistrationService;

/** Service for user feedback and progress notifications */
let feedbackService: FeedbackService;

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

    try {
        // Initialize core services
        feedbackService = new FeedbackService();
        gitService = new GitService(feedbackService);
        dialogService = new DialogService();

        // Initialize UI components
        gitMenuController = new GitMenuController(gitService);
        contextMenuProvider = new ContextMenuProvider(gitService);
        diffViewer = new DiffViewer(context);

        // Initialize VS Code integration services
        statusIntegrationService = new StatusIntegrationService(gitService);
        commandRegistrationService = new CommandRegistrationService(
            gitService,
            gitMenuController,
            contextMenuProvider,
            diffViewer,
            dialogService,
            statusIntegrationService
        );

        // Register all commands through the command registration service
        commandRegistrationService.registerAllCommands(context);

        // Add services to context subscriptions for proper cleanup
        context.subscriptions.push(
            feedbackService,
            statusIntegrationService,
            commandRegistrationService
        );

        console.log('JetGit Extension activated successfully');
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
        
        if (statusIntegrationService) {
            statusIntegrationService.dispose();
        }
        
        if (commandRegistrationService) {
            commandRegistrationService.dispose();
        }
        
        if (diffViewer) {
            diffViewer.dispose();
        }
        
        // Clear references
        gitService = undefined as any;
        gitMenuController = undefined as any;
        contextMenuProvider = undefined as any;
        diffViewer = undefined as any;
        dialogService = undefined as any;
        statusIntegrationService = undefined as any;
        commandRegistrationService = undefined as any;
        
        console.log('JetGit Extension deactivated successfully');
    } catch (error) {
        console.error('Error during JetGit Extension deactivation:', error);
    }
}
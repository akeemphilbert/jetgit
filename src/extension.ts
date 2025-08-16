import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { GitMenuController } from './providers/gitMenuController';
import { ContextMenuProvider } from './providers/contextMenuProvider';
import { DiffViewer } from './views/diffViewer';
import { DialogService } from './services/dialogService';
import { StatusIntegrationService } from './services/statusIntegrationService';
import { CommandRegistrationService } from './services/commandRegistrationService';
import { FeedbackService } from './services/feedbackService';

let gitService: GitService;
let gitMenuController: GitMenuController;
let contextMenuProvider: ContextMenuProvider;
let diffViewer: DiffViewer;
let dialogService: DialogService;
let statusIntegrationService: StatusIntegrationService;
let commandRegistrationService: CommandRegistrationService;
let feedbackService: FeedbackService;

/**
 * Extension activation function
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
 * Extension deactivation function
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
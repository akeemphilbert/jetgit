import * as vscode from 'vscode';
import { GitError } from '../types/git';

/**
 * Progress indicator interface for long-running operations
 */
export interface IProgressIndicator {
  showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
  ): Promise<T>;
}

/**
 * Notification service interface for user feedback
 */
export interface INotificationService {
  showSuccess(message: string, ...actions: string[]): Promise<string | undefined>;
  showInfo(message: string, ...actions: string[]): Promise<string | undefined>;
  showWarning(message: string, ...actions: string[]): Promise<string | undefined>;
  showError(message: string, ...actions: string[]): Promise<string | undefined>;
}

/**
 * Logging service interface for debugging and troubleshooting
 */
export interface ILoggingService {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  handleError(error: GitError): Promise<void>;
  showUserFriendlyMessage(error: GitError): void;
  logError(error: GitError): void;
  handleErrorWithRecovery(error: GitError): Promise<boolean>;
}

/**
 * Progress indicator implementation
 */
export class ProgressIndicator implements IProgressIndicator {
  async showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
      },
      task
    );
  }
}

/**
 * Notification service implementation
 */
export class NotificationService implements INotificationService {
  async showSuccess(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showInformationMessage(`✅ ${message}`, ...actions);
  }

  async showInfo(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showInformationMessage(message, ...actions);
  }

  async showWarning(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showWarningMessage(`⚠️ ${message}`, ...actions);
  }

  async showError(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showErrorMessage(`❌ ${message}`, ...actions);
  }
}

/**
 * Logging service implementation
 */
export class LoggingService implements ILoggingService {
  private outputChannel: vscode.OutputChannel;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private readonly logLevels = { debug: 0, info: 1, warn: 2, error: 3 };

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('JetGit Extension');
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [DEBUG] ${message}`;
      this.outputChannel.appendLine(logMessage);
      if (args.length > 0) {
        this.outputChannel.appendLine(`  Data: ${JSON.stringify(args, null, 2)}`);
      }
      console.debug(`[JetGit Extension] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [INFO] ${message}`;
      this.outputChannel.appendLine(logMessage);
      if (args.length > 0) {
        this.outputChannel.appendLine(`  Data: ${JSON.stringify(args, null, 2)}`);
      }
      console.info(`[JetGit Extension] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [WARN] ${message}`;
      this.outputChannel.appendLine(logMessage);
      if (args.length > 0) {
        this.outputChannel.appendLine(`  Data: ${JSON.stringify(args, null, 2)}`);
      }
      console.warn(`[JetGit Extension] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.shouldLog('error')) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ERROR] ${message}`;
      this.outputChannel.appendLine(logMessage);
      
      if (error) {
        this.outputChannel.appendLine(`  Error: ${error.message}`);
        if (error.stack) {
          this.outputChannel.appendLine(`  Stack: ${error.stack}`);
        }
      }
      
      if (args.length > 0) {
        this.outputChannel.appendLine(`  Data: ${JSON.stringify(args, null, 2)}`);
      }
      
      console.error(`[JetGit Extension] ${message}`, error, ...args);
    }
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }

  /**
   * Show the output channel to the user
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Dispose of the output channel
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Enhanced error handler implementation
 */
export class ErrorHandler implements IErrorHandler {
  private notificationService: NotificationService;
  private loggingService: LoggingService;

  constructor(loggingService?: LoggingService) {
    this.notificationService = new NotificationService();
    this.loggingService = loggingService || new LoggingService();
  }

  async handleError(error: GitError): Promise<void> {
    this.logError(error);
    this.showUserFriendlyMessage(error);
    
    // Additional error handling logic
    if (error.recoverable) {
      await this.handleErrorWithRecovery(error);
    }
  }

  async handleErrorWithRecovery(error: GitError): Promise<boolean> {
    const recoveryActions = this.getRecoveryActions(error);
    
    if (recoveryActions.length === 0) {
      return false;
    }

    const message = this.getUserFriendlyMessage(error);
    const action = await this.notificationService.showError(
      message,
      ...recoveryActions,
      'Show Logs'
    );

    if (action === 'Show Logs') {
      this.loggingService.show();
      return false;
    }

    return await this.executeRecoveryAction(error, action);
  }

  showUserFriendlyMessage(error: GitError): void {
    const message = this.getUserFriendlyMessage(error);
    
    switch (error.category) {
      case 'git':
        this.notificationService.showError(`Git Error: ${message}`);
        break;
      case 'filesystem':
        this.notificationService.showError(`File System Error: ${message}`);
        break;
      case 'vscode':
        this.notificationService.showError(`VS Code Error: ${message}`);
        break;
      default:
        this.notificationService.showError(`Error: ${message}`);
    }
  }

  logError(error: GitError): void {
    this.loggingService.error(
      `${error.category.toUpperCase()} Error [${error.code}]: ${error.message}`,
      error,
      {
        code: error.code,
        category: error.category,
        recoverable: error.recoverable
      }
    );
  }

  private getUserFriendlyMessage(error: GitError): string {
    // Map technical error messages to user-friendly ones
    switch (error.code) {
      case 'REPOSITORY_NOT_FOUND':
        return 'No Git repository found in the current workspace. Please open a folder with a Git repository.';
      case 'GIT_EXTENSION_NOT_FOUND':
        return 'VS Code Git extension is not available or not enabled. Please enable the Git extension.';
      case 'BRANCH_NOT_FOUND':
        return 'The specified branch does not exist. Please check the branch name.';
      case 'BRANCH_ALREADY_EXISTS':
        return 'A branch with this name already exists. Please choose a different name.';
      case 'INVALID_BRANCH_NAME':
        return 'The branch name is invalid. Please use a valid Git branch name.';
      case 'MERGE_CONFLICT':
      case 'MERGE_CONFLICTS':
        return 'Merge conflicts detected. Please resolve conflicts and try again.';
      case 'REBASE_CONFLICTS':
        return 'Rebase conflicts detected. Please resolve conflicts and continue the rebase.';
      case 'NETWORK_ERROR':
        return 'Network error occurred. Please check your internet connection and try again.';
      case 'AUTHENTICATION_FAILED':
        return 'Git authentication failed. Please check your credentials and try again.';
      case 'NO_CHANGES_TO_COMMIT':
        return 'No changes to commit. Please make some changes first.';
      case 'EMPTY_COMMIT_MESSAGE':
        return 'Commit message cannot be empty. Please provide a commit message.';
      case 'NO_BRANCH_SPECIFIED':
        return 'No branch specified and unable to determine current branch.';
      case 'NO_CURRENT_BRANCH':
        return 'Unable to determine current branch. Please check your repository state.';
      case 'SELF_MERGE_ATTEMPT':
        return 'Cannot merge a branch into itself. Please select a different branch.';
      case 'SELF_REBASE_ATTEMPT':
        return 'Cannot rebase a branch onto itself. Please select a different branch.';
      case 'INVALID_RESET_MODE':
        return 'Invalid reset mode specified. Please use soft, mixed, or hard.';
      case 'INVALID_STASH_INDEX':
        return 'Invalid stash index specified. Please select a valid stash.';
      case 'NO_STASHES_AVAILABLE':
        return 'No stashes available. Please create a stash first.';
      case 'REMOTE_NOT_FOUND':
        return 'The specified remote does not exist. Please check the remote name.';
      case 'REMOTE_ALREADY_EXISTS':
        return 'A remote with this name already exists. Please choose a different name.';
      case 'INVALID_REMOTE_URL':
        return 'The remote URL is invalid. Please provide a valid Git URL.';
      case 'FILE_NOT_FOUND':
        return 'The specified file does not exist or is not tracked by Git.';
      case 'OPERATION_CANCELLED':
        return 'Operation was cancelled by the user.';
      case 'PERMISSION_DENIED':
        return 'Permission denied. Please check file permissions and try again.';
      default:
        return error.message;
    }
  }

  private getRecoveryActions(error: GitError): string[] {
    switch (error.code) {
      case 'REPOSITORY_NOT_FOUND':
        return ['Open Folder', 'Initialize Repository'];
      case 'GIT_EXTENSION_NOT_FOUND':
        return ['Enable Git Extension'];
      case 'BRANCH_NOT_FOUND':
        return ['Create Branch', 'Refresh'];
      case 'MERGE_CONFLICTS':
      case 'REBASE_CONFLICTS':
        return ['Open Diff Viewer', 'Abort Operation'];
      case 'NETWORK_ERROR':
        return ['Retry', 'Work Offline'];
      case 'AUTHENTICATION_FAILED':
        return ['Configure Credentials', 'Retry'];
      case 'NO_CHANGES_TO_COMMIT':
        return ['Stage All Changes', 'Refresh'];
      case 'BRANCH_ALREADY_EXISTS':
        return ['Switch to Branch', 'Choose Different Name'];
      case 'REMOTE_NOT_FOUND':
        return ['Add Remote', 'Refresh'];
      default:
        return error.recoverable ? ['Retry'] : [];
    }
  }

  private async executeRecoveryAction(error: GitError, action?: string): Promise<boolean> {
    if (!action) {
      return false;
    }

    try {
      switch (action) {
        case 'Open Folder':
          await vscode.commands.executeCommand('vscode.openFolder');
          return true;
        case 'Initialize Repository':
          await vscode.commands.executeCommand('git.init');
          return true;
        case 'Enable Git Extension':
          await vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', ['vscode.git']);
          return true;
        case 'Refresh':
          await vscode.commands.executeCommand('git.refresh');
          return true;
        case 'Open Diff Viewer':
          await vscode.commands.executeCommand('git.openChange');
          return false; // User needs to manually resolve
        case 'Abort Operation':
          await vscode.commands.executeCommand('git.clean');
          return true;
        case 'Retry':
          return true; // Caller should retry the operation
        case 'Work Offline':
          this.notificationService.showInfo('Working in offline mode. Some features may be limited.');
          return false;
        case 'Configure Credentials':
          await vscode.commands.executeCommand('git.showOutput');
          this.notificationService.showInfo('Please configure your Git credentials and try again.');
          return false;
        case 'Stage All Changes':
          await vscode.commands.executeCommand('git.stageAll');
          return true;
        case 'Switch to Branch':
          await vscode.commands.executeCommand('git.checkout');
          return true;
        case 'Add Remote':
          await vscode.commands.executeCommand('git.addRemote');
          return true;
        default:
          return false;
      }
    } catch (recoveryError) {
      this.loggingService.error(`Recovery action '${action}' failed`, recoveryError as Error);
      return false;
    }
  }
}
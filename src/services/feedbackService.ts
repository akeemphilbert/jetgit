import * as vscode from 'vscode';
import { ProgressIndicator, NotificationService, LoggingService, IProgressIndicator, INotificationService, ILoggingService } from '../utils/errorHandler';

/**
 * Comprehensive feedback service for user interactions
 */
export interface IFeedbackService {
  showProgress<T>(title: string, task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>): Promise<T>;
  showSuccess(message: string, ...actions: string[]): Promise<string | undefined>;
  showInfo(message: string, ...actions: string[]): Promise<string | undefined>;
  showWarning(message: string, ...actions: string[]): Promise<string | undefined>;
  showError(message: string, ...actions: string[]): Promise<string | undefined>;
  logDebug(message: string, ...args: any[]): void;
  logInfo(message: string, ...args: any[]): void;
  logWarning(message: string, ...args: any[]): void;
  logError(message: string, error?: Error, ...args: any[]): void;
  showOperationProgress(operation: string, steps: string[]): Promise<void>;
  showOperationComplete(operation: string, success: boolean, message?: string): Promise<void>;
}

/**
 * Feedback service implementation
 */
export class FeedbackService implements IFeedbackService {
  private progressIndicator: IProgressIndicator;
  private notificationService: INotificationService;
  private loggingService: ILoggingService;

  constructor(loggingService?: ILoggingService) {
    this.progressIndicator = new ProgressIndicator();
    this.notificationService = new NotificationService();
    this.loggingService = loggingService || new LoggingService();
  }

  async showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
  ): Promise<T> {
    this.logInfo(`Starting operation: ${title}`);
    
    try {
      const result = await this.progressIndicator.showProgress(title, async (progress, token) => {
        const startTime = Date.now();
        
        try {
          const result = await task(progress, token);
          const duration = Date.now() - startTime;
          this.logInfo(`Operation completed: ${title} (${duration}ms)`);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logError(`Operation failed: ${title} (${duration}ms)`, error as Error);
          throw error;
        }
      });
      
      return result;
    } catch (error) {
      this.logError(`Progress operation failed: ${title}`, error as Error);
      throw error;
    }
  }

  async showSuccess(message: string, ...actions: string[]): Promise<string | undefined> {
    this.logInfo(`Success: ${message}`);
    return this.notificationService.showSuccess(message, ...actions);
  }

  async showInfo(message: string, ...actions: string[]): Promise<string | undefined> {
    this.logInfo(`Info: ${message}`);
    return this.notificationService.showInfo(message, ...actions);
  }

  async showWarning(message: string, ...actions: string[]): Promise<string | undefined> {
    this.logWarning(`Warning: ${message}`);
    return this.notificationService.showWarning(message, ...actions);
  }

  async showError(message: string, ...actions: string[]): Promise<string | undefined> {
    this.logError(`Error: ${message}`);
    return this.notificationService.showError(message, ...actions);
  }

  logDebug(message: string, ...args: any[]): void {
    this.loggingService.debug(message, ...args);
  }

  logInfo(message: string, ...args: any[]): void {
    this.loggingService.info(message, ...args);
  }

  logWarning(message: string, ...args: any[]): void {
    this.loggingService.warn(message, ...args);
  }

  logError(message: string, error?: Error, ...args: any[]): void {
    this.loggingService.error(message, error, ...args);
  }

  async showOperationProgress(operation: string, steps: string[]): Promise<void> {
    await this.showProgress(`${operation}...`, async (progress, token) => {
      const increment = 100 / steps.length;
      
      for (let i = 0; i < steps.length; i++) {
        if (token.isCancellationRequested) {
          throw new Error('Operation cancelled by user');
        }
        
        const step = steps[i];
        progress.report({ 
          message: step,
          increment: i === 0 ? increment : increment
        });
        
        this.logDebug(`${operation} - Step ${i + 1}/${steps.length}: ${step}`);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  }

  async showOperationComplete(operation: string, success: boolean, message?: string): Promise<void> {
    const statusMessage = message || (success ? `${operation} completed successfully` : `${operation} failed`);
    
    if (success) {
      await this.showSuccess(statusMessage);
    } else {
      await this.showError(statusMessage);
    }
  }

  /**
   * Show logs to the user
   */
  showLogs(): void {
    if (this.loggingService instanceof LoggingService) {
      this.loggingService.show();
    }
  }

  /**
   * Set the logging level
   */
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    if (this.loggingService instanceof LoggingService) {
      this.loggingService.setLogLevel(level);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.loggingService instanceof LoggingService) {
      this.loggingService.dispose();
    }
  }
}
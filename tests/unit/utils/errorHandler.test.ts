import { ErrorHandler, LoggingService, NotificationService, ProgressIndicator } from '../../../src/utils/errorHandler';
import { GitError } from '../../../src/types/git';

// Mock VS Code module
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    withProgress: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }))
  },
  commands: {
    executeCommand: jest.fn()
  },
  ProgressLocation: {
    Notification: 15
  }
}));

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockWindow: any;
  let mockCommands: any;
  let mockLoggingService: jest.Mocked<LoggingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    const vscode = require('vscode');
    mockWindow = vscode.window;
    mockCommands = vscode.commands;
    
    mockLoggingService = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    } as any;

    errorHandler = new ErrorHandler(mockLoggingService);
  });

  describe('handleError', () => {
    it('should log error and show user-friendly message', async () => {
      const error = new GitError('Test error', 'TEST_ERROR', 'git', true);
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      await errorHandler.handleError(error);
      
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'GIT Error [TEST_ERROR]: Test error',
        error,
        expect.objectContaining({
          code: 'TEST_ERROR',
          category: 'git',
          recoverable: true
        })
      );
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ Git Error: Test error');
    });

    it('should attempt recovery for recoverable errors', async () => {
      const error = new GitError('Repository not found', 'REPOSITORY_NOT_FOUND', 'git', true);
      mockWindow.showErrorMessage.mockResolvedValue('Open Folder');
      mockCommands.executeCommand.mockResolvedValue(undefined);
      
      await errorHandler.handleError(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        '❌ Git Error: No Git repository found in the current workspace. Please open a folder with a Git repository.',
        'Open Folder',
        'Initialize Repository',
        'Show Logs'
      );
    });
  });

  describe('showUserFriendlyMessage', () => {
    it('should show git error message with proper prefix and emoji', () => {
      const error = new GitError('Git operation failed', 'GIT_ERROR', 'git');
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      errorHandler.showUserFriendlyMessage(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ Git Error: Git operation failed');
    });

    it('should show filesystem error message with proper prefix and emoji', () => {
      const error = new GitError('File not found', 'FILE_NOT_FOUND', 'filesystem');
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      errorHandler.showUserFriendlyMessage(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ File System Error: The specified file does not exist or is not tracked by Git.');
    });

    it('should show vscode error message with proper prefix and emoji', () => {
      const error = new GitError('Extension error', 'EXTENSION_ERROR', 'vscode');
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      errorHandler.showUserFriendlyMessage(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ VS Code Error: Extension error');
    });

    it('should show user-friendly message for known error codes', () => {
      const error = new GitError('Repository not found', 'REPOSITORY_NOT_FOUND', 'git');
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      errorHandler.showUserFriendlyMessage(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        '❌ Git Error: No Git repository found in the current workspace. Please open a folder with a Git repository.'
      );
    });

    it('should show user-friendly message for Git extension not found', () => {
      const error = new GitError('Git extension not available', 'GIT_EXTENSION_NOT_FOUND', 'vscode');
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      errorHandler.showUserFriendlyMessage(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        '❌ VS Code Error: VS Code Git extension is not available or not enabled. Please enable the Git extension.'
      );
    });

    it('should show original message for unknown error codes', () => {
      const error = new GitError('Unknown error', 'UNKNOWN_ERROR', 'git');
      mockWindow.showErrorMessage.mockResolvedValue(undefined);
      
      errorHandler.showUserFriendlyMessage(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ Git Error: Unknown error');
    });
  });

  describe('logError', () => {
    it('should log error with proper format', () => {
      const error = new GitError('Test error', 'TEST_ERROR', 'git', true);
      
      errorHandler.logError(error);
      
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'GIT Error [TEST_ERROR]: Test error',
        error,
        expect.objectContaining({
          code: 'TEST_ERROR',
          category: 'git',
          recoverable: true
        })
      );
    });

    it('should log filesystem errors with proper category', () => {
      const error = new GitError('File error', 'FILE_ERROR', 'filesystem', false);
      
      errorHandler.logError(error);
      
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'FILESYSTEM Error [FILE_ERROR]: File error',
        error,
        expect.objectContaining({
          code: 'FILE_ERROR',
          category: 'filesystem',
          recoverable: false
        })
      );
    });

    it('should log vscode errors with proper category', () => {
      const error = new GitError('VS Code error', 'VSCODE_ERROR', 'vscode', true);
      
      errorHandler.logError(error);
      
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'VSCODE Error [VSCODE_ERROR]: VS Code error',
        error,
        expect.objectContaining({
          code: 'VSCODE_ERROR',
          category: 'vscode',
          recoverable: true
        })
      );
    });
  });

  describe('handleErrorWithRecovery', () => {
    it('should provide recovery actions for known errors', async () => {
      const error = new GitError('Repository not found', 'REPOSITORY_NOT_FOUND', 'git', true);
      mockWindow.showErrorMessage.mockResolvedValue('Open Folder');
      mockCommands.executeCommand.mockResolvedValue(undefined);
      
      const result = await errorHandler.handleErrorWithRecovery(error);
      
      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
        '❌ No Git repository found in the current workspace. Please open a folder with a Git repository.',
        'Open Folder',
        'Initialize Repository',
        'Show Logs'
      );
      expect(mockCommands.executeCommand).toHaveBeenCalledWith('vscode.openFolder');
      expect(result).toBe(true);
    });

    it('should show logs when requested', async () => {
      const error = new GitError('Test error', 'TEST_ERROR', 'git', true);
      mockWindow.showErrorMessage.mockResolvedValue('Show Logs');
      
      const result = await errorHandler.handleErrorWithRecovery(error);
      
      expect(mockLoggingService.show).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false for non-recoverable errors', async () => {
      const error = new GitError('Fatal error', 'FATAL_ERROR', 'git', false);
      
      const result = await errorHandler.handleErrorWithRecovery(error);
      
      expect(result).toBe(false);
    });
  });
});

describe('LoggingService', () => {
  let loggingService: LoggingService;
  let mockOutputChannel: any;
  let consoleSpy: { debug: jest.SpyInstance, info: jest.SpyInstance, warn: jest.SpyInstance, error: jest.SpyInstance };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOutputChannel = {
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    };
    
    const vscode = require('vscode');
    vscode.window.createOutputChannel.mockReturnValue(mockOutputChannel);
    
    consoleSpy = {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
    
    loggingService = new LoggingService();
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('logging levels', () => {
    it('should respect log level filtering', () => {
      loggingService.setLogLevel('warn');
      
      loggingService.debug('Debug message');
      loggingService.info('Info message');
      loggingService.warn('Warning message');
      loggingService.error('Error message');
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2); // Only warn and error
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log all levels when set to debug', () => {
      loggingService.setLogLevel('debug');
      
      loggingService.debug('Debug message');
      loggingService.info('Info message');
      loggingService.warn('Warning message');
      loggingService.error('Error message');
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(4);
      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      loggingService.error('Error occurred', error);
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\] Error occurred/)
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('  Error: Test error');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('  Stack: Error stack trace');
    });

    it('should log additional data', () => {
      loggingService.info('Info message', { key: 'value' });
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\] Info message/)
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '  Data: [\n  {\n    "key": "value"\n  }\n]'
      );
    });
  });

  describe('utility methods', () => {
    it('should show output channel', () => {
      loggingService.show();
      expect(mockOutputChannel.show).toHaveBeenCalled();
    });

    it('should dispose output channel', () => {
      loggingService.dispose();
      expect(mockOutputChannel.dispose).toHaveBeenCalled();
    });
  });
});

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockWindow: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const vscode = require('vscode');
    mockWindow = vscode.window;
    notificationService = new NotificationService();
  });

  it('should show success message with emoji', async () => {
    mockWindow.showInformationMessage.mockResolvedValue('OK');
    
    const result = await notificationService.showSuccess('Success message', 'OK');
    
    expect(mockWindow.showInformationMessage).toHaveBeenCalledWith('✅ Success message', 'OK');
    expect(result).toBe('OK');
  });

  it('should show warning message with emoji', async () => {
    mockWindow.showWarningMessage.mockResolvedValue('Continue');
    
    const result = await notificationService.showWarning('Warning message', 'Continue');
    
    expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('⚠️ Warning message', 'Continue');
    expect(result).toBe('Continue');
  });

  it('should show error message with emoji', async () => {
    mockWindow.showErrorMessage.mockResolvedValue('Retry');
    
    const result = await notificationService.showError('Error message', 'Retry');
    
    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ Error message', 'Retry');
    expect(result).toBe('Retry');
  });
});

describe('ProgressIndicator', () => {
  let progressIndicator: ProgressIndicator;
  let mockWindow: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const vscode = require('vscode');
    mockWindow = vscode.window;
    progressIndicator = new ProgressIndicator();
  });

  it('should show progress with correct options', async () => {
    const mockTask = jest.fn().mockResolvedValue('result');
    mockWindow.withProgress.mockImplementation((options, task) => {
      expect(options.location).toBe(15); // ProgressLocation.Notification
      expect(options.title).toBe('Test Operation');
      expect(options.cancellable).toBe(true);
      return task({}, {});
    });
    
    const result = await progressIndicator.showProgress('Test Operation', mockTask);
    
    expect(result).toBe('result');
    expect(mockTask).toHaveBeenCalled();
  });
});
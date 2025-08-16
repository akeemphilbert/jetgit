import { FeedbackService } from '../../../src/services/feedbackService';
import { LoggingService } from '../../../src/utils/errorHandler';

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
  ProgressLocation: {
    Notification: 15
  }
}));

describe('FeedbackService', () => {
  let feedbackService: FeedbackService;
  let mockWindow: any;
  let mockLoggingService: jest.Mocked<LoggingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    const vscode = require('vscode');
    mockWindow = vscode.window;
    
    mockLoggingService = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    } as any;

    feedbackService = new FeedbackService(mockLoggingService);
  });

  describe('showProgress', () => {
    it('should show progress with title and execute task', async () => {
      const mockTask = jest.fn().mockResolvedValue('result');
      mockWindow.withProgress.mockImplementation((options, task) => {
        expect(options.title).toBe('Test Operation');
        expect(options.location).toBe(15); // ProgressLocation.Notification
        return task({}, { isCancellationRequested: false });
      });

      const result = await feedbackService.showProgress('Test Operation', mockTask);

      expect(result).toBe('result');
      expect(mockTask).toHaveBeenCalled();
      expect(mockLoggingService.info).toHaveBeenCalledWith('Starting operation: Test Operation');
    });

    it('should log operation completion time', async () => {
      const mockTask = jest.fn().mockResolvedValue('result');
      mockWindow.withProgress.mockImplementation((options, task) => {
        return task({}, { isCancellationRequested: false });
      });

      await feedbackService.showProgress('Test Operation', mockTask);

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.stringMatching(/Operation completed: Test Operation \(\d+ms\)/)
      );
    });

    it('should log and rethrow errors', async () => {
      const error = new Error('Task failed');
      const mockTask = jest.fn().mockRejectedValue(error);
      mockWindow.withProgress.mockImplementation((options, task) => {
        return task({}, { isCancellationRequested: false });
      });

      await expect(feedbackService.showProgress('Test Operation', mockTask)).rejects.toThrow('Task failed');

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringMatching(/Operation failed: Test Operation \(\d+ms\)/),
        error
      );
    });
  });

  describe('notification methods', () => {
    it('should show success message with emoji', async () => {
      mockWindow.showInformationMessage.mockResolvedValue('OK');

      const result = await feedbackService.showSuccess('Operation completed', 'OK');

      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith('✅ Operation completed', 'OK');
      expect(result).toBe('OK');
      expect(mockLoggingService.info).toHaveBeenCalledWith('Success: Operation completed');
    });

    it('should show info message', async () => {
      mockWindow.showInformationMessage.mockResolvedValue('OK');

      const result = await feedbackService.showInfo('Information message', 'OK');

      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith('Information message', 'OK');
      expect(result).toBe('OK');
      expect(mockLoggingService.info).toHaveBeenCalledWith('Info: Information message');
    });

    it('should show warning message with emoji', async () => {
      mockWindow.showWarningMessage.mockResolvedValue('Continue');

      const result = await feedbackService.showWarning('Warning message', 'Continue');

      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('⚠️ Warning message', 'Continue');
      expect(result).toBe('Continue');
      expect(mockLoggingService.warn).toHaveBeenCalledWith('Warning: Warning message');
    });

    it('should show error message with emoji', async () => {
      mockWindow.showErrorMessage.mockResolvedValue('Retry');

      const result = await feedbackService.showError('Error message', 'Retry');

      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ Error message', 'Retry');
      expect(result).toBe('Retry');
      expect(mockLoggingService.error).toHaveBeenCalledWith('Error: Error message', undefined);
    });
  });

  describe('logging methods', () => {
    it('should delegate to logging service', () => {
      feedbackService.logDebug('Debug message', { data: 'test' });
      feedbackService.logInfo('Info message', { data: 'test' });
      feedbackService.logWarning('Warning message', { data: 'test' });
      feedbackService.logError('Error message', new Error('test'), { data: 'test' });

      expect(mockLoggingService.debug).toHaveBeenCalledWith('Debug message', { data: 'test' });
      expect(mockLoggingService.info).toHaveBeenCalledWith('Info message', { data: 'test' });
      expect(mockLoggingService.warn).toHaveBeenCalledWith('Warning message', { data: 'test' });
      expect(mockLoggingService.error).toHaveBeenCalledWith('Error message', new Error('test'), { data: 'test' });
    });
  });

  describe('showOperationProgress', () => {
    it('should show progress for multiple steps', async () => {
      const steps = ['Step 1', 'Step 2', 'Step 3'];
      mockWindow.withProgress.mockImplementation((options, task) => {
        const mockProgress = { report: jest.fn() };
        const mockToken = { isCancellationRequested: false };
        return task(mockProgress, mockToken);
      });

      await feedbackService.showOperationProgress('Test Operation', steps);

      expect(mockWindow.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Operation...'
        }),
        expect.any(Function)
      );
    });

    it('should handle cancellation', async () => {
      const steps = ['Step 1', 'Step 2'];
      mockWindow.withProgress.mockImplementation((options, task) => {
        const mockProgress = { report: jest.fn() };
        const mockToken = { isCancellationRequested: true };
        return task(mockProgress, mockToken);
      });

      await expect(feedbackService.showOperationProgress('Test Operation', steps))
        .rejects.toThrow('Operation cancelled by user');
    });
  });

  describe('showOperationComplete', () => {
    it('should show success message for successful operations', async () => {
      mockWindow.showInformationMessage.mockResolvedValue(undefined);

      await feedbackService.showOperationComplete('Test Operation', true);

      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith('✅ Test Operation completed successfully');
    });

    it('should show error message for failed operations', async () => {
      mockWindow.showErrorMessage.mockResolvedValue(undefined);

      await feedbackService.showOperationComplete('Test Operation', false);

      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith('❌ Test Operation failed');
    });

    it('should use custom message when provided', async () => {
      mockWindow.showInformationMessage.mockResolvedValue(undefined);

      await feedbackService.showOperationComplete('Test Operation', true, 'Custom success message');

      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith('✅ Custom success message');
    });
  });

  describe('utility methods', () => {
    it('should show logs when logging service supports it', () => {
      // Create a new feedback service with a real LoggingService for this test
      const realLoggingService = new (require('../../../src/utils/errorHandler').LoggingService)();
      const realFeedbackService = new FeedbackService(realLoggingService);
      const showSpy = jest.spyOn(realLoggingService, 'show');
      
      realFeedbackService.showLogs();
      expect(showSpy).toHaveBeenCalled();
      
      realLoggingService.dispose();
    });

    it('should set log level when logging service supports it', () => {
      const realLoggingService = new (require('../../../src/utils/errorHandler').LoggingService)();
      const realFeedbackService = new FeedbackService(realLoggingService);
      const setLogLevelSpy = jest.spyOn(realLoggingService, 'setLogLevel');
      
      realFeedbackService.setLogLevel('debug');
      expect(setLogLevelSpy).toHaveBeenCalledWith('debug');
      
      realLoggingService.dispose();
    });

    it('should dispose resources when logging service supports it', () => {
      const realLoggingService = new (require('../../../src/utils/errorHandler').LoggingService)();
      const realFeedbackService = new FeedbackService(realLoggingService);
      const disposeSpy = jest.spyOn(realLoggingService, 'dispose');
      
      realFeedbackService.dispose();
      expect(disposeSpy).toHaveBeenCalled();
    });
  });
});
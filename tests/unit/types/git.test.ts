import { GitError } from '../../../src/types/git';

describe('GitError', () => {
  describe('constructor', () => {
    it('should create GitError with all parameters', () => {
      const error = new GitError('Test message', 'TEST_CODE', 'git', false);
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.category).toBe('git');
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('GitError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create GitError with default recoverable value', () => {
      const error = new GitError('Test message', 'TEST_CODE', 'filesystem');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.category).toBe('filesystem');
      expect(error.recoverable).toBe(true); // default value
      expect(error.name).toBe('GitError');
    });

    it('should create GitError for vscode category', () => {
      const error = new GitError('VS Code error', 'VSCODE_ERROR', 'vscode', false);
      
      expect(error.message).toBe('VS Code error');
      expect(error.code).toBe('VSCODE_ERROR');
      expect(error.category).toBe('vscode');
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('GitError');
    });

    it('should be throwable and catchable', () => {
      const error = new GitError('Test error', 'TEST_CODE', 'git');
      
      expect(() => {
        throw error;
      }).toThrow(GitError);
      
      expect(() => {
        throw error;
      }).toThrow('Test error');
    });

    it('should maintain error stack trace', () => {
      const error = new GitError('Test error', 'TEST_CODE', 'git');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('GitError');
    });
  });
});
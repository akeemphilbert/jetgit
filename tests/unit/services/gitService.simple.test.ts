const gitServiceModule = require('../../../src/services/gitService');
console.log('gitServiceModule:', gitServiceModule);
const { GitService } = gitServiceModule;

// Mock VS Code module
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
  },
  extensions: {
    getExtension: jest.fn(() => ({
      exports: {
        getAPI: jest.fn(() => ({
          repositories: []
        }))
      }
    })),
  }
}));

describe('GitService - Simple Test', () => {
  it('should create GitService instance', () => {
    console.log('GitService:', GitService);
    console.log('typeof GitService:', typeof GitService);
    const gitService = new GitService();
    expect(gitService).toBeInstanceOf(GitService);
  });

  it('should have isRepository method', () => {
    const gitService = new GitService();
    expect(typeof gitService.isRepository).toBe('function');
  });

  it('should have getRepositoryRoot method', () => {
    const gitService = new GitService();
    expect(typeof gitService.getRepositoryRoot).toBe('function');
  });

  it('should have getCurrentBranch method', () => {
    const gitService = new GitService();
    expect(typeof gitService.getCurrentBranch).toBe('function');
  });

  it('should have getRepositoryStatus method', () => {
    const gitService = new GitService();
    expect(typeof (gitService as any).getRepositoryStatus).toBe('function');
  });
});
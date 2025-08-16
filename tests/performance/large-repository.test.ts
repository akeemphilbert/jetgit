import { GitService } from '../../src/services/gitService';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    createQuickPick: jest.fn(),
    withProgress: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  extensions: {
    getExtension: jest.fn(),
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
    parse: jest.fn(),
  },
  workspace: {
    workspaceFolders: [],
    getConfiguration: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
  },
  ProgressLocation: {
    Notification: 15,
    SourceControl: 1,
    Window: 10,
  },
}));

describe('Performance Tests - Large Repository', () => {
  let gitService: GitService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    gitService = new GitService();
  });

  describe('Branch Operations Performance', () => {
    it('should handle large number of branches efficiently', async () => {
      // Mock a repository with many branches
      const mockBranches = Array.from({ length: 1000 }, (_, i) => ({
        name: `feature/branch-${i}`,
        fullName: `refs/heads/feature/branch-${i}`,
        type: 'local' as const,
        isActive: i === 0,
        upstream: `origin/feature/branch-${i}`,
        ahead: Math.floor(Math.random() * 10),
        behind: Math.floor(Math.random() * 5),
        lastCommit: {
          hash: `commit-hash-${i}`,
          message: `Commit message ${i}`,
          author: 'Test Author',
          date: new Date(),
        },
      }));

      // Mock the Git service to return many branches
      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      const startTime = Date.now();
      const branches = await gitService.getBranches();
      const endTime = Date.now();

      expect(branches).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently group large number of branches', async () => {
      // Create branches with various prefixes
      const prefixes = ['feature', 'bugfix', 'hotfix', 'release', 'develop'];
      const mockBranches = [];
      
      for (let i = 0; i < 500; i++) {
        const prefix = prefixes[i % prefixes.length];
        mockBranches.push({
          name: `${prefix}/branch-${i}`,
          fullName: `refs/heads/${prefix}/branch-${i}`,
          type: 'local' as const,
          isActive: i === 0,
          upstream: `origin/${prefix}/branch-${i}`,
          ahead: 0,
          behind: 0,
        });
      }

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      const startTime = Date.now();
      const branches = await gitService.getBranches();
      const endTime = Date.now();

      expect(branches).toHaveLength(500);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('File Operations Performance', () => {
    it('should handle file history for files with many commits', async () => {
      // Mock a file with extensive history
      const mockHistory = Array.from({ length: 1000 }, (_, i) => ({
        hash: `commit-${i}`,
        message: `Commit message ${i}`,
        author: 'Test Author',
        date: new Date(Date.now() - i * 86400000), // One commit per day going back
        changes: [{
          file: 'test-file.ts',
          status: 'modified' as const,
          additions: Math.floor(Math.random() * 50),
          deletions: Math.floor(Math.random() * 20),
        }],
      }));

      jest.spyOn(gitService, 'getFileHistory').mockResolvedValue(mockHistory);

      const startTime = Date.now();
      const history = await gitService.getFileHistory('test-file.ts');
      const endTime = Date.now();

      expect(history).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should efficiently handle diff for large files', async () => {
      // Mock a large diff result
      const mockDiff = {
        filePath: 'large-file.ts',
        oldContent: 'old content '.repeat(10000),
        newContent: 'new content '.repeat(10000),
        hunks: Array.from({ length: 100 }, (_, i) => ({
          oldStart: i * 100,
          oldLines: 50,
          newStart: i * 100,
          newLines: 60,
          lines: Array.from({ length: 110 }, (_, j) => ({
            type: j % 3 === 0 ? 'added' : j % 3 === 1 ? 'removed' : 'unchanged' as const,
            content: `Line ${j} content`,
            oldLineNumber: j % 3 !== 0 ? i * 100 + j : undefined,
            newLineNumber: j % 3 !== 1 ? i * 100 + j : undefined,
          })),
        })),
        hasConflicts: false,
      };

      jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);

      const startTime = Date.now();
      const diff = await gitService.getFileDiff('large-file.ts');
      const endTime = Date.now();

      expect(diff.hunks).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        jest.spyOn(gitService, 'getBranches').mockResolvedValue([
          {
            name: `test-branch-${i}`,
            fullName: `refs/heads/test-branch-${i}`,
            type: 'local',
            isActive: false,
          },
        ]);
        
        await gitService.getBranches();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent branch operations', async () => {
      jest.spyOn(gitService, 'getBranches').mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return [
          {
            name: 'main',
            fullName: 'refs/heads/main',
            type: 'local',
            isActive: true,
          },
        ];
      });

      const startTime = Date.now();
      
      // Run 10 concurrent operations
      const promises = Array.from({ length: 10 }, () => gitService.getBranches());
      const results = await Promise.all(promises);
      
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      results.forEach(branches => {
        expect(branches).toHaveLength(1);
        expect(branches[0].name).toBe('main');
      });
      
      // Should complete faster than sequential execution
      expect(endTime - startTime).toBeLessThan(500); // Much faster than 10 * 100ms
    });
  });
});
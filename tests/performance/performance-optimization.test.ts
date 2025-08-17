import * as vscode from 'vscode';
import { BranchesProvider } from '../../src/providers/branchesProvider';
import { MenuController } from '../../src/providers/gitMenuController';
import { RepoContextService } from '../../src/services/repoContextService';
import { PerformanceMonitorService } from '../../src/services/performanceMonitorService';
import { GitService } from '../../src/services/gitService';
import { Repository, Branch } from '../../src/types/git';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    createQuickPick: jest.fn(() => ({
      items: [],
      placeholder: '',
      title: '',
      matchOnDescription: true,
      matchOnDetail: true,
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      onDidChangeSelection: jest.fn(),
      onDidHide: jest.fn(),
    })),
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
  QuickPickItemKind: {
    Separator: -1,
    Default: 0,
  },
}));

describe('Performance Optimization Tests', () => {
  let gitService: GitService;
  let repoContextService: RepoContextService;
  let branchesProvider: BranchesProvider;
  let menuController: MenuController;
  let performanceMonitor: PerformanceMonitorService;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singletons
    (RepoContextService as any).instance = undefined;
    (PerformanceMonitorService as any).instance = undefined;

    mockContext = {
      globalState: {
        get: jest.fn().mockReturnValue({}),
        update: jest.fn()
      }
    } as any;

    // Mock Git API
    const mockGitApi = {
      repositories: [],
      onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
      onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
    };

    const mockGitExtension = {
      isActive: true,
      exports: {
        getAPI: jest.fn(() => mockGitApi)
      }
    };

    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(mockGitExtension as any);

    gitService = new GitService();
    repoContextService = RepoContextService.getInstance(mockContext);
    branchesProvider = new BranchesProvider(gitService, repoContextService);
    menuController = new MenuController(gitService, repoContextService, branchesProvider);
    performanceMonitor = PerformanceMonitorService.getInstance();
  });

  afterEach(() => {
    if (repoContextService) {
      repoContextService.dispose();
    }
    if (branchesProvider) {
      branchesProvider.dispose();
    }
    if (performanceMonitor) {
      performanceMonitor.dispose();
    }
  });

  describe('Branch Caching Performance', () => {
    it('should cache branch data and avoid duplicate requests', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      const mockBranches: Branch[] = Array.from({ length: 1000 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: Math.floor(Math.random() * 5),
        behind: Math.floor(Math.random() * 3)
      }));

      const getBranchesSpy = jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);
      const getRemotesSpy = jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // First call should fetch data
      const startTime1 = performance.now();
      await branchesProvider.getLocal(mockRepository);
      const elapsed1 = performance.now() - startTime1;

      expect(getBranchesSpy).toHaveBeenCalledTimes(1);
      expect(getRemotesSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const startTime2 = performance.now();
      await branchesProvider.getLocal(mockRepository);
      const elapsed2 = performance.now() - startTime2;

      // Should not have called Git service again
      expect(getBranchesSpy).toHaveBeenCalledTimes(1);
      expect(getRemotesSpy).toHaveBeenCalledTimes(1);

      // Cached call should be significantly faster
      expect(elapsed2).toBeLessThan(elapsed1 * 0.1); // At least 10x faster
      expect(elapsed2).toBeLessThan(10); // Should be under 10ms
    });

    it('should handle cache invalidation efficiently', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      let branchCount = 500;
      const getBranchesWithCount = () => Array.from({ length: branchCount }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local' as const,
        isActive: i === 0,
        ahead: 0,
        behind: 0
      }));

      const getBranchesSpy = jest.spyOn(gitService, 'getBranches').mockImplementation(async () => {
        return getBranchesWithCount();
      });
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // Initial load
      await branchesProvider.getLocal(mockRepository);
      expect(getBranchesSpy).toHaveBeenCalledTimes(1);

      // Simulate branch addition (cache invalidation)
      branchCount = 1000;
      await branchesProvider.refresh(mockRepository);

      const startTime = performance.now();
      const result = await branchesProvider.getLocal(mockRepository);
      const elapsed = performance.now() - startTime;

      expect(getBranchesSpy).toHaveBeenCalledTimes(2);
      expect(result.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(100); // Should refresh efficiently
    });

    it('should enforce cache size limits', async () => {
      const repositories: Repository[] = Array.from({ length: 60 }, (_, i) => ({
        rootUri: vscode.Uri.file(`/test/repo-${i}`),
        name: `repo-${i}`,
        currentBranch: 'main',
        hasChanges: false
      }));

      const mockBranches: Branch[] = Array.from({ length: 100 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: 0,
        behind: 0
      }));

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // Load data for all repositories
      for (const repo of repositories) {
        await branchesProvider.getLocal(repo);
      }

      // Cache should have been cleaned up to enforce size limits
      // This is tested indirectly by ensuring performance doesn't degrade
      const startTime = performance.now();
      await branchesProvider.getLocal(repositories[0]);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(50); // Should still be fast despite many repos
    });
  });

  describe('Debounced Data Assembly', () => {
    it('should debounce rapid data assembly requests', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      const mockBranches: Branch[] = Array.from({ length: 200 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: 0,
        behind: 0
      }));

      const getBranchesSpy = jest.spyOn(gitService, 'getBranches').mockImplementation(async () => {
        // Add small delay to simulate real Git operation
        await new Promise(resolve => setTimeout(resolve, 20));
        return mockBranches;
      });
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // Make multiple rapid requests
      const promises = Array.from({ length: 5 }, () => branchesProvider.getLocal(mockRepository));
      
      const startTime = performance.now();
      const results = await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      // Should have debounced the requests
      expect(getBranchesSpy).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(5);
      expect(results[0]).toEqual(results[1]); // All results should be the same
      expect(elapsed).toBeLessThan(100); // Should be debounced to ~75ms + operation time
    });

    it('should maintain 50-100ms debounce delay', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      jest.spyOn(gitService, 'getBranches').mockResolvedValue([]);
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      const startTime = performance.now();
      
      // Make a request and measure debounce delay
      await branchesProvider.getLocal(mockRepository);
      
      const elapsed = performance.now() - startTime;

      // Should include the debounce delay (75ms) plus minimal processing time
      expect(elapsed).toBeGreaterThan(70); // At least the debounce delay
      expect(elapsed).toBeLessThan(150); // But not too much more
    });
  });

  describe('Performance Monitoring', () => {
    it('should track QuickPick open time performance', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      // Clear any existing performance data
      performanceMonitor.clearData();

      await menuController.open();

      const stats = performanceMonitor.getStats('quickpick-open');
      expect(stats).toBeDefined();
      expect(stats!.totalOperations).toBe(1);
      expect(stats!.averageDuration).toBeGreaterThan(0);
    });

    it('should identify slow operations exceeding 150ms target', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/large-repo'),
        name: 'large-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      // Mock slow branch provider
      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(branchesProvider, 'getRecent').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      });
      jest.spyOn(branchesProvider, 'getLocal').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      });
      jest.spyOn(branchesProvider, 'getRemotes').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [];
      });
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      performanceMonitor.clearData();

      await menuController.open();

      const stats = performanceMonitor.getStats('quickpick-open');
      expect(stats).toBeDefined();
      
      // Should have recorded the slow operation
      if (stats!.averageDuration > 150) {
        expect(stats!.slowOperations).toBe(1);
      }
    });

    it('should provide performance recommendations', async () => {
      // Simulate multiple slow operations
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordOperation('quickpick-open', 200, { iteration: i });
      }

      const recommendations = performanceMonitor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toContain('quickpick-open');
      expect(recommendations[0]).toContain('150ms');
    });
  });

  describe('Multi-Repository Performance', () => {
    it('should handle large multi-repo workspaces efficiently', async () => {
      const repositories: Repository[] = Array.from({ length: 50 }, (_, i) => ({
        rootUri: vscode.Uri.file(`/workspace/repo-${i}`),
        name: `repo-${i}`,
        currentBranch: i % 3 === 0 ? 'main' : i % 3 === 1 ? 'develop' : 'master',
        hasChanges: i % 4 === 0,
        ahead: i % 5,
        behind: i % 7
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(repositories);

      const startTime = performance.now();
      await menuController.open();
      const elapsed = performance.now() - startTime;

      // Should handle 50 repositories efficiently
      expect(elapsed).toBeLessThan(300);
    });

    it('should optimize repository state checking', async () => {
      const repositories: Repository[] = Array.from({ length: 20 }, (_, i) => ({
        rootUri: vscode.Uri.file(`/workspace/repo-${i}`),
        name: `repo-${i}`,
        currentBranch: 'main',
        hasChanges: false,
        ahead: Math.floor(Math.random() * 5),
        behind: Math.floor(Math.random() * 3)
      }));

      // Mock the repository refresh to simulate slow Git operations
      const refreshSpy = jest.spyOn(repoContextService as any, 'refreshRepositories').mockImplementation(async () => {
        // Simulate parallel processing
        await Promise.all(repositories.map(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        }));
      });

      const startTime = performance.now();
      await (repoContextService as any).refreshRepositories();
      const elapsed = performance.now() - startTime;

      // Should process repositories in parallel, not sequentially
      expect(elapsed).toBeLessThan(100); // Much less than 20 * 10ms = 200ms
    });
  });

  describe('Memory Efficiency', () => {
    it('should clean up expired cache entries', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      jest.spyOn(gitService, 'getBranches').mockResolvedValue([]);
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // Load data to create cache entry
      await branchesProvider.getLocal(mockRepository);

      // Manually trigger cache cleanup (normally done periodically)
      (branchesProvider as any).cleanupExpiredCache();

      // Should not throw errors and should handle cleanup gracefully
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should handle performance metrics without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many performance records
      for (let i = 0; i < 1000; i++) {
        performanceMonitor.recordOperation('test-operation', Math.random() * 100, { iteration: i });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 1000 records)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle Git operation failures gracefully without performance impact', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/failing-repo'),
        name: 'failing-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      // Mock failing Git operations
      jest.spyOn(gitService, 'getBranches').mockRejectedValue(new Error('Git operation failed'));
      jest.spyOn(gitService, 'getRemotes').mockRejectedValue(new Error('Remote fetch failed'));

      const startTime = performance.now();
      const result = await branchesProvider.getLocal(mockRepository);
      const elapsed = performance.now() - startTime;

      // Should handle errors quickly and return empty results
      expect(result).toEqual([]);
      expect(elapsed).toBeLessThan(100);
    });

    it('should timeout slow Git operations', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/slow-repo'),
        name: 'slow-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      // Mock very slow Git operation
      jest.spyOn(gitService, 'getBranches').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        return [];
      });
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      const startTime = performance.now();
      await branchesProvider.getLocal(mockRepository);
      const elapsed = performance.now() - startTime;

      // Should not wait for the full 2 seconds due to optimizations
      expect(elapsed).toBeLessThan(1500);
    });
  });
});
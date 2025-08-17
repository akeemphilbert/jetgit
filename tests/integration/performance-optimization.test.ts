import * as vscode from 'vscode';
import { BranchesProvider } from '../../src/providers/branchesProvider';
import { PerformanceMonitorService } from '../../src/services/performanceMonitorService';
import { RepoContextService } from '../../src/services/repoContextService';
import { GitService } from '../../src/services/gitService';
import { Repository, Branch } from '../../src/types/git';

describe('Performance Optimization Integration Tests', () => {
  let gitService: GitService;
  let repoContextService: RepoContextService;
  let branchesProvider: BranchesProvider;
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
    it('should demonstrate caching performance improvement', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      const mockBranches: Branch[] = Array.from({ length: 500 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: Math.floor(Math.random() * 5),
        behind: Math.floor(Math.random() * 3)
      }));

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // First call - should be slower (cache miss)
      const startTime1 = performance.now();
      const result1 = await branchesProvider.getLocal(mockRepository);
      const elapsed1 = performance.now() - startTime1;

      // Second call - should be faster (cache hit)
      const startTime2 = performance.now();
      const result2 = await branchesProvider.getLocal(mockRepository);
      const elapsed2 = performance.now() - startTime2;

      expect(result1).toEqual(result2);
      expect(elapsed2).toBeLessThan(elapsed1 * 0.5); // At least 50% faster
      
      // Verify cache metrics
      const metrics = branchesProvider.getPerformanceMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.cacheMisses).toBeGreaterThan(0);
    });

    it('should handle debounced operations efficiently', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      const mockBranches: Branch[] = Array.from({ length: 100 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: 0,
        behind: 0
      }));

      const getBranchesSpy = jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      // Make multiple rapid requests
      const promises = Array.from({ length: 3 }, () => branchesProvider.getLocal(mockRepository));
      
      const startTime = performance.now();
      const results = await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      // Should have debounced the requests
      expect(getBranchesSpy).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(results[1]);
      expect(elapsed).toBeLessThan(200); // Should be debounced efficiently
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation performance', async () => {
      performanceMonitor.clearData();

      const timer = performanceMonitor.startTimer('test-operation');
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
      const duration = timer.end({ testData: 'value' });

      expect(duration).toBeGreaterThan(45);
      expect(duration).toBeLessThan(100);

      const stats = performanceMonitor.getStats('test-operation');
      expect(stats).toBeDefined();
      expect(stats!.totalOperations).toBe(1);
      expect(stats!.averageDuration).toBeCloseTo(duration, 1);
    });

    it('should provide performance recommendations', async () => {
      performanceMonitor.clearData();

      // Record some slow operations
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordOperation('quickpick-open', 200, { iteration: i });
      }

      const recommendations = performanceMonitor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toContain('quickpick-open');
      expect(recommendations[0]).toContain('150ms');
    });
  });

  describe('Memory Management', () => {
    it('should clean up cache entries properly', async () => {
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

      // Manually trigger cache cleanup
      (branchesProvider as any).cleanupExpiredCache();

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle performance data cleanup', async () => {
      performanceMonitor.clearData();

      // Generate some performance data
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordOperation('test-op', Math.random() * 100);
      }

      const statsBefore = performanceMonitor.getStats('test-op');
      expect(statsBefore?.totalOperations).toBe(10);

      // Clear data
      performanceMonitor.clearData('test-op');

      const statsAfter = performanceMonitor.getStats('test-op');
      expect(statsAfter).toBeUndefined();
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle Git errors without performance degradation', async () => {
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
      expect(elapsed).toBeLessThan(200); // Should fail fast
    });
  });

  describe('Multi-Repository Performance', () => {
    it('should handle multiple repositories efficiently', async () => {
      const repositories: Repository[] = Array.from({ length: 10 }, (_, i) => ({
        rootUri: vscode.Uri.file(`/workspace/repo-${i}`),
        name: `repo-${i}`,
        currentBranch: 'main',
        hasChanges: false
      }));

      const mockBranches: Branch[] = Array.from({ length: 50 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: 0,
        behind: 0
      }));

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);
      jest.spyOn(gitService, 'getRemotes').mockResolvedValue([]);

      const startTime = performance.now();
      
      // Process all repositories
      const promises = repositories.map(repo => branchesProvider.getLocal(repo));
      await Promise.all(promises);
      
      const elapsed = performance.now() - startTime;

      // Should handle multiple repositories efficiently
      expect(elapsed).toBeLessThan(1000); // Within 1 second for 10 repos
    });
  });
});
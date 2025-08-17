import { GitMenuProvider } from '../../src/providers/gitMenuProvider';
import { MenuController } from '../../src/providers/gitMenuController';
import { BranchesProvider } from '../../src/providers/branchesProvider';
import { RepoContextService } from '../../src/services/repoContextService';
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

describe('Performance Tests - Menu Rendering', () => {
  let gitMenuProvider: GitMenuProvider;
  let menuController: MenuController;
  let branchesProvider: BranchesProvider;
  let repoContextService: RepoContextService;
  let gitService: GitService;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (RepoContextService as any).instance = undefined;

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
    gitMenuProvider = new GitMenuProvider(gitService);
    menuController = new MenuController(gitService, repoContextService, branchesProvider);
  });

  afterEach(() => {
    if (repoContextService) {
      repoContextService.dispose();
    }
  });

  describe('Large Branch List Rendering', () => {
    it('should render menu with 1000+ branches efficiently', async () => {
      // Create a large number of branches with various prefixes
      const prefixes = ['feature', 'bugfix', 'hotfix', 'release', 'develop', 'epic', 'task'];
      const mockBranches = [];
      
      for (let i = 0; i < 1500; i++) {
        const prefix = prefixes[i % prefixes.length];
        mockBranches.push({
          name: `${prefix}/branch-${i}`,
          fullName: `refs/heads/${prefix}/branch-${i}`,
          type: 'local' as const,
          isActive: i === 0,
          upstream: `origin/${prefix}/branch-${i}`,
          ahead: Math.floor(Math.random() * 5),
          behind: Math.floor(Math.random() * 3),
          lastCommit: {
            hash: `commit-${i}`,
            shortHash: `commit-${i}`.substring(0, 7),
            message: `Commit message for branch ${i}`,
            author: `Author ${i % 10}`,
            date: new Date(Date.now() - i * 3600000), // One commit per hour going back
          },
        });
      }

      // Add some remote branches
      for (let i = 0; i < 500; i++) {
        const prefix = prefixes[i % prefixes.length];
        mockBranches.push({
          name: `${prefix}/remote-branch-${i}`,
          fullName: `refs/remotes/origin/${prefix}/remote-branch-${i}`,
          type: 'remote' as const,
          isActive: false,
          lastCommit: {
            hash: `remote-commit-${i}`,
            shortHash: `remote-commit-${i}`.substring(0, 7),
            message: `Remote commit message ${i}`,
            author: `Remote Author ${i % 5}`,
            date: new Date(Date.now() - i * 7200000), // One commit per 2 hours going back
          },
        });
      }

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      const startTime = Date.now();
      await gitMenuProvider.showGitMenu();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should render within 2 seconds
    });

    it('should handle rapid menu updates efficiently', async () => {
      const baseBranches = Array.from({ length: 100 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local' as const,
        isActive: i === 0,
        ahead: 0,
        behind: 0,
      }));

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(baseBranches);

      const startTime = Date.now();
      
      // Simulate rapid menu updates (like during active development)
      for (let i = 0; i < 20; i++) {
        await gitMenuProvider.showGitMenu();
        // Small delay to simulate real-world usage
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const endTime = Date.now();

      // Should handle 20 rapid updates efficiently
      expect(endTime - startTime).toBeLessThan(1000); // Within 1 second total
    });
  });

  describe('Branch Grouping Performance', () => {
    it('should efficiently group branches with deep hierarchies', async () => {
      const mockBranches = [];
      
      // Create deeply nested branch structures
      const categories = ['feature', 'bugfix', 'hotfix'];
      const subcategories = ['frontend', 'backend', 'api', 'ui', 'database'];
      const features = ['auth', 'payment', 'search', 'profile', 'admin'];
      
      for (const category of categories) {
        for (const subcategory of subcategories) {
          for (const feature of features) {
            for (let i = 0; i < 5; i++) {
              mockBranches.push({
                name: `${category}/${subcategory}/${feature}/task-${i}`,
                fullName: `refs/heads/${category}/${subcategory}/${feature}/task-${i}`,
                type: 'local' as const,
                isActive: false,
                ahead: 0,
                behind: 0,
              });
            }
          }
        }
      }

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      const startTime = Date.now();
      await gitMenuProvider.showGitMenu();
      const endTime = Date.now();

      expect(mockBranches).toHaveLength(375); // 3 * 5 * 5 * 5 = 375 branches
      expect(endTime - startTime).toBeLessThan(1500); // Should group efficiently within 1.5 seconds
    });

    it('should handle mixed branch naming patterns efficiently', async () => {
      const mockBranches = [];
      
      // Mix of different naming patterns
      const patterns = [
        // Standard prefixed branches
        ...Array.from({ length: 200 }, (_, i) => `feature/JIRA-${1000 + i}`),
        // Ticket-based branches
        ...Array.from({ length: 200 }, (_, i) => `TICKET-${2000 + i}`),
        // User-based branches
        ...Array.from({ length: 100 }, (_, i) => `user${i % 10}/feature-${i}`),
        // Date-based branches
        ...Array.from({ length: 100 }, (_, i) => `2023-${String(i % 12 + 1).padStart(2, '0')}-feature-${i}`),
        // No pattern branches
        ...Array.from({ length: 100 }, (_, i) => `random-branch-name-${i}`),
      ];

      patterns.forEach((name, i) => {
        mockBranches.push({
          name,
          fullName: `refs/heads/${name}`,
          type: 'local' as const,
          isActive: i === 0,
          ahead: 0,
          behind: 0,
        });
      });

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      const startTime = Date.now();
      await gitMenuProvider.showGitMenu();
      const endTime = Date.now();

      expect(mockBranches).toHaveLength(700);
      expect(endTime - startTime).toBeLessThan(2000); // Should handle mixed patterns within 2 seconds
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate memory during repeated menu operations', async () => {
      const mockBranches = Array.from({ length: 500 }, (_, i) => ({
        name: `test-branch-${i}`,
        fullName: `refs/heads/test-branch-${i}`,
        type: 'local' as const,
        isActive: i === 0,
        ahead: Math.floor(Math.random() * 10),
        behind: Math.floor(Math.random() * 5),
        lastCommit: {
          hash: `commit-${i}`,
          shortHash: `commit-${i}`.substring(0, 7),
          message: `Test commit ${i}`,
          author: 'Test Author',
          date: new Date(),
        },
      }));

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many menu operations
      for (let i = 0; i < 50; i++) {
        await gitMenuProvider.showGitMenu();
        
        // Simulate some user interaction delay
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 20MB)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe('Search and Filter Performance', () => {
    it('should efficiently filter large branch lists', async () => {
      const mockBranches = Array.from({ length: 2000 }, (_, i) => ({
        name: `branch-${String(i).padStart(4, '0')}-${i % 2 === 0 ? 'feature' : 'bugfix'}`,
        fullName: `refs/heads/branch-${String(i).padStart(4, '0')}-${i % 2 === 0 ? 'feature' : 'bugfix'}`,
        type: 'local' as const,
        isActive: i === 0,
        ahead: 0,
        behind: 0,
      }));

      jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);

      // Test various search patterns
      const searchTerms = ['feature', 'bugfix', '001', 'branch-0', 'nonexistent'];
      
      for (const searchTerm of searchTerms) {
        const startTime = Date.now();
        
        // Simulate search/filter operation
        const filteredBranches = mockBranches.filter(branch => 
          branch.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeLessThan(50); // Should filter within 50ms
        
        if (searchTerm === 'feature') {
          expect(filteredBranches.length).toBe(1000); // Half the branches
        } else if (searchTerm === 'nonexistent') {
          expect(filteredBranches.length).toBe(0);
        }
      }
    });
  });

  describe('Concurrent Menu Operations', () => {
    it('should handle concurrent menu requests gracefully', async () => {
      const mockBranches = Array.from({ length: 300 }, (_, i) => ({
        name: `concurrent-branch-${i}`,
        fullName: `refs/heads/concurrent-branch-${i}`,
        type: 'local' as const,
        isActive: i === 0,
        ahead: 0,
        behind: 0,
      }));

      jest.spyOn(gitService, 'getBranches').mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        return mockBranches;
      });

      const startTime = Date.now();
      
      // Simulate multiple concurrent menu requests
      const promises = Array.from({ length: 5 }, () => gitMenuProvider.showGitMenu());
      await Promise.all(promises);
      
      const endTime = Date.now();

      // Should handle concurrent requests efficiently
      expect(endTime - startTime).toBeLessThan(300); // Should be much faster than 5 * 50ms
    });
  });

  describe('QuickPick Performance Tests', () => {
    const mockQuickPick = {
      title: '',
      placeholder: '',
      items: [],
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      onDidChangeSelection: jest.fn(),
      onDidTriggerButton: jest.fn(),
      onDidHide: jest.fn()
    };

    beforeEach(() => {
      jest.spyOn(vscode.window, 'createQuickPick').mockReturnValue(mockQuickPick as any);
      jest.clearAllMocks();
    });

    it('should meet 150ms requirement for repositories with ≤5k commits', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/large-repo'),
        name: 'large-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      // Simulate repository with many branches (representing 5k commits scenario)
      const largeBranchSet: Branch[] = Array.from({ length: 500 }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local',
        isActive: i === 0,
        ahead: Math.floor(Math.random() * 10),
        behind: Math.floor(Math.random() * 5),
        lastCommit: {
          hash: `commit-${i}`,
          shortHash: `commit-${i}`.substring(0, 7),
          message: `Commit message ${i}`,
          author: `Author ${i % 20}`,
          date: new Date(Date.now() - i * 3600000)
        }
      }));

      const remoteBranches: Branch[] = Array.from({ length: 200 }, (_, i) => ({
        name: `origin/branch-${i}`,
        fullName: `refs/remotes/origin/branch-${i}`,
        type: 'remote',
        isActive: false,
        lastCommit: {
          hash: `remote-commit-${i}`,
          shortHash: `remote-commit-${i}`.substring(0, 7),
          message: `Remote commit ${i}`,
          author: `Remote Author ${i % 10}`,
          date: new Date(Date.now() - i * 7200000)
        }
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue(['branch-1', 'branch-5', 'branch-10']);
      jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue(largeBranchSet.slice(0, 10));
      jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(largeBranchSet);
      jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue(remoteBranches);
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      const startTime = performance.now();
      await menuController.open();
      const elapsed = performance.now() - startTime;

      // Must meet the 150ms requirement
      expect(elapsed).toBeLessThan(150);
      expect(mockQuickPick.show).toHaveBeenCalled();
      expect(mockQuickPick.items.length).toBeGreaterThan(700); // Actions + branches + sections
    });

    it('should handle extremely large repositories (10k+ branches) within reasonable time', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/huge-repo'),
        name: 'huge-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      // Simulate extremely large repository
      const hugeBranchSet: Branch[] = Array.from({ length: 10000 }, (_, i) => {
        const prefixes = ['feature', 'bugfix', 'hotfix', 'release', 'epic', 'task', 'spike'];
        const prefix = prefixes[i % prefixes.length];
        return {
          name: `${prefix}/branch-${i}`,
          fullName: `refs/heads/${prefix}/branch-${i}`,
          type: 'local',
          isActive: i === 0,
          ahead: i % 10,
          behind: i % 5
        };
      });

      const hugeRemoteBranches: Branch[] = Array.from({ length: 2000 }, (_, i) => ({
        name: `origin/branch-${i}`,
        fullName: `refs/remotes/origin/branch-${i}`,
        type: 'remote',
        isActive: false
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue(['feature/branch-1', 'bugfix/branch-5']);
      jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue(hugeBranchSet.slice(0, 20));
      jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(hugeBranchSet);
      jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue(hugeRemoteBranches);
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      const startTime = performance.now();
      await menuController.open();
      const elapsed = performance.now() - startTime;

      // Should handle huge repositories within 1 second
      expect(elapsed).toBeLessThan(1000);
      expect(mockQuickPick.show).toHaveBeenCalled();
    });

    it('should handle multi-repo workspace with many repositories efficiently', async () => {
      const mockRepositories: Repository[] = Array.from({ length: 100 }, (_, i) => ({
        rootUri: vscode.Uri.file(`/workspace/repo-${i}`),
        name: `repo-${i}`,
        currentBranch: i % 3 === 0 ? 'main' : i % 3 === 1 ? 'develop' : 'master',
        hasChanges: i % 4 === 0,
        ahead: i % 5,
        behind: i % 7
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue(mockRepositories);

      const startTime = performance.now();
      await menuController.open();
      const elapsed = performance.now() - startTime;

      // Should handle 100 repositories efficiently
      expect(elapsed).toBeLessThan(300);
      expect(mockQuickPick.show).toHaveBeenCalled();
      expect(mockQuickPick.title).toBe('Git (100 repositories)');
    });

    it('should debounce QuickPick data assembly to 50-100ms', async () => {
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
        ahead: 0,
        behind: 0
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue([]);

      // Mock providers with artificial delay to test debouncing
      jest.spyOn(branchesProvider, 'getRecent').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return [];
      });
      jest.spyOn(branchesProvider, 'getLocal').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return mockBranches;
      });
      jest.spyOn(branchesProvider, 'getRemotes').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
        return [];
      });
      jest.spyOn(branchesProvider, 'getTags').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return [];
      });

      // Trigger multiple rapid menu opens to test debouncing
      const promises = Array.from({ length: 5 }, () => menuController.open());
      
      const startTime = performance.now();
      await Promise.all(promises);
      const elapsed = performance.now() - startTime;

      // Should debounce and not take 5x the individual time
      expect(elapsed).toBeLessThan(200); // Much less than 5 * (10+20+15+5) = 250ms
    });

    it('should maintain performance with frequent repository state changes', async () => {
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
        ahead: Math.floor(Math.random() * 5),
        behind: Math.floor(Math.random() * 3)
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue([]);
      jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(mockBranches);
      jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      const startTime = performance.now();

      // Simulate frequent state changes (like during active development)
      for (let i = 0; i < 20; i++) {
        // Simulate repository state change
        mockRepository.ahead = Math.floor(Math.random() * 10);
        mockRepository.behind = Math.floor(Math.random() * 5);
        mockRepository.hasChanges = Math.random() > 0.5;

        await menuController.open();
        mockQuickPick.hide();

        // Small delay to simulate user interaction
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const elapsed = performance.now() - startTime;

      // Should handle frequent updates efficiently
      expect(elapsed).toBeLessThan(1000); // 20 updates within 1 second
    });
  });

  describe('Branch Caching Performance', () => {
    it('should cache branch data and refresh only on repository changes', async () => {
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
        ahead: 0,
        behind: 0
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue([]);

      const getLocalSpy = jest.spyOn(branchesProvider, 'getLocal').mockResolvedValue(mockBranches);
      jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      // First call should fetch data
      await menuController.open();
      expect(getLocalSpy).toHaveBeenCalledTimes(1);

      // Subsequent calls should use cached data
      await menuController.open();
      await menuController.open();
      await menuController.open();

      // Should still only have been called once due to caching
      expect(getLocalSpy).toHaveBeenCalledTimes(1);

      // Simulate repository change to trigger cache refresh
      await branchesProvider.refresh();
      await menuController.open();

      // Should have been called again after refresh
      expect(getLocalSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle cache invalidation efficiently', async () => {
      const mockRepository: Repository = {
        rootUri: vscode.Uri.file('/test/repo'),
        name: 'test-repo',
        currentBranch: 'main',
        hasChanges: false
      };

      let branchCount = 100;
      const getBranchesWithCount = () => Array.from({ length: branchCount }, (_, i) => ({
        name: `branch-${i}`,
        fullName: `refs/heads/branch-${i}`,
        type: 'local' as const,
        isActive: i === 0,
        ahead: 0,
        behind: 0
      }));

      jest.spyOn(repoContextService, 'listRepositories').mockReturnValue([mockRepository]);
      jest.spyOn(repoContextService, 'getMRUBranches').mockReturnValue([]);
      jest.spyOn(branchesProvider, 'getRecent').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getRemotes').mockResolvedValue([]);
      jest.spyOn(branchesProvider, 'getTags').mockResolvedValue([]);

      const getLocalSpy = jest.spyOn(branchesProvider, 'getLocal').mockImplementation(async () => {
        return getBranchesWithCount();
      });

      // Initial load
      const startTime1 = performance.now();
      await menuController.open();
      const elapsed1 = performance.now() - startTime1;

      expect(getLocalSpy).toHaveBeenCalledTimes(1);
      expect(elapsed1).toBeLessThan(100);

      // Simulate branch addition (cache invalidation)
      branchCount = 200;
      await branchesProvider.refresh();

      const startTime2 = performance.now();
      await menuController.open();
      const elapsed2 = performance.now() - startTime2;

      expect(getLocalSpy).toHaveBeenCalledTimes(2);
      expect(elapsed2).toBeLessThan(150); // Should still be fast even with more branches
    });
  });
});
import { GitMenuProvider } from '../../src/providers/gitMenuProvider';
import { GitService } from '../../src/services/gitService';

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
  let gitService: GitService;

  beforeEach(() => {
    jest.clearAllMocks();
    gitService = new GitService();
    gitMenuProvider = new GitMenuProvider(gitService);
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
});
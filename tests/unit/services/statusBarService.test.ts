import { StatusBarService } from '../../../src/services/statusBarService';
import { GitService } from '../../../src/services/gitService';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  commands: {
    executeCommand: jest.fn()
  },
  extensions: {
    getExtension: jest.fn()
  },
  workspace: {
    createFileSystemWatcher: jest.fn(),
    getConfiguration: jest.fn(),
    onDidChangeConfiguration: jest.fn()
  }
}));

describe('StatusBarService', () => {
  let service: StatusBarService;
  let mockGitService: jest.Mocked<GitService>;
  let mockStatusBarItem: any;
  let mockGitExtension: any;
  let mockGitAPI: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset singleton
    (StatusBarService as any).instance = undefined;
    
    mockStatusBarItem = {
      text: '',
      tooltip: '',
      command: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    };
    
    mockGitAPI = {
      repositories: [],
      onDidOpenRepository: jest.fn(() => ({ dispose: jest.fn() })),
      onDidCloseRepository: jest.fn(() => ({ dispose: jest.fn() }))
    };
    
    mockGitExtension = {
      exports: {
        getAPI: jest.fn(() => mockGitAPI)
      }
    };
    
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGitExtension);
    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn()
    });
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn(() => true)
    });
    (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue({
      dispose: jest.fn()
    });
    
    mockGitService = {
      isRepository: jest.fn(),
      getCurrentBranch: jest.fn(),
      getRepositoryStatus: jest.fn()
    } as any;
    
    service = StatusBarService.getInstance(mockGitService);
    service.init(); // Initialize to trigger setup methods
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
    jest.useRealTimers();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = StatusBarService.getInstance();
      const instance2 = StatusBarService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(service);
    });

    it('should throw error if no GitService provided on first call', () => {
      (StatusBarService as any).instance = undefined;
      
      expect(() => StatusBarService.getInstance()).toThrow('GitService is required for first initialization');
    });
  });

  describe('initialization', () => {
    it('should create status bar item with correct properties', () => {
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 100);
      expect(mockStatusBarItem.command).toBe('jbGit.openMenu');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Click to open Git menu');
    });

    it('should setup Git repository watcher', () => {
      expect(vscode.extensions.getExtension).toHaveBeenCalledWith('vscode.git');
      expect(mockGitExtension.exports.getAPI).toHaveBeenCalledWith(1);
    });

    it('should setup file system watcher', () => {
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '**/.git/{HEAD,refs/**,index,MERGE_HEAD,REBASE_HEAD}',
        false,
        false,
        false
      );
    });
  });

  describe('update - no repositories', () => {
    beforeEach(() => {
      mockGitAPI.repositories = [];
    });

    it('should hide status bar when no repositories', async () => {
      await service.update();
      
      expect(mockStatusBarItem.hide).toHaveBeenCalled();
    });
  });

  describe('update - single repository', () => {
    let mockRepo: any;

    beforeEach(() => {
      mockRepo = {
        state: {
          HEAD: {
            name: 'main',
            ahead: 2,
            behind: 1
          },
          workingTreeChanges: [{ uri: 'file1.txt' }],
          indexChanges: [],
          untrackedChanges: []
        }
      };
      mockGitAPI.repositories = [mockRepo];
    });

    it('should show single repo status with branch and indicators', async () => {
      await service.update();
      
      expect(mockStatusBarItem.text).toBe('$(git-branch) main $(diff) $(arrow-up)2 $(arrow-down)1');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: main (has changes) • 2 ahead • 1 behind\n\nClick to open Git menu');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should show clean status without indicators', async () => {
      mockRepo.state.HEAD.ahead = 0;
      mockRepo.state.HEAD.behind = 0;
      mockRepo.state.workingTreeChanges = [];
      
      await service.update();
      
      expect(mockStatusBarItem.text).toBe('$(git-branch) main');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: main\n\nClick to open Git menu');
    });

    it('should handle unknown branch', async () => {
      mockRepo.state.HEAD.name = undefined;
      
      await service.update();
      
      expect(mockStatusBarItem.text).toContain('$(git-branch) unknown');
    });
  });

  describe('update - multiple repositories', () => {
    beforeEach(() => {
      const mockRepo1 = {
        state: {
          HEAD: { name: 'main' }
        }
      };
      const mockRepo2 = {
        state: {
          HEAD: { name: 'develop' }
        }
      };
      mockGitAPI.repositories = [mockRepo1, mockRepo2];
    });

    it('should show multi-repo status', async () => {
      await service.update();
      
      expect(mockStatusBarItem.text).toBe('$(repo) 2 repos • main');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: 2 repositories\nActive: main\n\nClick to open Git menu');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });
  });

  describe('notifyGitOperation', () => {
    it('should show operation progress and restore status', async () => {
      // Mock update to set a specific text
      jest.spyOn(service, 'update').mockResolvedValue();
      mockStatusBarItem.text = '$(git-branch) main';
      
      const promise = service.notifyGitOperation('Test Operation');
      
      // The method should call update() first, then set progress text
      await promise;
      
      expect(mockStatusBarItem.text).toBe('$(sync~spin) Test Operation...');
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(2000);
      
      expect(mockStatusBarItem.text).toBe('$(git-branch) main');
    });
  });

  describe('repository management', () => {
    it('should get repositories list', () => {
      const mockRepos = [{ name: 'repo1' }, { name: 'repo2' }];
      mockGitAPI.repositories = mockRepos;
      
      service['repositories'] = mockRepos;
      const repos = service.getRepositories();
      
      expect(repos).toBe(mockRepos);
    });

    it('should get active repository', () => {
      const mockRepo = { name: 'active-repo' };
      service['activeRepository'] = mockRepo;
      
      const activeRepo = service.getActiveRepository();
      
      expect(activeRepo).toBe(mockRepo);
    });

    it('should set active repository and update', async () => {
      const mockRepo = { name: 'new-active-repo' };
      const updateSpy = jest.spyOn(service, 'update').mockResolvedValue();
      
      service.setActiveRepository(mockRepo);
      
      expect(service.getActiveRepository()).toBe(mockRepo);
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('settings integration', () => {
    it('should respect statusBar.enabled setting', () => {
      const mockConfig = {
        get: jest.fn(() => false)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      service.updateVisibility();
      
      expect(mockConfig.get).toHaveBeenCalledWith('statusBar.enabled', true);
      expect(mockStatusBarItem.hide).toHaveBeenCalled();
    });

    it('should show status bar when enabled', () => {
      const mockConfig = {
        get: jest.fn(() => true)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      const updateSpy = jest.spyOn(service, 'update').mockResolvedValue();
      
      service.updateVisibility();
      
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle update errors gracefully', async () => {
      // Mock refreshRepositoryList to throw an error
      jest.spyOn(service as any, 'refreshRepositoryList').mockRejectedValue(new Error('Test error'));
      
      await service.update();
      
      expect(mockStatusBarItem.text).toBe('$(source-control) JetGit: Error');
      expect(mockStatusBarItem.tooltip).toBe('JetGit: Error updating status');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should handle repository status errors', async () => {
      mockGitAPI.repositories = [{}]; // Invalid repo object
      
      await service.update();
      
      // Should not throw and should handle gracefully
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', () => {
      const disposeSpy = jest.spyOn(mockStatusBarItem, 'dispose');
      
      service.dispose();
      
      expect(disposeSpy).toHaveBeenCalled();
      expect((StatusBarService as any).instance).toBeUndefined();
    });
  });
});
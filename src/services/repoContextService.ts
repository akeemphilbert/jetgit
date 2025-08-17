import * as vscode from 'vscode';
import { Repository } from '../types/git';

/**
 * Interface for MRU (Most Recently Used) branch tracking data
 */
interface MRUBranchData {
  [repoPath: string]: {
    branches: string[];
    lastUpdated: number;
  };
}

/**
 * Repository context management service
 * 
 * This service manages repository context in multi-repo workspaces, tracks the active repository,
 * and provides MRU (Most Recently Used) branch tracking per repository with persistence.
 * 
 * Key features:
 * - Repository detection and listing using VS Code Git API
 * - Active repository tracking with change events
 * - MRU branch tracking per repository with globalState persistence
 * - Integration with VS Code Git extension for repository state management
 * 
 * @example
 * ```typescript
 * const repoService = RepoContextService.getInstance(context);
 * const repos = repoService.listRepositories();
 * repoService.setActiveRepository(repos[0]);
 * repoService.addToMRU(repos[0], 'feature/new-feature');
 * ```
 */
export class RepoContextService implements vscode.Disposable {
    private static instance: RepoContextService | undefined;
    
    private readonly _onDidChangeActiveRepository = new vscode.EventEmitter<Repository | undefined>();
    public readonly onDidChangeActiveRepository = this._onDidChangeActiveRepository.event;
    
    private _activeRepository: Repository | undefined;
    private _repositories: Repository[] = [];
    private _gitApi: any;
    private _disposables: vscode.Disposable[] = [];
    private _mruData: MRUBranchData = {};
    
    private static readonly mruStorageKey = 'jbGit.mruBranches';
    private static readonly mruMaxBranches = 20;
    
    private constructor(private context: vscode.ExtensionContext) {
        this._disposables.push(this._onDidChangeActiveRepository);
        this.initialize();
    }
    
    /**
     * Gets the singleton instance of RepoContextService
     * 
     * @param context - VS Code extension context (required for first call)
     * @returns The singleton RepoContextService instance
     */
    public static getInstance(context?: vscode.ExtensionContext): RepoContextService {
        if (!RepoContextService.instance) {
            if (!context) {
                throw new Error('Extension context is required for first initialization of RepoContextService');
            }
            RepoContextService.instance = new RepoContextService(context);
        }
        return RepoContextService.instance;
    }
    
    /**
     * Initializes the service by setting up Git API integration and loading MRU data
     */
    private async initialize(): Promise<void> {
        try {
            // Get VS Code Git API
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension) {
                if (!gitExtension.isActive) {
                    await gitExtension.activate();
                }
                this._gitApi = gitExtension.exports.getAPI(1);
                
                // Listen for repository changes
                this._disposables.push(
                    this._gitApi.onDidOpenRepository(() => this.refreshRepositories()),
                    this._gitApi.onDidCloseRepository(() => this.refreshRepositories())
                );
            }
            
            // Load MRU data from storage
            this.loadMRUData();
            
            // Initial repository refresh
            await this.refreshRepositories();
            
        } catch (error) {
            console.error('Failed to initialize RepoContextService:', error);
        }
    }
    
    /**
     * Lists all available repositories in the workspace
     * 
     * @returns Array of Repository objects representing all detected repositories
     */
    public listRepositories(): Repository[] {
        return [...this._repositories];
    }
    
    /**
     * Gets the currently active repository
     * 
     * @returns The active Repository object, or undefined if no repository is active
     */
    public getActiveRepository(): Repository | undefined {
        return this._activeRepository;
    }
    
    /**
     * Sets the active repository and emits change event
     * 
     * @param repo - The Repository to set as active, or undefined to clear active repository
     */
    public setActiveRepository(repo: Repository | undefined): void {
        if (this._activeRepository?.rootUri.fsPath !== repo?.rootUri.fsPath) {
            this._activeRepository = repo;
            this._onDidChangeActiveRepository.fire(repo);
        }
    }
    
    /**
     * Adds a branch to the MRU list for a specific repository
     * 
     * @param repository - The repository to add the branch to
     * @param branchName - The name of the branch to add to MRU
     */
    public addToMRU(repository: Repository, branchName: string): void {
        const repoPath = repository.rootUri.fsPath;
        
        if (!this._mruData[repoPath]) {
            this._mruData[repoPath] = {
                branches: [],
                lastUpdated: Date.now()
            };
        }
        
        const mruEntry = this._mruData[repoPath];
        
        // Remove branch if it already exists
        const existingIndex = mruEntry.branches.indexOf(branchName);
        if (existingIndex !== -1) {
            mruEntry.branches.splice(existingIndex, 1);
        }
        
        // Add to front of list
        mruEntry.branches.unshift(branchName);
        
        // Limit to max branches
        if (mruEntry.branches.length > RepoContextService.mruMaxBranches) {
            mruEntry.branches = mruEntry.branches.slice(0, RepoContextService.mruMaxBranches);
        }
        
        mruEntry.lastUpdated = Date.now();
        
        // Persist to storage
        this.saveMRUData();
    }
    
    /**
     * Gets the MRU branches for a specific repository
     * 
     * @param repository - The repository to get MRU branches for
     * @returns Array of branch names in MRU order
     */
    public getMRUBranches(repository: Repository): string[] {
        const repoPath = repository.rootUri.fsPath;
        return this._mruData[repoPath]?.branches || [];
    }
    
    /**
     * Clears MRU data for a specific repository
     * 
     * @param repository - The repository to clear MRU data for
     */
    public clearMRU(repository: Repository): void {
        const repoPath = repository.rootUri.fsPath;
        delete this._mruData[repoPath];
        this.saveMRUData();
    }
    
    /**
     * Refreshes the repository list from VS Code Git API
     */
    private async refreshRepositories(): Promise<void> {
        if (!this._gitApi) {
            return;
        }
        
        try {
            const gitRepositories = this._gitApi.repositories;
            const repositories: Repository[] = [];
            
            for (const gitRepo of gitRepositories) {
                try {
                    const repository = await this.createRepositoryFromGitRepo(gitRepo);
                    repositories.push(repository);
                } catch (error) {
                    console.warn('Failed to create repository from git repo:', error);
                }
            }
            
            this._repositories = repositories;
            
            // If no active repository is set, set the first one as active
            if (!this._activeRepository && repositories.length > 0) {
                this.setActiveRepository(repositories[0]);
            }
            
            // If active repository is no longer available, clear it or set to first available
            if (this._activeRepository) {
                const activeStillExists = repositories.some(
                    repo => repo.rootUri.fsPath === this._activeRepository!.rootUri.fsPath
                );
                if (!activeStillExists) {
                    this.setActiveRepository(repositories.length > 0 ? repositories[0] : undefined);
                }
            }
            
        } catch (error) {
            console.error('Failed to refresh repositories:', error);
        }
    }
    
    /**
     * Creates a Repository object from a VS Code Git repository
     * 
     * @param gitRepo - The VS Code Git repository object
     * @returns Promise resolving to a Repository object
     */
    private async createRepositoryFromGitRepo(gitRepo: any): Promise<Repository> {
        const rootUri = gitRepo.rootUri;
        const name = this.getRepositoryName(rootUri);
        
        let currentBranch: string | undefined;
        let ahead: number | undefined;
        let behind: number | undefined;
        let hasChanges = false;
        
        try {
            // Get current branch
            const head = gitRepo.state.HEAD;
            if (head && head.name) {
                currentBranch = head.name;
                ahead = head.ahead;
                behind = head.behind;
            }
            
            // Check for changes
            const workingTreeChanges = gitRepo.state.workingTreeChanges || [];
            const indexChanges = gitRepo.state.indexChanges || [];
            hasChanges = workingTreeChanges.length > 0 || indexChanges.length > 0;
            
        } catch (error) {
            console.warn('Failed to get repository state:', error);
        }
        
        return {
            rootUri,
            name,
            currentBranch,
            ahead,
            behind,
            hasChanges
        };
    }
    
    /**
     * Extracts a repository name from its root URI
     * 
     * @param rootUri - The root URI of the repository
     * @returns The repository name (typically the folder name)
     */
    private getRepositoryName(rootUri: vscode.Uri): string {
        const pathSegments = rootUri.fsPath.split(/[/\\]/);
        return pathSegments[pathSegments.length - 1] || 'Unknown';
    }
    
    /**
     * Loads MRU data from VS Code global state
     */
    private loadMRUData(): void {
        try {
            const stored = this.context.globalState.get<MRUBranchData>(RepoContextService.mruStorageKey);
            if (stored) {
                this._mruData = stored;
            }
        } catch (error) {
            console.warn('Failed to load MRU data:', error);
            this._mruData = {};
        }
    }
    
    /**
     * Saves MRU data to VS Code global state
     */
    private saveMRUData(): void {
        try {
            this.context.globalState.update(RepoContextService.mruStorageKey, this._mruData);
        } catch (error) {
            console.error('Failed to save MRU data:', error);
        }
    }
    
    /**
     * Disposes of the service and cleans up resources
     */
    public dispose(): void {
        this._disposables.forEach(disposable => disposable.dispose());
        this._disposables = [];
        RepoContextService.instance = undefined;
    }
}
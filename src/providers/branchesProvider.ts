import * as vscode from 'vscode';
import { Branch, Repository, Remote, GitError, GitErrorCodes } from '../types/git';
import { IGitService } from '../services/gitService';
import { RepoContextService } from '../services/repoContextService';

/**
 * Interface for branch items with divergence badges and MRU metadata
 */
export interface BranchItem {
    branch: Branch;
    divergenceBadge?: string;
    isMRU?: boolean;
    lastAccessed?: Date;
}

/**
 * Interface for grouped branch items
 */
export interface BranchGroup {
    prefix: string;
    branches: BranchItem[];
    isCollapsed?: boolean;
}

/**
 * Interface for tag items
 */
export interface TagItem {
    name: string;
    commit: string;
    message?: string;
    date?: Date;
}

/**
 * Cache entry for branch data
 */
interface BranchCache {
    repository: Repository;
    branches: Branch[];
    remotes: Remote[];
    tags: TagItem[];
    timestamp: number;
    ttl: number; // Time to live in milliseconds
    lastRefresh: number; // Last time cache was refreshed
    hitCount: number; // Number of times cache was accessed
}

/**
 * Performance metrics for monitoring
 */
interface PerformanceMetrics {
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    lastOperationTime: number;
    totalOperations: number;
}

/**
 * Branches data provider with caching and MRU functionality
 * 
 * This provider manages branch data for the JetBrains-style QuickPick menu,
 * providing efficient access to recent, local, remote branches and tags with
 * divergence indicators and MRU tracking.
 * 
 * Key features:
 * - Branch list caching with automatic refresh on repository changes
 * - MRU (Most Recently Used) branch tracking and Recent section population
 * - Divergence badge calculation with ahead/behind indicators
 * - Debounced data assembly for performance (50-100ms)
 * - Grouped branch display with prefix-based organization
 * 
 * @example
 * ```typescript
 * const provider = new BranchesProvider(gitService, repoContextService);
 * const recentBranches = await provider.getRecent();
 * const localBranches = await provider.getLocal();
 * ```
 */
export class BranchesProvider implements vscode.Disposable {
    private readonly _cache = new Map<string, BranchCache>();
    private readonly _disposables: vscode.Disposable[] = [];
    private _debounceTimer: NodeJS.Timeout | undefined;
    private _performanceMetrics: PerformanceMetrics = {
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        lastOperationTime: 0,
        totalOperations: 0
    };
    private _pendingOperations = new Map<string, Promise<any>>();
    
    // Cache configuration
    private static readonly cacheTtl = 5 * 60 * 1000; // 5 minutes
    private static readonly debounceDelay = 75; // 75ms for optimal performance
    private static readonly maxRecentBranches = 10;
    private static readonly maxCacheSize = 50; // Maximum number of cached repositories
    
    constructor(
        private readonly gitService: IGitService,
        private readonly repoContextService: RepoContextService
    ) {
        // Listen for repository changes to invalidate cache
        this._disposables.push(
            this.repoContextService.onDidChangeActiveRepository(() => {
                this.invalidateCache();
            })
        );
        
        // Set up periodic cache cleanup
        const cleanupInterval = setInterval(() => {
            this.cleanupExpiredCache();
        }, 60000); // Clean up every minute
        
        this._disposables.push({
            dispose: () => clearInterval(cleanupInterval)
        });
    }
    
    /**
     * Gets recent branches based on MRU tracking
     * 
     * @param repository - Optional repository, uses active repository if not provided
     * @returns Promise resolving to array of recent branch items
     */
    public async getRecent(repository?: Repository): Promise<BranchItem[]> {
        const repo = repository || this.repoContextService.getActiveRepository();
        if (!repo) {
            return [];
        }
        
        return this.debounceDataAssembly(async () => {
            const cache = await this.getOrCreateCache(repo);
            const mruBranches = this.repoContextService.getMRUBranches(repo);
            
            const recentItems: BranchItem[] = [];
            
            // Get branches that exist in MRU list
            for (const branchName of mruBranches.slice(0, BranchesProvider.maxRecentBranches)) {
                const branch = cache.branches.find(b => b.name === branchName || b.fullName === branchName);
                if (branch) {
                    recentItems.push({
                        branch,
                        divergenceBadge: this.calculateDivergenceBadge(branch),
                        isMRU: true,
                        lastAccessed: branch.lastAccessed
                    });
                }
            }
            
            return recentItems;
        });
    }
    
    /**
     * Gets local branches with grouping and divergence badges
     * 
     * @param repository - Optional repository, uses active repository if not provided
     * @returns Promise resolving to array of grouped local branch items
     */
    public async getLocal(repository?: Repository): Promise<BranchGroup[]> {
        const repo = repository || this.repoContextService.getActiveRepository();
        if (!repo) {
            return [];
        }
        
        return this.debounceDataAssembly(async () => {
            const cache = await this.getOrCreateCache(repo);
            const localBranches = cache.branches.filter(b => b.type === 'local');
            
            // Group branches by prefix
            const groups = this.groupBranches(localBranches);
            
            // Convert to BranchGroup format with divergence badges
            return groups.map(group => ({
                prefix: group.prefix,
                branches: group.branches.map(branch => ({
                    branch,
                    divergenceBadge: this.calculateDivergenceBadge(branch),
                    isMRU: this.isBranchInMRU(repo, branch)
                })),
                isCollapsed: false
            }));
        });
    }
    
    /**
     * Gets remote branches grouped by remote with divergence badges
     * 
     * @param repository - Optional repository, uses active repository if not provided
     * @returns Promise resolving to array of grouped remote branch items
     */
    public async getRemotes(repository?: Repository): Promise<BranchGroup[]> {
        const repo = repository || this.repoContextService.getActiveRepository();
        if (!repo) {
            return [];
        }
        
        return this.debounceDataAssembly(async () => {
            const cache = await this.getOrCreateCache(repo);
            const remoteBranches = cache.branches.filter(b => b.type === 'remote');
            
            // Group by remote name
            const remoteGroups = new Map<string, Branch[]>();
            
            for (const branch of remoteBranches) {
                const remoteName = this.extractRemoteName(branch.fullName);
                if (!remoteGroups.has(remoteName)) {
                    remoteGroups.set(remoteName, []);
                }
                remoteGroups.get(remoteName)!.push(branch);
            }
            
            // Convert to BranchGroup format
            return Array.from(remoteGroups.entries()).map(([remoteName, branches]) => ({
                prefix: remoteName,
                branches: branches.map(branch => ({
                    branch,
                    divergenceBadge: this.calculateDivergenceBadge(branch),
                    isMRU: false // Remote branches are not tracked in MRU
                })),
                isCollapsed: false
            }));
        });
    }
    
    /**
     * Gets tags for the repository
     * 
     * @param repository - Optional repository, uses active repository if not provided
     * @returns Promise resolving to array of tag items
     */
    public async getTags(repository?: Repository): Promise<TagItem[]> {
        const repo = repository || this.repoContextService.getActiveRepository();
        if (!repo) {
            return [];
        }
        
        return this.debounceDataAssembly(async () => {
            const cache = await this.getOrCreateCache(repo);
            return [...cache.tags];
        });
    }
    
    /**
     * Refreshes the cache for a specific repository
     * 
     * @param repository - Optional repository, uses active repository if not provided
     */
    public async refresh(repository?: Repository): Promise<void> {
        const repo = repository || this.repoContextService.getActiveRepository();
        if (!repo) {
            return;
        }
        
        const cacheKey = this.getCacheKey(repo);
        this._cache.delete(cacheKey);
        
        // Pre-populate cache
        await this.getOrCreateCache(repo);
    }
    
    /**
     * Invalidates all cached data
     */
    public invalidateCache(): void {
        this._cache.clear();
    }
    
    /**
     * Gets or creates cache entry for a repository with performance monitoring
     */
    private async getOrCreateCache(repository: Repository): Promise<BranchCache> {
        const startTime = Date.now();
        const cacheKey = this.getCacheKey(repository);
        
        // Check for pending operation to avoid duplicate requests
        const pendingOperation = this._pendingOperations.get(cacheKey);
        if (pendingOperation) {
            return pendingOperation;
        }
        
        const existing = this._cache.get(cacheKey);
        
        // Check if cache is valid
        if (existing && (Date.now() - existing.timestamp) < existing.ttl) {
            existing.hitCount++;
            this._performanceMetrics.cacheHits++;
            this.updatePerformanceMetrics(Date.now() - startTime);
            return existing;
        }
        
        // Create new cache entry
        const cacheOperation = this.createCacheEntry(repository, cacheKey);
        this._pendingOperations.set(cacheKey, cacheOperation);
        
        try {
            const cache = await cacheOperation;
            this._performanceMetrics.cacheMisses++;
            this.updatePerformanceMetrics(Date.now() - startTime);
            return cache;
        } finally {
            this._pendingOperations.delete(cacheKey);
        }
    }
    
    /**
     * Creates a new cache entry for a repository
     */
    private async createCacheEntry(repository: Repository, cacheKey: string): Promise<BranchCache> {
        try {
            // Use Promise.allSettled to handle partial failures gracefully
            const results = await Promise.allSettled([
                this.gitService.getBranches(),
                this.gitService.getRemotes(),
                this.fetchTags(repository)
            ]);
            
            const branches = results[0].status === 'fulfilled' ? results[0].value : [];
            const remotes = results[1].status === 'fulfilled' ? results[1].value : [];
            const tags = results[2].status === 'fulfilled' ? results[2].value : [];
            
            // Log any failures
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const operation = ['branches', 'remotes', 'tags'][index];
                    console.warn(`Failed to fetch ${operation} for repository ${repository.name}:`, result.reason);
                }
            });
            
            const cache: BranchCache = {
                repository,
                branches,
                remotes,
                tags,
                timestamp: Date.now(),
                ttl: BranchesProvider.cacheTtl,
                lastRefresh: Date.now(),
                hitCount: 0
            };
            
            this._cache.set(cacheKey, cache);
            this.enforceMaxCacheSize();
            
            return cache;
            
        } catch (error) {
            console.error('Failed to create cache for repository:', error);
            
            // Return empty cache on error
            const emptyCache: BranchCache = {
                repository,
                branches: [],
                remotes: [],
                tags: [],
                timestamp: Date.now(),
                ttl: BranchesProvider.cacheTtl,
                lastRefresh: Date.now(),
                hitCount: 0
            };
            
            return emptyCache;
        }
    }
    
    /**
     * Fetches tags for a repository
     */
    private async fetchTags(repository: Repository): Promise<TagItem[]> {
        try {
            // This would typically use GitService to get tags
            // For now, return empty array as tag functionality may not be fully implemented
            return [];
        } catch (error) {
            console.warn('Failed to fetch tags:', error);
            return [];
        }
    }
    
    /**
     * Groups branches by common prefixes
     */
    private groupBranches(branches: Branch[]): { prefix: string; branches: Branch[] }[] {
        const groups = new Map<string, Branch[]>();
        const ungrouped: Branch[] = [];
        
        for (const branch of branches) {
            const prefix = this.extractBranchPrefix(branch.name);
            
            if (prefix && prefix !== branch.name) {
                if (!groups.has(prefix)) {
                    groups.set(prefix, []);
                }
                groups.get(prefix)!.push(branch);
            } else {
                ungrouped.push(branch);
            }
        }
        
        const result: { prefix: string; branches: Branch[] }[] = [];
        
        // Add ungrouped branches first (main, develop, etc.)
        if (ungrouped.length > 0) {
            result.push({ prefix: '', branches: ungrouped });
        }
        
        // Add grouped branches
        for (const [prefix, groupBranches] of groups.entries()) {
            result.push({ prefix, branches: groupBranches });
        }
        
        return result;
    }
    
    /**
     * Extracts branch prefix for grouping (e.g., "feature/" from "feature/auth")
     */
    private extractBranchPrefix(branchName: string): string | null {
        const prefixMatch = branchName.match(/^([a-zA-Z0-9-_]+)\//);
        return prefixMatch ? prefixMatch[1] + '/' : null;
    }
    
    /**
     * Extracts remote name from full remote branch name
     */
    private extractRemoteName(fullName: string): string {
        const parts = fullName.split('/');
        return parts.length > 1 ? parts[0] : 'origin';
    }
    
    /**
     * Calculates divergence badge for a branch
     */
    private calculateDivergenceBadge(branch: Branch): string | undefined {
        const ahead = branch.ahead || 0;
        const behind = branch.behind || 0;
        
        if (ahead === 0 && behind === 0) {
            return undefined;
        }
        
        const parts: string[] = [];
        if (ahead > 0) {
            parts.push(`↑${ahead}`);
        }
        if (behind > 0) {
            parts.push(`↓${behind}`);
        }
        
        return parts.join(' ');
    }
    
    /**
     * Checks if a branch is in the MRU list for a repository
     */
    private isBranchInMRU(repository: Repository, branch: Branch): boolean {
        const mruBranches = this.repoContextService.getMRUBranches(repository);
        return mruBranches.includes(branch.name) || mruBranches.includes(branch.fullName);
    }
    
    /**
     * Generates cache key for a repository
     */
    private getCacheKey(repository: Repository): string {
        return repository.rootUri.fsPath;
    }
    
    /**
     * Debounces data assembly operations for performance (50-100ms)
     */
    private async debounceDataAssembly<T>(operation: () => Promise<T>): Promise<T> {
        // Clear existing timer
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        
        return new Promise((resolve, reject) => {
            this._debounceTimer = setTimeout(async () => {
                const startTime = Date.now();
                try {
                    const result = await operation();
                    this.updatePerformanceMetrics(Date.now() - startTime);
                    resolve(result);
                } catch (error) {
                    this.updatePerformanceMetrics(Date.now() - startTime);
                    reject(error);
                } finally {
                    this._debounceTimer = undefined;
                }
            }, BranchesProvider.debounceDelay);
        });
    }
    
    /**
     * Updates performance metrics
     */
    private updatePerformanceMetrics(operationTime: number): void {
        this._performanceMetrics.totalOperations++;
        this._performanceMetrics.lastOperationTime = operationTime;
        
        // Calculate rolling average
        const totalTime = this._performanceMetrics.averageResponseTime * (this._performanceMetrics.totalOperations - 1) + operationTime;
        this._performanceMetrics.averageResponseTime = totalTime / this._performanceMetrics.totalOperations;
    }
    
    /**
     * Gets current performance metrics
     */
    public getPerformanceMetrics(): PerformanceMetrics {
        return { ...this._performanceMetrics };
    }
    
    /**
     * Cleans up expired cache entries
     */
    private cleanupExpiredCache(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];
        
        for (const [key, cache] of this._cache.entries()) {
            if ((now - cache.timestamp) > cache.ttl) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => this._cache.delete(key));
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }
    
    /**
     * Enforces maximum cache size by removing least recently used entries
     */
    private enforceMaxCacheSize(): void {
        if (this._cache.size <= BranchesProvider.maxCacheSize) {
            return;
        }
        
        // Sort by hit count and last refresh time (LRU)
        const entries = Array.from(this._cache.entries()).sort((a, b) => {
            const aScore = a[1].hitCount + (a[1].lastRefresh / 1000000); // Normalize timestamp
            const bScore = b[1].hitCount + (b[1].lastRefresh / 1000000);
            return aScore - bScore; // Ascending order (least used first)
        });
        
        // Remove oldest entries
        const entriesToRemove = entries.slice(0, this._cache.size - BranchesProvider.maxCacheSize);
        entriesToRemove.forEach(([key]) => this._cache.delete(key));
        
        console.log(`Removed ${entriesToRemove.length} cache entries to enforce size limit`);
    }
    
    /**
     * Disposes of the provider and cleans up resources
     */
    public dispose(): void {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        
        this._disposables.forEach(disposable => disposable.dispose());
        this._disposables.length = 0;
        this._cache.clear();
    }
}
import * as vscode from 'vscode';
import { Branch, Remote, CommitInfo, DiffResult, ResetMode, GitError, StashEntry, ConflictRegion } from '../types/git';
import { ErrorHandler } from '../utils/errorHandler';
import { validateBranchName } from '../utils/branchUtils';
import { ConflictResolver } from './conflictResolver';
import { DialogService } from './dialogService';
import { FeedbackService, IFeedbackService } from './feedbackService';

/**
 * Core Git service interface defining all Git operations
 */
export interface IGitService {
    // Branch operations
    getBranches(): Promise<Branch[]>;
    createBranch(name: string, startPoint?: string): Promise<void>;
    checkoutBranch(name: string): Promise<void>;
    renameBranch(oldName: string, newName: string): Promise<void>;

    // Repository operations
    fetch(): Promise<void>;
    pull(): Promise<void>;
    push(branch?: string): Promise<void>;
    commit(message: string): Promise<void>;
    merge(branch: string): Promise<void>;
    rebase(branch: string): Promise<void>;

    // Advanced operations
    resetHead(mode: ResetMode, commit?: string): Promise<void>;
    stashChanges(message?: string): Promise<void>;
    unstashChanges(stashIndex?: number): Promise<void>;
    createTag(name: string, message?: string): Promise<void>;

    // Remote operations
    getRemotes(): Promise<Remote[]>;
    addRemote(name: string, url: string): Promise<void>;
    removeRemote(name: string): Promise<void>;

    // File operations
    getFileHistory(filePath: string): Promise<CommitInfo[]>;
    getFileDiff(filePath: string, ref1?: string, ref2?: string): Promise<DiffResult>;
    revertFile(filePath: string): Promise<void>;
    getFileAnnotation(filePath: string): Promise<{
        lines: Array<{
            lineNumber: number;
            content: string;
            commit: CommitInfo;
        }>;
    }>;

    // Repository state
    getCurrentBranch(): Promise<string | undefined>;
    getRepositoryRoot(): Promise<string | undefined>;
    isRepository(): Promise<boolean>;
    getRepositoryStatus(): Promise<{
        hasChanges: boolean;
        stagedChanges: number;
        unstagedChanges: number;
        untrackedFiles: number;
    }>;

    // Stash operations
    getStashes(): Promise<StashEntry[]>;

    // Conflict detection and resolution
    detectMergeConflicts(): Promise<string[]>;
    getConflictedFiles(): Promise<string[]>;
    getFileConflicts(filePath: string): Promise<ConflictRegion[]>;
    resolveConflicts(filePath: string, conflicts: ConflictRegion[]): Promise<void>;
    isInMergeState(): Promise<boolean>;
    isInRebaseState(): Promise<boolean>;
}

/**
 * Git service implementation using VS Code Git API
 */
export class GitService implements IGitService {
    private gitExtension: vscode.Extension<any> | undefined;
    private git: any;
    private errorHandler: ErrorHandler;
    private conflictResolver: ConflictResolver;
    private dialogService: DialogService;
    private feedbackService: IFeedbackService;

    constructor(feedbackService?: IFeedbackService) {
        this.feedbackService = feedbackService || new FeedbackService();
        this.errorHandler = new ErrorHandler();
        this.conflictResolver = new ConflictResolver();
        this.dialogService = new DialogService();
        this.initializeGitExtension();
    }

    /**
     * Initialize VS Code Git extension integration
     */
    private initializeGitExtension(): void {
        this.gitExtension = vscode.extensions.getExtension('vscode.git');
        if (this.gitExtension) {
            this.git = this.gitExtension.exports.getAPI(1);
        }
    }

    /**
     * Get the current Git repository
     */
    private async getRepository(): Promise<any> {
        if (!this.git) {
            throw new GitError(
                'Git extension not available',
                'GIT_EXTENSION_NOT_FOUND',
                'vscode',
                false
            );
        }

        const repositories = this.git.repositories;
        if (repositories.length === 0) {
            throw new GitError(
                'No Git repository found in workspace',
                'REPOSITORY_NOT_FOUND',
                'git',
                false
            );
        }

        // Return the first repository (most common case)
        // In the future, we could add logic to handle multiple repositories
        return repositories[0];
    }

    /**
     * Check if current workspace has a Git repository
     */
    async isRepository(): Promise<boolean> {
        try {
            await this.getRepository();
            return true;
        } catch (error) {
            if (error instanceof GitError && 
                (error.code === 'REPOSITORY_NOT_FOUND' || error.code === 'GIT_EXTENSION_NOT_FOUND')) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get the root path of the current Git repository
     */
    async getRepositoryRoot(): Promise<string | undefined> {
        try {
            const repository = await this.getRepository();
            return repository.rootUri.fsPath;
        } catch (error) {
            if (error instanceof GitError) {
                await this.errorHandler.handleError(error);
            }
            return undefined;
        }
    }

    /**
     * Get the current active branch name
     */
    async getCurrentBranch(): Promise<string | undefined> {
        try {
            const repository = await this.getRepository();
            const head = repository.state.HEAD;
            return head?.name;
        } catch (error) {
            if (error instanceof GitError) {
                await this.errorHandler.handleError(error);
            }
            return undefined;
        }
    }

    /**
     * Get repository status information
     */
    async getRepositoryStatus(): Promise<{
        hasChanges: boolean;
        stagedChanges: number;
        unstagedChanges: number;
        untrackedFiles: number;
    }> {
        try {
            const repository = await this.getRepository();
            const changes = repository.state.workingTreeChanges || [];
            const indexChanges = repository.state.indexChanges || [];
            const untrackedChanges = repository.state.untrackedChanges || [];

            return {
                hasChanges: changes.length > 0 || indexChanges.length > 0 || untrackedChanges.length > 0,
                stagedChanges: indexChanges.length,
                unstagedChanges: changes.length,
                untrackedFiles: untrackedChanges.length
            };
        } catch (error) {
            if (error instanceof GitError) {
                await this.errorHandler.handleError(error);
            }
            return {
                hasChanges: false,
                stagedChanges: 0,
                unstagedChanges: 0,
                untrackedFiles: 0
            };
        }
    }

    /**
     * Get all branches (local and remote) with grouping information
     */
    async getBranches(): Promise<Branch[]> {
        try {
            const repository = await this.getRepository();
            const branches: Branch[] = [];
            const currentBranch = await this.getCurrentBranch();

            // Get all branches from refs
            const refs = repository.state.refs || [];
            for (const ref of refs) {
                if (ref.type === 1) { // Local branch
                    const branch: Branch = {
                        name: ref.name || '',
                        fullName: ref.name || '',
                        type: 'local',
                        isActive: ref.name === currentBranch,
                        upstream: ref.upstream?.name,
                        ahead: ref.ahead,
                        behind: ref.behind,
                        lastCommit: ref.commit ? {
                            hash: ref.commit,
                            shortHash: ref.commit.substring(0, 7),
                            message: '',
                            author: '',
                            date: new Date()
                        } : undefined
                    };
                    branches.push(branch);
                } else if (ref.type === 2) { // Remote branch
                    const remoteName = ref.remote || 'origin';
                    const branchName = ref.name?.replace(`${remoteName}/`, '') || '';
                    
                    const branch: Branch = {
                        name: branchName,
                        fullName: ref.fullName || ref.name || '',
                        type: 'remote',
                        isActive: false,
                        upstream: ref.name,
                        lastCommit: ref.commit ? {
                            hash: ref.commit,
                            shortHash: ref.commit.substring(0, 7),
                            message: '',
                            author: '',
                            date: new Date()
                        } : undefined
                    };
                    branches.push(branch);
                }
            }

            return branches;
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GET_BRANCHES_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Create a new branch from the specified start point
     */
    async createBranch(name: string, startPoint?: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate branch name
            const validation = validateBranchName(name);
            if (!validation.isValid) {
                throw new GitError(
                    validation.error || 'Invalid branch name',
                    'INVALID_BRANCH_NAME',
                    'git'
                );
            }

            // Check if branch already exists
            const existingBranches = await this.getBranches();
            const branchExists = existingBranches.some(branch => 
                branch.name === name && branch.type === 'local'
            );

            if (branchExists) {
                throw new GitError(
                    `Branch '${name}' already exists`,
                    'BRANCH_ALREADY_EXISTS',
                    'git'
                );
            }

            // Create the branch
            await repository.createBranch(name, true, startPoint);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to create branch '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CREATE_BRANCH_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Checkout the specified branch
     */
    async checkoutBranch(name: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate branch name
            const validation = validateBranchName(name);
            if (!validation.isValid) {
                throw new GitError(
                    validation.error || 'Invalid branch name',
                    'INVALID_BRANCH_NAME',
                    'git'
                );
            }

            // Check if branch exists
            const branches = await this.getBranches();
            const targetBranch = branches.find(branch => 
                branch.name === name || branch.fullName === name
            );

            if (!targetBranch) {
                throw new GitError(
                    `Branch '${name}' not found`,
                    'BRANCH_NOT_FOUND',
                    'git'
                );
            }

            // Checkout the branch
            await repository.checkout(targetBranch.fullName);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to checkout branch '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CHECKOUT_BRANCH_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Rename a local branch
     */
    async renameBranch(oldName: string, newName: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate old branch name
            const oldValidation = validateBranchName(oldName);
            if (!oldValidation.isValid) {
                throw new GitError(
                    `Invalid old branch name: ${oldValidation.error}`,
                    'INVALID_BRANCH_NAME',
                    'git'
                );
            }

            // Validate new branch name
            const newValidation = validateBranchName(newName);
            if (!newValidation.isValid) {
                throw new GitError(
                    `Invalid new branch name: ${newValidation.error}`,
                    'INVALID_BRANCH_NAME',
                    'git'
                );
            }

            // Check if old branch exists and is local
            const branches = await this.getBranches();
            const oldBranch = branches.find(branch => 
                branch.name === oldName && branch.type === 'local'
            );

            if (!oldBranch) {
                throw new GitError(
                    `Local branch '${oldName}' not found`,
                    'BRANCH_NOT_FOUND',
                    'git'
                );
            }

            // Check if new branch name already exists
            const newBranchExists = branches.some(branch => 
                branch.name === newName && branch.type === 'local'
            );

            if (newBranchExists) {
                throw new GitError(
                    `Branch '${newName}' already exists`,
                    'BRANCH_ALREADY_EXISTS',
                    'git'
                );
            }

            // Rename the branch using Git command
            await repository.renameBranch(oldName, newName);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to rename branch '${oldName}' to '${newName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'RENAME_BRANCH_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Fetch latest changes from remote repository
     */
    async fetch(): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            await this.feedbackService.showProgress('Fetching from remote', async (progress, token) => {
                if (token.isCancellationRequested) {
                    throw new GitError('Fetch operation cancelled', 'OPERATION_CANCELLED', 'git', false);
                }
                
                progress.report({ message: 'Connecting to remote repository...', increment: 20 });
                this.feedbackService.logDebug('Starting fetch operation');
                
                await repository.fetch();
                
                if (token.isCancellationRequested) {
                    throw new GitError('Fetch operation cancelled', 'OPERATION_CANCELLED', 'git', false);
                }
                
                progress.report({ message: 'Fetch completed successfully', increment: 80 });
                this.feedbackService.logInfo('Fetch operation completed successfully');
            });
            
            await this.feedbackService.showSuccess('Successfully fetched latest changes from remote');
            
        } catch (error) {
            if (error instanceof GitError && error.code === 'OPERATION_CANCELLED') {
                this.feedbackService.logInfo('Fetch operation was cancelled by user');
                throw error;
            }
            
            const gitError = this.createNetworkError(error, 'fetch');
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Pull latest changes from remote repository
     */
    async pull(): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Check if there are uncommitted changes
            const status = await this.getRepositoryStatus();
            if (status.hasChanges) {
                const choice = await this.dialogService.showUncommittedChangesWarning('pull');
                
                if (choice !== 'continue') {
                    this.feedbackService.logInfo('Pull operation cancelled due to uncommitted changes');
                    return;
                }
            }
            
            await this.feedbackService.showProgress('Pulling from remote', async (progress, token) => {
                if (token.isCancellationRequested) {
                    throw new GitError('Pull operation cancelled', 'OPERATION_CANCELLED', 'git', false);
                }
                
                progress.report({ message: 'Fetching latest changes...', increment: 30 });
                this.feedbackService.logDebug('Starting pull operation');
                
                await repository.pull();
                
                if (token.isCancellationRequested) {
                    throw new GitError('Pull operation cancelled', 'OPERATION_CANCELLED', 'git', false);
                }
                
                progress.report({ message: 'Pull completed successfully', increment: 70 });
                this.feedbackService.logInfo('Pull operation completed successfully');
            });
            
            await this.feedbackService.showSuccess('Successfully pulled latest changes from remote');
            
        } catch (error) {
            if (error instanceof GitError && error.code === 'OPERATION_CANCELLED') {
                this.feedbackService.logInfo('Pull operation was cancelled by user');
                throw error;
            }
            
            const gitError = this.createNetworkError(error, 'pull');
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Push changes to remote repository
     */
    async push(branch?: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Get current branch if none specified
            const targetBranch = branch || await this.getCurrentBranch();
            if (!targetBranch) {
                throw new GitError(
                    'No branch specified and unable to determine current branch',
                    'NO_BRANCH_SPECIFIED',
                    'git'
                );
            }
            
            // Check if there are changes to push
            const branches = await this.getBranches();
            const currentBranchInfo = branches.find(b => b.name === targetBranch && b.type === 'local');
            
            if (currentBranchInfo && currentBranchInfo.ahead === 0) {
                await this.feedbackService.showInfo('No changes to push');
                this.feedbackService.logInfo(`No changes to push for branch: ${targetBranch}`);
                return;
            }
            
            await this.feedbackService.showProgress(`Pushing ${targetBranch} to remote`, async (progress, token) => {
                if (token.isCancellationRequested) {
                    throw new GitError('Push operation cancelled', 'OPERATION_CANCELLED', 'git', false);
                }
                
                progress.report({ message: 'Uploading changes...', increment: 30 });
                this.feedbackService.logDebug(`Starting push operation for branch: ${targetBranch}`);
                
                await repository.push();
                
                if (token.isCancellationRequested) {
                    throw new GitError('Push operation cancelled', 'OPERATION_CANCELLED', 'git', false);
                }
                
                progress.report({ message: 'Push completed successfully', increment: 70 });
                this.feedbackService.logInfo(`Push operation completed successfully for branch: ${targetBranch}`);
            });
            
            await this.feedbackService.showSuccess(`Successfully pushed ${targetBranch} to remote`);
            
        } catch (error) {
            if (error instanceof GitError && error.code === 'OPERATION_CANCELLED') {
                this.feedbackService.logInfo('Push operation was cancelled by user');
                throw error;
            }
            
            const gitError = this.createNetworkError(error, 'push');
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Commit staged changes with a message
     */
    async commit(message: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate commit message
            if (!message || message.trim().length === 0) {
                throw new GitError(
                    'Commit message cannot be empty',
                    'EMPTY_COMMIT_MESSAGE',
                    'git'
                );
            }
            
            // Check if there are staged changes
            const status = await this.getRepositoryStatus();
            if (status.stagedChanges === 0) {
                const choice = await this.dialogService.showNoStagedChangesWarning();
                
                if (choice === 'stage-all') {
                    // Stage all changes
                    const workingTreeChanges = repository.state.workingTreeChanges || [];
                    const untrackedChanges = repository.state.untrackedChanges || [];
                    const allChanges = [...workingTreeChanges, ...untrackedChanges];
                    
                    if (allChanges.length === 0) {
                        vscode.window.showInformationMessage('No changes to commit');
                        return;
                    }
                    
                    // Add all changes to staging
                    await repository.add(allChanges.map(change => change.uri.fsPath));
                } else {
                    return;
                }
            }
            
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating commit...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing commit...' });
                
                try {
                    await repository.commit(message.trim());
                    progress.report({ increment: 100, message: 'Commit created successfully' });
                } catch (error) {
                    throw error;
                }
            });
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully created commit: ${message.trim()}`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'COMMIT_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Create appropriate error for network operations
     */
    private createNetworkError(error: any, operation: string): GitError {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check for common network/authentication errors
        if (errorMessage.includes('Authentication failed') || 
            errorMessage.includes('Permission denied') ||
            errorMessage.includes('401') ||
            errorMessage.includes('403')) {
            return new GitError(
                `Authentication failed during ${operation}. Please check your credentials.`,
                'AUTHENTICATION_FAILED',
                'git'
            );
        }
        
        if (errorMessage.includes('Network') || 
            errorMessage.includes('Connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('Could not resolve host')) {
            return new GitError(
                `Network error during ${operation}. Please check your internet connection.`,
                'NETWORK_ERROR',
                'git'
            );
        }
        
        if (errorMessage.includes('Repository not found') ||
            errorMessage.includes('404')) {
            return new GitError(
                `Remote repository not found during ${operation}. Please check the repository URL.`,
                'REPOSITORY_NOT_FOUND',
                'git'
            );
        }
        
        if (errorMessage.includes('non-fast-forward') ||
            errorMessage.includes('Updates were rejected')) {
            return new GitError(
                `Push rejected during ${operation}. Please pull the latest changes first.`,
                'PUSH_REJECTED',
                'git'
            );
        }
        
        // Generic error for other cases
        return new GitError(
            `Failed to ${operation}: ${errorMessage}`,
            `${operation.toUpperCase()}_FAILED`,
            'git'
        );
    }

    /**
     * Merge the specified branch into the current branch
     */
    async merge(branch: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate branch name
            const validation = validateBranchName(branch);
            if (!validation.isValid) {
                throw new GitError(
                    validation.error || 'Invalid branch name',
                    'INVALID_BRANCH_NAME',
                    'git'
                );
            }

            // Check if branch exists
            const branches = await this.getBranches();
            const targetBranch = branches.find(b => 
                b.name === branch || b.fullName === branch
            );

            if (!targetBranch) {
                throw new GitError(
                    `Branch '${branch}' not found`,
                    'BRANCH_NOT_FOUND',
                    'git'
                );
            }

            // Get current branch
            const currentBranch = await this.getCurrentBranch();
            if (!currentBranch) {
                throw new GitError(
                    'Unable to determine current branch',
                    'NO_CURRENT_BRANCH',
                    'git'
                );
            }

            // Check if trying to merge branch into itself
            if (currentBranch === branch) {
                throw new GitError(
                    'Cannot merge a branch into itself',
                    'SELF_MERGE_ATTEMPT',
                    'git'
                );
            }

            // Check for uncommitted changes
            const status = await this.getRepositoryStatus();
            if (status.hasChanges) {
                const choice = await this.dialogService.showUncommittedChangesWarning('merge');
                
                if (choice === 'cancel') {
                    return;
                } else if (choice === 'stash') {
                    await this.stashChanges(`Auto-stash before merge with ${branch}`);
                }
            }

            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Merging ${branch} into ${currentBranch}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing merge...' });
                
                try {
                    await repository.merge(targetBranch.fullName);
                    progress.report({ increment: 50, message: 'Checking for conflicts...' });
                    
                    // Check for conflicts after merge attempt
                    const conflictedFiles = await this.detectMergeConflicts();
                    
                    if (conflictedFiles.length > 0) {
                        progress.report({ increment: 75, message: 'Processing conflicts...' });
                        
                        // Try to auto-resolve conflicts
                        let autoResolvedCount = 0;
                        for (const filePath of conflictedFiles) {
                            const conflicts = await this.getFileConflicts(filePath);
                            const resolvedConflicts = conflicts.filter(c => c.isResolved);
                            
                            if (resolvedConflicts.length > 0 && this.conflictResolver.getAllConflictsResolved(conflicts)) {
                                await this.resolveConflicts(filePath, conflicts);
                                autoResolvedCount++;
                            }
                        }
                        
                        const remainingConflicts = conflictedFiles.length - autoResolvedCount;
                        
                        if (remainingConflicts > 0) {
                            throw new GitError(
                                `Merge conflicts detected in ${remainingConflicts} file(s). ${autoResolvedCount} conflicts were auto-resolved. Please resolve remaining conflicts manually.`,
                                'MERGE_CONFLICTS',
                                'git',
                                true
                            );
                        } else {
                            // All conflicts were auto-resolved
                            vscode.window.showInformationMessage(
                                `Merge completed with ${autoResolvedCount} conflicts auto-resolved.`
                            );
                        }
                    }
                    
                    progress.report({ increment: 100, message: 'Merge completed successfully' });
                } catch (error) {
                    // Enhanced error handling for merge conflicts
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    if (errorMessage.includes('conflict') || errorMessage.includes('CONFLICT') || 
                        (error instanceof GitError && error.code === 'MERGE_CONFLICTS')) {
                        
                        // If it's already a GitError with conflict info, re-throw it
                        if (error instanceof GitError && error.code === 'MERGE_CONFLICTS') {
                            throw error;
                        }
                        
                        // Otherwise, create a new GitError with conflict detection
                        const conflictedFiles = await this.detectMergeConflicts();
                        throw new GitError(
                            `Merge conflicts detected in ${conflictedFiles.length} file(s). Please resolve conflicts and commit the merge.`,
                            'MERGE_CONFLICTS',
                            'git',
                            true
                        );
                    }
                    throw error;
                }
            });
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully merged ${branch} into ${currentBranch}`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to merge branch '${branch}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'MERGE_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Rebase the current branch onto the specified branch
     */
    async rebase(branch: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate branch name
            const validation = validateBranchName(branch);
            if (!validation.isValid) {
                throw new GitError(
                    validation.error || 'Invalid branch name',
                    'INVALID_BRANCH_NAME',
                    'git'
                );
            }

            // Check if branch exists
            const branches = await this.getBranches();
            const targetBranch = branches.find(b => 
                b.name === branch || b.fullName === branch
            );

            if (!targetBranch) {
                throw new GitError(
                    `Branch '${branch}' not found`,
                    'BRANCH_NOT_FOUND',
                    'git'
                );
            }

            // Get current branch
            const currentBranch = await this.getCurrentBranch();
            if (!currentBranch) {
                throw new GitError(
                    'Unable to determine current branch',
                    'NO_CURRENT_BRANCH',
                    'git'
                );
            }

            // Check if trying to rebase branch onto itself
            if (currentBranch === branch) {
                throw new GitError(
                    'Cannot rebase a branch onto itself',
                    'SELF_REBASE_ATTEMPT',
                    'git'
                );
            }

            // Check for uncommitted changes
            const status = await this.getRepositoryStatus();
            if (status.hasChanges) {
                const choice = await this.dialogService.showUncommittedChangesWarning('rebase');
                
                if (choice === 'cancel') {
                    return;
                } else if (choice === 'stash') {
                    await this.stashChanges(`Auto-stash before rebase onto ${branch}`);
                }
            }

            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Rebasing ${currentBranch} onto ${branch}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing rebase...' });
                
                try {
                    await repository.rebase(targetBranch.fullName);
                    progress.report({ increment: 50, message: 'Checking for conflicts...' });
                    
                    // Check for conflicts after rebase attempt
                    const conflictedFiles = await this.detectMergeConflicts();
                    
                    if (conflictedFiles.length > 0) {
                        progress.report({ increment: 75, message: 'Processing conflicts...' });
                        
                        // Try to auto-resolve conflicts
                        let autoResolvedCount = 0;
                        for (const filePath of conflictedFiles) {
                            const conflicts = await this.getFileConflicts(filePath);
                            const resolvedConflicts = conflicts.filter(c => c.isResolved);
                            
                            if (resolvedConflicts.length > 0 && this.conflictResolver.getAllConflictsResolved(conflicts)) {
                                await this.resolveConflicts(filePath, conflicts);
                                autoResolvedCount++;
                            }
                        }
                        
                        const remainingConflicts = conflictedFiles.length - autoResolvedCount;
                        
                        if (remainingConflicts > 0) {
                            throw new GitError(
                                `Rebase conflicts detected in ${remainingConflicts} file(s). ${autoResolvedCount} conflicts were auto-resolved. Please resolve remaining conflicts and continue the rebase.`,
                                'REBASE_CONFLICTS',
                                'git',
                                true
                            );
                        } else {
                            // All conflicts were auto-resolved
                            vscode.window.showInformationMessage(
                                `Rebase completed with ${autoResolvedCount} conflicts auto-resolved.`
                            );
                        }
                    }
                    
                    progress.report({ increment: 100, message: 'Rebase completed successfully' });
                } catch (error) {
                    // Enhanced error handling for rebase conflicts
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    if (errorMessage.includes('conflict') || errorMessage.includes('CONFLICT') || 
                        (error instanceof GitError && error.code === 'REBASE_CONFLICTS')) {
                        
                        // If it's already a GitError with conflict info, re-throw it
                        if (error instanceof GitError && error.code === 'REBASE_CONFLICTS') {
                            throw error;
                        }
                        
                        // Otherwise, create a new GitError with conflict detection
                        const conflictedFiles = await this.detectMergeConflicts();
                        throw new GitError(
                            `Rebase conflicts detected in ${conflictedFiles.length} file(s). Please resolve conflicts and continue the rebase.`,
                            'REBASE_CONFLICTS',
                            'git',
                            true
                        );
                    }
                    throw error;
                }
            });
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully rebased ${currentBranch} onto ${branch}`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to rebase onto branch '${branch}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'REBASE_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Reset HEAD to the specified commit with the given mode
     */
    async resetHead(mode: ResetMode, commit?: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate reset mode
            if (!['soft', 'mixed', 'hard'].includes(mode)) {
                throw new GitError(
                    `Invalid reset mode '${mode}'. Must be 'soft', 'mixed', or 'hard'`,
                    'INVALID_RESET_MODE',
                    'git'
                );
            }

            // Default to HEAD if no commit specified
            const targetCommit = commit || 'HEAD';

            // Show warning for destructive operations
            if (mode === 'hard') {
                const confirmed = await this.dialogService.confirmHardReset();
                if (!confirmed) {
                    return;
                }
            } else if (mode === 'mixed') {
                const status = await this.getRepositoryStatus();
                if (status.stagedChanges > 0) {
                    const confirmed = await this.dialogService.showMixedResetWarning();
                    if (!confirmed) {
                        return;
                    }
                }
            }

            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Performing ${mode} reset to ${targetCommit}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing reset...' });
                
                try {
                    // Use the repository's reset method if available, otherwise use Git command
                    if (repository.reset) {
                        await repository.reset(targetCommit, mode);
                    } else {
                        // Fallback to direct Git command execution
                        const { spawn } = require('child_process');
                        const repoRoot = await this.getRepositoryRoot();
                        
                        await new Promise<void>((resolve, reject) => {
                            const gitProcess = spawn('git', ['reset', `--${mode}`, targetCommit], {
                                cwd: repoRoot,
                                stdio: 'pipe'
                            });
                            
                            let errorOutput = '';
                            gitProcess.stderr.on('data', (data) => {
                                errorOutput += data.toString();
                            });
                            
                            gitProcess.on('close', (code) => {
                                if (code === 0) {
                                    resolve();
                                } else {
                                    reject(new Error(errorOutput || `Git reset failed with code ${code}`));
                                }
                            });
                        });
                    }
                    
                    progress.report({ increment: 100, message: 'Reset completed successfully' });
                } catch (error) {
                    throw error;
                }
            });
            
            // Show success message
            const modeDescription = {
                'soft': 'Soft reset completed - HEAD moved, index and working tree unchanged',
                'mixed': 'Mixed reset completed - HEAD and index reset, working tree unchanged',
                'hard': 'Hard reset completed - HEAD, index, and working tree reset'
            };
            
            vscode.window.showInformationMessage(modeDescription[mode]);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to reset HEAD: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'RESET_HEAD_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Stash current changes with an optional message
     */
    async stashChanges(message?: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Check if there are changes to stash
            const status = await this.getRepositoryStatus();
            if (!status.hasChanges) {
                vscode.window.showInformationMessage('No changes to stash');
                return;
            }

            // Create stash message
            const stashMessage = message || `Stash created on ${new Date().toLocaleString()}`;

            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Stashing changes...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing stash...' });
                
                try {
                    // Use the repository's stash method if available, otherwise use Git command
                    if (repository.createStash) {
                        await repository.createStash(stashMessage, true); // includeUntracked = true
                    } else {
                        // Fallback to direct Git command execution
                        const { spawn } = require('child_process');
                        const repoRoot = await this.getRepositoryRoot();
                        
                        await new Promise<void>((resolve, reject) => {
                            const gitProcess = spawn('git', ['stash', 'push', '-u', '-m', stashMessage], {
                                cwd: repoRoot,
                                stdio: 'pipe'
                            });
                            
                            let errorOutput = '';
                            gitProcess.stderr.on('data', (data) => {
                                errorOutput += data.toString();
                            });
                            
                            gitProcess.on('close', (code) => {
                                if (code === 0) {
                                    resolve();
                                } else {
                                    reject(new Error(errorOutput || `Git stash failed with code ${code}`));
                                }
                            });
                        });
                    }
                    
                    progress.report({ increment: 100, message: 'Stash created successfully' });
                } catch (error) {
                    throw error;
                }
            });
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully stashed changes: ${stashMessage}`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to stash changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'STASH_CHANGES_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Unstash changes from the specified stash index
     */
    async unstashChanges(stashIndex?: number): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Get available stashes
            const stashes = await this.getStashes();
            if (stashes.length === 0) {
                vscode.window.showInformationMessage('No stashes available');
                return;
            }

            // Determine which stash to apply
            let targetStashIndex = stashIndex;
            if (targetStashIndex === undefined) {
                // If no index specified, let user choose
                if (stashes.length === 1) {
                    targetStashIndex = 0;
                } else {
                    const stashItems = stashes.map((stash, index) => ({
                        label: `stash@{${index}}: ${stash.message}`,
                        description: `${stash.branch} - ${stash.timestamp.toLocaleString()}`,
                        index: index
                    }));

                    const selectedStash = await this.dialogService.selectStashForUnstash(stashes);

                    if (!selectedStash) {
                        return; // User cancelled
                    }

                    targetStashIndex = selectedStash.index;
                }
            }

            // Validate stash index
            if (targetStashIndex < 0 || targetStashIndex >= stashes.length) {
                throw new GitError(
                    `Invalid stash index ${targetStashIndex}. Available stashes: 0-${stashes.length - 1}`,
                    'INVALID_STASH_INDEX',
                    'git'
                );
            }

            const targetStash = stashes[targetStashIndex];

            // Check for uncommitted changes
            const status = await this.getRepositoryStatus();
            if (status.hasChanges) {
                const confirmed = await this.dialogService.showStashConflictWarning();
                
                if (!confirmed) {
                    return;
                }
            }

            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Applying stash: ${targetStash.message}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing to apply stash...' });
                
                try {
                    // Use the repository's apply stash method if available, otherwise use Git command
                    if (repository.popStash) {
                        await repository.popStash(targetStashIndex);
                    } else {
                        // Fallback to direct Git command execution
                        const { spawn } = require('child_process');
                        const repoRoot = await this.getRepositoryRoot();
                        
                        await new Promise<void>((resolve, reject) => {
                            const gitProcess = spawn('git', ['stash', 'pop', `stash@{${targetStashIndex}}`], {
                                cwd: repoRoot,
                                stdio: 'pipe'
                            });
                            
                            let errorOutput = '';
                            gitProcess.stderr.on('data', (data) => {
                                errorOutput += data.toString();
                            });
                            
                            gitProcess.on('close', (code) => {
                                if (code === 0) {
                                    resolve();
                                } else {
                                    // Check for conflicts
                                    if (errorOutput.includes('conflict') || errorOutput.includes('CONFLICT')) {
                                        reject(new GitError(
                                            'Stash application resulted in conflicts. Please resolve conflicts manually.',
                                            'STASH_CONFLICTS',
                                            'git',
                                            true
                                        ));
                                    } else {
                                        reject(new Error(errorOutput || `Git stash pop failed with code ${code}`));
                                    }
                                }
                            });
                        });
                    }
                    
                    progress.report({ increment: 100, message: 'Stash applied successfully' });
                } catch (error) {
                    throw error;
                }
            });
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully applied stash: ${targetStash.message}`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to unstash changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'UNSTASH_CHANGES_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Get list of available stashes
     */
    async getStashes(): Promise<StashEntry[]> {
        try {
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                return [];
            }

            const { spawn } = require('child_process');
            
            return new Promise<StashEntry[]>((resolve, reject) => {
                const gitProcess = spawn('git', ['stash', 'list', '--format=%gd|%gs|%gD'], {
                    cwd: repoRoot,
                    stdio: 'pipe'
                });
                
                let output = '';
                let errorOutput = '';
                
                gitProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                gitProcess.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                gitProcess.on('close', (code) => {
                    if (code === 0) {
                        const stashes: StashEntry[] = [];
                        const lines = output.trim().split('\n').filter(line => line.length > 0);
                        
                        lines.forEach((line, index) => {
                            const parts = line.split('|');
                            if (parts.length >= 3) {
                                const stashRef = parts[0]; // e.g., "stash@{0}"
                                const message = parts[1];
                                const dateStr = parts[2];
                                
                                // Extract branch name from message (format: "WIP on branch: message")
                                const branchMatch = message.match(/WIP on ([^:]+):/);
                                const branch = branchMatch ? branchMatch[1] : 'unknown';
                                
                                stashes.push({
                                    index: index,
                                    message: message,
                                    branch: branch,
                                    timestamp: new Date(dateStr)
                                });
                            }
                        });
                        
                        resolve(stashes);
                    } else {
                        reject(new Error(errorOutput || `Git stash list failed with code ${code}`));
                    }
                });
            });
        } catch (error) {
            console.error('Failed to get stashes:', error);
            return [];
        }
    }

    async createTag(_name: string, _message?: string): Promise<void> {
        throw new Error('Method not implemented - will be implemented in task 6.');
    }

    /**
     * Get all configured remotes
     */
    async getRemotes(): Promise<Remote[]> {
        try {
            const repository = await this.getRepository();
            const remotes: Remote[] = [];
            
            // Get remotes from the repository state
            const repositoryRemotes = repository.state.remotes || [];
            
            for (const remote of repositoryRemotes) {
                const remoteBranches = await this.getRemoteBranches(remote.name);
                
                const remoteInfo: Remote = {
                    name: remote.name,
                    fetchUrl: remote.fetchUrl || remote.pushUrl || '',
                    pushUrl: remote.pushUrl || remote.fetchUrl || '',
                    branches: remoteBranches
                };
                
                remotes.push(remoteInfo);
            }
            
            return remotes;
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to get remotes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GET_REMOTES_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Add a new remote repository
     */
    async addRemote(name: string, url: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate remote name
            if (!name || name.trim().length === 0) {
                throw new GitError(
                    'Remote name cannot be empty',
                    'INVALID_REMOTE_NAME',
                    'git'
                );
            }
            
            // Validate remote name format (no spaces, special characters)
            const remoteNameRegex = /^[a-zA-Z0-9._-]+$/;
            if (!remoteNameRegex.test(name.trim())) {
                throw new GitError(
                    'Remote name can only contain letters, numbers, dots, underscores, and hyphens',
                    'INVALID_REMOTE_NAME',
                    'git'
                );
            }
            
            // Validate URL
            const validationResult = this.validateRemoteUrl(url);
            if (!validationResult.isValid) {
                throw new GitError(
                    validationResult.error || 'Invalid remote URL',
                    'INVALID_REMOTE_URL',
                    'git'
                );
            }
            
            // Check if remote already exists
            const existingRemotes = await this.getRemotes();
            const remoteExists = existingRemotes.some(remote => remote.name === name.trim());
            
            if (remoteExists) {
                throw new GitError(
                    `Remote '${name.trim()}' already exists`,
                    'REMOTE_ALREADY_EXISTS',
                    'git'
                );
            }
            
            // Add the remote
            await repository.addRemote(name.trim(), url.trim());
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully added remote '${name.trim()}'`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to add remote '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'ADD_REMOTE_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Remove a remote repository
     */
    async removeRemote(name: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate remote name
            if (!name || name.trim().length === 0) {
                throw new GitError(
                    'Remote name cannot be empty',
                    'INVALID_REMOTE_NAME',
                    'git'
                );
            }
            
            // Check if remote exists
            const existingRemotes = await this.getRemotes();
            const remoteExists = existingRemotes.some(remote => remote.name === name.trim());
            
            if (!remoteExists) {
                throw new GitError(
                    `Remote '${name.trim()}' not found`,
                    'REMOTE_NOT_FOUND',
                    'git'
                );
            }
            
            // Confirm removal with user
            const confirmed = await this.dialogService.confirmRemoteRemoval(name.trim());
            
            if (!confirmed) {
                return;
            }
            
            // Remove the remote
            await repository.removeRemote(name.trim());
            
            // Show success message
            vscode.window.showInformationMessage(`Successfully removed remote '${name.trim()}'`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to remove remote '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'REMOVE_REMOTE_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Get branches for a specific remote
     */
    private async getRemoteBranches(remoteName: string): Promise<string[]> {
        try {
            const branches = await this.getBranches();
            return branches
                .filter(branch => branch.type === 'remote' && branch.fullName.startsWith(`${remoteName}/`))
                .map(branch => branch.name);
        } catch (error) {
            // Return empty array if unable to get branches
            return [];
        }
    }

    /**
     * Validate remote URL format and accessibility
     */
    private validateRemoteUrl(url: string): { isValid: boolean; error?: string } {
        if (!url || url.trim().length === 0) {
            return { isValid: false, error: 'URL cannot be empty' };
        }
        
        const trimmedUrl = url.trim();
        
        // Check for common Git URL patterns
        const gitUrlPatterns = [
            /^https?:\/\/.+\.git$/,                    // HTTPS: https://github.com/user/repo.git
            /^https?:\/\/.+$/,                        // HTTPS without .git: https://github.com/user/repo
            /^git@.+:.+\.git$/,                       // SSH: git@github.com:user/repo.git
            /^git@.+:.+$/,                            // SSH without .git: git@github.com:user/repo
            /^ssh:\/\/.+$/,                           // SSH protocol: ssh://git@github.com/user/repo.git
            /^git:\/\/.+$/,                           // Git protocol: git://github.com/user/repo.git
            /^file:\/\/.+$/,                          // File protocol: file:///path/to/repo
            /^\/.*$/,                                 // Local path: /path/to/repo
            /^\.\.?\/.*/                              // Relative path: ./repo or ../repo
        ];
        
        const isValidFormat = gitUrlPatterns.some(pattern => pattern.test(trimmedUrl));
        
        if (!isValidFormat) {
            return { 
                isValid: false, 
                error: 'Invalid URL format. Supported formats: HTTPS, SSH, Git protocol, or local path' 
            };
        }
        
        // Additional validation for HTTPS URLs
        if (trimmedUrl.startsWith('http')) {
            try {
                new URL(trimmedUrl);
            } catch (error) {
                return { isValid: false, error: 'Invalid HTTPS URL format' };
            }
        }
        
        return { isValid: true };
    }

    /**
     * Get commit history for a specific file
     */
    async getFileHistory(filePath: string): Promise<CommitInfo[]> {
        try {
            const repository = await this.getRepository();
            
            // Validate file path
            if (!filePath || filePath.trim().length === 0) {
                throw new GitError(
                    'File path cannot be empty',
                    'INVALID_FILE_PATH',
                    'git'
                );
            }

            // Get repository root to make relative path
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                throw new GitError(
                    'Unable to determine repository root',
                    'REPOSITORY_ROOT_NOT_FOUND',
                    'git'
                );
            }

            // Make path relative to repository root
            const relativePath = filePath.startsWith(repoRoot) 
                ? filePath.substring(repoRoot.length + 1).replace(/\\/g, '/')
                : filePath.replace(/\\/g, '/');

            // Use Git log command to get file history
            const logResult = await repository.log({
                path: relativePath,
                maxEntries: 100 // Limit to 100 commits for performance
            });

            const commits: CommitInfo[] = [];
            
            if (logResult && logResult.length > 0) {
                for (const commit of logResult) {
                    commits.push({
                        hash: commit.hash,
                        shortHash: commit.hash.substring(0, 7),
                        message: commit.message || 'No commit message',
                        author: commit.authorName || 'Unknown',
                        date: commit.authorDate ? new Date(commit.authorDate) : new Date()
                    });
                }
            }

            return commits;
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to get file history for '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GET_FILE_HISTORY_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Get diff for a file between two revisions
     */
    async getFileDiff(filePath: string, ref1?: string, ref2?: string): Promise<DiffResult> {
        try {
            const repository = await this.getRepository();
            
            // Validate file path
            if (!filePath || filePath.trim().length === 0) {
                throw new GitError(
                    'File path cannot be empty',
                    'INVALID_FILE_PATH',
                    'git'
                );
            }

            // Get repository root to make relative path
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                throw new GitError(
                    'Unable to determine repository root',
                    'REPOSITORY_ROOT_NOT_FOUND',
                    'git'
                );
            }

            // Make path relative to repository root
            const relativePath = filePath.startsWith(repoRoot) 
                ? filePath.substring(repoRoot.length + 1).replace(/\\/g, '/')
                : filePath.replace(/\\/g, '/');

            // Default refs: compare with HEAD if not specified
            const fromRef = ref1 || 'HEAD';
            const toRef = ref2 || ''; // Empty means working tree

            let oldContent = '';
            let newContent = '';

            // Get old content from ref1
            try {
                if (fromRef !== '') {
                    const oldBlob = await repository.show(fromRef, relativePath);
                    oldContent = oldBlob || '';
                }
            } catch (error) {
                // File might not exist in ref1, which is okay
                console.warn(`Could not read old file content: ${error}`);
            }

            // Get new content from ref2 or working tree
            try {
                if (toRef === '') {
                    // Read from working tree
                    const fs = require('fs');
                    const path = require('path');
                    const fullPath = path.join(repoRoot, relativePath);
                    
                    if (fs.existsSync(fullPath)) {
                        newContent = fs.readFileSync(fullPath, 'utf8');
                    }
                } else {
                    const newBlob = await repository.show(toRef, relativePath);
                    newContent = newBlob || '';
                }
            } catch (error) {
                // File might not exist in ref2 or working tree, which is okay
                console.warn(`Could not read new file content: ${error}`);
            }

            // Generate diff hunks by comparing line by line
            const hunks = this.generateDiffHunks(oldContent, newContent);

            const diffResult: DiffResult = {
                filePath: relativePath,
                oldContent,
                newContent,
                hunks,
                hasConflicts: false, // File diffs don't have conflicts unless it's a merge diff
                conflicts: undefined
            };

            return diffResult;
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to get file diff for '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GET_FILE_DIFF_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Revert changes to a specific file
     */
    async revertFile(filePath: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            
            // Validate file path
            if (!filePath || filePath.trim().length === 0) {
                throw new GitError(
                    'File path cannot be empty',
                    'INVALID_FILE_PATH',
                    'git'
                );
            }

            // Get repository root to make relative path
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                throw new GitError(
                    'Unable to determine repository root',
                    'REPOSITORY_ROOT_NOT_FOUND',
                    'git'
                );
            }

            // Make path relative to repository root
            const relativePath = filePath.startsWith(repoRoot) 
                ? filePath.substring(repoRoot.length + 1).replace(/\\/g, '/')
                : filePath.replace(/\\/g, '/');

            // Check if file has changes
            const workingTreeChanges = repository.state.workingTreeChanges || [];
            const indexChanges = repository.state.indexChanges || [];
            
            const hasWorkingTreeChanges = workingTreeChanges.some((change: any) => 
                change.uri.fsPath.endsWith(relativePath.replace(/\//g, require('path').sep))
            );
            
            const hasIndexChanges = indexChanges.some((change: any) => 
                change.uri.fsPath.endsWith(relativePath.replace(/\//g, require('path').sep))
            );

            if (!hasWorkingTreeChanges && !hasIndexChanges) {
                vscode.window.showInformationMessage(`No changes to revert for ${relativePath}`);
                return;
            }

            // Show confirmation dialog
            const confirmed = await this.dialogService.confirmFileRevert(relativePath);

            if (!confirmed) {
                return;
            }

            // Revert the file using checkout HEAD
            await repository.checkout('HEAD', [relativePath]);
            
            // Show success message
            vscode.window.showInformationMessage(`Reverted changes to ${relativePath}`);
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to revert file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'REVERT_FILE_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Get file annotation (blame) information
     */
    async getFileAnnotation(filePath: string): Promise<{
        lines: Array<{
            lineNumber: number;
            content: string;
            commit: CommitInfo;
        }>;
    }> {
        try {
            const repository = await this.getRepository();
            
            // Validate file path
            if (!filePath || filePath.trim().length === 0) {
                throw new GitError(
                    'File path cannot be empty',
                    'INVALID_FILE_PATH',
                    'git'
                );
            }

            // Get repository root to make relative path
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                throw new GitError(
                    'Unable to determine repository root',
                    'REPOSITORY_ROOT_NOT_FOUND',
                    'git'
                );
            }

            // Make path relative to repository root
            const relativePath = filePath.startsWith(repoRoot) 
                ? filePath.substring(repoRoot.length + 1).replace(/\\/g, '/')
                : filePath.replace(/\\/g, '/');

            // Read current file content
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.join(repoRoot, relativePath);
            
            if (!fs.existsSync(fullPath)) {
                throw new GitError(
                    `File not found: ${relativePath}`,
                    'FILE_NOT_FOUND',
                    'filesystem'
                );
            }

            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const lines = fileContent.split('\n');

            // Get blame information using Git blame command
            // Note: VS Code Git API might not have direct blame support, so we'll simulate it
            // by getting the last commit that modified the file
            const history = await this.getFileHistory(filePath);
            const lastCommit = history.length > 0 ? history[0] : {
                hash: 'unknown',
                shortHash: 'unknown',
                message: 'No commit found',
                author: 'Unknown',
                date: new Date()
            };

            // Create annotation result with the last commit for all lines
            // In a real implementation, we would use git blame to get per-line commit info
            const annotatedLines = lines.map((content, index) => ({
                lineNumber: index + 1,
                content,
                commit: lastCommit
            }));

            return { lines: annotatedLines };
            
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to get file annotation for '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GET_FILE_ANNOTATION_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Generate diff hunks by comparing old and new content line by line
     */
    private generateDiffHunks(oldContent: string, newContent: string): DiffHunk[] {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const hunks: DiffHunk[] = [];

        // Simple diff algorithm - in a real implementation, you'd use a more sophisticated algorithm
        let oldIndex = 0;
        let newIndex = 0;
        let currentHunk: DiffHunk | null = null;

        while (oldIndex < oldLines.length || newIndex < newLines.length) {
            const oldLine = oldIndex < oldLines.length ? oldLines[oldIndex] : undefined;
            const newLine = newIndex < newLines.length ? newLines[newIndex] : undefined;

            if (oldLine === newLine) {
                // Lines are the same
                if (currentHunk) {
                    currentHunk.lines.push({
                        type: 'unchanged',
                        content: oldLine || '',
                        oldLineNumber: oldIndex + 1,
                        newLineNumber: newIndex + 1
                    });
                }
                oldIndex++;
                newIndex++;
            } else {
                // Lines are different, start a new hunk if needed
                if (!currentHunk) {
                    currentHunk = {
                        oldStart: oldIndex + 1,
                        oldLines: 0,
                        newStart: newIndex + 1,
                        newLines: 0,
                        lines: []
                    };
                }

                if (oldLine !== undefined && newLine !== undefined) {
                    // Both lines exist but are different - treat as remove + add
                    currentHunk.lines.push({
                        type: 'removed',
                        content: oldLine,
                        oldLineNumber: oldIndex + 1,
                        newLineNumber: undefined
                    });
                    currentHunk.lines.push({
                        type: 'added',
                        content: newLine,
                        oldLineNumber: undefined,
                        newLineNumber: newIndex + 1
                    });
                    currentHunk.oldLines++;
                    currentHunk.newLines++;
                    oldIndex++;
                    newIndex++;
                } else if (oldLine !== undefined) {
                    // Line was removed
                    currentHunk.lines.push({
                        type: 'removed',
                        content: oldLine,
                        oldLineNumber: oldIndex + 1,
                        newLineNumber: undefined
                    });
                    currentHunk.oldLines++;
                    oldIndex++;
                } else if (newLine !== undefined) {
                    // Line was added
                    currentHunk.lines.push({
                        type: 'added',
                        content: newLine,
                        oldLineNumber: undefined,
                        newLineNumber: newIndex + 1
                    });
                    currentHunk.newLines++;
                    newIndex++;
                }
            }

            // If we've processed some changes and hit matching lines, close the current hunk
            if (currentHunk && currentHunk.lines.length > 0 && oldLine === newLine) {
                hunks.push(currentHunk);
                currentHunk = null;
            }
        }

        // Add the final hunk if it exists
        if (currentHunk && currentHunk.lines.length > 0) {
            hunks.push(currentHunk);
        }

        return hunks;
    }

    /**
     * Detect merge conflicts in the repository
     */
    async detectMergeConflicts(): Promise<string[]> {
        try {
            const repository = await this.getRepository();
            const conflictedFiles: string[] = [];

            // Check repository state for conflicts
            const workingTreeChanges = repository.state.workingTreeChanges || [];
            const indexChanges = repository.state.indexChanges || [];

            // Look for files with conflict status
            for (const change of [...workingTreeChanges, ...indexChanges]) {
                // VS Code Git API uses status codes similar to Git
                // Status 'C' or conflict-related statuses indicate conflicts
                if (change.status === 'C' || change.status === 'U' || 
                    (change.status === 'M' && await this.hasConflictMarkers(change.uri.fsPath))) {
                    conflictedFiles.push(change.uri.fsPath);
                }
            }

            return conflictedFiles;
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to detect merge conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CONFLICT_DETECTION_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            return [];
        }
    }

    /**
     * Get list of files with conflicts
     */
    async getConflictedFiles(): Promise<string[]> {
        return this.detectMergeConflicts();
    }

    /**
     * Get conflict regions for a specific file
     */
    async getFileConflicts(filePath: string): Promise<ConflictRegion[]> {
        try {
            // Read file content
            const fileUri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();

            // Use conflict resolver to detect conflicts
            const conflicts = this.conflictResolver.detectConflicts(content);

            // Try to auto-resolve non-conflicting changes
            const resolvedConflicts = this.conflictResolver.resolveNonConflictingChanges(conflicts);

            return resolvedConflicts;
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to get file conflicts for '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GET_FILE_CONFLICTS_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            return [];
        }
    }

    /**
     * Resolve conflicts in a file
     */
    async resolveConflicts(filePath: string, conflicts: ConflictRegion[]): Promise<void> {
        try {
            // Read current file content
            const fileUri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();

            // Apply conflict resolution
            const resolvedContent = this.conflictResolver.applyConflictResolution(content, conflicts);

            // Write resolved content back to file
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );
            edit.replace(fileUri, fullRange, resolvedContent);

            const success = await vscode.workspace.applyEdit(edit);
            if (!success) {
                throw new GitError(
                    `Failed to apply conflict resolution to '${filePath}'`,
                    'APPLY_RESOLUTION_FAILED',
                    'vscode'
                );
            }

            // Save the document
            await document.save();

            // Stage the resolved file
            const repository = await this.getRepository();
            await repository.add([filePath]);

        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to resolve conflicts in '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                'RESOLVE_CONFLICTS_FAILED',
                'git'
            );
            await this.errorHandler.handleError(gitError);
            throw gitError;
        }
    }

    /**
     * Check if repository is in merge state
     */
    async isInMergeState(): Promise<boolean> {
        try {
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                return false;
            }

            // Check for .git/MERGE_HEAD file
            const fs = require('fs').promises;
            const path = require('path');
            const mergeHeadPath = path.join(repoRoot, '.git', 'MERGE_HEAD');

            try {
                await fs.access(mergeHeadPath);
                return true;
            } catch {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if repository is in rebase state
     */
    async isInRebaseState(): Promise<boolean> {
        try {
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                return false;
            }

            // Check for .git/rebase-merge or .git/rebase-apply directories
            const fs = require('fs').promises;
            const path = require('path');
            const rebaseMergePath = path.join(repoRoot, '.git', 'rebase-merge');
            const rebaseApplyPath = path.join(repoRoot, '.git', 'rebase-apply');

            try {
                await fs.access(rebaseMergePath);
                return true;
            } catch {
                try {
                    await fs.access(rebaseApplyPath);
                    return true;
                } catch {
                    return false;
                }
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a file has conflict markers
     */
    private async hasConflictMarkers(filePath: string): Promise<boolean> {
        try {
            const fileUri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();

            // Look for Git conflict markers
            return content.includes('<<<<<<<') && 
                   content.includes('=======') && 
                   content.includes('>>>>>>>');
        } catch (error) {
            return false;
        }
    }
}
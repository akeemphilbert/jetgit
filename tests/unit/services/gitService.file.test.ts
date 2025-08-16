import { GitService } from '../../../src/services/gitService';
import { GitError, CommitInfo, DiffResult } from '../../../src/types/git';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        showWarningMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        withProgress: jest.fn()
    },
    extensions: {
        getExtension: jest.fn()
    },
    ProgressLocation: {
        Notification: 15
    }
}));

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
    join: jest.fn(),
    sep: '/'
}));

describe('GitService File Operations', () => {
    let gitService: GitService;
    let mockRepository: any;
    let mockGitExtension: any;
    let mockGitApi: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock repository
        mockRepository = {
            log: jest.fn(),
            show: jest.fn(),
            checkout: jest.fn(),
            state: {
                workingTreeChanges: [],
                indexChanges: []
            },
            rootUri: {
                fsPath: '/test/repo'
            }
        };

        // Mock Git API
        mockGitApi = {
            repositories: [mockRepository]
        };

        // Mock Git extension
        mockGitExtension = {
            exports: {
                getAPI: jest.fn().mockReturnValue(mockGitApi)
            }
        };

        // Mock VS Code extensions
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGitExtension);

        gitService = new GitService();
    });

    describe('getFileHistory', () => {
        it('should return commit history for a file', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    message: 'Fix bug in file',
                    authorName: 'John Doe',
                    authorDate: new Date('2023-01-01')
                },
                {
                    hash: 'def456ghi789',
                    message: 'Initial commit',
                    authorName: 'Jane Smith',
                    authorDate: new Date('2022-12-01')
                }
            ];

            mockRepository.log.mockResolvedValue(mockCommits);

            const result = await gitService.getFileHistory('/test/repo/src/file.ts');

            expect(mockRepository.log).toHaveBeenCalledWith({
                path: 'src/file.ts',
                maxEntries: 100
            });

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                hash: 'abc123def456',
                shortHash: 'abc123d',
                message: 'Fix bug in file',
                author: 'John Doe',
                date: new Date('2023-01-01')
            });
            expect(result[1]).toEqual({
                hash: 'def456ghi789',
                shortHash: 'def456g',
                message: 'Initial commit',
                author: 'Jane Smith',
                date: new Date('2022-12-01')
            });
        });

        it('should handle relative file paths', async () => {
            mockRepository.log.mockResolvedValue([]);

            await gitService.getFileHistory('src/file.ts');

            expect(mockRepository.log).toHaveBeenCalledWith({
                path: 'src/file.ts',
                maxEntries: 100
            });
        });

        it('should handle empty commit history', async () => {
            mockRepository.log.mockResolvedValue([]);

            const result = await gitService.getFileHistory('/test/repo/src/file.ts');

            expect(result).toEqual([]);
        });

        it('should handle commits with missing data', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    message: null,
                    authorName: null,
                    authorDate: null
                }
            ];

            mockRepository.log.mockResolvedValue(mockCommits);

            const result = await gitService.getFileHistory('/test/repo/src/file.ts');

            expect(result[0]).toEqual({
                hash: 'abc123def456',
                shortHash: 'abc123d',
                message: 'No commit message',
                author: 'Unknown',
                date: expect.any(Date)
            });
        });

        it('should throw error for empty file path', async () => {
            await expect(gitService.getFileHistory('')).rejects.toThrow(GitError);
            await expect(gitService.getFileHistory('   ')).rejects.toThrow(GitError);
        });

        it('should handle repository errors', async () => {
            mockRepository.log.mockRejectedValue(new Error('Git log failed'));

            await expect(gitService.getFileHistory('/test/repo/src/file.ts')).rejects.toThrow(GitError);
        });
    });

    describe('getFileDiff', () => {
        beforeEach(() => {
            const fs = require('fs');
            const path = require('path');
            
            (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('new content\nline 2\nline 3');
        });

        it('should return diff between HEAD and working tree', async () => {
            mockRepository.show.mockResolvedValue('old content\nline 2\nline 4');

            const result = await gitService.getFileDiff('/test/repo/src/file.ts');

            expect(mockRepository.show).toHaveBeenCalledWith('HEAD', 'src/file.ts');
            expect(result.filePath).toBe('src/file.ts');
            expect(result.oldContent).toBe('old content\nline 2\nline 4');
            expect(result.newContent).toBe('new content\nline 2\nline 3');
            expect(result.hasConflicts).toBe(false);
            expect(result.hunks).toBeDefined();
        });

        it('should return diff between two specific refs', async () => {
            mockRepository.show
                .mockResolvedValueOnce('old content')
                .mockResolvedValueOnce('new content');

            const result = await gitService.getFileDiff('/test/repo/src/file.ts', 'ref1', 'ref2');

            expect(mockRepository.show).toHaveBeenCalledWith('ref1', 'src/file.ts');
            expect(mockRepository.show).toHaveBeenCalledWith('ref2', 'src/file.ts');
            expect(result.oldContent).toBe('old content');
            expect(result.newContent).toBe('new content');
        });

        it('should handle file not found in refs', async () => {
            mockRepository.show.mockRejectedValue(new Error('File not found'));
            
            const result = await gitService.getFileDiff('/test/repo/src/file.ts');

            expect(result.oldContent).toBe('');
            expect(result.newContent).toBe('new content\nline 2\nline 3');
        });

        it('should handle file not found in working tree', async () => {
            const fs = require('fs');
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            
            mockRepository.show.mockResolvedValue('old content');

            const result = await gitService.getFileDiff('/test/repo/src/file.ts');

            expect(result.oldContent).toBe('old content');
            expect(result.newContent).toBe('');
        });

        it('should throw error for empty file path', async () => {
            await expect(gitService.getFileDiff('')).rejects.toThrow(GitError);
        });

        it('should generate correct diff hunks', async () => {
            mockRepository.show.mockResolvedValue('line 1\nline 2\nline 3');
            
            const fs = require('fs');
            (fs.readFileSync as jest.Mock).mockReturnValue('line 1\nmodified line 2\nline 3\nline 4');

            const result = await gitService.getFileDiff('/test/repo/src/file.ts');

            expect(result.hunks.length).toBeGreaterThan(0);
            // Check that we have the expected changes in the hunks
            const allLines = result.hunks.flatMap(hunk => hunk.lines);
            expect(allLines).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'removed', content: 'line 2' }),
                    expect.objectContaining({ type: 'added', content: 'modified line 2' }),
                    expect.objectContaining({ type: 'added', content: 'line 4' })
                ])
            );
        });
    });

    describe('revertFile', () => {
        it('should revert file with confirmation', async () => {
            mockRepository.state.workingTreeChanges = [
                { uri: { fsPath: '/test/repo/src/file.ts' } }
            ];

            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Revert');

            await gitService.revertFile('/test/repo/src/file.ts');

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'Are you sure you want to revert changes to file.ts? This action cannot be undone.',
                { modal: true },
                'Revert',
                'Cancel'
            );
            expect(mockRepository.checkout).toHaveBeenCalledWith('HEAD', ['src/file.ts']);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Reverted changes to src/file.ts');
        });

        it('should not revert if user cancels', async () => {
            mockRepository.state.workingTreeChanges = [
                { uri: { fsPath: '/test/repo/src/file.ts' } }
            ];

            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');

            await gitService.revertFile('/test/repo/src/file.ts');

            expect(mockRepository.checkout).not.toHaveBeenCalled();
        });

        it('should handle file with no changes', async () => {
            mockRepository.state.workingTreeChanges = [];
            mockRepository.state.indexChanges = [];

            await gitService.revertFile('/test/repo/src/file.ts');

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to revert for src/file.ts');
            expect(mockRepository.checkout).not.toHaveBeenCalled();
        });

        it('should handle staged changes', async () => {
            mockRepository.state.workingTreeChanges = [];
            mockRepository.state.indexChanges = [
                { uri: { fsPath: '/test/repo/src/file.ts' } }
            ];

            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Revert');

            await gitService.revertFile('/test/repo/src/file.ts');

            expect(mockRepository.checkout).toHaveBeenCalledWith('HEAD', ['src/file.ts']);
        });

        it('should throw error for empty file path', async () => {
            await expect(gitService.revertFile('')).rejects.toThrow(GitError);
        });

        it('should handle checkout errors', async () => {
            mockRepository.state.workingTreeChanges = [
                { uri: { fsPath: '/test/repo/src/file.ts' } }
            ];

            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Revert');
            mockRepository.checkout.mockRejectedValue(new Error('Checkout failed'));

            await expect(gitService.revertFile('/test/repo/src/file.ts')).rejects.toThrow(GitError);
        });
    });

    describe('getFileAnnotation', () => {
        beforeEach(() => {
            const fs = require('fs');
            const path = require('path');
            
            (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('line 1\nline 2\nline 3');
        });

        it('should return file annotation with commit info', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    message: 'Last commit',
                    authorName: 'John Doe',
                    authorDate: new Date('2023-01-01')
                }
            ];

            mockRepository.log.mockResolvedValue(mockCommits);

            const result = await gitService.getFileAnnotation('/test/repo/src/file.ts');

            expect(result.lines).toHaveLength(3);
            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                content: 'line 1',
                commit: {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    message: 'Last commit',
                    author: 'John Doe',
                    date: new Date('2023-01-01')
                }
            });
        });

        it('should handle file with no commit history', async () => {
            mockRepository.log.mockResolvedValue([]);

            const result = await gitService.getFileAnnotation('/test/repo/src/file.ts');

            expect(result.lines[0].commit).toEqual({
                hash: 'unknown',
                shortHash: 'unknown',
                message: 'No commit found',
                author: 'Unknown',
                date: expect.any(Date)
            });
        });

        it('should throw error for non-existent file', async () => {
            const fs = require('fs');
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            await expect(gitService.getFileAnnotation('/test/repo/src/file.ts')).rejects.toThrow(GitError);
        });

        it('should throw error for empty file path', async () => {
            await expect(gitService.getFileAnnotation('')).rejects.toThrow(GitError);
        });
    });

    describe('generateDiffHunks', () => {
        it('should generate hunks for simple changes', () => {
            const gitServiceInstance = gitService as any;
            const oldContent = 'line 1\nline 2\nline 3';
            const newContent = 'line 1\nmodified line 2\nline 3';

            const hunks = gitServiceInstance.generateDiffHunks(oldContent, newContent);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].lines).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'removed', content: 'line 2' }),
                    expect.objectContaining({ type: 'added', content: 'modified line 2' })
                ])
            );
        });

        it('should handle added lines', () => {
            const gitServiceInstance = gitService as any;
            const oldContent = 'line 1\nline 2';
            const newContent = 'line 1\nline 2\nline 3';

            const hunks = gitServiceInstance.generateDiffHunks(oldContent, newContent);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].lines).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'added', content: 'line 3' })
                ])
            );
        });

        it('should handle removed lines', () => {
            const gitServiceInstance = gitService as any;
            const oldContent = 'line 1\nline 2\nline 3';
            const newContent = 'line 1\nline 3';

            const hunks = gitServiceInstance.generateDiffHunks(oldContent, newContent);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].lines).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'removed', content: 'line 2' })
                ])
            );
        });

        it('should handle identical content', () => {
            const gitServiceInstance = gitService as any;
            const content = 'line 1\nline 2\nline 3';

            const hunks = gitServiceInstance.generateDiffHunks(content, content);

            expect(hunks).toHaveLength(0);
        });

        it('should handle empty content', () => {
            const gitServiceInstance = gitService as any;

            const hunks = gitServiceInstance.generateDiffHunks('', '');

            expect(hunks).toHaveLength(0);
        });
    });
});
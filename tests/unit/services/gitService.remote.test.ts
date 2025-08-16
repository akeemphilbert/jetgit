import { GitService } from '../../../src/services/gitService';
import { Remote, GitError } from '../../../src/types/git';
import * as vscode from 'vscode';

// Mock VS Code
jest.mock('vscode', () => ({
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
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

describe('GitService - Remote Operations', () => {
    let gitService: GitService;
    let mockRepository: any;
    let mockGitExtension: any;
    let mockGitApi: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock repository
        mockRepository = {
            state: {
                remotes: [],
                refs: []
            },
            addRemote: jest.fn(),
            removeRemote: jest.fn()
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

        // Mock vscode.extensions.getExtension
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGitExtension);

        gitService = new GitService();
    });

    describe('getRemotes', () => {
        it('should return empty array when no remotes are configured', async () => {
            mockRepository.state.remotes = [];

            const remotes = await gitService.getRemotes();

            expect(remotes).toEqual([]);
        });

        it('should return configured remotes with branch information', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                },
                {
                    name: 'upstream',
                    fetchUrl: 'https://github.com/original/repo.git',
                    pushUrl: 'https://github.com/original/repo.git'
                }
            ];

            // Mock branches for remote branch detection
            mockRepository.state.refs = [
                {
                    type: 2, // Remote branch
                    name: 'main',
                    fullName: 'origin/main',
                    remote: 'origin'
                },
                {
                    type: 2, // Remote branch
                    name: 'develop',
                    fullName: 'origin/develop',
                    remote: 'origin'
                },
                {
                    type: 2, // Remote branch
                    name: 'main',
                    fullName: 'upstream/main',
                    remote: 'upstream'
                }
            ];

            const remotes = await gitService.getRemotes();

            expect(remotes).toHaveLength(2);
            expect(remotes[0]).toEqual({
                name: 'origin',
                fetchUrl: 'https://github.com/user/repo.git',
                pushUrl: 'https://github.com/user/repo.git',
                branches: ['main', 'develop']
            });
            expect(remotes[1]).toEqual({
                name: 'upstream',
                fetchUrl: 'https://github.com/original/repo.git',
                pushUrl: 'https://github.com/original/repo.git',
                branches: ['main']
            });
        });

        it('should handle remotes with different fetch and push URLs', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'git@github.com:user/repo.git'
                }
            ];

            const remotes = await gitService.getRemotes();

            expect(remotes).toHaveLength(1);
            expect(remotes[0]).toEqual({
                name: 'origin',
                fetchUrl: 'https://github.com/user/repo.git',
                pushUrl: 'git@github.com:user/repo.git',
                branches: []
            });
        });

        it('should handle remotes with missing URLs', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git'
                    // pushUrl is missing
                }
            ];

            const remotes = await gitService.getRemotes();

            expect(remotes).toHaveLength(1);
            expect(remotes[0]).toEqual({
                name: 'origin',
                fetchUrl: 'https://github.com/user/repo.git',
                pushUrl: 'https://github.com/user/repo.git',
                branches: []
            });
        });

        it('should throw GitError when repository is not available', async () => {
            mockGitApi.repositories = [];

            await expect(gitService.getRemotes()).rejects.toThrow(GitError);
            await expect(gitService.getRemotes()).rejects.toThrow('No Git repository found in workspace');
        });

        it('should handle errors during remote retrieval', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                }
            ];

            // Mock getBranches to throw an error
            jest.spyOn(gitService, 'getBranches').mockRejectedValue(new Error('Network error'));

            const remotes = await gitService.getRemotes();

            // Should still return remote info but with empty branches array
            expect(remotes).toHaveLength(1);
            expect(remotes[0].branches).toEqual([]);
        });
    });

    describe('addRemote', () => {
        beforeEach(() => {
            mockRepository.state.remotes = [];
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);
        });

        it('should successfully add a new remote with HTTPS URL', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            await gitService.addRemote('origin', 'https://github.com/user/repo.git');

            expect(mockRepository.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/user/repo.git');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Successfully added remote 'origin'");
        });

        it('should successfully add a new remote with SSH URL', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            await gitService.addRemote('upstream', 'git@github.com:original/repo.git');

            expect(mockRepository.addRemote).toHaveBeenCalledWith('upstream', 'git@github.com:original/repo.git');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Successfully added remote 'upstream'");
        });

        it('should trim whitespace from name and URL', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            await gitService.addRemote('  origin  ', '  https://github.com/user/repo.git  ');

            expect(mockRepository.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/user/repo.git');
        });

        it('should throw error for empty remote name', async () => {
            await expect(gitService.addRemote('', 'https://github.com/user/repo.git')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('', 'https://github.com/user/repo.git')).rejects.toThrow('Remote name cannot be empty');
        });

        it('should throw error for whitespace-only remote name', async () => {
            await expect(gitService.addRemote('   ', 'https://github.com/user/repo.git')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('   ', 'https://github.com/user/repo.git')).rejects.toThrow('Remote name cannot be empty');
        });

        it('should throw error for invalid remote name with special characters', async () => {
            await expect(gitService.addRemote('origin@#$', 'https://github.com/user/repo.git')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('origin@#$', 'https://github.com/user/repo.git')).rejects.toThrow('Remote name can only contain letters, numbers, dots, underscores, and hyphens');
        });

        it('should allow valid remote names with allowed characters', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            await gitService.addRemote('origin-2', 'https://github.com/user/repo.git');
            await gitService.addRemote('upstream_fork', 'https://github.com/user/repo.git');
            await gitService.addRemote('remote.backup', 'https://github.com/user/repo.git');

            expect(mockRepository.addRemote).toHaveBeenCalledTimes(3);
        });

        it('should throw error for empty URL', async () => {
            await expect(gitService.addRemote('origin', '')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('origin', '')).rejects.toThrow('URL cannot be empty');
        });

        it('should throw error for invalid URL format', async () => {
            await expect(gitService.addRemote('origin', 'invalid-url')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('origin', 'invalid-url')).rejects.toThrow('Invalid URL format');
        });

        it('should accept various valid URL formats', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            const validUrls = [
                'https://github.com/user/repo.git',
                'https://github.com/user/repo',
                'git@github.com:user/repo.git',
                'git@github.com:user/repo',
                'ssh://git@github.com/user/repo.git',
                'git://github.com/user/repo.git',
                'file:///path/to/repo',
                '/absolute/path/to/repo',
                './relative/path/to/repo',
                '../relative/path/to/repo'
            ];

            for (const url of validUrls) {
                await gitService.addRemote(`remote${validUrls.indexOf(url)}`, url);
            }

            expect(mockRepository.addRemote).toHaveBeenCalledTimes(validUrls.length);
        });

        it('should throw error when remote already exists', async () => {
            // Mock existing remote
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/existing/repo.git',
                    pushUrl: 'https://github.com/existing/repo.git'
                }
            ];

            await expect(gitService.addRemote('origin', 'https://github.com/user/repo.git')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('origin', 'https://github.com/user/repo.git')).rejects.toThrow("Remote 'origin' already exists");
        });

        it('should handle repository addRemote failure', async () => {
            mockRepository.addRemote.mockRejectedValue(new Error('Permission denied'));

            await expect(gitService.addRemote('origin', 'https://github.com/user/repo.git')).rejects.toThrow(GitError);
            await expect(gitService.addRemote('origin', 'https://github.com/user/repo.git')).rejects.toThrow("Failed to add remote 'origin'");
        });
    });

    describe('removeRemote', () => {
        beforeEach(() => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Remove');
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);
        });

        it('should successfully remove an existing remote', async () => {
            // Mock existing remote
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                }
            ];
            mockRepository.removeRemote.mockResolvedValue(undefined);

            await gitService.removeRemote('origin');

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                "Are you sure you want to remove remote 'origin'?",
                { modal: false },
                'Remove',
                'Cancel'
            );
            expect(mockRepository.removeRemote).toHaveBeenCalledWith('origin');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Successfully removed remote 'origin'");
        });

        it('should trim whitespace from remote name', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                }
            ];
            mockRepository.removeRemote.mockResolvedValue(undefined);

            await gitService.removeRemote('  origin  ');

            expect(mockRepository.removeRemote).toHaveBeenCalledWith('origin');
        });

        it('should throw error for empty remote name', async () => {
            await expect(gitService.removeRemote('')).rejects.toThrow(GitError);
            await expect(gitService.removeRemote('')).rejects.toThrow('Remote name cannot be empty');
        });

        it('should throw error for whitespace-only remote name', async () => {
            await expect(gitService.removeRemote('   ')).rejects.toThrow(GitError);
            await expect(gitService.removeRemote('   ')).rejects.toThrow('Remote name cannot be empty');
        });

        it('should throw error when remote does not exist', async () => {
            mockRepository.state.remotes = [];

            await expect(gitService.removeRemote('nonexistent')).rejects.toThrow(GitError);
            await expect(gitService.removeRemote('nonexistent')).rejects.toThrow("Remote 'nonexistent' not found");
        });

        it('should cancel removal when user chooses Cancel', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                }
            ];
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');

            await gitService.removeRemote('origin');

            expect(mockRepository.removeRemote).not.toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });

        it('should cancel removal when user dismisses dialog', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                }
            ];
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

            await gitService.removeRemote('origin');

            expect(mockRepository.removeRemote).not.toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });

        it('should handle repository removeRemote failure', async () => {
            mockRepository.state.remotes = [
                {
                    name: 'origin',
                    fetchUrl: 'https://github.com/user/repo.git',
                    pushUrl: 'https://github.com/user/repo.git'
                }
            ];
            mockRepository.removeRemote.mockRejectedValue(new Error('Permission denied'));

            await expect(gitService.removeRemote('origin')).rejects.toThrow(GitError);
            await expect(gitService.removeRemote('origin')).rejects.toThrow("Failed to remove remote 'origin'");
        });
    });

    describe('URL validation', () => {
        it('should validate HTTPS URLs correctly', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            // Valid HTTPS URLs
            await expect(gitService.addRemote('test1', 'https://github.com/user/repo.git')).resolves.not.toThrow();
            await expect(gitService.addRemote('test2', 'https://gitlab.com/user/repo.git')).resolves.not.toThrow();
            await expect(gitService.addRemote('test3', 'http://localhost:3000/repo.git')).resolves.not.toThrow();

            // Invalid HTTPS URLs
            await expect(gitService.addRemote('test4', 'https://')).rejects.toThrow('Invalid URL format');
            await expect(gitService.addRemote('test5', 'https://invalid url')).rejects.toThrow('Invalid HTTPS URL format');
        });

        it('should validate SSH URLs correctly', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            // Valid SSH URLs
            await expect(gitService.addRemote('test1', 'git@github.com:user/repo.git')).resolves.not.toThrow();
            await expect(gitService.addRemote('test2', 'git@gitlab.com:user/repo')).resolves.not.toThrow();
            await expect(gitService.addRemote('test3', 'ssh://git@github.com/user/repo.git')).resolves.not.toThrow();
        });

        it('should validate local paths correctly', async () => {
            mockRepository.addRemote.mockResolvedValue(undefined);

            // Valid local paths
            await expect(gitService.addRemote('test1', '/absolute/path/to/repo')).resolves.not.toThrow();
            await expect(gitService.addRemote('test2', './relative/path')).resolves.not.toThrow();
            await expect(gitService.addRemote('test3', '../parent/repo')).resolves.not.toThrow();
            await expect(gitService.addRemote('test4', 'file:///path/to/repo')).resolves.not.toThrow();
        });
    });
});
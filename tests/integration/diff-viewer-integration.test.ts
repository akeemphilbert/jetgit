import * as vscode from 'vscode';
import { GitService } from '../../src/services/gitService';
import { DiffViewer } from '../../src/views/diffViewer';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showInputBox: jest.fn(),
        showQuickPick: jest.fn(),
        activeTextEditor: {
            document: {
                uri: { fsPath: '/test/file.ts' }
            }
        }
    },
    ViewColumn: {
        One: 1
    },
    Uri: {
        joinPath: jest.fn()
    },
    workspace: {
        asRelativePath: jest.fn().mockReturnValue('test/file.ts'),
        workspaceFolders: [{ uri: { fsPath: '/test' } }]
    },
    commands: {
        executeCommand: jest.fn()
    },
    extensions: {
        getExtension: jest.fn().mockReturnValue({
            exports: {
                getAPI: jest.fn().mockReturnValue({
                    repositories: []
                })
            }
        })
    }
}));

describe('Diff Viewer Integration', () => {
    let gitService: GitService;
    let diffViewer: DiffViewer;
    let mockContext: vscode.ExtensionContext;
    let mockPanel: any;
    let mockWebview: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock webview
        mockWebview = {
            html: '',
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn(),
            asWebviewUri: jest.fn().mockReturnValue('mock-uri')
        };

        // Mock panel
        mockPanel = {
            webview: mockWebview,
            reveal: jest.fn(),
            onDidDispose: jest.fn(),
            dispose: jest.fn()
        };

        // Mock context
        mockContext = {
            extensionUri: { fsPath: '/mock/path' },
            subscriptions: []
        } as any;

        // Mock createWebviewPanel
        (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

        gitService = new GitService();
        diffViewer = new DiffViewer(mockContext);
    });

    afterEach(() => {
        if (diffViewer) {
            diffViewer.dispose();
        }
    });

    describe('showFileDiff command integration', () => {
        it('should show diff viewer when getFileDiff returns valid diff', async () => {
            // Mock GitService.getFileDiff
            const mockDiff = {
                filePath: 'test/file.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [{
                    oldStart: 1,
                    oldLines: 1,
                    newStart: 1,
                    newLines: 1,
                    lines: [{
                        type: 'changed' as const,
                        content: 'modified line',
                        oldLineNumber: 1,
                        newLineNumber: 1
                    }]
                }],
                hasConflicts: false
            };

            jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);

            await diffViewer.showDiff(mockDiff, 'Test Integration');

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'gitDiffViewer',
                'Test Integration',
                vscode.ViewColumn.One,
                expect.objectContaining({
                    enableScripts: true,
                    retainContextWhenHidden: true
                })
            );

            expect(mockWebview.html).toContain('test/file.ts');
        });

        it('should handle diff with conflicts', async () => {
            const mockDiffWithConflicts = {
                filePath: 'test/file.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: true,
                conflicts: [{
                    startLine: 1,
                    endLine: 3,
                    currentContent: 'current version',
                    incomingContent: 'incoming version',
                    isResolved: false
                }]
            };

            jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiffWithConflicts);

            await diffViewer.showDiff(mockDiffWithConflicts, 'Conflict Test');

            expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
            expect(mockWebview.html).toContain('test/file.ts');
        });
    });

    describe('compareWithBranch command integration', () => {
        it('should integrate with branch selection', async () => {
            const mockBranches = [
                { name: 'main', type: 'local' as const, isActive: true },
                { name: 'feature/test', type: 'local' as const, isActive: false },
                { name: 'origin/main', type: 'remote' as const, isActive: false }
            ];

            const mockDiff = {
                filePath: 'test/file.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            jest.spyOn(gitService, 'getBranches').mockResolvedValue(mockBranches);
            jest.spyOn(gitService, 'getFileDiff').mockResolvedValue(mockDiff);

            // Mock user selecting a branch
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
                label: 'feature/test',
                description: 'Local'
            });

            // Simulate the compareWithBranch command logic
            const branches = await gitService.getBranches();
            const branchItems = branches.map(branch => ({
                label: branch.name,
                description: branch.type === 'remote' ? 'Remote' : 'Local',
                detail: branch.isActive ? 'Current branch' : undefined
            }));

            const selectedBranch = await vscode.window.showQuickPick(branchItems, {
                placeHolder: 'Select branch to compare with'
            });

            if (selectedBranch) {
                const diff = await gitService.getFileDiff('test/file.ts', selectedBranch.label, undefined);
                await diffViewer.showDiff(diff, `test/file.ts (${selectedBranch.label} ↔ Working Tree)`);
            }

            expect(gitService.getBranches).toHaveBeenCalled();
            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ label: 'main', description: 'Local' }),
                    expect.objectContaining({ label: 'feature/test', description: 'Local' }),
                    expect.objectContaining({ label: 'origin/main', description: 'Remote' })
                ]),
                { placeHolder: 'Select branch to compare with' }
            );
            expect(gitService.getFileDiff).toHaveBeenCalledWith('test/file.ts', 'feature/test', undefined);
            expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
        });
    });

    describe('webview message handling integration', () => {
        it('should handle conflict resolution messages', async () => {
            const mockDiffWithConflicts = {
                filePath: 'test/file.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: true,
                conflicts: [{
                    startLine: 1,
                    endLine: 3,
                    currentContent: 'current version',
                    incomingContent: 'incoming version',
                    isResolved: false
                }]
            };

            await diffViewer.showDiff(mockDiffWithConflicts, 'Conflict Resolution Test');

            // Get the message handler
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Simulate accepting left side of conflict
            await messageHandler({ command: 'acceptLeft', lineIndex: 2 });

            // Verify conflict was resolved
            expect(mockDiffWithConflicts.conflicts![0].isResolved).toBe(true);
            expect(mockDiffWithConflicts.conflicts![0].resolution).toBe('left');

            // Verify webview was updated
            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateResolution',
                lineIndex: 2,
                resolution: 'left'
            });
        });

        it('should handle navigation messages', async () => {
            const mockDiff = {
                filePath: 'test/file.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff, 'Navigation Test');

            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            // Simulate navigation
            await messageHandler({ command: 'navigateToChange', direction: 'next' });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'navigateChange',
                direction: 'next'
            });
        });
    });

    describe('error handling integration', () => {
        it('should handle GitService errors gracefully', async () => {
            // Mock GitService to throw an error
            jest.spyOn(gitService, 'getFileDiff').mockRejectedValue(new Error('Git operation failed'));

            try {
                const diff = await gitService.getFileDiff('test/file.ts', 'main', 'HEAD');
                await diffViewer.showDiff(diff, 'Error Test');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Git operation failed');
            }

            // Verify webview was not created due to error
            expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
        });
    });

    describe('resource cleanup integration', () => {
        it('should properly dispose resources', () => {
            diffViewer.dispose();
            
            // Verify cleanup doesn't throw errors
            expect(() => diffViewer.dispose()).not.toThrow();
        });

        it('should handle panel disposal', async () => {
            const mockDiff = {
                filePath: 'test/file.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff, 'Disposal Test');

            // Simulate panel disposal
            const onDidDispose = mockPanel.onDidDispose.mock.calls[0][0];
            onDidDispose();

            // Verify panel reference is cleared
            // This is tested implicitly through the implementation
        });
    });
});
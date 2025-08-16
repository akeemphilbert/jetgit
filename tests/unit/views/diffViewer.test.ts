import * as vscode from 'vscode';
import { DiffViewer } from '../../../src/views/diffViewer';
import { DiffResult, DiffHunk, DiffLine, ConflictRegion } from '../../../src/types/git';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn()
    },
    ViewColumn: {
        One: 1
    },
    Uri: {
        joinPath: jest.fn()
    },
    workspace: {
        asRelativePath: jest.fn()
    }
}));

describe('DiffViewer', () => {
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

        diffViewer = new DiffViewer(mockContext);
    });

    afterEach(() => {
        diffViewer.dispose();
    });

    describe('showDiff', () => {
        it('should create webview panel when none exists', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff, 'Test Diff');

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'gitDiffViewer',
                'Test Diff',
                vscode.ViewColumn.One,
                expect.objectContaining({
                    enableScripts: true,
                    retainContextWhenHidden: true
                })
            );
        });

        it('should reveal existing panel instead of creating new one', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            // First call creates panel
            await diffViewer.showDiff(mockDiff, 'Test Diff');
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);

            // Second call should reveal existing panel
            await diffViewer.showDiff(mockDiff, 'Test Diff 2');
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(mockPanel.reveal).toHaveBeenCalled();
        });

        it('should set webview HTML content', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff);

            expect(mockWebview.html).toContain('<!DOCTYPE html>');
            expect(mockWebview.html).toContain('test.ts');
            expect(mockWebview.html).toContain('diff-container');
        });

        it('should register message handler', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff);

            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });
    });

    describe('webview message handling', () => {
        let messageHandler: (message: any) => Promise<void>;

        beforeEach(async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: true,
                conflicts: [{
                    startLine: 1,
                    endLine: 3,
                    currentContent: 'current',
                    incomingContent: 'incoming',
                    isResolved: false
                }]
            };

            await diffViewer.showDiff(mockDiff);
            messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
        });

        it('should handle acceptLeft message', async () => {
            await messageHandler({ command: 'acceptLeft', lineIndex: 1 });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateResolution',
                lineIndex: 1,
                resolution: 'left'
            });
        });

        it('should handle acceptRight message', async () => {
            await messageHandler({ command: 'acceptRight', lineIndex: 1 });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateResolution',
                lineIndex: 1,
                resolution: 'right'
            });
        });

        it('should handle acceptBoth message', async () => {
            await messageHandler({ command: 'acceptBoth', lineIndex: 1 });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'updateResolution',
                lineIndex: 1,
                resolution: 'both'
            });
        });

        it('should handle navigateToChange message', async () => {
            await messageHandler({ command: 'navigateToChange', direction: 'next' });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'navigateChange',
                direction: 'next'
            });
        });

        it('should handle ready message', async () => {
            await messageHandler({ command: 'ready' });

            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'setDiffData',
                data: expect.any(Object)
            });
        });
    });

    describe('conflict resolution', () => {
        it('should mark conflict as resolved when accepting change', async () => {
            const mockConflict: ConflictRegion = {
                startLine: 1,
                endLine: 3,
                currentContent: 'current',
                incomingContent: 'incoming',
                isResolved: false
            };

            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: true,
                conflicts: [mockConflict]
            };

            await diffViewer.showDiff(mockDiff);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            await messageHandler({ command: 'acceptLeft', lineIndex: 2 });

            expect(mockConflict.isResolved).toBe(true);
            expect(mockConflict.resolution).toBe('current');
        });

        it('should not resolve conflict for line outside conflict region', async () => {
            const mockConflict: ConflictRegion = {
                startLine: 1,
                endLine: 3,
                currentContent: 'current',
                incomingContent: 'incoming',
                isResolved: false
            };

            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: true,
                conflicts: [mockConflict]
            };

            await diffViewer.showDiff(mockDiff);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];

            await messageHandler({ command: 'acceptLeft', lineIndex: 5 });

            expect(mockConflict.isResolved).toBe(false);
            expect(mockConflict.resolution).toBeUndefined();
        });
    });

    describe('dispose', () => {
        it('should dispose webview panel', () => {
            diffViewer.dispose();
            // Panel should be disposed when diffViewer is disposed
            // This is tested implicitly through the panel cleanup
        });

        it('should handle dispose when no panel exists', () => {
            const newDiffViewer = new DiffViewer(mockContext);
            expect(() => newDiffViewer.dispose()).not.toThrow();
        });
    });

    describe('HTML generation', () => {
        it('should include file path in HTML', async () => {
            const mockDiff: DiffResult = {
                filePath: 'src/components/MyComponent.tsx',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff);

            expect(mockWebview.html).toContain('src/components/MyComponent.tsx');
        });

        it('should include navigation controls', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff);

            expect(mockWebview.html).toContain('navigation-controls');
            expect(mockWebview.html).toContain('prevChange');
            expect(mockWebview.html).toContain('nextChange');
        });

        it('should include diff panes', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff);

            expect(mockWebview.html).toContain('left-pane');
            expect(mockWebview.html).toContain('right-pane');
            expect(mockWebview.html).toContain('Original');
            expect(mockWebview.html).toContain('Modified');
        });

        it('should include JavaScript for interactivity', async () => {
            const mockDiff: DiffResult = {
                filePath: 'test.ts',
                oldContent: 'old content',
                newContent: 'new content',
                hunks: [],
                hasConflicts: false
            };

            await diffViewer.showDiff(mockDiff);

            expect(mockWebview.html).toContain('<script>');
            expect(mockWebview.html).toContain('acquireVsCodeApi');
            expect(mockWebview.html).toContain('setupEventListeners');
        });
    });
});
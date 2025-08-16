import * as vscode from 'vscode';
import { DiffResult, DiffHunk, DiffLine, ConflictRegion } from '../types/git';
import { ConflictResolver } from '../services/conflictResolver';

export class DiffViewer {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private currentDiff: DiffResult | undefined;
    private conflictResolver: ConflictResolver;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.conflictResolver = new ConflictResolver();
    }

    public async showDiff(diff: DiffResult, title: string = 'Git Diff'): Promise<void> {
        this.currentDiff = diff;
        
        // If the diff has conflicts, try to auto-resolve them
        if (diff.hasConflicts && diff.conflicts) {
            const originalConflictCount = diff.conflicts.length;
            diff.conflicts = this.conflictResolver.resolveNonConflictingChanges(diff.conflicts);
            
            // Generate feedback for auto-resolved conflicts
            const autoResolutionFeedback = this.conflictResolver.generateAutoResolutionFeedback(diff.conflicts);
            if (autoResolutionFeedback.details.length > 0) {
                // Show notification about auto-resolved conflicts
                vscode.window.showInformationMessage(
                    `${autoResolutionFeedback.message}. ${diff.conflicts.filter(c => !c.isResolved).length} conflicts remain.`,
                    'Show Details'
                ).then(selection => {
                    if (selection === 'Show Details') {
                        const details = autoResolutionFeedback.details.map(d => d.feedback).join('\n');
                        vscode.window.showInformationMessage(details);
                    }
                });
            }
        }
        
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'gitDiffViewer',
                title,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'resources')
                    ]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            this.panel.webview.onDidReceiveMessage(
                message => this.handleWebviewMessage(message),
                undefined,
                this.context.subscriptions
            );
        }

        this.panel.webview.html = this.getWebviewContent(diff);
    }

    public async showConflicts(filePath: string, conflicts: ConflictRegion[], title: string = 'Resolve Conflicts'): Promise<void> {
        // Read file content to create a diff result
        const fileUri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();

        // Create a DiffResult from the conflicts
        const diffResult: DiffResult = {
            filePath,
            oldContent: content,
            newContent: content,
            hunks: this.createHunksFromConflicts(content, conflicts),
            hasConflicts: true,
            conflicts: conflicts
        };

        await this.showDiff(diffResult, title);
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'acceptLeft':
                await this.acceptChange(message.lineIndex, 'left');
                break;
            case 'acceptRight':
                await this.acceptChange(message.lineIndex, 'right');
                break;
            case 'acceptBoth':
                await this.acceptChange(message.lineIndex, 'both');
                break;
            case 'navigateToChange':
                this.navigateToChange(message.direction);
                break;
            case 'completeMerge':
                await this.completeMerge();
                break;
            case 'ready':
                // Webview is ready, send initial data
                this.sendDiffData();
                break;
        }
    }

    private async acceptChange(lineIndex: number, side: 'left' | 'right' | 'both'): Promise<void> {
        if (!this.currentDiff) {
            return;
        }

        // Find the conflict region containing this line
        const conflict = this.currentDiff.conflicts?.find(c => 
            lineIndex >= c.startLine && lineIndex <= c.endLine
        );

        if (conflict) {
            conflict.isResolved = true;
            // Map UI actions to resolution types
            switch (side) {
                case 'left':
                    conflict.resolution = 'current';
                    break;
                case 'right':
                    conflict.resolution = 'incoming';
                    break;
                case 'both':
                    conflict.resolution = 'both';
                    break;
            }
            conflict.autoResolved = false; // This is a manual resolution
            
            // Update the webview to reflect the resolution
            this.panel?.webview.postMessage({
                command: 'updateResolution',
                lineIndex,
                resolution: side
            });

            // Check if all conflicts are resolved and provide feedback
            const resolutionState = this.conflictResolver.getConflictResolutionState(this.currentDiff.conflicts || []);
            this.panel?.webview.postMessage({
                command: 'updateResolutionState',
                state: resolutionState
            });
        }
    }

    private navigateToChange(direction: 'next' | 'previous'): void {
        this.panel?.webview.postMessage({
            command: 'navigateChange',
            direction
        });
    }

    private sendDiffData(): void {
        if (!this.currentDiff || !this.panel) {
            return;
        }

        this.panel.webview.postMessage({
            command: 'setDiffData',
            data: this.currentDiff
        });
    }

    private getWebviewContent(diff: DiffResult): string {
        const styleUri = this.panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'diff-viewer.css')
        );
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Git Diff Viewer</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div class="diff-container">
                <div class="diff-header">
                    <div class="file-path">${diff.filePath}</div>
                    <div class="navigation-controls">
                        <button id="prevChange" class="nav-button" title="Previous Change">⬆</button>
                        <button id="nextChange" class="nav-button" title="Next Change">⬇</button>
                        <span id="changeCounter" class="change-counter">0 / 0</span>
                    </div>
                </div>
                
                <div class="resolution-status" id="resolutionStatus" style="display: none;">
                    <div class="status-content">
                        <span class="status-icon">ℹ️</span>
                        <span class="status-message" id="statusMessage"></span>
                        <button id="completeMerge" class="complete-button" style="display: none;">Complete Merge</button>
                    </div>
                </div>
                
                <div class="diff-content">
                    <div class="diff-pane left-pane">
                        <div class="pane-header">Original</div>
                        <div class="code-container" id="leftCode"></div>
                    </div>
                    
                    <div class="diff-controls">
                        <div id="diffControls"></div>
                    </div>
                    
                    <div class="diff-pane right-pane">
                        <div class="pane-header">Modified</div>
                        <div class="code-container" id="rightCode"></div>
                    </div>
                </div>
            </div>

            <script>
                ${this.getWebviewScript()}
            </script>
        </body>
        </html>`;
    }

    private getWebviewScript(): string {
        return `
            const vscode = acquireVsCodeApi();
            let currentDiff = null;
            let changes = [];
            let currentChangeIndex = 0;

            // Initialize when DOM is loaded
            document.addEventListener('DOMContentLoaded', () => {
                setupEventListeners();
                vscode.postMessage({ command: 'ready' });
            });

            function setupEventListeners() {
                document.getElementById('prevChange').addEventListener('click', () => {
                    navigateChange('previous');
                });
                
                document.getElementById('nextChange').addEventListener('click', () => {
                    navigateChange('next');
                });

                document.getElementById('completeMerge').addEventListener('click', () => {
                    vscode.postMessage({ command: 'completeMerge' });
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.command) {
                    case 'setDiffData':
                        currentDiff = message.data;
                        renderDiff();
                        updateResolutionStatus();
                        break;
                    case 'updateResolution':
                        updateResolution(message.lineIndex, message.resolution);
                        break;
                    case 'updateResolutionState':
                        updateResolutionStatusFromState(message.state);
                        break;
                    case 'navigateChange':
                        navigateChange(message.direction);
                        break;
                }
            });

            function renderDiff() {
                if (!currentDiff) return;

                const leftCode = document.getElementById('leftCode');
                const rightCode = document.getElementById('rightCode');
                const diffControls = document.getElementById('diffControls');

                leftCode.innerHTML = '';
                rightCode.innerHTML = '';
                diffControls.innerHTML = '';
                changes = [];

                let leftLineNum = 1;
                let rightLineNum = 1;
                let controlIndex = 0;

                currentDiff.hunks.forEach(hunk => {
                    hunk.lines.forEach((line, index) => {
                        const leftLine = createLineElement(line, leftLineNum, 'left');
                        const rightLine = createLineElement(line, rightLineNum, 'right');
                        const control = createControlElement(line, controlIndex);

                        leftCode.appendChild(leftLine);
                        rightCode.appendChild(rightLine);
                        diffControls.appendChild(control);

                        if (line.type === 'added' || line.type === 'removed' || line.type === 'conflict') {
                            changes.push({
                                index: controlIndex,
                                type: line.type,
                                element: control
                            });
                        }

                        if (line.type !== 'removed') rightLineNum++;
                        if (line.type !== 'added') leftLineNum++;
                        controlIndex++;
                    });
                });

                updateChangeCounter();
                if (changes.length > 0) {
                    highlightCurrentChange();
                }
            }

            function createLineElement(line, lineNum, side) {
                const lineEl = document.createElement('div');
                lineEl.className = \`line line-\${line.type}\`;
                
                const lineNumEl = document.createElement('span');
                lineNumEl.className = 'line-number';
                lineNumEl.textContent = (line.type === 'removed' && side === 'right') || 
                                       (line.type === 'added' && side === 'left') ? '' : lineNum.toString();
                
                const contentEl = document.createElement('span');
                contentEl.className = 'line-content';
                contentEl.innerHTML = highlightSyntax(line.content);
                
                lineEl.appendChild(lineNumEl);
                lineEl.appendChild(contentEl);
                
                return lineEl;
            }

            function createControlElement(line, index) {
                const controlEl = document.createElement('div');
                controlEl.className = 'diff-control';
                controlEl.setAttribute('data-line-index', index);
                
                if (line.type === 'conflict') {
                    // Check if this conflict is auto-resolved
                    const conflict = currentDiff.conflicts?.find(c => 
                        index >= c.startLine && index <= c.endLine
                    );
                    
                    if (conflict && conflict.isResolved && conflict.autoResolved) {
                        // Show auto-resolved indicator
                        const autoResolvedEl = document.createElement('div');
                        autoResolvedEl.className = 'auto-resolved-indicator';
                        autoResolvedEl.innerHTML = '✓ Auto-resolved';
                        autoResolvedEl.title = conflict.autoResolveReason || 'Automatically resolved';
                        controlEl.appendChild(autoResolvedEl);
                        controlEl.classList.add('auto-resolved');
                    } else if (conflict && conflict.isResolved) {
                        // Show manually resolved indicator
                        const resolvedEl = document.createElement('div');
                        resolvedEl.className = 'resolved-indicator';
                        resolvedEl.innerHTML = '✓ Resolved';
                        controlEl.appendChild(resolvedEl);
                        controlEl.classList.add('resolved');
                    } else {
                        // Show resolution buttons for unresolved conflicts
                        const leftBtn = document.createElement('button');
                        leftBtn.className = 'accept-button accept-left';
                        leftBtn.innerHTML = '←';
                        leftBtn.title = 'Accept Left';
                        leftBtn.onclick = () => acceptChange(index, 'left');
                        
                        const rightBtn = document.createElement('button');
                        rightBtn.className = 'accept-button accept-right';
                        rightBtn.innerHTML = '→';
                        rightBtn.title = 'Accept Right';
                        rightBtn.onclick = () => acceptChange(index, 'right');
                        
                        const bothBtn = document.createElement('button');
                        bothBtn.className = 'accept-button accept-both';
                        bothBtn.innerHTML = '↔';
                        bothBtn.title = 'Accept Both';
                        bothBtn.onclick = () => acceptChange(index, 'both');
                        
                        controlEl.appendChild(leftBtn);
                        controlEl.appendChild(bothBtn);
                        controlEl.appendChild(rightBtn);
                    }
                } else if (line.type === 'added' || line.type === 'removed') {
                    const indicator = document.createElement('div');
                    indicator.className = \`change-indicator \${line.type}\`;
                    indicator.textContent = line.type === 'added' ? '+' : '-';
                    controlEl.appendChild(indicator);
                }
                
                return controlEl;
            }

            function highlightSyntax(content) {
                // Basic syntax highlighting - can be enhanced with a proper syntax highlighter
                return content
                    .replace(/\\b(function|const|let|var|if|else|for|while|return|class|interface|type)\\b/g, 
                             '<span class="keyword">$1</span>')
                    .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>')
                    .replace(/'([^']*)'/g, '<span class="string">\'$1\'</span>')
                    .replace(/\\/\\/.*$/gm, '<span class="comment">$&</span>')
                    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '<span class="comment">$&</span>');
            }

            function acceptChange(lineIndex, side) {
                vscode.postMessage({
                    command: \`accept\${side.charAt(0).toUpperCase() + side.slice(1)}\`,
                    lineIndex
                });
            }

            function navigateChange(direction) {
                if (changes.length === 0) return;

                if (direction === 'next') {
                    currentChangeIndex = (currentChangeIndex + 1) % changes.length;
                } else {
                    currentChangeIndex = currentChangeIndex === 0 ? changes.length - 1 : currentChangeIndex - 1;
                }

                highlightCurrentChange();
                scrollToCurrentChange();
            }

            function highlightCurrentChange() {
                // Remove previous highlights
                changes.forEach(change => {
                    change.element.classList.remove('current-change');
                });

                // Highlight current change
                if (changes[currentChangeIndex]) {
                    changes[currentChangeIndex].element.classList.add('current-change');
                }

                updateChangeCounter();
            }

            function scrollToCurrentChange() {
                if (changes[currentChangeIndex]) {
                    changes[currentChangeIndex].element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }

            function updateChangeCounter() {
                const counter = document.getElementById('changeCounter');
                counter.textContent = \`\${currentChangeIndex + 1} / \${changes.length}\`;
            }

            function updateResolution(lineIndex, resolution) {
                const controlEl = document.querySelector(\`[data-line-index="\${lineIndex}"] .diff-control\`);
                if (controlEl) {
                    controlEl.classList.add('resolved');
                    controlEl.setAttribute('data-resolution', resolution);
                }
            }

            function updateResolutionStatus() {
                if (!currentDiff || !currentDiff.conflicts) {
                    return;
                }

                const statusPanel = document.getElementById('resolutionStatus');
                const statusMessage = document.getElementById('statusMessage');
                const completeMergeBtn = document.getElementById('completeMerge');

                const totalConflicts = currentDiff.conflicts.length;
                const resolvedConflicts = currentDiff.conflicts.filter(c => c.isResolved).length;
                const autoResolvedConflicts = currentDiff.conflicts.filter(c => c.autoResolved).length;
                const unresolvedConflicts = totalConflicts - resolvedConflicts;

                if (totalConflicts === 0) {
                    statusPanel.style.display = 'none';
                    return;
                }

                statusPanel.style.display = 'block';

                let message = '';
                if (autoResolvedConflicts > 0) {
                    message += \`\${autoResolvedConflicts} conflict\${autoResolvedConflicts > 1 ? 's' : ''} auto-resolved. \`;
                }

                if (unresolvedConflicts === 0) {
                    message += 'All conflicts resolved!';
                    statusPanel.className = 'resolution-status success';
                    completeMergeBtn.style.display = 'inline-block';
                } else {
                    message += \`\${unresolvedConflicts} conflict\${unresolvedConflicts > 1 ? 's' : ''} remaining.\`;
                    statusPanel.className = 'resolution-status warning';
                    completeMergeBtn.style.display = 'none';
                }

                statusMessage.textContent = message;
            }

            function updateResolutionStatusFromState(state) {
                const statusPanel = document.getElementById('resolutionStatus');
                const statusMessage = document.getElementById('statusMessage');
                const completeMergeBtn = document.getElementById('completeMerge');

                statusPanel.style.display = 'block';
                statusMessage.textContent = state.resolutionSummary + ' ' + state.nextAction;

                if (state.canCompleteAutomatically) {
                    statusPanel.className = 'resolution-status success';
                    completeMergeBtn.style.display = 'inline-block';
                } else {
                    statusPanel.className = 'resolution-status warning';
                    completeMergeBtn.style.display = 'none';
                }
            }
        `;
    }

    private createHunksFromConflicts(content: string, conflicts: ConflictRegion[]): DiffHunk[] {
        const lines = content.split('\n');
        const hunks: DiffHunk[] = [];

        for (const conflict of conflicts) {
            const hunk: DiffHunk = {
                oldStart: conflict.startLine + 1,
                oldLines: conflict.endLine - conflict.startLine + 1,
                newStart: conflict.startLine + 1,
                newLines: conflict.endLine - conflict.startLine + 1,
                lines: []
            };

            // Add context lines before conflict
            const contextStart = Math.max(0, conflict.startLine - 3);
            for (let i = contextStart; i < conflict.startLine; i++) {
                hunk.lines.push({
                    type: 'unchanged',
                    content: lines[i] || '',
                    oldLineNumber: i + 1,
                    newLineNumber: i + 1
                });
            }

            // Add conflict marker start
            hunk.lines.push({
                type: 'conflict',
                content: '<<<<<<< HEAD',
                oldLineNumber: conflict.startLine + 1,
                newLineNumber: conflict.startLine + 1
            });

            // Add current content lines
            const currentLines = conflict.currentContent.split('\n');
            currentLines.forEach((line, index) => {
                hunk.lines.push({
                    type: 'conflict',
                    content: line,
                    oldLineNumber: conflict.startLine + 2 + index,
                    newLineNumber: conflict.startLine + 2 + index
                });
            });

            // Add separator
            hunk.lines.push({
                type: 'conflict',
                content: '=======',
                oldLineNumber: undefined,
                newLineNumber: undefined
            });

            // Add incoming content lines
            const incomingLines = conflict.incomingContent.split('\n');
            incomingLines.forEach((line, index) => {
                hunk.lines.push({
                    type: 'conflict',
                    content: line,
                    oldLineNumber: undefined,
                    newLineNumber: conflict.startLine + 2 + currentLines.length + 1 + index
                });
            });

            // Add conflict marker end
            hunk.lines.push({
                type: 'conflict',
                content: '>>>>>>> branch',
                oldLineNumber: undefined,
                newLineNumber: conflict.endLine + 1
            });

            // Add context lines after conflict
            const contextEnd = Math.min(lines.length, conflict.endLine + 4);
            for (let i = conflict.endLine + 1; i < contextEnd; i++) {
                hunk.lines.push({
                    type: 'unchanged',
                    content: lines[i] || '',
                    oldLineNumber: i + 1,
                    newLineNumber: i + 1
                });
            }

            hunks.push(hunk);
        }

        return hunks;
    }

    private async completeMerge(): Promise<void> {
        if (!this.currentDiff || !this.currentDiff.conflicts) {
            return;
        }

        const mergeCompletion = this.conflictResolver.canCompleteMerge(this.currentDiff.conflicts);
        
        if (!mergeCompletion.canComplete) {
            vscode.window.showWarningMessage(`Cannot complete merge: ${mergeCompletion.reason}`);
            return;
        }

        // Apply all conflict resolutions to the file content
        const resolvedContent = this.conflictResolver.applyConflictResolution(
            this.currentDiff.oldContent,
            this.currentDiff.conflicts
        );

        // Write the resolved content back to the file
        try {
            const fileUri = vscode.Uri.file(this.currentDiff.filePath);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(fileUri, encoder.encode(resolvedContent));
            
            vscode.window.showInformationMessage(
                `Merge completed successfully for ${this.currentDiff.filePath}`
            );
            
            // Close the diff viewer
            this.panel?.dispose();
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to complete merge: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    public dispose(): void {
        this.panel?.dispose();
    }
}
import * as vscode from 'vscode';
import { ConflictRegion, DiffResult, GitError } from '../types/git';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Interface for conflict resolution operations
 */
export interface IConflictResolver {
    detectConflicts(content: string): ConflictRegion[];
    parseConflictMarkers(content: string): ConflictRegion[];
    resolveNonConflictingChanges(conflicts: ConflictRegion[]): ConflictRegion[];
    mergeConflictRegions(current: string, incoming: string, base?: string): string;
    isConflictResolved(region: ConflictRegion): boolean;
    getAllConflictsResolved(conflicts: ConflictRegion[]): boolean;
}

/**
 * Service for detecting and resolving Git merge conflicts
 */
export class ConflictResolver implements IConflictResolver {
    private errorHandler: ErrorHandler;

    constructor() {
        this.errorHandler = new ErrorHandler();
    }

    /**
     * Detect conflicts in file content by parsing Git conflict markers
     */
    detectConflicts(content: string): ConflictRegion[] {
        try {
            return this.parseConflictMarkers(content);
        } catch (error) {
            const gitError = error instanceof GitError ? error : new GitError(
                `Failed to detect conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CONFLICT_DETECTION_FAILED',
                'git'
            );
            this.errorHandler.handleError(gitError);
            return [];
        }
    }

    /**
     * Parse Git conflict markers in file content
     * Conflict markers format:
     * <<<<<<< HEAD (current)
     * current content
     * =======
     * incoming content
     * >>>>>>> branch-name (incoming)
     */
    parseConflictMarkers(content: string): ConflictRegion[] {
        const conflicts: ConflictRegion[] = [];
        const lines = content.split('\n');
        
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            
            // Look for conflict start marker
            if (line.startsWith('<<<<<<<')) {
                const conflictStart = i;
                const currentBranch = line.substring(7).trim() || 'HEAD';
                
                // Find the separator (=======)
                let separatorIndex = -1;
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].startsWith('=======')) {
                        separatorIndex = j;
                        break;
                    }
                }
                
                if (separatorIndex === -1) {
                    // Malformed conflict marker, skip
                    i++;
                    continue;
                }
                
                // Find the end marker (>>>>>>>)
                let conflictEnd = -1;
                let incomingBranch = '';
                for (let j = separatorIndex + 1; j < lines.length; j++) {
                    if (lines[j].startsWith('>>>>>>>')) {
                        conflictEnd = j;
                        incomingBranch = lines[j].substring(7).trim();
                        break;
                    }
                }
                
                if (conflictEnd === -1) {
                    // Malformed conflict marker, skip
                    i++;
                    continue;
                }
                
                // Extract current and incoming content
                const currentContent = lines.slice(conflictStart + 1, separatorIndex).join('\n');
                const incomingContent = lines.slice(separatorIndex + 1, conflictEnd).join('\n');
                
                // Create conflict region
                const conflict: ConflictRegion = {
                    startLine: conflictStart,
                    endLine: conflictEnd,
                    currentContent,
                    incomingContent,
                    isResolved: false
                };
                
                conflicts.push(conflict);
                
                // Move past this conflict
                i = conflictEnd + 1;
            } else {
                i++;
            }
        }
        
        return conflicts;
    }

    /**
     * Automatically resolve non-conflicting changes
     * This identifies conflicts that can be safely auto-resolved
     */
    resolveNonConflictingChanges(conflicts: ConflictRegion[]): ConflictRegion[] {
        return conflicts.map(conflict => {
            if (conflict.isResolved) {
                return conflict;
            }

            // Auto-resolve if one side is empty (pure addition/deletion)
            if (conflict.currentContent.trim() === '' && conflict.incomingContent.trim() !== '') {
                return {
                    ...conflict,
                    isResolved: true,
                    resolution: 'incoming',
                    autoResolved: true,
                    autoResolveReason: 'Pure addition - incoming side has content, current side is empty'
                };
            }
            
            if (conflict.incomingContent.trim() === '' && conflict.currentContent.trim() !== '') {
                return {
                    ...conflict,
                    isResolved: true,
                    resolution: 'current',
                    autoResolved: true,
                    autoResolveReason: 'Pure deletion - current side has content, incoming side is empty'
                };
            }

            // Auto-resolve if both sides are identical
            if (conflict.currentContent.trim() === conflict.incomingContent.trim()) {
                return {
                    ...conflict,
                    isResolved: true,
                    resolution: 'current', // Could be either, they're the same
                    autoResolved: true,
                    autoResolveReason: 'Identical content on both sides'
                };
            }

            // Check for simple whitespace-only differences
            const currentNormalized = this.normalizeWhitespace(conflict.currentContent);
            const incomingNormalized = this.normalizeWhitespace(conflict.incomingContent);
            
            if (currentNormalized === incomingNormalized) {
                return {
                    ...conflict,
                    isResolved: true,
                    resolution: 'current', // Prefer current for whitespace conflicts
                    autoResolved: true,
                    autoResolveReason: 'Whitespace-only differences detected'
                };
            }

            // Check for simple line order differences (if base content is available)
            if (conflict.baseContent) {
                const autoResolution = this.tryAutoResolveWithBase(conflict);
                if (autoResolution.resolution) {
                    return {
                        ...conflict,
                        isResolved: true,
                        resolution: autoResolution.resolution,
                        autoResolved: true,
                        autoResolveReason: autoResolution.reason
                    };
                }
            }

            // Check for simple import/require statement conflicts
            const importResolution = this.tryResolveImportConflicts(conflict);
            if (importResolution.resolution) {
                return {
                    ...conflict,
                    isResolved: true,
                    resolution: importResolution.resolution,
                    autoResolved: true,
                    autoResolveReason: importResolution.reason
                };
            }

            // Check for simple comment conflicts
            const commentResolution = this.tryResolveCommentConflicts(conflict);
            if (commentResolution.resolution) {
                return {
                    ...conflict,
                    isResolved: true,
                    resolution: commentResolution.resolution,
                    autoResolved: true,
                    autoResolveReason: commentResolution.reason
                };
            }

            // Cannot auto-resolve, requires manual intervention
            return conflict;
        });
    }

    /**
     * Normalize whitespace for comparison
     */
    private normalizeWhitespace(content: string): string {
        return content
            .replace(/\r\n/g, '\n')  // Normalize line endings
            .replace(/\t/g, '    ')   // Convert tabs to spaces
            .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
            .replace(/\s+/g, ' ')     // Normalize multiple spaces to single space
            .trim();
    }

    /**
     * Try to auto-resolve conflict using base content (3-way merge)
     */
    private tryAutoResolveWithBase(conflict: ConflictRegion): { resolution: 'current' | 'incoming' | 'both' | null; reason: string } {
        if (!conflict.baseContent) {
            return { resolution: null, reason: '' };
        }

        const base = conflict.baseContent.trim();
        const current = conflict.currentContent.trim();
        const incoming = conflict.incomingContent.trim();

        // If current matches base, take incoming (incoming has changes)
        if (current === base && incoming !== base) {
            return { 
                resolution: 'incoming', 
                reason: 'Current side unchanged from base, incoming side has modifications' 
            };
        }

        // If incoming matches base, take current (current has changes)
        if (incoming === base && current !== base) {
            return { 
                resolution: 'current', 
                reason: 'Incoming side unchanged from base, current side has modifications' 
            };
        }

        // If both sides made the same change
        if (current === incoming && current !== base) {
            return { 
                resolution: 'current', 
                reason: 'Both sides made identical changes from base' 
            };
        }

        // Check for non-overlapping changes (both sides changed different parts)
        if (this.hasNonOverlappingChanges(base, current, incoming)) {
            return { 
                resolution: 'both', 
                reason: 'Non-overlapping changes detected - both sides can be safely merged' 
            };
        }

        return { resolution: null, reason: '' };
    }

    /**
     * Check if changes are non-overlapping and can be safely merged
     */
    private hasNonOverlappingChanges(base: string, current: string, incoming: string): boolean {
        // This is a simplified implementation
        // In a real-world scenario, you'd want more sophisticated diff analysis
        
        const baseLines = base.split('\n');
        const currentLines = current.split('\n');
        const incomingLines = incoming.split('\n');

        // If line counts are very different, likely overlapping changes
        if (Math.abs(currentLines.length - baseLines.length) > 5 ||
            Math.abs(incomingLines.length - baseLines.length) > 5) {
            return false;
        }

        // Simple heuristic: if both sides have similar line counts and 
        // some common lines with base, might be non-overlapping
        const currentCommonLines = this.countCommonLines(baseLines, currentLines);
        const incomingCommonLines = this.countCommonLines(baseLines, incomingLines);
        
        const baseLineCount = baseLines.length;
        const commonThreshold = Math.max(1, Math.floor(baseLineCount * 0.5));

        return currentCommonLines >= commonThreshold && incomingCommonLines >= commonThreshold;
    }

    /**
     * Count common lines between two arrays
     */
    private countCommonLines(lines1: string[], lines2: string[]): number {
        const set1 = new Set(lines1.map(line => line.trim()));
        const set2 = new Set(lines2.map(line => line.trim()));
        
        let commonCount = 0;
        for (const line of set1) {
            if (set2.has(line)) {
                commonCount++;
            }
        }
        
        return commonCount;
    }

    /**
     * Try to resolve import/require statement conflicts automatically
     */
    private tryResolveImportConflicts(conflict: ConflictRegion): { resolution: 'current' | 'incoming' | 'both' | null; reason: string } {
        const currentLines = conflict.currentContent.split('\n').map(line => line.trim()).filter(line => line);
        const incomingLines = conflict.incomingContent.split('\n').map(line => line.trim()).filter(line => line);

        // Check if all lines are import/require statements
        const isImportLine = (line: string): boolean => {
            return /^(import\s|const\s.*=\s*require\(|from\s['"]|export\s.*from)/.test(line);
        };

        const allCurrentImports = currentLines.every(isImportLine);
        const allIncomingImports = incomingLines.every(isImportLine);

        if (allCurrentImports && allIncomingImports) {
            // Check for duplicate imports
            const currentImports = new Set(currentLines);
            const incomingImports = new Set(incomingLines);
            const hasOverlap = [...currentImports].some(imp => incomingImports.has(imp));

            if (!hasOverlap) {
                // No duplicate imports, safe to merge both
                return { 
                    resolution: 'both', 
                    reason: 'Non-conflicting import statements - merging both sides' 
                };
            } else {
                // Has duplicates, prefer the side with more imports
                if (currentLines.length > incomingLines.length) {
                    return { 
                        resolution: 'current', 
                        reason: 'Import conflict resolved - current side has more comprehensive imports' 
                    };
                } else if (incomingLines.length > currentLines.length) {
                    return { 
                        resolution: 'incoming', 
                        reason: 'Import conflict resolved - incoming side has more comprehensive imports' 
                    };
                }
            }
        }

        return { resolution: null, reason: '' };
    }

    /**
     * Try to resolve comment-only conflicts automatically
     */
    private tryResolveCommentConflicts(conflict: ConflictRegion): { resolution: 'current' | 'incoming' | 'both' | null; reason: string } {
        const currentLines = conflict.currentContent.split('\n').map(line => line.trim()).filter(line => line);
        const incomingLines = conflict.incomingContent.split('\n').map(line => line.trim()).filter(line => line);

        // Check if all lines are comments
        const isCommentLine = (line: string): boolean => {
            return /^(\/\/|\/\*|\*|#|<!--)/.test(line) || line === '*/';
        };

        const allCurrentComments = currentLines.every(isCommentLine);
        const allIncomingComments = incomingLines.every(isCommentLine);

        if (allCurrentComments && allIncomingComments) {
            // For comments, prefer the more detailed/longer version
            const currentLength = conflict.currentContent.length;
            const incomingLength = conflict.incomingContent.length;

            if (Math.abs(currentLength - incomingLength) / Math.max(currentLength, incomingLength) < 0.1) {
                // Very similar length, prefer current
                return { 
                    resolution: 'current', 
                    reason: 'Comment conflict resolved - similar content, preferring current version' 
                };
            } else if (currentLength > incomingLength) {
                return { 
                    resolution: 'current', 
                    reason: 'Comment conflict resolved - current version is more detailed' 
                };
            } else {
                return { 
                    resolution: 'incoming', 
                    reason: 'Comment conflict resolved - incoming version is more detailed' 
                };
            }
        }

        return { resolution: null, reason: '' };
    }

    /**
     * Merge conflict regions based on resolution choice
     */
    mergeConflictRegions(current: string, incoming: string, base?: string): string {
        // This method would be used to create the final merged content
        // For now, it's a placeholder that could be extended based on resolution strategy
        
        // Default to current content
        return current;
    }

    /**
     * Check if a conflict region is resolved
     */
    isConflictResolved(region: ConflictRegion): boolean {
        return region.isResolved === true && region.resolution !== undefined;
    }

    /**
     * Check if all conflicts in a list are resolved
     */
    getAllConflictsResolved(conflicts: ConflictRegion[]): boolean {
        return conflicts.length > 0 && conflicts.every(conflict => this.isConflictResolved(conflict));
    }

    /**
     * Apply conflict resolution to file content
     */
    applyConflictResolution(content: string, conflicts: ConflictRegion[]): string {
        if (conflicts.length === 0) {
            return content;
        }

        const lines = content.split('\n');
        let result: string[] = [];
        let lastProcessedLine = 0;

        // Sort conflicts by start line to process them in order
        const sortedConflicts = [...conflicts].sort((a, b) => a.startLine - b.startLine);

        for (const conflict of sortedConflicts) {
            // Add lines before this conflict
            result.push(...lines.slice(lastProcessedLine, conflict.startLine));

            // Add resolved content based on resolution
            if (conflict.isResolved && conflict.resolution) {
                switch (conflict.resolution) {
                    case 'current':
                        if (conflict.currentContent.trim()) {
                            result.push(...conflict.currentContent.split('\n'));
                        }
                        break;
                    case 'incoming':
                        if (conflict.incomingContent.trim()) {
                            result.push(...conflict.incomingContent.split('\n'));
                        }
                        break;
                    case 'both':
                        if (conflict.currentContent.trim()) {
                            result.push(...conflict.currentContent.split('\n'));
                        }
                        if (conflict.incomingContent.trim()) {
                            result.push(...conflict.incomingContent.split('\n'));
                        }
                        break;
                    case 'manual':
                        // For manual resolution, we'd need the manually resolved content
                        // This would come from the diff viewer UI
                        result.push(...conflict.currentContent.split('\n'));
                        break;
                }
            } else {
                // Unresolved conflict, keep original markers
                result.push(...lines.slice(conflict.startLine, conflict.endLine + 1));
            }

            lastProcessedLine = conflict.endLine + 1;
        }

        // Add remaining lines after the last conflict
        result.push(...lines.slice(lastProcessedLine));

        return result.join('\n');
    }

    /**
     * Get conflict statistics for reporting
     */
    getConflictStats(conflicts: ConflictRegion[]): {
        total: number;
        resolved: number;
        autoResolved: number;
        manuallyResolved: number;
        unresolved: number;
    } {
        const total = conflicts.length;
        const resolved = conflicts.filter(c => c.isResolved).length;
        const autoResolved = conflicts.filter(c => 
            c.isResolved && c.autoResolved === true
        ).length;
        const manuallyResolved = conflicts.filter(c => 
            c.isResolved && c.autoResolved !== true
        ).length;
        const unresolved = total - resolved;

        return {
            total,
            resolved,
            autoResolved,
            manuallyResolved,
            unresolved
        };
    }

    /**
     * Manage conflict resolution state and provide visual feedback
     */
    getConflictResolutionState(conflicts: ConflictRegion[]): {
        canCompleteAutomatically: boolean;
        requiresManualIntervention: boolean;
        autoResolvedConflicts: ConflictRegion[];
        manualConflicts: ConflictRegion[];
        resolutionSummary: string;
        nextAction: string;
    } {
        const stats = this.getConflictStats(conflicts);
        const autoResolvedConflicts = conflicts.filter(c => c.autoResolved === true);
        const manualConflicts = conflicts.filter(c => !c.isResolved);

        const canCompleteAutomatically = stats.unresolved === 0;
        const requiresManualIntervention = stats.unresolved > 0;

        let resolutionSummary = '';
        if (stats.autoResolved > 0) {
            resolutionSummary += `${stats.autoResolved} conflict${stats.autoResolved > 1 ? 's' : ''} auto-resolved. `;
        }
        if (stats.manuallyResolved > 0) {
            resolutionSummary += `${stats.manuallyResolved} conflict${stats.manuallyResolved > 1 ? 's' : ''} manually resolved. `;
        }
        if (stats.unresolved > 0) {
            resolutionSummary += `${stats.unresolved} conflict${stats.unresolved > 1 ? 's' : ''} require${stats.unresolved === 1 ? 's' : ''} manual resolution.`;
        }

        let nextAction = '';
        if (canCompleteAutomatically) {
            nextAction = 'All conflicts resolved. Ready to complete merge.';
        } else {
            nextAction = `Please resolve the remaining ${stats.unresolved} conflict${stats.unresolved > 1 ? 's' : ''} manually.`;
        }

        return {
            canCompleteAutomatically,
            requiresManualIntervention,
            autoResolvedConflicts,
            manualConflicts,
            resolutionSummary: resolutionSummary.trim(),
            nextAction
        };
    }

    /**
     * Enable merge completion when all conflicts are resolved
     */
    canCompleteMerge(conflicts: ConflictRegion[]): { canComplete: boolean; reason: string } {
        const unresolvedConflicts = conflicts.filter(c => !c.isResolved);
        
        if (unresolvedConflicts.length === 0) {
            return {
                canComplete: true,
                reason: 'All conflicts have been resolved'
            };
        }

        return {
            canComplete: false,
            reason: `${unresolvedConflicts.length} conflict${unresolvedConflicts.length > 1 ? 's' : ''} still need${unresolvedConflicts.length === 1 ? 's' : ''} to be resolved`
        };
    }

    /**
     * Generate visual feedback for auto-resolved sections
     */
    generateAutoResolutionFeedback(conflicts: ConflictRegion[]): {
        message: string;
        details: Array<{ conflict: ConflictRegion; feedback: string }>;
    } {
        const autoResolvedConflicts = conflicts.filter(c => c.autoResolved === true);
        
        if (autoResolvedConflicts.length === 0) {
            return {
                message: 'No conflicts were automatically resolved.',
                details: []
            };
        }

        const message = `Automatically resolved ${autoResolvedConflicts.length} conflict${autoResolvedConflicts.length > 1 ? 's' : ''}`;
        
        const details = autoResolvedConflicts.map(conflict => ({
            conflict,
            feedback: `Lines ${conflict.startLine + 1}-${conflict.endLine + 1}: ${conflict.autoResolveReason || 'Auto-resolved'} (${conflict.resolution})`
        }));

        return { message, details };
    }
}
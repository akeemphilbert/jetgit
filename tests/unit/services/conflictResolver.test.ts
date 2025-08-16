import { ConflictResolver } from '../../../src/services/conflictResolver';
import { ConflictRegion } from '../../../src/types/git';

describe('ConflictResolver', () => {
    let conflictResolver: ConflictResolver;

    beforeEach(() => {
        conflictResolver = new ConflictResolver();
    });

    describe('parseConflictMarkers', () => {
        it('should parse simple conflict markers', () => {
            const content = `line 1
line 2
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> feature-branch
line 3`;

            const conflicts = conflictResolver.parseConflictMarkers(content);

            expect(conflicts).toHaveLength(1);
            expect(conflicts[0]).toEqual({
                startLine: 2,
                endLine: 6,
                currentContent: 'current content',
                incomingContent: 'incoming content',
                isResolved: false
            });
        });

        it('should parse multiple conflicts', () => {
            const content = `line 1
<<<<<<< HEAD
current 1
=======
incoming 1
>>>>>>> branch1
line 2
<<<<<<< HEAD
current 2
=======
incoming 2
>>>>>>> branch2
line 3`;

            const conflicts = conflictResolver.parseConflictMarkers(content);

            expect(conflicts).toHaveLength(2);
            expect(conflicts[0].currentContent).toBe('current 1');
            expect(conflicts[0].incomingContent).toBe('incoming 1');
            expect(conflicts[1].currentContent).toBe('current 2');
            expect(conflicts[1].incomingContent).toBe('incoming 2');
        });

        it('should handle multi-line conflicts', () => {
            const content = `line 1
<<<<<<< HEAD
current line 1
current line 2
current line 3
=======
incoming line 1
incoming line 2
>>>>>>> feature-branch
line 2`;

            const conflicts = conflictResolver.parseConflictMarkers(content);

            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].currentContent).toBe('current line 1\ncurrent line 2\ncurrent line 3');
            expect(conflicts[0].incomingContent).toBe('incoming line 1\nincoming line 2');
        });

        it('should handle malformed conflict markers gracefully', () => {
            const content = `line 1
<<<<<<< HEAD
current content
line 2`;

            const conflicts = conflictResolver.parseConflictMarkers(content);

            expect(conflicts).toHaveLength(0);
        });

        it('should handle empty conflict sections', () => {
            const content = `line 1
<<<<<<< HEAD
=======
incoming content
>>>>>>> feature-branch
line 2`;

            const conflicts = conflictResolver.parseConflictMarkers(content);

            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].currentContent).toBe('');
            expect(conflicts[0].incomingContent).toBe('incoming content');
        });
    });

    describe('resolveNonConflictingChanges', () => {
        it('should auto-resolve when current side is empty', () => {
            const conflicts: ConflictRegion[] = [{
                startLine: 0,
                endLine: 3,
                currentContent: '',
                incomingContent: 'new content',
                isResolved: false
            }];

            const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

            expect(resolved[0].isResolved).toBe(true);
            expect(resolved[0].resolution).toBe('incoming');
        });

        it('should auto-resolve when incoming side is empty', () => {
            const conflicts: ConflictRegion[] = [{
                startLine: 0,
                endLine: 3,
                currentContent: 'existing content',
                incomingContent: '',
                isResolved: false
            }];

            const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

            expect(resolved[0].isResolved).toBe(true);
            expect(resolved[0].resolution).toBe('current');
        });

        it('should auto-resolve when both sides are identical', () => {
            const conflicts: ConflictRegion[] = [{
                startLine: 0,
                endLine: 3,
                currentContent: 'same content',
                incomingContent: 'same content',
                isResolved: false
            }];

            const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

            expect(resolved[0].isResolved).toBe(true);
            expect(resolved[0].resolution).toBe('current');
        });

        it('should auto-resolve whitespace-only differences', () => {
            const conflicts: ConflictRegion[] = [{
                startLine: 0,
                endLine: 3,
                currentContent: 'content with spaces',
                incomingContent: 'content  with   spaces',
                isResolved: false
            }];

            const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

            expect(resolved[0].isResolved).toBe(true);
            expect(resolved[0].resolution).toBe('current');
        });

        it('should not auto-resolve actual conflicts', () => {
            const conflicts: ConflictRegion[] = [{
                startLine: 0,
                endLine: 3,
                currentContent: 'current version',
                incomingContent: 'incoming version',
                isResolved: false
            }];

            const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

            expect(resolved[0].isResolved).toBe(false);
            expect(resolved[0].resolution).toBeUndefined();
        });

        it('should handle 3-way merge with base content', () => {
            const conflicts: ConflictRegion[] = [{
                startLine: 0,
                endLine: 3,
                currentContent: 'modified current',
                incomingContent: 'original base',
                baseContent: 'original base',
                isResolved: false
            }];

            const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

            expect(resolved[0].isResolved).toBe(true);
            expect(resolved[0].resolution).toBe('current');
        });
    });

    describe('isConflictResolved', () => {
        it('should return true for resolved conflicts', () => {
            const conflict: ConflictRegion = {
                startLine: 0,
                endLine: 3,
                currentContent: 'content',
                incomingContent: 'other content',
                isResolved: true,
                resolution: 'current'
            };

            expect(conflictResolver.isConflictResolved(conflict)).toBe(true);
        });

        it('should return false for unresolved conflicts', () => {
            const conflict: ConflictRegion = {
                startLine: 0,
                endLine: 3,
                currentContent: 'content',
                incomingContent: 'other content',
                isResolved: false
            };

            expect(conflictResolver.isConflictResolved(conflict)).toBe(false);
        });

        it('should return false for conflicts without resolution', () => {
            const conflict: ConflictRegion = {
                startLine: 0,
                endLine: 3,
                currentContent: 'content',
                incomingContent: 'other content',
                isResolved: true
                // resolution is undefined
            };

            expect(conflictResolver.isConflictResolved(conflict)).toBe(false);
        });
    });

    describe('getAllConflictsResolved', () => {
        it('should return true when all conflicts are resolved', () => {
            const conflicts: ConflictRegion[] = [
                {
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'content1',
                    incomingContent: 'other1',
                    isResolved: true,
                    resolution: 'current'
                },
                {
                    startLine: 5,
                    endLine: 8,
                    currentContent: 'content2',
                    incomingContent: 'other2',
                    isResolved: true,
                    resolution: 'incoming'
                }
            ];

            expect(conflictResolver.getAllConflictsResolved(conflicts)).toBe(true);
        });

        it('should return false when some conflicts are unresolved', () => {
            const conflicts: ConflictRegion[] = [
                {
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'content1',
                    incomingContent: 'other1',
                    isResolved: true,
                    resolution: 'current'
                },
                {
                    startLine: 5,
                    endLine: 8,
                    currentContent: 'content2',
                    incomingContent: 'other2',
                    isResolved: false
                }
            ];

            expect(conflictResolver.getAllConflictsResolved(conflicts)).toBe(false);
        });

        it('should return false for empty conflicts array', () => {
            expect(conflictResolver.getAllConflictsResolved([])).toBe(false);
        });
    });

    describe('applyConflictResolution', () => {
        it('should apply current resolution', () => {
            const content = `line 1
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> branch
line 2`;

            const conflicts: ConflictRegion[] = [{
                startLine: 1,
                endLine: 5,
                currentContent: 'current content',
                incomingContent: 'incoming content',
                isResolved: true,
                resolution: 'current'
            }];

            const result = conflictResolver.applyConflictResolution(content, conflicts);

            expect(result).toBe(`line 1
current content
line 2`);
        });

        it('should apply incoming resolution', () => {
            const content = `line 1
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> branch
line 2`;

            const conflicts: ConflictRegion[] = [{
                startLine: 1,
                endLine: 5,
                currentContent: 'current content',
                incomingContent: 'incoming content',
                isResolved: true,
                resolution: 'incoming'
            }];

            const result = conflictResolver.applyConflictResolution(content, conflicts);

            expect(result).toBe(`line 1
incoming content
line 2`);
        });

        it('should apply both resolution', () => {
            const content = `line 1
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> branch
line 2`;

            const conflicts: ConflictRegion[] = [{
                startLine: 1,
                endLine: 5,
                currentContent: 'current content',
                incomingContent: 'incoming content',
                isResolved: true,
                resolution: 'both'
            }];

            const result = conflictResolver.applyConflictResolution(content, conflicts);

            expect(result).toBe(`line 1
current content
incoming content
line 2`);
        });

        it('should handle multiple conflicts', () => {
            const content = `line 1
<<<<<<< HEAD
current 1
=======
incoming 1
>>>>>>> branch
line 2
<<<<<<< HEAD
current 2
=======
incoming 2
>>>>>>> branch
line 3`;

            const conflicts: ConflictRegion[] = [
                {
                    startLine: 1,
                    endLine: 5,
                    currentContent: 'current 1',
                    incomingContent: 'incoming 1',
                    isResolved: true,
                    resolution: 'current'
                },
                {
                    startLine: 7,
                    endLine: 11,
                    currentContent: 'current 2',
                    incomingContent: 'incoming 2',
                    isResolved: true,
                    resolution: 'incoming'
                }
            ];

            const result = conflictResolver.applyConflictResolution(content, conflicts);

            expect(result).toBe(`line 1
current 1
line 2
incoming 2
line 3`);
        });

        it('should leave unresolved conflicts unchanged', () => {
            const content = `line 1
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> branch
line 2`;

            const conflicts: ConflictRegion[] = [{
                startLine: 1,
                endLine: 5,
                currentContent: 'current content',
                incomingContent: 'incoming content',
                isResolved: false
            }];

            const result = conflictResolver.applyConflictResolution(content, conflicts);

            expect(result).toBe(content);
        });
    });

    describe('getConflictStats', () => {
        it('should return correct statistics', () => {
            const conflicts: ConflictRegion[] = [
                {
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'content1',
                    incomingContent: 'other1',
                    isResolved: true,
                    resolution: 'current',
                    autoResolved: true
                },
                {
                    startLine: 5,
                    endLine: 8,
                    currentContent: 'content2',
                    incomingContent: 'other2',
                    isResolved: true,
                    resolution: 'manual'
                },
                {
                    startLine: 10,
                    endLine: 13,
                    currentContent: 'content3',
                    incomingContent: 'other3',
                    isResolved: false
                }
            ];

            const stats = conflictResolver.getConflictStats(conflicts);

            expect(stats).toEqual({
                total: 3,
                resolved: 2,
                autoResolved: 1,
                manuallyResolved: 1,
                unresolved: 1
            });
        });

        it('should handle empty conflicts array', () => {
            const stats = conflictResolver.getConflictStats([]);

            expect(stats).toEqual({
                total: 0,
                resolved: 0,
                autoResolved: 0,
                manuallyResolved: 0,
                unresolved: 0
            });
        });
    });

    describe('automatic conflict resolution algorithms', () => {
        describe('import/require statement resolution', () => {
            it('should auto-resolve non-conflicting import statements', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'import React from "react";\nimport { useState } from "react";',
                    incomingContent: 'import axios from "axios";\nimport { debounce } from "lodash";',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('both');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('Non-conflicting import statements');
            });

            it('should prefer side with more imports when duplicates exist', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'import React from "react";\nimport { useState } from "react";\nimport axios from "axios";',
                    incomingContent: 'import React from "react";',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('current');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('more comprehensive imports');
            });
        });

        describe('comment conflict resolution', () => {
            it('should auto-resolve comment conflicts by preferring more detailed version', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: '// This is a simple comment',
                    incomingContent: '// This is a detailed comment\n// with multiple lines\n// explaining the functionality',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('incoming');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('more detailed');
            });

            it('should prefer current when comment lengths are similar', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: '// Comment A',
                    incomingContent: '// Comment B',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('current');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('similar content');
            });
        });

        describe('3-way merge with base content', () => {
            it('should auto-resolve when current unchanged from base', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'original content',
                    incomingContent: 'modified content',
                    baseContent: 'original content',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('incoming');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('Current side unchanged from base');
            });

            it('should auto-resolve when incoming unchanged from base', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'modified content',
                    incomingContent: 'original content',
                    baseContent: 'original content',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('current');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('Incoming side unchanged from base');
            });

            it('should auto-resolve when both sides made identical changes', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'modified content',
                    incomingContent: 'modified content',
                    baseContent: 'original content',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(true);
                expect(resolved[0].resolution).toBe('current');
                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toContain('Identical content on both sides');
            });
        });

        describe('enhanced auto-resolution tracking', () => {
            it('should track auto-resolution reasons', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: '',
                    incomingContent: 'new content',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].autoResolved).toBe(true);
                expect(resolved[0].autoResolveReason).toBe('Pure addition - incoming side has content, current side is empty');
            });

            it('should not auto-resolve complex conflicts', () => {
                const conflicts: ConflictRegion[] = [{
                    startLine: 0,
                    endLine: 3,
                    currentContent: 'function foo() { return "current"; }',
                    incomingContent: 'function foo() { return "incoming"; }',
                    isResolved: false
                }];

                const resolved = conflictResolver.resolveNonConflictingChanges(conflicts);

                expect(resolved[0].isResolved).toBe(false);
                expect(resolved[0].autoResolved).toBeUndefined();
                expect(resolved[0].autoResolveReason).toBeUndefined();
            });
        });
    });

    describe('conflict resolution state management', () => {
        describe('getConflictResolutionState', () => {
            it('should provide complete resolution state', () => {
                const conflicts: ConflictRegion[] = [
                    {
                        startLine: 0,
                        endLine: 3,
                        currentContent: 'content1',
                        incomingContent: 'other1',
                        isResolved: true,
                        resolution: 'current',
                        autoResolved: true,
                        autoResolveReason: 'Auto-resolved reason'
                    },
                    {
                        startLine: 5,
                        endLine: 8,
                        currentContent: 'content2',
                        incomingContent: 'other2',
                        isResolved: false
                    }
                ];

                const state = conflictResolver.getConflictResolutionState(conflicts);

                expect(state.canCompleteAutomatically).toBe(false);
                expect(state.requiresManualIntervention).toBe(true);
                expect(state.autoResolvedConflicts).toHaveLength(1);
                expect(state.manualConflicts).toHaveLength(1);
                expect(state.resolutionSummary).toContain('1 conflict auto-resolved');
                expect(state.nextAction).toContain('resolve the remaining 1 conflict');
            });

            it('should handle all conflicts resolved', () => {
                const conflicts: ConflictRegion[] = [
                    {
                        startLine: 0,
                        endLine: 3,
                        currentContent: 'content1',
                        incomingContent: 'other1',
                        isResolved: true,
                        resolution: 'current',
                        autoResolved: true
                    }
                ];

                const state = conflictResolver.getConflictResolutionState(conflicts);

                expect(state.canCompleteAutomatically).toBe(true);
                expect(state.requiresManualIntervention).toBe(false);
                expect(state.nextAction).toBe('All conflicts resolved. Ready to complete merge.');
            });
        });

        describe('canCompleteMerge', () => {
            it('should allow completion when all conflicts resolved', () => {
                const conflicts: ConflictRegion[] = [
                    {
                        startLine: 0,
                        endLine: 3,
                        currentContent: 'content',
                        incomingContent: 'other',
                        isResolved: true,
                        resolution: 'current'
                    }
                ];

                const result = conflictResolver.canCompleteMerge(conflicts);

                expect(result.canComplete).toBe(true);
                expect(result.reason).toBe('All conflicts have been resolved');
            });

            it('should prevent completion when conflicts remain', () => {
                const conflicts: ConflictRegion[] = [
                    {
                        startLine: 0,
                        endLine: 3,
                        currentContent: 'content',
                        incomingContent: 'other',
                        isResolved: false
                    }
                ];

                const result = conflictResolver.canCompleteMerge(conflicts);

                expect(result.canComplete).toBe(false);
                expect(result.reason).toBe('1 conflict still needs to be resolved');
            });
        });

        describe('generateAutoResolutionFeedback', () => {
            it('should generate feedback for auto-resolved conflicts', () => {
                const conflicts: ConflictRegion[] = [
                    {
                        startLine: 0,
                        endLine: 3,
                        currentContent: 'content1',
                        incomingContent: 'other1',
                        isResolved: true,
                        resolution: 'current',
                        autoResolved: true,
                        autoResolveReason: 'Test reason'
                    }
                ];

                const feedback = conflictResolver.generateAutoResolutionFeedback(conflicts);

                expect(feedback.message).toBe('Automatically resolved 1 conflict');
                expect(feedback.details).toHaveLength(1);
                expect(feedback.details[0].feedback).toContain('Lines 1-4: Test reason (current)');
            });

            it('should handle no auto-resolved conflicts', () => {
                const conflicts: ConflictRegion[] = [
                    {
                        startLine: 0,
                        endLine: 3,
                        currentContent: 'content',
                        incomingContent: 'other',
                        isResolved: false
                    }
                ];

                const feedback = conflictResolver.generateAutoResolutionFeedback(conflicts);

                expect(feedback.message).toBe('No conflicts were automatically resolved.');
                expect(feedback.details).toHaveLength(0);
            });
        });
    });
});
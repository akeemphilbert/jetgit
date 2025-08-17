# Manual Testing Checklist for JetBrains Git Extension

This checklist covers manual testing scenarios for the new architecture features that require human interaction and cannot be fully automated.

## Prerequisites

- [ ] VS Code with the JetBrains Git Extension installed
- [ ] At least one Git repository in the workspace
- [ ] Multiple Git repositories for multi-repo testing
- [ ] Repository with many branches (100+) for performance testing
- [ ] Repository with diverged branches (ahead/behind commits)

## Status Bar Testing

### Single Repository
- [ ] Status bar shows `$(git-branch) <branch-name>` format
- [ ] Status bar shows dirty indicator when there are uncommitted changes
- [ ] Status bar shows ahead/behind indicators (↑n/↓m) when applicable
- [ ] Clicking status bar opens QuickPick menu within 150ms
- [ ] Status bar updates when switching branches
- [ ] Status bar updates when making commits/changes

### Multiple Repositories
- [ ] Status bar shows `$(repo) <repo-count> repos • <active-branch>` format
- [ ] Status bar shows correct repository count
- [ ] Status bar shows active repository's current branch
- [ ] Status bar updates when switching active repository
- [ ] Clicking status bar opens multi-repo QuickPick layout

### Settings Integration
- [ ] Setting `jbGit.statusBar.enabled` to `false` hides status bar item
- [ ] Setting `jbGit.statusBar.enabled` to `true` shows status bar item
- [ ] Settings changes take effect immediately without restart

## QuickPick Menu Testing

### Performance Requirements
- [ ] QuickPick opens within 150ms for repositories with ≤5k commits
- [ ] QuickPick opens within 1 second for repositories with 10k+ branches
- [ ] QuickPick remains responsive during data loading
- [ ] No noticeable lag when typing in search box
- [ ] Smooth scrolling through large branch lists

### Single Repository Layout
- [ ] Title shows "Git (<repo-name>)"
- [ ] Placeholder text shows "Search for branches and actions"
- [ ] Top actions section includes:
  - [ ] Update Project…
  - [ ] Commit…
  - [ ] Push…
  - [ ] New Branch…
  - [ ] Checkout Tag or Revision…
- [ ] Sections appear in order: Recent, Local, Remote, Tags
- [ ] Current branch marked with ⭐ icon
- [ ] Branch grouping works for prefixed branches (feature/, bugfix/, etc.)
- [ ] Remote branches grouped by remote name
- [ ] Recent section only appears when MRU branches exist
- [ ] Recent section shows most recently used branches first

### Multi Repository Layout
- [ ] Title shows "Git (<count> repositories)"
- [ ] Divergence warning banner appears when any repo has diverged
- [ ] Repository grid shows folder icons and current branches
- [ ] Divergence badges (↑n/↓m) appear for repositories with ahead/behind commits
- [ ] Common Local Branches section shows branches present in multiple repos
- [ ] Common Remote Branches section shows remote branches present in multiple repos
- [ ] Selecting a repository drills into single-repo layout
- [ ] Repository switching updates active repository context

### Keyboard Navigation
- [ ] Up/Down arrow keys navigate through items
- [ ] Enter key selects highlighted item
- [ ] Escape key closes QuickPick
- [ ] Type-ahead filtering works for branches and actions
- [ ] Filtered results update in real-time while typing
- [ ] Clear search with Backspace/Delete works correctly

### Search and Filtering
- [ ] Type-ahead search filters branches by name
- [ ] Search works across all sections (Recent, Local, Remote, Tags)
- [ ] Search highlights matching text in results
- [ ] Search is case-insensitive
- [ ] Special characters in search work correctly
- [ ] Empty search shows all items

## Repository Context Management

### Single Repository
- [ ] Active repository is automatically set when only one exists
- [ ] Repository context updates when branches change
- [ ] Repository context persists across VS Code sessions

### Multiple Repositories
- [ ] Repository switcher appears in multi-repo scenarios
- [ ] Active repository can be changed via QuickPick selection
- [ ] Active repository change updates status bar immediately
- [ ] Active repository change updates QuickPick content
- [ ] Repository context change events fire correctly

### MRU (Most Recently Used) Branches
- [ ] Checking out a branch adds it to MRU list
- [ ] MRU list is limited to 20 branches per repository
- [ ] MRU list persists across VS Code sessions
- [ ] MRU list is separate for each repository
- [ ] Deleted branches are removed from MRU list
- [ ] Recent section shows MRU branches in correct order

## Divergence Detection and Display

### Single Repository
- [ ] Ahead/behind indicators show in status bar
- [ ] Branch items show divergence badges when applicable
- [ ] Divergence information updates after fetch/pull operations

### Multiple Repositories
- [ ] Divergence warning banner appears when any repo has diverged
- [ ] Repository grid shows divergence badges per repository
- [ ] Divergence detection works across all repositories
- [ ] Divergence warning disappears when all repos are up-to-date

## SCM View Integration

### View Visibility
- [ ] SCM view appears when `jbGit.scmView.enabled` is `true`
- [ ] SCM view hides when `jbGit.scmView.enabled` is `false`
- [ ] Setting changes take effect immediately

### Tree Structure
- [ ] Tree shows sections: Recent, Local, Remote, Tags
- [ ] Changelists section appears when `jbGit.showChangelists` is `true`
- [ ] Tree items show appropriate icons (branch, remote, tag)
- [ ] Current branch marked with ⭐ icon
- [ ] Branch grouping works in tree view

### View Title Actions
- [ ] Refresh button updates tree content
- [ ] Repository switcher appears in multi-repo scenarios
- [ ] Create branch button opens branch creation dialog
- [ ] New changelist button appears when changelists enabled

### Context Menus
- [ ] Right-click on branch shows context menu
- [ ] Context menu actions mirror QuickPick actions
- [ ] Context menu actions work correctly

## Error Handling and Edge Cases

### Network Issues
- [ ] Graceful handling of network timeouts during fetch operations
- [ ] Appropriate error messages for authentication failures
- [ ] Recovery from temporary network issues

### Repository Issues
- [ ] Handling of corrupted Git repositories
- [ ] Graceful degradation when Git is not available
- [ ] Appropriate messaging for non-Git directories

### Performance Edge Cases
- [ ] Handling repositories with 10,000+ branches
- [ ] Handling repositories with very long branch names
- [ ] Handling repositories with special characters in branch names
- [ ] Memory usage remains stable during extended use

## Settings and Configuration

### Feature Flags
- [ ] `jbGit.statusBar.enabled` controls status bar visibility
- [ ] `jbGit.scmView.enabled` controls SCM view visibility
- [ ] `jbGit.showChangelists` controls changelist features
- [ ] `jbGit.updateProject.mode` affects Update Project behavior

### Settings Persistence
- [ ] Settings changes persist across VS Code restarts
- [ ] Settings changes take effect immediately
- [ ] Invalid setting values are handled gracefully

## Integration Testing

### VS Code Git Extension
- [ ] No conflicts with built-in Git functionality
- [ ] Git status indicators update correctly
- [ ] Source control view remains functional
- [ ] Git commands in Command Palette work

### Other Extensions
- [ ] No conflicts with other Git extensions
- [ ] No interference with other status bar items
- [ ] No conflicts with other QuickPick implementations

## Accessibility

### Keyboard Navigation
- [ ] All functionality accessible via keyboard
- [ ] Tab navigation works correctly
- [ ] Screen reader compatibility (if available for testing)

### Visual Indicators
- [ ] High contrast mode support
- [ ] Color-blind friendly indicators
- [ ] Appropriate font sizes and spacing

## Performance Benchmarks

### Timing Requirements
- [ ] QuickPick opens in <150ms for repos with ≤5k commits
- [ ] QuickPick opens in <1s for repos with 10k+ branches
- [ ] Status bar updates in <100ms
- [ ] Repository switching in <200ms

### Memory Usage
- [ ] Memory usage remains stable during extended use
- [ ] No memory leaks during repeated operations
- [ ] Reasonable memory footprint with large repositories

### CPU Usage
- [ ] Low CPU usage during idle state
- [ ] Reasonable CPU usage during operations
- [ ] No excessive CPU usage during background updates

## Test Results

### Environment Information
- VS Code Version: _______________
- Extension Version: _______________
- Operating System: _______________
- Git Version: _______________
- Test Date: _______________

### Overall Results
- [ ] All critical functionality working
- [ ] Performance requirements met
- [ ] No blocking issues found
- [ ] Ready for release

### Issues Found
(List any issues discovered during testing)

1. ________________________________
2. ________________________________
3. ________________________________

### Notes
(Additional observations or comments)

_________________________________
_________________________________
_________________________________
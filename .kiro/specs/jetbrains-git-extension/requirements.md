# Requirements Document

## Introduction

This VS Code extension will provide JetBrains IDE-style Git functionality, including an enhanced Git menu with branch management, context-sensitive file operations, and an advanced diff viewer with automatic conflict resolution capabilities. The extension aims to bring the familiar and powerful Git workflow from JetBrains IDEs to VS Code users.

## Requirements

### Requirement 1

**User Story:** As a developer, I want a comprehensive Git menu that displays all branches with intelligent grouping, so that I can easily navigate and manage my Git branches.

#### Acceptance Criteria

1. WHEN the Git menu is opened THEN the system SHALL display all local and remote branches in a hierarchical list
2. WHEN branches have common prefixes (e.g., "feature/", "bugfix/") THEN the system SHALL group them under collapsible folder-like sections
3. WHEN a branch is selected from the menu THEN the system SHALL provide options "new branch from", "show diff with working tree", "update", "push", "rename"
4. WHEN "new branch from" is selected THEN the system SHALL prompt for a new branch name and create a branch starting from the selected branch's HEAD
5. WHEN "show diff with working tree" is selected THEN the system SHALL display a diff view comparing the selected branch with current working directory changes
6. WHEN "update" is selected on a local branch THEN the system SHALL pull the latest changes from its upstream remote branch
7. WHEN "push" is selected on a local branch THEN the system SHALL push the branch to its configured remote repository
8. WHEN "rename" is selected THEN the system SHALL prompt for a new branch name and rename the selected branch locally
9. WHEN the menu is displayed THEN the system SHALL highlight the current active branch
10. WHEN remote branches are shown THEN the system SHALL distinguish them visually from local branches

### Requirement 2

**User Story:** As a developer, I want quick access to common Git operations from the main Git menu, so that I can perform routine Git tasks efficiently.

#### Acceptance Criteria

1. WHEN the Git menu is opened THEN the system SHALL display a dedicated section for common tasks including update, commit, push, and fetch operations at the top of the menu
2. WHEN the "New Branch" option is selected THEN the system SHALL prompt for branch name and create a new branch from current HEAD
3. WHEN the "Checkout Revision" option is selected THEN the system SHALL allow input of commit hash, tag, or branch name for checkout
4. WHEN any Git operation is executed THEN the system SHALL provide visual feedback and error handling
5. WHEN operations complete THEN the system SHALL refresh the branch list and status indicators

### Requirement 3

**User Story:** As a developer, I want a comprehensive context menu when right-clicking that provides JetBrains-style Git operations, so that I can perform all Git actions quickly from any location.

#### Acceptance Criteria

1. WHEN a file or folder is right-clicked THEN the system SHALL display a Git submenu with comprehensive Git operations
2. WHEN the Git context menu is opened THEN the system SHALL include repository operations: push, pull, fetch, merge, rebase
3. WHEN the Git context menu is opened THEN the system SHALL include branch management options: branches, new branch, new tag
4. WHEN the Git context menu is opened THEN the system SHALL include file operations: show history, show current version, compare with branch, compare with revision, annotate, revert
5. WHEN the Git context menu is opened THEN the system SHALL include advanced operations: reset HEAD, stash changes, unstash changes, manage remotes
6. WHEN "Show History" is selected THEN the system SHALL display the file's commit history with diff previews
7. WHEN "Compare with Branch" is selected THEN the system SHALL allow branch selection and open diff view
8. WHEN "Merge" or "Rebase" is selected THEN the system SHALL prompt for branch selection and execute the operation
9. WHEN "New Branch" or "New Tag" is selected THEN the system SHALL prompt for name input and create the item
10. WHEN "Reset HEAD" is selected THEN the system SHALL prompt for reset mode (soft, mixed, hard) and optional commit reference
11. WHEN "Stash Changes" is selected THEN the system SHALL prompt for optional stash message and stash current changes
12. WHEN "Unstash Changes" is selected THEN the system SHALL display available stashes and allow selection for unstashing
13. WHEN "Manage Remotes" is selected THEN the system SHALL display remote management interface for adding, removing, and editing remotes
14. WHEN operations are performed on modified files THEN the system SHALL handle unsaved changes appropriately
15. WHEN a file has no Git history THEN the system SHALL display appropriate messaging and disable history-related options


### Requirement 4

**User Story:** As a developer, I want an advanced diff window similar to JetBrains IDEs, so that I can easily compare files and resolve conflicts.

#### Acceptance Criteria

1. WHEN a diff view is opened THEN the system SHALL display side-by-side comparison with syntax highlighting
2. WHEN merge conflicts are detected THEN the system SHALL highlight conflicted sections with clear visual indicators
3. WHEN viewing diffs THEN the system SHALL provide navigation buttons to jump between changes
4. WHEN in diff view THEN the system SHALL allow accepting changes from left, right, or both sides
5. WHEN conflicts exist THEN the system SHALL provide options to accept current, incoming, or both changes

### Requirement 5

**User Story:** As a developer, I want automatic conflict resolution for non-conflicting changes, so that I can focus only on actual conflicts that require manual intervention.

#### Acceptance Criteria

1. WHEN merge conflicts are detected THEN the system SHALL automatically resolve non-conflicting changes
2. WHEN automatic resolution is possible THEN the system SHALL apply changes and mark sections as resolved
3. WHEN automatic resolution occurs THEN the system SHALL provide visual feedback about what was auto-resolved
4. WHEN manual conflicts remain THEN the system SHALL clearly highlight only the sections requiring user input
5. WHEN all conflicts are resolved THEN the system SHALL enable the completion of the merge operation

### Requirement 6

**User Story:** As a developer, I want the extension to follow VS Code best practices and include comprehensive tests, so that I can rely on stable and maintainable functionality.

#### Acceptance Criteria

1. WHEN the extension is developed THEN the system SHALL follow VS Code extension development best practices
2. WHEN the extension is built THEN the system SHALL include unit tests for all core functionality
3. WHEN the extension is tested THEN the system SHALL include integration tests for Git operations
4. WHEN the extension is packaged THEN the system SHALL include proper error handling and logging
5. WHEN the extension is published THEN the system SHALL include comprehensive documentation and usage examples

### Requirement 7

**User Story:** As a developer, I want the extension to integrate seamlessly with VS Code's existing Git functionality, so that I can use both systems without conflicts.

#### Acceptance Criteria

1. WHEN the extension is active THEN the system SHALL not interfere with VS Code's built-in Git features
2. WHEN Git operations are performed THEN the system SHALL update VS Code's Git status indicators
3. WHEN the extension is installed THEN the system SHALL register appropriate command palette entries
4. WHEN keyboard shortcuts are used THEN the system SHALL respect existing VS Code Git shortcuts
5. WHEN the extension is disabled THEN the system SHALL cleanly remove all UI elements and commands

### Requirement 8

**User Story:** As a developer, I want a single status bar entry that opens a JetBrains-style QuickPick menu, so that I can access Git operations efficiently without cluttering the status bar.

#### Acceptance Criteria

1. WHEN the extension is active THEN the system SHALL display exactly one status bar item for Git operations
2. WHEN in a single repository THEN the status bar SHALL show `$(git-branch) <branch-name>` with dirty/ahead/behind indicators
3. WHEN in multiple repositories THEN the status bar SHALL show `$(repo) <repo-count> repos • <active-branch>`
4. WHEN the status bar item is clicked THEN the system SHALL open a QuickPick menu with JetBrains-style layout
5. WHEN the QuickPick opens THEN the system SHALL display within 150ms for repositories with ≤5k commits
6. WHEN using keyboard navigation THEN the system SHALL support Up/Down/Enter keys and Esc to close
7. WHEN typing in the QuickPick THEN the system SHALL support type-ahead filtering of branches and actions
8. WHEN the status bar is disabled via settings THEN the system SHALL hide the status bar item

### Requirement 9

**User Story:** As a developer, I want a QuickPick menu that adapts to single-repo vs multi-repo workspaces, so that I can work efficiently in different project structures.

#### Acceptance Criteria

1. WHEN in a single repository THEN the QuickPick SHALL display single-repo layout with search placeholder "Search for branches and actions"
2. WHEN in single-repo mode THEN the system SHALL show top actions: Update Project…, Commit…, Push…, New Branch…, Checkout Tag or Revision…
3. WHEN in single-repo mode THEN the system SHALL show sections: Recent, Local (grouped), Remote (grouped by remote), Tags
4. WHEN in multiple repositories THEN the QuickPick SHALL display multi-repo layout with repo grid
5. WHEN any repo has diverged THEN the system SHALL show warning banner "⚠ Branches have diverged"
6. WHEN in multi-repo mode THEN the system SHALL show repo grid with folder icons, names, current branches, and divergence badges
7. WHEN in multi-repo mode THEN the system SHALL show Common Local Branches and Common Remote Branches sections
8. WHEN a repo item is selected THEN the system SHALL drill into that repo's single-repo layout view
9. WHEN branches are displayed THEN the system SHALL show divergence indicators `↑n`/`↓m` where applicable
10. WHEN the current branch is shown THEN the system SHALL mark it with ⭐ icon

### Requirement 10

**User Story:** As a developer, I want an SCM view that lists branches and changelists in a tree structure, so that I can have persistent access to Git information.

#### Acceptance Criteria

1. WHEN the SCM view is enabled THEN the system SHALL display "Git (JetBrains)" view in the SCM panel
2. WHEN the SCM view is displayed THEN the system SHALL show tree sections: Recent, Local, Remote, Tags
3. WHEN changelists are enabled THEN the system SHALL show additional Changelists section
4. WHEN the SCM view is active THEN the system SHALL show title actions: repo switcher, refresh, create branch
5. WHEN changelists are enabled THEN the system SHALL show additional "new changelist" title action
6. WHEN the SCM view is disabled via settings THEN the system SHALL hide the entire view
7. WHEN context menus are opened in SCM view THEN the system SHALL mirror QuickPick actions
8. WHEN repository changes occur THEN the system SHALL refresh the SCM view automatically

### Requirement 11

**User Story:** As a developer, I want repository context management that tracks active repositories and provides switching capabilities, so that I can work efficiently in multi-repo workspaces.

#### Acceptance Criteria

1. WHEN multiple repositories are detected THEN the system SHALL provide repository switching capabilities
2. WHEN the active repository changes THEN the system SHALL emit change events to update UI components
3. WHEN repositories are listed THEN the system SHALL provide listRepositories(), getActiveRepository(), setActiveRepository() methods
4. WHEN repository context changes THEN the system SHALL update status bar text and QuickPick content
5. WHEN MRU (Most Recently Used) branches are tracked THEN the system SHALL persist per-repo MRU in globalState with cap at 20

### Requirement 12

**User Story:** As a developer, I want configurable settings for the new Git surfaces, so that I can customize the experience to my preferences.

#### Acceptance Criteria

1. WHEN jbGit.statusBar.enabled is false THEN the system SHALL hide the status bar item
2. WHEN jbGit.scmView.enabled is false THEN the system SHALL hide the SCM view
3. WHEN jbGit.updateProject.mode is set THEN the system SHALL respect "pull", "pullRebase", or "fetchRebaseInteractive" modes
4. WHEN jbGit.showChangelists is false THEN the system SHALL hide changelist-related UI elements
5. WHEN settings change THEN the system SHALL update UI components immediately without requiring restart
 # Implementation Plan

- [x] 1. Set up VS Code extension project structure and core interfaces
  - Create TypeScript VS Code extension project with proper package.json configuration
  - Set up build system with esbuild and TypeScript compilation
  - Define core interfaces for GitService, Branch, Remote, and other data models
  - Configure extension activation events and basic command registration
  - _Requirements: 6.1, 6.2, 7.3_

- [x] 2. Implement Git Service Layer foundation
  - Create GitService class with VS Code Git API integration
  - Implement basic repository detection and status checking
  - Add error handling utilities and GitError class
  - Write unit tests for GitService foundation
  - _Requirements: 6.1, 6.4_

- [x] 3. Implement branch management operations
  - Add getBranches() method with local and remote branch detection
  - Implement createBranch(), checkoutBranch(), and renameBranch() methods
  - Add branch grouping logic for hierarchical display (feature/, bugfix/ prefixes)
  - Write unit tests for branch operations
  - _Requirements: 1.1, 1.2, 1.4, 1.8_

- [x] 4. Implement repository operations (fetch, pull, push, commit)
  - Add fetch(), pull(), push(), and commit() methods to GitService
  - Implement progress tracking and user feedback for long-running operations
  - Add error handling for network and authentication issues
  - Write unit tests for repository operations
  - _Requirements: 2.1, 2.4, 3.2_

- [x] 5. Implement advanced Git operations (merge, rebase, reset, stash)
  - Add merge() and rebase() methods with conflict detection
  - Implement resetHead() with support for soft, mixed, and hard modes
  - Add stashChanges() and unstashChanges() with stash management
  - Write unit tests for advanced operations
  - _Requirements: 3.8, 3.10, 3.11, 3.12_

- [x] 6. Implement remote management operations
  - Add getRemotes(), addRemote(), and removeRemote() methods
  - Create Remote data model and validation
  - Implement remote URL validation and connectivity testing
  - Write unit tests for remote operations
  - _Requirements: 3.13_

- [x] 7. Create toolbar dropdown menu provider
  - Implement command registration for toolbar Git menu button
  - Create menu structure with common tasks section at top
  - Add branch hierarchy display with grouping and current branch highlighting
  - Implement menu item selection handlers for all operations
  - _Requirements: 1.1, 1.3, 1.9, 1.10, 2.1_

- [x] 8. Implement branch selection operations from main menu
  - Add "new branch from" functionality with branch name input prompt
  - Implement "show diff with working tree" with diff viewer integration
  - Add "update" operation for pulling latest changes from upstream
  - Implement "push" and "rename" operations for selected branches
  - Write integration tests for branch menu operations
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 9. Create comprehensive context menu provider
  - Register Git submenu for file and folder context menus
  - Implement repository operations section (push, pull, fetch, merge, rebase)
  - Add branch management section (branches, new branch, new tag)
  - Create file operations section (history, compare, annotate, revert)
  - Add advanced operations section (reset, stash, remotes)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 10. Implement file-specific Git operations
  - Add getFileHistory() method with commit information retrieval
  - Implement getFileDiff() for file comparison between revisions
  - Add revertFile() operation with confirmation prompts
  - Create file annotation (blame) functionality
  - Write unit tests for file operations
  - _Requirements: 3.6, 3.7, 3.14, 3.15_

- [x] 11. Create custom diff viewer with webview
  - Implement webview-based diff interface with side-by-side comparison
  - Add syntax highlighting and line number display
  - Create navigation controls for jumping between changes
  - Implement change acceptance controls (left, right, both sides)
  - _Requirements: 4.1, 4.3, 4.4_

- [x] 12. Implement conflict detection and resolution
  - Add conflict detection logic for merge and rebase operations
  - Create ConflictRegion data model and conflict parsing
  - Implement automatic resolution for non-conflicting changes
  - Add visual indicators for conflicted sections in diff viewer
  - Write unit tests for conflict detection algorithms
  - _Requirements: 4.2, 5.1, 5.2, 5.4_

- [x] 13. Implement automatic conflict resolution
  - Create algorithms for resolving non-conflicting changes automatically
  - Add visual feedback for auto-resolved sections
  - Implement conflict resolution state management
  - Enable merge completion when all conflicts are resolved
  - Write unit tests for automatic resolution logic
  - _Requirements: 5.1`1    
  , 5.2, 5.3, 5.5_

- [x] 14. Add user interaction prompts and dialogs
  - Create input dialogs for branch names, tag names, and commit messages
  - Implement branch selection dialogs for merge and rebase operations
  - Add confirmation dialogs for destructive operations (reset, revert)
  - Create stash selection interface for unstash operations
  - _Requirements: 1.4, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 15. Implement VS Code integration and status updates
  - Add integration with VS Code's Git status indicators
  - Implement command palette registration for all Git operations
  - Add keyboard shortcut support respecting existing VS Code shortcuts
  - Ensure proper cleanup when extension is disabled
  - Write integration tests for VS Code API interactions
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 16. Add comprehensive error handling and user feedback
  - Implement user-friendly error messages for all Git operations
  - Add progress indicators for long-running operations
  - Create toast notifications for operation completion
  - Add logging system for debugging and troubleshooting
  - Write tests for error scenarios and recovery paths
  - _Requirements: 2.4, 6.4_

- [x] 17. Create comprehensive test suite
  - Write unit tests for all GitService methods and utilities
  - Add integration tests for VS Code API interactions
  - Create end-to-end tests for complete user workflows
  - Add performance tests for large repositories
  - Set up continuous integration testing pipeline
  - _Requirements: 6.2, 6.3_

- [x] 18. Add documentation and examples
  - Create README with installation and usage instructions
  - Add inline code documentation and JSDoc comments
  - Create example workflows and screenshots
  - Write troubleshooting guide for common issues
  - _Requirements: 6.5_

- [x] 19. Refactor to single status bar entry with JetBrains-style QuickPick
  - Remove duplicate status bar registrations and audit existing implementations
  - Create StatusBarService singleton with init(), update() methods for repository-aware text
  - Implement single status bar item with click handler to open QuickPick menu
  - Add status bar text formatting for single-repo vs multi-repo scenarios
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.8_

- [x] 20. Implement repository context management service
  - Create RepoContextService to track active repository and emit change events
  - Implement listRepositories(), getActiveRepository(), setActiveRepository() methods
  - Add MRU (Most Recently Used) branch tracking per repository with globalState persistence
  - Integrate with VS Code Git API for repository detection and state management
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 21. Create JetBrains-style QuickPick menu controller
  - Implement MenuController.open() method that detects single vs multi-repo context
  - Create single-repo layout with search placeholder and top actions section
  - Implement multi-repo layout with repo grid and common branches sections
  - Add divergence warning banner when repositories have diverged
  - Ensure QuickPick opens within 150ms performance requirement
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 8.5, 8.6, 8.7_

- [ ] 22. Implement branches data provider with caching and MRU
  - Create BranchesProvider with getRecent(), getLocal(), getRemotes(), getTags() methods
  - Add divergence badge calculation with ahead/behind indicators
  - Implement branch list caching with refresh on repository change events
  - Add MRU metadata tracking and Recent branches section population
  - Debounce QuickPick data assembly to 50-100ms for performance
  - _Requirements: 9.9, 9.10, 11.5_

- [ ] 23. Wire QuickPick actions and commands
  - Implement Update Project command with configurable mode (pull/pullRebase/fetchRebaseInteractive)
  - Add Commit, Push, New Branch, Checkout Tag or Revision commands
  - Implement branch selection actions: checkout, merge, rebase, cherry-pick, rename, delete
  - Create "create branch from here" functionality for selected branches
  - Register all commands in Command Palette with proper when clauses
  - _Requirements: 9.2, 9.3, 12.3_

- [ ] 24. Create SCM view with TreeDataProvider
  - Implement SCMTreeProvider for sections: Recent, Local, Remote, Tags, Changelists
  - Add view title actions: repo switcher, refresh, create branch, new changelist
  - Create context menu items that mirror QuickPick actions
  - Implement tree item icons and badges for branches, remotes, and tags
  - Add collapsible groups for branch prefixes and remote grouping
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

- [ ] 25. Implement settings and feature flags
  - Add jbGit.statusBar.enabled, jbGit.scmView.enabled, jbGit.updateProject.mode, jbGit.showChangelists settings
  - Implement settings-based UI component visibility (status bar, SCM view, changelists)
  - Add settings change listeners to update UI immediately without restart
  - Create context keys for conditional view title button visibility
  - _Requirements: 10.6, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 26. Update package.json contributions for new architecture
  - Remove duplicate status bar contributions and ensure single StatusBarItem
  - Add SCM view contribution: "views": { "scm": [{ "id": "jbGit.explorer", "name": "Git (JetBrains)" }] }
  - Add new commands for jbGit.openMenu, jbGit.createBranch, jbGit.checkoutRef, etc.
  - Add view/title menu contributions for repo switcher, refresh, new branch, new changelist
  - Add extensionDependencies: ["vscode.git"] for Git API integration
  - _Requirements: 8.1, 10.1, 10.4, 10.5_

- [ ] 27. Add comprehensive testing for new architecture
  - Write unit tests for menu modeling (single vs multi-repo scenarios)
  - Add integration tests for multi-repo workspace handling and MRU persistence
  - Create performance tests for QuickPick open time and large repository handling
  - Add manual testing checklist for keyboard navigation, status bar toggling, fast open time
  - Test divergence banner display and repo switching functionality
  - _Requirements: 8.5, 8.6, 8.7, 9.5_

- [ ] 28. Performance optimization and caching
  - Implement branch list caching with onDidChangeRepository event refresh
  - Add debounced QuickPick data assembly (50-100ms) for smooth user experience
  - Optimize repository detection and status checking for multi-repo workspaces
  - Add performance monitoring for 150ms QuickPick open time requirement
  - _Requirements: 8.5_

- [ ] 29. Polish JetBrains-style UI and UX
  - Match wording/casing of menu items to JetBrains ("Update Project…", "Checkout Tag or Revision…")
  - Use appropriate VS Code icons: $(git-branch), $(repo), $(arrow-up), $(arrow-down), etc.
  - Implement proper keyboard navigation (Up/Down/Enter, Esc to close)
  - Add type-ahead filtering support for branches and actions
  - Set context keys for view-title buttons to show only when view == jbGit.explorer
  - _Requirements: 8.6, 8.7, 9.10_
# JetGit Usage Examples

This document provides comprehensive examples of how to use JetGit's features effectively. Each example includes step-by-step instructions and screenshots where applicable.

## Table of Contents

1. [Basic Git Operations](#basic-git-operations)
2. [Branch Management](#branch-management)
3. [File Operations](#file-operations)
4. [Conflict Resolution](#conflict-resolution)
5. [Advanced Workflows](#advanced-workflows)
6. [Context Menu Operations](#context-menu-operations)

## Basic Git Operations

### Opening the Git Menu

The Git menu is your central hub for all Git operations in JetGit.

**Method 1: Toolbar Button**
1. Look for the Git icon (source control icon) in the editor toolbar
2. Click the icon to open the dropdown menu

**Method 2: Keyboard Shortcut**
- Windows/Linux: `Ctrl+Shift+G Ctrl+Shift+M`
- Mac: `Cmd+Shift+G Cmd+Shift+M`

**Method 3: Command Palette**
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "JetGit: Show Git Menu"
3. Press Enter

### Updating Your Project (Pull Latest Changes)

**From Git Menu:**
1. Open the Git menu
2. Click "Update Project" in the Common Tasks section
3. JetGit will pull the latest changes from your upstream branch

**Using Keyboard Shortcut:**
- Windows/Linux: `Ctrl+Shift+G U`
- Mac: `Cmd+Shift+G U`

### Committing Changes

**From Git Menu:**
1. Open the Git menu
2. Click "Commit Changes" in the Common Tasks section
3. Enter your commit message in the input dialog
4. Click "OK" to commit

**Using Keyboard Shortcut:**
- Windows/Linux: `Ctrl+Shift+G C`
- Mac: `Cmd+Shift+G C`

### Pushing Changes

**From Git Menu:**
1. Open the Git menu
2. Click "Push" in the Common Tasks section
3. JetGit will push your commits to the remote repository

**Using Keyboard Shortcut:**
- Windows/Linux: `Ctrl+Shift+G P`
- Mac: `Cmd+Shift+G P`

## Branch Management

### Viewing Branch Hierarchy

JetGit automatically organizes your branches into a hierarchical structure:

```
Local Branches
├── ● main (current branch - highlighted)
├── develop
├── feature/ ▶ (expandable group)
│   ├── feature/user-authentication
│   ├── feature/payment-integration
│   └── feature/ui-improvements
├── bugfix/ ▶ (expandable group)
│   ├── bugfix/login-issue
│   └── bugfix/memory-leak
└── hotfix/ ▶ (expandable group)
    └── hotfix/security-patch

Remote Branches
├── origin/main
├── origin/develop
├── upstream/main
└── upstream/develop
```

### Creating a New Branch

**From Git Menu:**
1. Open the Git menu
2. Click "New Branch" in the Common Tasks section
3. Enter the branch name (e.g., `feature/new-feature`)
4. The branch is created from the current HEAD and checked out

**Using Keyboard Shortcut:**
- Windows/Linux: `Ctrl+Shift+G B`
- Mac: `Cmd+Shift+G B`

### Creating a Branch from Another Branch

1. Open the Git menu
2. Right-click on the source branch (e.g., `main`)
3. Select "New branch from"
4. Enter the new branch name
5. The branch is created from the selected branch's HEAD

### Switching Branches

1. Open the Git menu
2. Click on any branch name to switch to it
3. JetGit will checkout the selected branch

### Renaming a Branch

1. Open the Git menu
2. Right-click on the branch you want to rename
3. Select "Rename"
4. Enter the new branch name
5. The branch is renamed locally

### Updating a Branch (Pull from Upstream)

1. Open the Git menu
2. Right-click on the branch you want to update
3. Select "Update"
4. JetGit will pull the latest changes from the branch's upstream

### Pushing a Branch

1. Open the Git menu
2. Right-click on the branch you want to push
3. Select "Push"
4. The branch is pushed to its configured remote

## File Operations

### Viewing File History

**From Context Menu:**
1. Right-click on a file in the Explorer
2. Select "Git" → "Show History"
3. A new tab opens showing the file's commit history with:
   - Commit messages
   - Author information
   - Timestamps
   - Diff previews

**From Command Palette:**
1. Open the file you want to view history for
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Type "JetGit: Show History"
4. Press Enter

### Comparing Files with Different Branches

**Method 1: Context Menu**
1. Right-click on a file in the Explorer
2. Select "Git" → "Compare with Branch"
3. Choose the target branch from the dropdown
4. The diff viewer opens showing side-by-side comparison

**Method 2: Git Menu**
1. Open the Git menu
2. Right-click on a branch
3. Select "Show diff with working tree"
4. Choose the file to compare

**Using Keyboard Shortcut:**
- Windows/Linux: `Ctrl+Shift+G D`
- Mac: `Cmd+Shift+G D`

### Comparing Files with Specific Revisions

1. Right-click on a file in the Explorer
2. Select "Git" → "Compare with Revision"
3. Enter the commit hash, tag, or branch name
4. The diff viewer opens with the comparison

### Annotating Files (Git Blame)

1. Right-click on a file in the Explorer
2. Select "Git" → "Annotate"
3. The file opens with line-by-line author and commit information

### Reverting File Changes

1. Right-click on a modified file in the Explorer
2. Select "Git" → "Revert"
3. Confirm the revert operation
4. The file is reverted to its last committed state

## Conflict Resolution

### Automatic Conflict Resolution

JetGit automatically resolves non-conflicting changes during merge operations:

1. Perform a merge that results in conflicts
2. JetGit opens the diff viewer automatically
3. Non-conflicting changes are resolved and marked as ✅ Auto-resolved
4. Only actual conflicts require manual intervention

### Manual Conflict Resolution

When manual conflicts remain:

1. The diff viewer highlights conflicted sections with clear markers
2. For each conflict, you can choose:
   - **Accept Current**: Keep the version from your current branch
   - **Accept Incoming**: Keep the version from the branch being merged
   - **Accept Both**: Include both versions
   - **Manual Edit**: Manually edit the conflict region

3. Navigate between conflicts using the "Previous" and "Next" buttons
4. Once all conflicts are resolved, click "Complete Merge"

### Example Conflict Resolution Workflow

```
1. Merge feature branch into main
   git merge feature/user-auth

2. JetGit detects conflicts and opens diff viewer

3. Conflict regions are highlighted:
   <<<<<<< HEAD (Current)
   const API_URL = 'https://api.prod.com';
   =======
   const API_URL = 'https://api.staging.com';
   >>>>>>> feature/user-auth (Incoming)

4. Choose resolution:
   - Click "Accept Current" to keep production URL
   - Click "Accept Incoming" to use staging URL
   - Click "Accept Both" to include both (usually not desired)
   - Manually edit to create: const API_URL = process.env.API_URL;

5. Repeat for all conflicts

6. Click "Complete Merge" when done
```

## Advanced Workflows

### Feature Branch Workflow

**Creating and Working on a Feature:**

1. **Start from main branch:**
   ```
   Git Menu → Right-click "main" → "New branch from"
   Enter: feature/user-authentication
   ```

2. **Make your changes and commit:**
   ```
   Edit files...
   Git Menu → "Commit Changes"
   Enter commit message: "Add user authentication logic"
   ```

3. **Push the feature branch:**
   ```
   Git Menu → Right-click "feature/user-authentication" → "Push"
   ```

4. **Keep feature branch updated:**
   ```
   Git Menu → Right-click "main" → "Update" (pull latest)
   Git Menu → Right-click "feature/user-authentication" → "Update"
   ```

5. **Merge back to main:**
   ```
   Switch to main: Git Menu → Click "main"
   Context Menu → "Git" → "Merge"
   Select: feature/user-authentication
   Resolve any conflicts using JetGit's diff viewer
   ```

### Hotfix Workflow

**Creating and Deploying a Hotfix:**

1. **Create hotfix from production:**
   ```
   Git Menu → Right-click "main" → "New branch from"
   Enter: hotfix/security-patch
   ```

2. **Make the fix and test:**
   ```
   Edit files...
   Git Menu → "Commit Changes"
   Enter: "Fix security vulnerability in auth module"
   ```

3. **Push hotfix:**
   ```
   Git Menu → Right-click "hotfix/security-patch" → "Push"
   ```

4. **Merge to main and develop:**
   ```
   Switch to main: Git Menu → Click "main"
   Context Menu → "Git" → "Merge"
   Select: hotfix/security-patch
   
   Switch to develop: Git Menu → Click "develop"
   Context Menu → "Git" → "Merge"
   Select: hotfix/security-patch
   ```

### Release Workflow

**Preparing a Release:**

1. **Create release branch:**
   ```
   Git Menu → Right-click "develop" → "New branch from"
   Enter: release/v1.2.0
   ```

2. **Finalize release (version bumps, changelog, etc.):**
   ```
   Edit version files...
   Git Menu → "Commit Changes"
   Enter: "Bump version to 1.2.0"
   ```

3. **Create release tag:**
   ```
   Context Menu → "Git" → "New Tag"
   Enter: v1.2.0
   Enter message: "Release version 1.2.0"
   ```

4. **Merge to main and develop:**
   ```
   Switch to main: Git Menu → Click "main"
   Context Menu → "Git" → "Merge"
   Select: release/v1.2.0
   
   Switch to develop: Git Menu → Click "develop"
   Context Menu → "Git" → "Merge"
   Select: release/v1.2.0
   ```

## Context Menu Operations

### Repository Operations

**Accessing Repository Operations:**
1. Right-click anywhere in the Explorer
2. Select "Git" to open the submenu
3. Repository operations are in the first group:
   - Pull
   - Push
   - Fetch
   - Merge
   - Rebase

**Pull Operation:**
1. Right-click in Explorer → "Git" → "Pull"
2. JetGit pulls changes from the current branch's upstream
3. Progress is shown in the status bar

**Push Operation:**
1. Right-click in Explorer → "Git" → "Push"
2. JetGit pushes commits to the remote repository
3. Success notification is displayed

**Fetch Operation:**
1. Right-click in Explorer → "Git" → "Fetch"
2. JetGit fetches latest changes without merging
3. Remote branch information is updated

**Merge Operation:**
1. Right-click in Explorer → "Git" → "Merge"
2. Select the branch to merge from the dropdown
3. JetGit performs the merge with automatic conflict resolution

**Rebase Operation:**
1. Right-click in Explorer → "Git" → "Rebase"
2. Select the target branch for rebasing
3. JetGit performs an interactive rebase

### Branch Management Operations

**Creating New Branch:**
1. Right-click in Explorer → "Git" → "New Branch"
2. Enter the branch name
3. Branch is created from current HEAD

**Creating New Tag:**
1. Right-click in Explorer → "Git" → "New Tag"
2. Enter tag name and optional message
3. Tag is created at current HEAD

**Accessing Branch Menu:**
1. Right-click in Explorer → "Git" → "Branches"
2. The full Git menu opens with branch hierarchy

### Advanced Operations

**Reset HEAD:**
1. Right-click in Explorer → "Git" → "Reset HEAD"
2. Choose reset mode:
   - **Soft**: Keep changes staged
   - **Mixed**: Keep changes unstaged
   - **Hard**: Discard all changes
3. Optionally specify a commit reference

**Stash Changes:**
1. Right-click in Explorer → "Git" → "Stash Changes"
2. Enter optional stash message
3. Current changes are stashed

**Unstash Changes:**
1. Right-click in Explorer → "Git" → "Unstash Changes"
2. Select from available stashes
3. Stash is applied to working directory

**Manage Remotes:**
1. Right-click in Explorer → "Git" → "Manage Remotes"
2. Add, remove, or edit remote repositories
3. Test remote connectivity

## Tips and Best Practices

### Branch Naming Conventions

Use consistent prefixes for automatic grouping:
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes
- `release/` - Release preparation
- `experiment/` - Experimental changes

### Keyboard Shortcuts

Memorize these common shortcuts for faster workflow:
- `Ctrl+Shift+G Ctrl+Shift+M` - Open Git menu
- `Ctrl+Shift+G U` - Update project
- `Ctrl+Shift+G C` - Commit changes
- `Ctrl+Shift+G P` - Push
- `Ctrl+Shift+G B` - New branch
- `Ctrl+Shift+G D` - Compare with branch

### Conflict Resolution Tips

1. **Review auto-resolved changes** - JetGit shows what was automatically resolved
2. **Use the navigation buttons** - Jump between conflicts efficiently
3. **Test after resolution** - Always test your code after resolving conflicts
4. **Commit immediately** - Don't leave resolved conflicts uncommitted

### Performance Tips

1. **Use branch grouping** - Organize branches with consistent prefixes
2. **Regular cleanup** - Delete merged branches to keep the menu clean
3. **Fetch regularly** - Keep remote information up to date
4. **Use stash** - Stash work-in-progress before switching branches

---

For more information, see the main [README](../README.md) or visit our [GitHub repository](https://github.com/your-username/jetgit).
# JetGit Troubleshooting Guide

This guide helps you resolve common issues with the JetGit extension. If you can't find a solution here, please check our [GitHub Issues](https://github.com/your-username/jetgit/issues) or create a new issue.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Git Menu Issues](#git-menu-issues)
3. [Branch Management Issues](#branch-management-issues)
4. [Context Menu Issues](#context-menu-issues)
5. [Diff Viewer Issues](#diff-viewer-issues)
6. [Performance Issues](#performance-issues)
7. [Conflict Resolution Issues](#conflict-resolution-issues)
8. [Integration Issues](#integration-issues)
9. [Debugging and Logs](#debugging-and-logs)
10. [Getting Help](#getting-help)

## Installation Issues

### Extension Not Installing

**Problem**: JetGit extension fails to install from the marketplace.

**Solutions**:
1. **Check VS Code version**: Ensure you're running VS Code 1.74.0 or later
   ```bash
   code --version
   ```

2. **Clear extension cache**:
   - Close VS Code
   - Delete the extensions cache:
     - Windows: `%USERPROFILE%\.vscode\extensions`
     - macOS: `~/.vscode/extensions`
     - Linux: `~/.vscode/extensions`
   - Restart VS Code and try installing again

3. **Install manually**:
   - Download the `.vsix` file from releases
   - Use `Extensions: Install from VSIX...` command

4. **Check network connectivity**:
   - Ensure you can access the VS Code marketplace
   - Check corporate firewall settings

### Extension Not Activating

**Problem**: JetGit is installed but not working.

**Solutions**:
1. **Check activation events**: JetGit activates when a Git repository is detected
   - Open a folder with a Git repository
   - Run `git init` in your workspace if needed

2. **Reload VS Code window**:
   - `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Type "Developer: Reload Window"
   - Press Enter

3. **Check extension status**:
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Find JetGit and ensure it's enabled
   - Check for any error messages

4. **Check VS Code logs**:
   - `Help` → `Toggle Developer Tools`
   - Check Console tab for errors

## Git Menu Issues

### Git Menu Not Showing

**Problem**: The Git menu button doesn't appear in the toolbar.

**Solutions**:
1. **Verify Git repository**: JetGit only shows when a Git repository is detected
   ```bash
   git status  # Should not show "not a git repository"
   ```

2. **Check Git extension**: Ensure VS Code's built-in Git extension is enabled
   - Go to Extensions view
   - Search for "Git" (by Microsoft)
   - Ensure it's enabled

3. **Restart VS Code**: Sometimes a simple restart resolves UI issues

4. **Check workspace trust**: Ensure your workspace is trusted
   - `File` → `Trust Workspace`

### Git Menu Empty or Not Loading

**Problem**: Git menu opens but shows no content or is stuck loading.

**Solutions**:
1. **Check Git installation**: Ensure Git is installed and in PATH
   ```bash
   git --version  # Should show Git version
   ```

2. **Verify repository state**: Check if the repository is in a valid state
   ```bash
   git status
   git branch -a
   ```

3. **Clear Git cache**: Sometimes Git cache gets corrupted
   ```bash
   git gc --prune=now
   ```

4. **Check permissions**: Ensure you have read/write access to the repository

### Keyboard Shortcut Not Working

**Problem**: `Ctrl+Shift+G Ctrl+Shift+M` doesn't open the Git menu.

**Solutions**:
1. **Check keybinding conflicts**:
   - `File` → `Preferences` → `Keyboard Shortcuts`
   - Search for "jetgit.showGitMenu"
   - Resolve any conflicts

2. **Reset keybindings**:
   - Remove custom keybindings for JetGit commands
   - Restart VS Code

3. **Use alternative methods**:
   - Command Palette: `JetGit: Show Git Menu`
   - Click the toolbar button

## Branch Management Issues

### Branches Not Showing

**Problem**: Local or remote branches are missing from the Git menu.

**Solutions**:
1. **Fetch latest information**:
   ```bash
   git fetch --all
   git branch -a  # Verify branches exist
   ```

2. **Check branch filters**: JetGit shows all branches by default
   - Ensure no custom Git configuration is filtering branches

3. **Refresh the menu**:
   - Close and reopen the Git menu
   - Use `JetGit: Refresh Git Status` command

4. **Check remote configuration**:
   ```bash
   git remote -v  # Verify remotes are configured
   ```

### Branch Creation Fails

**Problem**: Cannot create new branches through JetGit.

**Solutions**:
1. **Check branch name validity**:
   - Avoid special characters: `<>:"|?*`
   - Don't start with `-` or end with `.`
   - Use forward slashes for grouping: `feature/branch-name`

2. **Verify permissions**: Ensure you can create branches
   ```bash
   git checkout -b test-branch  # Test manually
   git branch -d test-branch    # Clean up
   ```

3. **Check repository state**: Ensure you're not in a detached HEAD state
   ```bash
   git status  # Should show "On branch ..."
   ```

4. **Resolve uncommitted changes**:
   - Commit or stash changes before creating branches
   - Use `git status` to check for uncommitted changes

### Branch Switching Fails

**Problem**: Cannot switch branches through JetGit.

**Solutions**:
1. **Check for uncommitted changes**:
   ```bash
   git status
   ```
   - Commit changes: `git commit -am "WIP"`
   - Or stash changes: `git stash`

2. **Resolve merge conflicts**: If in the middle of a merge
   ```bash
   git merge --abort  # Abort current merge
   # Or resolve conflicts and commit
   ```

3. **Check branch existence**:
   ```bash
   git branch -a  # Verify target branch exists
   ```

4. **Force checkout** (use with caution):
   ```bash
   git checkout -f branch-name
   ```

## Context Menu Issues

### Git Context Menu Missing

**Problem**: Right-click context menu doesn't show Git options.

**Solutions**:
1. **Verify Git repository**: Context menu only appears in Git repositories

2. **Check menu registration**: Restart VS Code to re-register menus

3. **Verify file/folder context**: Some Git operations are context-sensitive
   - File operations work on files
   - Repository operations work on folders

4. **Check extension conflicts**: Other Git extensions might interfere
   - Temporarily disable other Git extensions
   - Test if JetGit context menu appears

### Context Menu Commands Not Working

**Problem**: Git context menu items don't execute properly.

**Solutions**:
1. **Check command registration**: Use Command Palette to test commands
   - `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Search for "JetGit" commands

2. **Verify file selection**: Ensure you're right-clicking on the correct file/folder

3. **Check Git status**: Some commands require specific Git states
   - File must be tracked for history operations
   - Repository must be clean for some operations

## Diff Viewer Issues

### Diff Viewer Not Opening

**Problem**: Diff viewer doesn't open when comparing files or branches.

**Solutions**:
1. **Check file differences**: Ensure there are actual differences to show
   ```bash
   git diff branch1 branch2 -- filename
   ```

2. **Verify file tracking**: File must be tracked by Git
   ```bash
   git ls-files | grep filename
   ```

3. **Check webview support**: Ensure VS Code can create webviews
   - Try other extensions that use webviews
   - Check VS Code settings for webview restrictions

4. **Clear webview cache**:
   - Close all diff viewers
   - Restart VS Code

### Diff Viewer Shows Blank Content

**Problem**: Diff viewer opens but shows no content.

**Solutions**:
1. **Check file encoding**: Ensure files use supported encoding (UTF-8)

2. **Verify file size**: Very large files might not display properly
   - JetGit has limits for performance reasons

3. **Check file type**: Binary files won't show text diffs

4. **Refresh the diff**:
   - Close the diff viewer
   - Reopen the comparison

### Syntax Highlighting Missing

**Problem**: Diff viewer doesn't show syntax highlighting.

**Solutions**:
1. **Check file extension**: Ensure file has proper extension for language detection

2. **Install language extensions**: Install relevant language support extensions

3. **Check VS Code theme**: Some themes might not support diff highlighting

## Performance Issues

### Slow Git Operations

**Problem**: Git operations through JetGit are slow.

**Solutions**:
1. **Check repository size**: Large repositories naturally take longer
   ```bash
   git count-objects -vH  # Check repository size
   ```

2. **Optimize Git configuration**:
   ```bash
   git config core.preloadindex true
   git config core.fscache true
   git config gc.auto 256
   ```

3. **Clean up repository**:
   ```bash
   git gc --aggressive --prune=now
   git remote prune origin
   ```

4. **Check disk space**: Ensure adequate free disk space

5. **Disable real-time scanning**: Temporarily disable antivirus real-time scanning

### High Memory Usage

**Problem**: JetGit uses excessive memory.

**Solutions**:
1. **Restart VS Code**: Clear memory leaks with a restart

2. **Check repository size**: Large repositories require more memory

3. **Limit branch display**: Very large numbers of branches can impact performance

4. **Close unused diff viewers**: Each diff viewer uses memory

5. **Update VS Code**: Ensure you're using the latest version

### UI Freezing

**Problem**: VS Code becomes unresponsive during Git operations.

**Solutions**:
1. **Wait for completion**: Some operations take time, especially on large repositories

2. **Check background processes**: Ensure no other Git operations are running

3. **Restart VS Code**: Force restart if completely frozen

4. **Check system resources**: Ensure adequate RAM and CPU availability

## Conflict Resolution Issues

### Conflicts Not Detected

**Problem**: JetGit doesn't detect merge conflicts.

**Solutions**:
1. **Verify conflict state**: Check if conflicts actually exist
   ```bash
   git status  # Should show "both modified" files
   ```

2. **Check file content**: Look for conflict markers
   ```bash
   grep -n "<<<<<<< HEAD" filename
   ```

3. **Refresh conflict detection**: Close and reopen the diff viewer

### Auto-Resolution Not Working

**Problem**: JetGit doesn't automatically resolve non-conflicting changes.

**Solutions**:
1. **Check conflict complexity**: Very complex conflicts might not auto-resolve

2. **Verify file format**: Auto-resolution works best with text files

3. **Manual resolution**: Use manual resolution for complex cases

4. **Check merge strategy**: Some merge strategies don't support auto-resolution

### Cannot Complete Merge

**Problem**: "Complete Merge" button is disabled or not working.

**Solutions**:
1. **Resolve all conflicts**: Ensure all conflict regions are resolved

2. **Check file status**: All conflicted files must be resolved
   ```bash
   git status  # Should show no "both modified" files
   ```

3. **Stage resolved files**:
   ```bash
   git add .  # Stage all resolved files
   ```

4. **Complete merge manually**:
   ```bash
   git commit  # Complete the merge
   ```

## Integration Issues

### VS Code Git Integration Conflicts

**Problem**: JetGit conflicts with VS Code's built-in Git features.

**Solutions**:
1. **Keep both enabled**: JetGit is designed to work alongside VS Code Git

2. **Check settings**: Ensure Git settings are compatible
   ```json
   {
     "git.enableSmartCommit": true,
     "git.confirmSync": false,
     "git.autofetch": true
   }
   ```

3. **Restart VS Code**: Reload to reset integration

### Other Git Extensions Conflicts

**Problem**: JetGit conflicts with other Git extensions.

**Solutions**:
1. **Identify conflicts**: Disable other Git extensions temporarily

2. **Check command conflicts**: Look for duplicate commands in Command Palette

3. **Configure extension priority**: Some extensions allow priority configuration

4. **Use complementary extensions**: Choose extensions that complement rather than duplicate functionality

## Debugging and Logs

### Enabling Debug Mode

To get more detailed information about JetGit operations:

1. **Open Developer Tools**:
   - `Help` → `Toggle Developer Tools`
   - Check Console tab for JetGit messages

2. **Enable VS Code logging**:
   ```bash
   code --log-level=debug
   ```

3. **Check extension logs**:
   - Look for JetGit-related messages in the console
   - Note any error messages or stack traces

### Collecting Debug Information

When reporting issues, include:

1. **VS Code version**: `Help` → `About`
2. **JetGit version**: Check in Extensions view
3. **Operating system**: Windows/macOS/Linux version
4. **Git version**: `git --version`
5. **Repository information**:
   ```bash
   git status
   git branch -a
   git remote -v
   ```
6. **Error messages**: Copy exact error text
7. **Steps to reproduce**: Detailed reproduction steps

### Common Error Messages

**"Git repository not found"**
- Ensure you're in a Git repository
- Run `git init` if needed

**"Permission denied"**
- Check file/folder permissions
- Ensure Git credentials are configured

**"Branch already exists"**
- Choose a different branch name
- Delete existing branch if appropriate

**"Cannot checkout branch"**
- Commit or stash uncommitted changes
- Resolve any merge conflicts

**"Remote repository not found"**
- Check remote URL configuration
- Verify network connectivity

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Search existing GitHub issues**
3. **Try the basic solutions** (restart VS Code, reload window)
4. **Collect debug information** (versions, error messages, steps to reproduce)

### Where to Get Help

1. **GitHub Issues**: [https://github.com/your-username/jetgit/issues](https://github.com/your-username/jetgit/issues)
   - Search existing issues first
   - Create a new issue with detailed information

2. **VS Code Community**: 
   - VS Code Discord server
   - Stack Overflow with tags: `vscode`, `git`, `jetgit`

3. **Documentation**:
   - [README](../README.md) - Main documentation
   - [Examples](EXAMPLES.md) - Usage examples
   - [GitHub Wiki](https://github.com/your-username/jetgit/wiki) - Additional resources

### Creating a Good Issue Report

Include the following information:

```markdown
## Environment
- VS Code version: 
- JetGit version: 
- Operating System: 
- Git version: 

## Problem Description
[Clear description of the issue]

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
[What you expected to happen]

## Actual Behavior
[What actually happened]

## Error Messages
[Any error messages or console output]

## Additional Context
[Screenshots, repository information, etc.]
```

### Emergency Workarounds

If JetGit is completely broken:

1. **Disable the extension**:
   - Go to Extensions view
   - Find JetGit and click "Disable"

2. **Use VS Code's built-in Git**: VS Code has comprehensive Git support

3. **Use command line Git**: All JetGit operations can be done via command line

4. **Use other Git extensions**: GitLens, Git Graph, etc.

---

Remember: Most issues can be resolved by restarting VS Code or checking basic Git repository status. If you're still having trouble, don't hesitate to create an issue on GitHub with detailed information.
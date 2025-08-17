# JetGit - JetBrains IDE-style Git for VS Code

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/your-username/jetgit)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-blue.svg)](https://code.visualstudio.com/)

JetGit brings the familiar and powerful Git workflow from JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm, etc.) to VS Code. Experience enhanced Git functionality with intelligent branch management, comprehensive context menus, and advanced diff viewing with automatic conflict resolution.

## ✨ Features

### 🌳 Enhanced Git Menu
- **Hierarchical Branch Display**: Branches are automatically grouped by prefixes (feature/, bugfix/, etc.)
- **Current Branch Highlighting**: Easily identify your active branch
- **Quick Actions**: Common tasks (Update, Commit, Push, Fetch) at your fingertips
- **Branch Operations**: Create, rename, update, and push branches directly from the menu

### 📁 Comprehensive Context Menus
- **Repository Operations**: Push, Pull, Fetch, Merge, Rebase
- **Branch Management**: Create branches, tags, and access branch menu
- **File Operations**: History, Compare, Annotate (Blame), Revert
- **Advanced Operations**: Reset HEAD, Stash/Unstash, Remote management

### 🔍 Advanced Diff Viewer
- **Side-by-Side Comparison**: Clean, syntax-highlighted diff view
- **Conflict Resolution**: Visual conflict markers with resolution options
- **Automatic Resolution**: Non-conflicting changes resolved automatically
- **Navigation Controls**: Jump between changes effortlessly

### 🚀 Smart Conflict Resolution
- **Automatic Detection**: Identifies and resolves non-conflicting changes
- **Visual Indicators**: Clear highlighting of conflict regions
- **Resolution Options**: Accept current, incoming, or both changes
- **Merge Completion**: Seamless workflow from conflict to resolution

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "JetGit"
4. Click Install

### From VSIX Package
1. Download the latest `.vsix` file from releases
2. Open VS Code
3. Run `Extensions: Install from VSIX...` from Command Palette
4. Select the downloaded file

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/your-username/jetgit.git
cd jetgit

# Install dependencies
npm install

# Compile the extension
npm run compile

# Package the extension (optional)
npm install -g vsce
vsce package
```

## 🚀 Quick Start

### Accessing the Git Menu
- **Toolbar Button**: Click the Git icon in the editor toolbar
- **Keyboard Shortcut**: `Ctrl+Shift+G Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+G Cmd+Shift+M` (Mac)
- **Command Palette**: `JetGit: Show Git Menu`

### Using Context Menus
1. Right-click on any file or folder in the Explorer
2. Select "Git" from the context menu
3. Choose from the comprehensive list of Git operations

### Working with Branches
1. Open the Git menu
2. Browse branches in the hierarchical view
3. Right-click on any branch for operations:
   - New branch from
   - Show diff with working tree
   - Update (pull latest changes)
   - Push
   - Rename

## 📖 Usage Examples

### Creating a New Feature Branch
1. Open Git menu (`Ctrl+Shift+G Ctrl+Shift+M`)
2. Right-click on the base branch (e.g., `main`)
3. Select "New branch from"
4. Enter branch name: `feature/user-authentication`
5. The branch is created and checked out automatically

### Comparing Files with Different Branches
1. Right-click on a file in Explorer
2. Select "Git" → "Compare with Branch"
3. Choose the target branch from the dropdown
4. View the side-by-side diff with syntax highlighting

### Resolving Merge Conflicts
1. Perform a merge operation that results in conflicts
2. JetGit automatically opens the diff viewer
3. Non-conflicting changes are resolved automatically
4. Review and resolve remaining conflicts using the visual interface
5. Complete the merge when all conflicts are resolved

### Managing Stashes
1. Right-click in Explorer
2. Select "Git" → "Stash Changes"
3. Enter an optional stash message
4. To restore: "Git" → "Unstash Changes" → Select stash

## ⌨️ Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Show Git Menu | `Ctrl+Shift+G Ctrl+Shift+M` | `Cmd+Shift+G Cmd+Shift+M` |
| Update Project | `Ctrl+Shift+G U` | `Cmd+Shift+G U` |
| Commit Changes | `Ctrl+Shift+G C` | `Cmd+Shift+G C` |
| Push | `Ctrl+Shift+G P` | `Cmd+Shift+G P` |
| Fetch | `Ctrl+Shift+G F` | `Cmd+Shift+G F` |
| New Branch | `Ctrl+Shift+G B` | `Cmd+Shift+G B` |
| Compare with Branch | `Ctrl+Shift+G D` | `Cmd+Shift+G D` |

## 🔧 Configuration

JetGit works out of the box with VS Code's Git settings. No additional configuration is required, but you can customize the experience through VS Code settings.

### Recommended Settings
```json
{
  "git.enableSmartCommit": true,
  "git.confirmSync": false,
  "git.autofetch": true,
  "git.showProgress": true
}
```

## 🏗️ Architecture

JetGit is built with a modular architecture:

- **Services**: Core Git operations and business logic
- **Providers**: UI components and menu providers
- **Views**: Custom diff viewer and webview components
- **Utils**: Helper functions and utilities

### Key Components
- `GitService`: Core Git operations using VS Code's Git API
- `GitMenuController`: Manages the main Git menu and branch hierarchy
- `ContextMenuProvider`: Handles right-click context menu integration
- `DiffViewer`: Custom webview-based diff interface
- `ConflictResolver`: Automatic and manual conflict resolution

## 🧪 Testing

JetGit includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:performance # Performance tests

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## 📚 Documentation

- **[Usage Examples](docs/EXAMPLES.md)** - Comprehensive examples and workflows
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Solutions for common issues
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[Changelog](CHANGELOG.md)** - Version history and release notes
- **[Test Documentation](tests/README.md)** - Information about the test suite

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/jetgit.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow the existing code style and conventions
- Add JSDoc comments for public APIs
- Include unit tests for new functionality

## 📝 Changelog

### [0.0.1] - 2024-01-XX
- Initial release
- Enhanced Git menu with branch hierarchy
- Comprehensive context menu integration
- Advanced diff viewer with conflict resolution
- Automatic conflict resolution for non-conflicting changes
- Full VS Code integration with keyboard shortcuts

## 🐛 Troubleshooting

### Common Issues

#### Git Menu Not Showing
- **Cause**: No Git repository detected
- **Solution**: Ensure you have a Git repository open in your workspace

#### Commands Not Working
- **Cause**: Extension not properly activated
- **Solution**: Reload VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")

#### Diff Viewer Not Opening
- **Cause**: File not tracked by Git or no differences found
- **Solution**: Ensure the file is tracked and has changes to compare

#### Performance Issues with Large Repositories
- **Cause**: Large number of branches or extensive history
- **Solution**: JetGit is optimized for large repositories, but you can:
  - Use `git config core.preloadindex true` for faster operations
  - Consider using shallow clones for very large repositories

### Getting Help
1. Check the [Troubleshooting Guide](#troubleshooting)
2. Search existing [GitHub Issues](https://github.com/your-username/jetgit/issues)
3. Create a new issue with:
   - VS Code version
   - JetGit version
   - Operating system
   - Steps to reproduce
   - Error messages or logs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by JetBrains IDEs' excellent Git integration
- Built on top of VS Code's powerful extension API
- Thanks to the VS Code and Git communities for their excellent tools and documentation

---

**Enjoy enhanced Git workflows with JetGit! 🚀**

For more information, visit our [GitHub repository](https://github.com/your-username/jetgit).
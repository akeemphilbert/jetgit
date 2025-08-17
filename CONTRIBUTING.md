# Contributing to JetGit

Thank you for your interest in contributing to JetGit! This document provides guidelines and information for contributors.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Coding Standards](#coding-standards)
6. [Testing](#testing)
7. [Submitting Changes](#submitting-changes)
8. [Issue Guidelines](#issue-guidelines)
9. [Pull Request Process](#pull-request-process)
10. [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful, inclusive, and constructive in all interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- **Node.js**: Version 16.x or later
- **npm**: Version 8.x or later
- **VS Code**: Version 1.74.0 or later
- **Git**: Version 2.20 or later
- **TypeScript**: Familiarity with TypeScript development

### First Contribution

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/jetgit.git
   cd jetgit
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** and test them
6. **Submit a pull request**

## Development Setup

### Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/jetgit.git
   cd jetgit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run compile
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

### Development Workflow

1. **Start development**:
   ```bash
   npm run watch  # Compile in watch mode
   ```

2. **Open in VS Code**:
   - Open the project folder in VS Code
   - Press `F5` to launch Extension Development Host
   - Test your changes in the new VS Code window

3. **Run tests during development**:
   ```bash
   npm run test:watch  # Run tests in watch mode
   ```

### Debugging

1. **Debug the extension**:
   - Set breakpoints in your TypeScript code
   - Press `F5` to start debugging
   - Use the Extension Development Host for testing

2. **Debug tests**:
   ```bash
   npm run test -- --inspect-brk
   ```

3. **View logs**:
   - Open Developer Tools in the Extension Development Host
   - Check Console tab for extension logs

## Project Structure

```
jetgit/
├── src/                     # Source code
│   ├── extension.ts         # Extension entry point
│   ├── providers/           # UI providers (menus, trees)
│   ├── services/            # Business logic services
│   ├── views/               # Custom views (diff viewer)
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── tests/                   # Test suite
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── e2e/                 # End-to-end tests
│   └── performance/         # Performance tests
├── docs/                    # Documentation
├── resources/               # Static resources (CSS, images)
├── .kiro/                   # Kiro spec files
└── package.json             # Extension manifest
```

### Key Components

- **GitService**: Core Git operations using VS Code Git API
- **GitMenuController**: Main Git menu management
- **ContextMenuProvider**: Right-click context menu integration
- **DiffViewer**: Custom diff viewer with conflict resolution
- **ConflictResolver**: Automatic conflict resolution logic

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript**:
   ```typescript
   // Good
   function processData(data: string[]): Promise<ProcessedData> {
       // Implementation
   }

   // Avoid
   function processData(data: any): any {
       // Implementation
   }
   ```

2. **Prefer interfaces over types** for object shapes:
   ```typescript
   // Good
   interface GitBranch {
       name: string;
       isActive: boolean;
   }

   // Avoid (unless union types are needed)
   type GitBranch = {
       name: string;
       isActive: boolean;
   }
   ```

3. **Use meaningful names**:
   ```typescript
   // Good
   const currentBranchName = await gitService.getCurrentBranch();

   // Avoid
   const cb = await gitService.getCurrentBranch();
   ```

### Code Style

1. **Use Prettier** for formatting (configured in `.prettierrc`)
2. **Use ESLint** for linting (configured in `.eslintrc.json`)
3. **Follow existing patterns** in the codebase
4. **Use async/await** instead of Promises where possible

### Documentation Standards

1. **JSDoc comments** for all public APIs:
   ```typescript
   /**
    * Creates a new branch from the specified starting point
    * 
    * @param name - The name of the new branch
    * @param startPoint - The commit, branch, or tag to start from (defaults to HEAD)
    * @throws {GitError} When branch creation fails
    * 
    * @example
    * ```typescript
    * await gitService.createBranch('feature/new-feature', 'main');
    * ```
    */
   async createBranch(name: string, startPoint?: string): Promise<void> {
       // Implementation
   }
   ```

2. **Inline comments** for complex logic:
   ```typescript
   // Group branches by prefix for hierarchical display
   const groupedBranches = branches.reduce((groups, branch) => {
       const prefix = branch.name.includes('/') 
           ? branch.name.split('/')[0] 
           : 'root';
       // ...
   });
   ```

3. **README updates** for new features
4. **Example updates** in documentation

## Testing

### Test Categories

1. **Unit Tests** (`tests/unit/`):
   - Test individual components in isolation
   - Use mocks for dependencies
   - Fast execution (< 30 seconds total)

2. **Integration Tests** (`tests/integration/`):
   - Test component interactions
   - Test VS Code API integration
   - Moderate execution time (< 60 seconds)

3. **End-to-End Tests** (`tests/e2e/`):
   - Test complete user workflows
   - Test real Git operations
   - Longer execution time (< 5 minutes)

4. **Performance Tests** (`tests/performance/`):
   - Test with large repositories
   - Memory usage testing
   - Load testing

### Writing Tests

1. **Follow the AAA pattern**:
   ```typescript
   describe('GitService', () => {
       describe('createBranch', () => {
           it('should create a new branch successfully', async () => {
               // Arrange
               const branchName = 'feature/test';
               const mockGit = { checkout: jest.fn() };
               
               // Act
               await gitService.createBranch(branchName);
               
               // Assert
               expect(mockGit.checkout).toHaveBeenCalledWith(['-b', branchName]);
           });
       });
   });
   ```

2. **Test error cases**:
   ```typescript
   it('should handle invalid branch names', async () => {
       const invalidName = 'invalid<branch>name';
       
       await expect(gitService.createBranch(invalidName))
           .rejects.toThrow('Invalid branch name');
   });
   ```

3. **Use descriptive test names**:
   ```typescript
   // Good
   it('should group branches by prefix when displaying hierarchy')
   
   // Avoid
   it('should work correctly')
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/services/gitService.test.ts
```

### Coverage Requirements

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## Submitting Changes

### Before Submitting

1. **Run the full test suite**:
   ```bash
   npm run test:all
   ```

2. **Check linting**:
   ```bash
   npm run lint
   ```

3. **Build the extension**:
   ```bash
   npm run compile
   ```

4. **Test manually** in Extension Development Host

5. **Update documentation** if needed

### Commit Guidelines

1. **Use conventional commits**:
   ```
   feat: add branch grouping in Git menu
   fix: resolve conflict resolution issue with binary files
   docs: update installation instructions
   test: add unit tests for GitService
   refactor: simplify branch hierarchy logic
   ```

2. **Write clear commit messages**:
   - First line: concise summary (< 50 characters)
   - Blank line
   - Detailed description if needed

3. **Make atomic commits**:
   - Each commit should represent a single logical change
   - Avoid mixing unrelated changes

### Branch Naming

Use descriptive branch names with prefixes:
- `feature/branch-grouping` - New features
- `fix/conflict-resolution-bug` - Bug fixes
- `docs/api-documentation` - Documentation updates
- `test/integration-tests` - Test additions
- `refactor/service-cleanup` - Code refactoring

## Issue Guidelines

### Reporting Bugs

Use the bug report template and include:

1. **Environment information**:
   - VS Code version
   - JetGit version
   - Operating system
   - Git version

2. **Steps to reproduce**:
   - Clear, numbered steps
   - Expected vs actual behavior
   - Screenshots if applicable

3. **Error messages**:
   - Complete error text
   - Console logs if available

4. **Repository information** (if relevant):
   - Repository size
   - Number of branches
   - Git configuration

### Feature Requests

Use the feature request template and include:

1. **Problem description**: What problem does this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: Other approaches you've thought of
4. **Additional context**: Screenshots, examples, etc.

### Questions and Discussions

- Use GitHub Discussions for questions
- Search existing issues and discussions first
- Provide context and examples

## Pull Request Process

### Creating a Pull Request

1. **Fork and clone** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** with tests
4. **Update documentation** as needed
5. **Submit the pull request**

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] New tests added (if applicable)

## Documentation
- [ ] README updated (if applicable)
- [ ] JSDoc comments added/updated
- [ ] Examples updated (if applicable)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] Documentation updated
```

### Review Process

1. **Automated checks** must pass:
   - Tests
   - Linting
   - Build

2. **Code review** by maintainers:
   - Code quality
   - Test coverage
   - Documentation
   - Compatibility

3. **Manual testing** by reviewers

4. **Approval and merge** by maintainers

### After Merge

1. **Delete your feature branch**
2. **Update your fork**:
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md**
3. **Run full test suite**
4. **Create release tag**
5. **Publish to marketplace**
6. **Update documentation**

### Beta Releases

- Use `-beta.x` suffix for beta versions
- Test with community before stable release
- Document known issues

## Getting Help

### Development Questions

1. **Check existing documentation**
2. **Search GitHub issues and discussions**
3. **Ask in GitHub Discussions**
4. **Contact maintainers** for complex questions

### Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Git API](https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

## Recognition

Contributors are recognized in:
- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributors** section

Thank you for contributing to JetGit! 🚀
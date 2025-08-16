# JetGit Extension Test Suite

This directory contains the comprehensive test suite for the JetGit VS Code extension. The test suite is designed to ensure reliability, performance, and maintainability of all extension features.

## Test Structure

```
tests/
├── __mocks__/           # Mock implementations
│   └── vscode.ts        # VS Code API mock
├── unit/                # Unit tests
│   ├── providers/       # Provider component tests
│   ├── services/        # Service layer tests
│   ├── types/           # Type definition tests
│   ├── utils/           # Utility function tests
│   └── views/           # View component tests
├── integration/         # Integration tests
│   ├── branch-menu-operations.test.ts
│   ├── diff-viewer-integration.test.ts
│   └── vscode-integration.test.ts
├── e2e/                 # End-to-end tests
│   └── complete-workflows.test.ts
├── performance/         # Performance tests
│   └── large-repository.test.ts
├── setup.ts             # Test setup configuration
├── test-runner.ts       # Comprehensive test runner
└── README.md           # This file
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Unit tests focus on testing individual components in isolation. They use extensive mocking to ensure components are tested independently.

**Coverage Areas:**
- **Services**: GitService, ConflictResolver, DialogService, FeedbackService
- **Providers**: GitMenuProvider, ContextMenuProvider, GitMenuController
- **Views**: DiffViewer
- **Utils**: BranchUtils, ErrorHandler
- **Types**: Git type definitions and validation

**Key Features:**
- Isolated component testing
- Comprehensive mocking of dependencies
- Fast execution (< 30 seconds total)
- High code coverage targets (>80%)

### 2. Integration Tests (`tests/integration/`)

Integration tests verify that components work correctly together and integrate properly with VS Code APIs.

**Coverage Areas:**
- Branch menu operations and Git service integration
- Diff viewer integration with conflict resolution
- VS Code API integration and command registration

**Key Features:**
- Component interaction testing
- VS Code API integration verification
- Moderate execution time (< 60 seconds)
- Real workflow simulation

### 3. End-to-End Tests (`tests/e2e/`)

End-to-end tests simulate complete user workflows from start to finish.

**Coverage Areas:**
- Complete branch management workflows
- File operations and history workflows
- Context menu integration workflows
- Error recovery scenarios

**Key Features:**
- Full workflow testing
- User scenario simulation
- Longer execution time (< 5 minutes)
- Real-world usage patterns

### 4. Performance Tests (`tests/performance/`)

Performance tests ensure the extension performs well under various load conditions.

**Coverage Areas:**
- Large repository handling (1000+ branches)
- Memory usage and leak detection
- Concurrent operation handling
- File operations with extensive history

**Key Features:**
- Load testing
- Memory usage monitoring
- Performance benchmarking
- Scalability verification

## Running Tests

### Quick Commands

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

# Run in watch mode (for development)
npm run test:watch

# Run comprehensive test suite with reporting
npm run test:all
```

### Detailed Test Runner

The comprehensive test runner (`tests/test-runner.ts`) provides detailed reporting and can be used for CI/CD pipelines:

```bash
# Run comprehensive test suite
npm run test:all

# Or run directly
npx ts-node tests/test-runner.ts
```

This generates:
- Detailed console output with progress
- JSON test results file (`test-results.json`)
- Coverage reports
- Performance metrics

### CI/CD Integration

The test suite is designed for continuous integration with the provided GitHub Actions workflow (`.github/workflows/test.yml`).

**CI Features:**
- Multi-platform testing (Ubuntu, Windows, macOS)
- Multiple Node.js versions (16.x, 18.x, 20.x)
- Parallel test execution
- Coverage reporting
- Performance benchmarking
- Artifact collection

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  moduleNameMapping: {
    '^vscode$': '<rootDir>/tests/__mocks__/vscode'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/extension.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

### VS Code Mock (`tests/__mocks__/vscode.ts`)

The VS Code mock provides comprehensive mocking of the VS Code API, including:
- Window operations (messages, input, progress)
- Command registration and execution
- Workspace and file system operations
- Extension and Git API mocking
- Webview and UI component mocking

## Writing Tests

### Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Mocking**: Use comprehensive mocking for external dependencies
3. **Descriptive Names**: Test names should clearly describe what is being tested
4. **Arrange-Act-Assert**: Follow the AAA pattern for test structure
5. **Edge Cases**: Include tests for error conditions and edge cases

### Example Test Structure

```typescript
describe('ComponentName', () => {
  let component: ComponentName;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(() => {
    // Arrange: Set up mocks and test data
    mockDependency = {
      method: jest.fn(),
    };
    component = new ComponentName(mockDependency);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case correctly', async () => {
      // Arrange
      const input = 'test input';
      const expectedOutput = 'expected output';
      mockDependency.method.mockResolvedValue(expectedOutput);

      // Act
      const result = await component.methodName(input);

      // Assert
      expect(result).toBe(expectedOutput);
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });

    it('should handle error case gracefully', async () => {
      // Arrange
      const error = new Error('Test error');
      mockDependency.method.mockRejectedValue(error);

      // Act & Assert
      await expect(component.methodName('input')).rejects.toThrow('Test error');
    });
  });
});
```

## Coverage Targets

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## Performance Benchmarks

- **Unit Tests**: < 30 seconds total
- **Integration Tests**: < 60 seconds total
- **E2E Tests**: < 5 minutes total
- **Performance Tests**: < 10 minutes total
- **Memory Usage**: < 50MB increase during test execution

## Troubleshooting

### Common Issues

1. **VS Code Mock Issues**: Ensure the mock is properly configured in `jest.config.js`
2. **Timeout Errors**: Increase timeout for long-running tests
3. **Memory Leaks**: Use `jest.clearAllMocks()` in `afterEach` blocks
4. **Flaky Tests**: Ensure proper cleanup and avoid shared state

### Debug Mode

Run tests with additional debugging:

```bash
# Enable verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/unit/services/gitService.test.ts

# Run with debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Contributing

When adding new features:

1. Write unit tests for new components
2. Add integration tests for component interactions
3. Include E2E tests for new user workflows
4. Add performance tests for operations that handle large data sets
5. Update this documentation as needed

Ensure all tests pass before submitting pull requests:

```bash
npm run test:all
```
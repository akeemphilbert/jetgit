// Mock VS Code API for testing
const mockFn = () => jest.fn();

export const window = {
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showInputBox: jest.fn(),
  createQuickPick: jest.fn(() => ({
    items: [],
    placeholder: '',
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
    onDidChangeSelection: jest.fn(),
    onDidHide: jest.fn(),
  })),
  withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
  createWebviewPanel: jest.fn(() => ({
    webview: {
      html: '',
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn(),
    },
    onDidDispose: jest.fn(),
    dispose: jest.fn(),
  })),
  createStatusBarItem: jest.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const extensions = {
  getExtension: jest.fn(() => mockGitExtension),
};

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path })),
  parse: jest.fn(),
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
  })),
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export class ThemeIcon {
  constructor(public id: string) {}
}

export const ProgressLocation = {
  Notification: 15,
  SourceControl: 1,
  Window: 10,
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const ViewColumn = {
  One: 1,
  Two: 2,
};

export const QuickPickItemKind = {
  Separator: -1,
  Default: 0,
};

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  
  get event() {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index !== -1) {
            this.listeners.splice(index, 1);
          }
        }
      };
    };
  }
  
  fire(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }
  
  dispose(): void {
    this.listeners = [];
  }
}

// Mock extension context
export const mockExtensionContext = {
  subscriptions: [],
  workspaceState: {
    get: mockFn(),
    update: mockFn(),
  },
  globalState: {
    get: mockFn(),
    update: mockFn(),
  },
  extensionPath: '/mock/extension/path',
  storagePath: '/mock/storage/path',
  globalStoragePath: '/mock/global/storage/path',
};

// Mock Git extension API
export const mockGitAPI = {
  repositories: [] as any[],
  getRepository: mockFn(),
};

export const mockRepository = {
  rootUri: { fsPath: '/mock/repo/path' },
  state: {
    HEAD: { name: 'main' } as any,
    workingTreeChanges: [] as any[],
    indexChanges: [] as any[],
    untrackedChanges: [] as any[],
  },
};

export const mockGitExtension = {
  exports: {
    getAPI: jest.fn(() => mockGitAPI),
  },
};
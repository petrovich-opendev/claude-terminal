// SSH Session
export interface SSHSession {
  id: string;            // uuid v4
  name: string;          // display name e.g. "llmsrv"
  group: string;         // logical group e.g. "AI Infra"
  host: string;          // hostname or IP
  port: number;          // default 22
  user: string;          // SSH username
  authType: 'key' | 'password' | 'keychain';
  keyPath?: string;      // path to private key file e.g. "~/.ssh/id_ed25519" — key PATH only, never key content
  tags: string[];        // searchable tags
  note: string;          // freeform description
  lastConnected?: string; // ISO timestamp
  status: 'idle' | 'connected' | 'error' | 'connecting';
}

// Claude Code modes
export type ClaudeModeId = 'coding' | 'reasoning' | 'design' | 'research';

export interface ToolPermissions {
  Bash: boolean;
  Edit: boolean;
  Write: boolean;
  Glob: boolean;
  Grep: boolean;
  WebSearch: boolean;
  WebFetch: boolean;
  Notebook: boolean;
}

export type PermissionsMode = 'auto' | 'manual' | 'skip';

export interface ClaudeMode {
  id: ClaudeModeId;
  label: string;
  icon: string;
  color: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tools: ToolPermissions;
  permissionsMode: PermissionsMode;
  extendedThinking: boolean;
  thinkingBudget: number;   // tokens 0-30000
  cliFlags: string[];       // additional flags e.g. ['--continue']
  description: string;
}

// Model pricing
export interface ModelPricing {
  label: string;
  inputPerMTok: number;   // USD per 1M input tokens
  outputPerMTok: number;  // USD per 1M output tokens
  speed: string;          // display only e.g. '●●●○'
  quality: string;        // display only e.g. '●●●○'
  color: string;          // hex
}

// Cost tracking
export interface SessionCost {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string;
  estimatedUSD: number;
  updatedAt: string; // ISO timestamp
}

// App config (persisted to ~/.config/claude-terminal/config.json)
export interface AppConfig {
  version: string;
  theme: 'dark' | 'light' | 'system';
  terminal: {
    fontFamily: string;
    fontSize: number;     // px, range 10-20
    lineHeight: number;   // range 1.2-2.0
    scrollback: number;   // lines, range 1000-50000
  };
  defaultMode: ClaudeModeId;
  costAlertThresholdUSD: number;
  contextAlertPercent: number;
  obsidianPort: number;   // default 22360
  editor: {
    readOnlyDefault: boolean;
    wordWrap: boolean;
  };
  updates: {
    checkOnLaunch: boolean;
    channel: 'stable' | 'beta';
  };
}

// Quick command
export interface QuickCommand {
  id: string;
  label: string;
  category: 'session' | 'code' | 'git' | 'arch';
  cmd: string;
  icon: string;
}

// Memory file (CLAUDE.md etc)
export interface MemoryFile {
  path: string;
  scope: 'global' | 'project' | 'local';
  sizeBytes: number;
  lastModified: string;  // ISO timestamp
  firstLine: string;     // preview
  exists: boolean;
}

// File tree node
export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  extension?: string;
}

// IPC channel names (type-safe event names)
export const IPC = {
  // SSH
  SSH_CONNECT: 'ssh:connect',
  SSH_DISCONNECT: 'ssh:disconnect',
  SSH_LIST: 'ssh:list',
  SSH_SAVE: 'ssh:save',
  SSH_DELETE: 'ssh:delete',
  SSH_IMPORT_CONFIG: 'ssh:import-config',
  // PTY
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  // Keychain
  KEYCHAIN_SET: 'keychain:set',
  KEYCHAIN_GET: 'keychain:get',
  KEYCHAIN_DELETE: 'keychain:delete',
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  // FS
  FS_LIST: 'fs:list',
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  // SFTP
  SFTP_UPLOAD: 'sftp:upload',
  SFTP_DOWNLOAD: 'sftp:download',
  SFTP_PROGRESS: 'sftp:progress',
} as const;

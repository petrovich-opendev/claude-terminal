# Claude Code Terminal — Build Specification Prompt

> **License:** MIT  
> **Author:** AGENTDATA.PRO / PETROVICH  
> **Version:** 1.0.0  
> **Target OS:** macOS 13 Ventura and later (Apple Silicon + Intel)  
> **Purpose:** Open-source AI-native terminal for Claude Code CLI with SSH session management, file explorer, and Obsidian integration

---

## 1. OVERVIEW

Build a native macOS desktop application — a purpose-built terminal emulator and session manager designed for working with [Claude Code CLI](https://claude.ai/product/claude-code). The app replaces the standard Terminal.app workflow with a structured environment that surfaces Claude Code's capabilities: model selection, tool permission control, memory management, cost tracking, and MCP integrations.

**Core value proposition:**
- One-click SSH session switching across multiple development servers
- Per-session Claude Code mode presets (Coding / Reasoning / Design / Research)
- Live token and cost tracking with `/compact` prompts
- Built-in file explorer and lightweight editor
- Obsidian vault connector via MCP

**This is NOT a general-purpose terminal.** It is optimized for the Claude Code CLI workflow. Standard shell use is secondary.

---

## 2. TECHNOLOGY STACK

### 2.1 Application Framework

**Use [Tauri 2.0](https://v2.tauri.app/)** (Rust backend + React frontend).

Rationale over Electron:
- Native macOS process model — no Chromium bloat
- OS-level security sandbox by default
- Hardware Keychain access via native Rust crates
- Smaller binary (~8 MB vs ~150 MB)
- Better memory footprint for long-running terminal sessions

```
Tauri 2.x         — app shell, IPC, native APIs
Rust 1.78+        — backend: SSH, Keychain, pty, fs
React 19 + TypeScript 5.5  — frontend UI
Vite 5            — frontend build
portable-pty (Rust) — PTY / pseudoterminal
ssh2 (Rust crate) — SSH client
xterm.js 5        — terminal renderer (WebComponent in webview)
```

### 2.2 macOS Requirements

- **Minimum:** macOS 13.0 Ventura
- **Recommended:** macOS 14.0 Sonoma or later
- **Architectures:** Universal binary (arm64 + x86_64)
- **Node.js:** 20 LTS (for Claude Code CLI itself, not bundled in app)
- **Distribution:** Notarized and signed `.dmg` via GitHub Releases. App Store distribution is NOT required.

### 2.3 Runtime Dependencies (not bundled)

The following must be installed by the user. The app detects them at startup and shows a setup guide if missing:

| Dependency | Detection | Install hint shown |
|---|---|---|
| `claude` (Claude Code CLI) | `which claude` | `npm install -g @anthropic-ai/claude-code` |
| Node.js ≥ 20 | `node --version` | Directs to nodejs.org |
| SSH client | `which ssh` | Built-in macOS, always present |

---

## 3. APPLICATION ARCHITECTURE

### 3.1 Process Model

```
┌─────────────────────────────────────────────────────────┐
│  macOS App Sandbox                                       │
│                                                          │
│  ┌──────────────────┐    IPC (Tauri commands)           │
│  │  Webview (React) │ ◄─────────────────────────────┐  │
│  │  xterm.js        │                               │  │
│  │  UI / State      │                               │  │
│  └──────────────────┘                               │  │
│                                                     │  │
│  ┌──────────────────────────────────────────────┐  │  │
│  │  Rust Core                                   │  │  │
│  │                                              │  │  │
│  │  ┌─────────────┐  ┌──────────────────────┐  │  │  │
│  │  │  PTY Manager│  │  SSH Session Manager  │  │──┘  │
│  │  │  (pty crate)│  │  (ssh2 crate)         │  │     │
│  │  └─────────────┘  └──────────────────────┘  │     │
│  │                                              │     │
│  │  ┌─────────────┐  ┌──────────────────────┐  │     │
│  │  │  Keychain   │  │  Config Store        │  │     │
│  │  │  (security- │  │  (encrypted JSON,    │  │     │
│  │  │   framework)│  │  no credentials)     │  │     │
│  │  └─────────────┘  └──────────────────────┘  │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
   Claude Code CLI          Remote SSH Servers
   (local process)
```

### 3.2 Data Flow

```
User action (React UI)
  → Tauri IPC command (serialized, typed)
    → Rust handler (validated, rate-limited)
      → PTY / SSH / Keychain / FS
        → Result serialized
          → Tauri event emitted
            → React state update
```

All IPC calls are typed with Tauri's command system. No arbitrary shell injection from the frontend.

---

## 4. LAYOUT & UI SPECIFICATION

### 4.1 Window Chrome

macOS native window with:
- Standard traffic-light controls (close / minimize / fullscreen)
- Transparent title bar with vibrancy effect (`NSVisualEffectView`, material: `sidebar`)
- Minimum window size: 960 × 640 px
- Default window size: 1280 × 800 px
- Resizable. Panels use CSS grid with drag-to-resize dividers.

### 4.2 Layout Regions

```
┌──────────────────────────────────────────────────────────┐
│  TITLE BAR  (traffic lights · app name · active session) │
├──────────────────────────────────────────────────────────┤
│  MODE BAR   (Coding | Reasoning | Design | Research)     │
├───────────┬──────────────────────────────────────────────┤
│           │                                              │
│  SIDEBAR  │            TERMINAL                         │
│  280 px   │            (xterm.js)                       │
│           │                                              │
│  Tabs:    ├──────────────────────────────────────────────┤
│  • SSH    │  INPUT BAR  (prompt · text field · RUN btn)  │
│  • Files  ├──────────────────────────────────────────────┤
│  • Tools  │  QUICK COMMANDS  (categorized presets)       │
│  • Memory ├──────────────────────────────────────────────┤
│  • Obsdn  │  STATUS BAR  (connection · tokens · cost)   │
└───────────┴──────────────────────────────────────────────┘
```

An optional **right panel** (360 px) opens when a file is selected in the Files tab. It shows a lightweight code editor (Monaco Editor WebComponent, read/write, no LSP required).

---

## 5. FEATURE SPECIFICATIONS

### 5.1 SSH Session Manager

**This is the primary first-launch experience.** The app opens to the SSH panel if no active session exists.

**Session profile schema (stored in config, NO credentials):**

```typescript
interface SSHSession {
  id: string;           // uuid v4
  name: string;         // display name, e.g. "llmsrv"
  group: string;        // logical group, e.g. "AI Infra"
  host: string;         // hostname or IP
  port: number;         // default 22
  user: string;         // SSH username
  authType: "key" | "password" | "keychain";
  keyPath?: string;     // path to private key file, e.g. "~/.ssh/id_ed25519"
                        // NOTE: key FILE PATH only — never the key content
  tags: string[];       // searchable tags
  note: string;         // freeform description
  lastConnected?: string; // ISO timestamp
  status: "idle" | "connected" | "error";
}
```

**Password / passphrase storage:**

```
authType === "password"  →  stored in macOS Keychain
                             service:  "claude-terminal"
                             account:  session.id
                             password: encrypted by Keychain

authType === "keychain"  →  SSH key passphrase in Keychain
                             same service/account scheme

authType === "key"       →  no secret stored by app at all
                             SSH agent handles key auth
```

**NEVER write credentials to disk.** The config JSON file contains only `authType` and `keyPath`, never passwords or passphrases.

**Session list UI:**
- Grouped by `group` field
- Status dot: green (connected) / gray (idle) / red (error)
- Search: real-time filter across name, host, tags, note
- Right-click context menu: Connect / Edit / Duplicate / Delete
- Drag to reorder within group
- Import from `~/.ssh/config`: one-click parsing of existing SSH config file

**Import `~/.ssh/config` parser:**
Parse standard OpenSSH config format. Create session profiles for each `Host` block. Map `HostName`, `User`, `Port`, `IdentityFile` to the session schema. Do not import `Host *` wildcard blocks.

**Connect action:**
1. Read session profile from config store
2. Fetch credential from Keychain if needed
3. Spawn SSH connection via Rust `ssh2` crate
4. Allocate PTY and attach to xterm.js renderer
5. Update `lastConnected` and `status`
6. Show connection log in terminal output

### 5.2 Claude Code Mode System

Four presets that configure the active Claude Code invocation:

```typescript
interface ClaudeMode {
  id: "coding" | "reasoning" | "design" | "research";
  label: string;
  model: "haiku" | "sonnet" | "opus";
  tools: {
    Bash: boolean;
    Edit: boolean;
    Write: boolean;
    Glob: boolean;
    Grep: boolean;
    WebSearch: boolean;
    WebFetch: boolean;
    Notebook: boolean;
  };
  permissionsMode: "auto" | "manual" | "skip";
  extendedThinking: boolean;
  thinkingBudget?: number;     // tokens
  cliFlags: string[];          // additional flags, e.g. ["--continue"]
}
```

**Preset definitions:**

| Mode | Model | Bash | Edit/Write | Web | Thinking | Permissions |
|---|---|---|---|---|---|---|
| Coding | sonnet | ✓ | ✓ | ✗ | off | auto |
| Reasoning | opus | ✗ | ✗ | ✓ | ON (10k) | manual |
| Design | sonnet | ✗ | Write only | ✓ | off | auto |
| Research | haiku | ✗ | ✗ | ✓ | off | auto |

User can override individual tool toggles within any preset. Changes do not overwrite the preset — they create a session-local override shown in the UI.

**Generated CLI command** (shown in sidebar, updated live):
```bash
claude \
  --model claude-sonnet-4-6 \
  --allowedTools "Edit,Write,Glob,Grep" \
  [--dangerously-skip-permissions | --auto-approve] \
  [--thinking --thinking-budget 10000]
```

### 5.3 Tool Permission Panel

Sidebar tab "Tools" shows:
- List of all 8 tools with toggle switches
- Risk classification: none / low / medium / high (color-coded dots)
- Per-tool description (shown on hover)
- Current permissions mode badge: AUTO / MANUAL / YOLO
- Extended Thinking toggle with budget slider (0 – 30,000 tokens)
- Live-generated CLI command string at bottom of panel (copy button)

### 5.4 Memory & Context Panel

Sidebar tab "Memory" shows:

**Memory files in scope:**
Scan and display:
- `~/.claude/CLAUDE.md` — global user memory
- `./CLAUDE.md` — project-level memory (current working directory)
- `./.claude/settings.local.json` — local overrides (git-ignored)
- `./.claude/commands/` — custom slash commands

For each file: display name, scope badge (global / project / local), file size, last modified, one-line preview of first non-empty line.

**Context usage bar:**
- Read from Claude Code `/cost` output (parse JSON or text)
- Show: tokens used / context limit, colored by threshold:
  - < 50 %: green
  - 50–80 %: amber
  - > 80 %: red with warning
- Show estimated remaining turns before context exhaustion

**Actions:**
- "Compact now" → inserts `/compact` into terminal input
- "Edit global memory" → opens `~/.claude/CLAUDE.md` in right panel editor
- "Edit project memory" → opens `./CLAUDE.md` in right panel editor
- "New custom command" → scaffolds `.claude/commands/<name>.md`

### 5.5 Cost Tracker

**Token / cost widget** lives in the status bar and expands to a panel via click.

Track per-session:
- Input tokens consumed
- Output tokens consumed
- Cache read tokens (lower cost)
- Cache write tokens
- Estimated USD cost (calculated locally using published pricing)

**Model pricing table** (hardcoded, with "check for updates" link):

```typescript
const MODEL_PRICING = {
  "claude-haiku-4-5":   { inputMTok: 0.25,  outputMTok: 1.25  },
  "claude-sonnet-4-6":  { inputMTok: 3.00,  outputMTok: 15.00 },
  "claude-opus-4-6":    { inputMTok: 15.00, outputMTok: 75.00 },
} as const;
```

Parse token counts from Claude Code's structured output (`--output-format stream-json` in non-interactive mode) or from `/cost` slash command output in interactive mode.

Show a "⚠ Compact recommended" banner when:
- Context utilization > 70 %
- OR session cost > $0.50 (configurable threshold)

### 5.6 File Explorer

Sidebar tab "Files" shows the directory tree of the current working directory.

- Recursive directory listing via Rust `std::fs` (not shell)
- Ignored patterns: `.git/`, `node_modules/`, `__pycache__/`, `*.pyc`, build artifacts (configurable via `.gitignore` parsing)
- File icons by extension (SVG icon set, no external dependencies)
- Click a file → open in right panel editor
- Right-click context menu: Open / Rename / Delete / Copy path / "Ask Claude about this file"
  - "Ask Claude about this file" inserts `claude "Explain the code in <filename>"` into terminal input

**Right panel editor:**
- Monaco Editor (self-hosted WebAssembly build, no CDN calls)
- Syntax highlighting only, no LSP/autocomplete
- Read/Write mode toggle (default: read-only to prevent accidental edits)
- Save: Cmd+S
- "Ask Claude" toolbar: predefined prompts for the open file (Explain / Refactor / Write tests / Fix bugs)

### 5.7 Obsidian MCP Connector

Sidebar tab "Obsidian" provides integration with the user's Obsidian vault via the `obsidian-claude-code-mcp` plugin.

**Connection:**
- Detect plugin on `localhost:22360` (default port, configurable)
- Protocol: HTTP/SSE (`2024-11-05` spec — NOT the newer Streamable HTTP)
- Status: connected (green dot) / searching (pulsing) / disconnected (gray)

**When connected, show:**
- Vault name and root path
- Recent notes (last 10 modified, with tags)
- Quick actions:
  - "Search vault" → `claude "Search my Obsidian vault for notes about: "`
  - "Save session → Vault" → prompts Claude Code to summarize and write to a new note
  - "Open note" → dropdown picker of vault files

**MCP registration** (auto-generated config):
```json
{
  "mcpServers": {
    "obsidian": {
      "url": "http://localhost:22360/sse",
      "type": "sse"
    }
  }
}
```

The app writes this to `~/.claude/claude_desktop_config.json` (merged, not overwritten) when the user clicks "Enable Obsidian MCP".

---

## 6. TERMINAL RENDERER

Use **xterm.js 5.x** as a WebComponent inside the Tauri webview.

```typescript
const terminal = new Terminal({
  fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
  fontSize: 13,
  lineHeight: 1.6,
  theme: {
    background: "#08080b",
    foreground: "#e8e8f0",
    cursor: "#f59e0b",
    cursorAccent: "#000000",
    selectionBackground: "rgba(245,158,11,0.2)",
    black: "#1c1c28",   bright_black: "#363650",
    red: "#ef4444",     bright_red: "#f87171",
    green: "#22c55e",   bright_green: "#4ade80",
    yellow: "#f59e0b",  bright_yellow: "#fcd34d",
    blue: "#60a5fa",    bright_blue: "#93c5fd",
    magenta: "#a78bfa", bright_magenta: "#c4b5fd",
    cyan: "#34d399",    bright_cyan: "#6ee7b7",
    white: "#a0a0b8",   bright_white: "#e8e8f0",
  },
  allowProposedApi: true,
  macOptionIsMeta: true,    // Option key = Meta on macOS
  rightClickSelectsWord: true,
  scrollback: 10000,
});
```

**xterm addons to include:**
- `@xterm/addon-fit` — resize to container
- `@xterm/addon-search` — Cmd+F search in terminal output
- `@xterm/addon-web-links` — clickable URLs
- `@xterm/addon-serialize` — session export

**Mouse support in input line:**
Implement a custom input bar component (not relying on xterm's built-in input). This is a controlled `<input>` element above the xterm canvas that:
- Supports standard macOS text editing (Cmd+A, Cmd+←, Option+←, etc.)
- Forwards Enter to the PTY
- Maintains command history (↑↓ arrows)
- Shows history count indicator when navigating

---

## 7. QUICK COMMANDS SYSTEM

A configurable bar below the terminal input. Commands are organized in categories.

**Built-in categories and defaults:**

```typescript
const QUICK_COMMANDS: QuickCommand[] = [
  // Session
  { id: "start",    label: "Start",    category: "session", cmd: "claude" },
  { id: "continue", label: "Continue", category: "session", cmd: "claude --continue" },
  { id: "resume",   label: "Resume",   category: "session", cmd: "claude --resume" },
  { id: "cost",     label: "Cost",     category: "session", cmd: "/cost" },
  { id: "compact",  label: "Compact",  category: "session", cmd: "/compact" },
  // Code
  { id: "review",   label: "Review",   category: "code", cmd: 'claude "Review this code for bugs and security issues"' },
  { id: "tests",    label: "Tests",    category: "code", cmd: 'claude "Write unit tests with ≥80% coverage"' },
  { id: "refactor", label: "Refactor", category: "code", cmd: 'claude "Refactor for readability and performance"' },
  { id: "explain",  label: "Explain",  category: "code", cmd: 'claude "Explain this codebase architecture"' },
  // Git
  { id: "commit",   label: "Commit",   category: "git",  cmd: 'claude "Write a conventional commit message for staged changes"' },
  { id: "pr",       label: "PR Draft", category: "git",  cmd: 'claude "Draft a PR description for these changes"' },
  // Arch
  { id: "design",   label: "Design",   category: "arch", cmd: 'claude "Design the architecture for: "' },
  { id: "adr",      label: "ADR",      category: "arch", cmd: 'claude "Write an Architecture Decision Record for: "' },
];
```

**User customization:**
- Add / edit / delete commands via Settings panel
- Commands stored in `~/.config/claude-terminal/quick-commands.json`
- Import/export as JSON

---

## 8. SECURITY REQUIREMENTS

Security is non-negotiable. The following requirements are **mandatory**, not optional.

### 8.1 Credential Storage

```
RULE: No secret ever touches the filesystem in plaintext.

SSH passwords      → macOS Keychain (Security.framework via Rust)
SSH key passphrases → macOS Keychain
API keys (if any)  → macOS Keychain
Config files       → store ONLY: session metadata, paths, preferences
```

Implementation:
```rust
// Rust backend — Keychain access
use security_framework::passwords::{
    get_generic_password,
    set_generic_password,
    delete_generic_password,
};

const SERVICE: &str = "claude-terminal";

pub fn store_password(account: &str, password: &str) -> Result<()> {
    set_generic_password(SERVICE, account, password.as_bytes())?;
    Ok(())
}

pub fn retrieve_password(account: &str) -> Result<String> {
    let pw = get_generic_password(SERVICE, account)?;
    Ok(String::from_utf8(pw)?)
}
```

### 8.2 IPC Security (Tauri)

Enable Tauri's capability system. Restrict each command to minimum required permissions:

```json
{
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "fs:allow-read-dir",
    "fs:allow-read-file",
    "fs:allow-write-file"
  ]
}
```

No `shell:allow-open` for arbitrary URLs. No `fs:allow-write` to system directories.

Validate ALL inputs from the frontend in Rust before execution:

```rust
#[tauri::command]
fn connect_ssh(session_id: String) -> Result<(), String> {
    // Validate UUID format
    let id = Uuid::parse_str(&session_id)
        .map_err(|_| "Invalid session ID")?;
    // Load from config — never accept host/user/port from frontend directly
    let session = config::load_session(id)?;
    ssh::connect(session)
}
```

**The frontend never passes raw shell commands to the Rust backend.** It passes structured data (session IDs, tool names, file paths). The backend constructs and validates all commands.

### 8.3 PTY / Process Isolation

- Claude Code process spawned with explicit `env` (no environment leakage)
- Working directory explicitly set per session
- Process terminated cleanly on window close (SIGTERM → 2s → SIGKILL)
- No orphan processes: track all PIDs, clean up on app exit

```rust
// Never do this:
Command::new("sh").arg("-c").arg(user_input);

// Always do this:
Command::new("claude")
    .arg("--model").arg(&validated_model)
    .arg("--allowedTools").arg(&validated_tools)
    .current_dir(&validated_path)
    .env_clear()
    .envs(&safe_env_vars);
```

### 8.4 Content Security Policy

Tauri webview CSP (in `tauri.conf.json`):

```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:22360; font-src 'self'"
  }
}
```

No external network calls from the frontend. The Obsidian MCP connection (`localhost:22360`) is the only allowed non-`'self'` origin.

### 8.5 Config File Security

```
~/.config/claude-terminal/
├── config.json          # app settings, NO credentials
├── sessions.json        # session metadata, NO credentials
├── quick-commands.json  # user-defined quick commands
└── themes/              # optional custom themes
```

`sessions.json` and `config.json` are set to mode `0600` (owner read/write only) on creation.

### 8.6 SSH Security

- Support only `ed25519` and `ecdsa` keys (no RSA < 3072 bit)
- Enforce `StrictHostKeyChecking yes` by default (configurable to `ask`)
- Never bypass host key verification silently
- Display fingerprint on first connection and require explicit user confirmation
- Respect `~/.ssh/known_hosts`

### 8.7 Dependency Audit

- Run `cargo audit` and `npm audit` in CI on every PR
- Pin all dependency versions (no `*` or `^` ranges in production)
- Automated Dependabot PRs for security patches
- No telemetry, analytics, or crash reporting without explicit opt-in

---

## 9. CONFIGURATION & PERSISTENCE

### 9.1 Config Schema

```typescript
// ~/.config/claude-terminal/config.json
interface AppConfig {
  version: string;
  theme: "dark" | "light" | "system";
  terminal: {
    fontFamily: string;
    fontSize: number;        // px, range 10–20
    lineHeight: number;      // range 1.2–2.0
    scrollback: number;      // lines, range 1000–50000
  };
  defaultMode: ClaudeModeId;
  costAlertThreshold: number;   // USD, triggers compact suggestion
  contextAlertPercent: number;  // %, triggers compact suggestion
  obsidianPort: number;         // default 22360
  editor: {
    readOnlyDefault: boolean;
    wordWrap: boolean;
  };
  updates: {
    checkOnLaunch: boolean;     // default true
    channel: "stable" | "beta";
  };
}
```

### 9.2 Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| New SSH session | Cmd+N |
| Connect to selected session | Cmd+Return |
| Disconnect | Cmd+W |
| Clear terminal | Cmd+K |
| Search in terminal | Cmd+F |
| Toggle sidebar | Cmd+B |
| Toggle right panel | Cmd+E |
| Switch mode: Coding | Cmd+1 |
| Switch mode: Reasoning | Cmd+2 |
| Switch mode: Design | Cmd+3 |
| Switch mode: Research | Cmd+4 |
| Settings | Cmd+, |
| Quick command palette | Cmd+Shift+P |
| Focus terminal input | Escape |

---

## 10. PROJECT STRUCTURE

```
claude-terminal/
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs             # app entry point
│   │   ├── commands/           # Tauri IPC commands
│   │   │   ├── ssh.rs          # SSH connection management
│   │   │   ├── pty.rs          # PTY spawn and I/O
│   │   │   ├── keychain.rs     # macOS Keychain access
│   │   │   ├── config.rs       # config read/write
│   │   │   └── fs.rs           # file system operations
│   │   ├── ssh/
│   │   │   ├── session.rs      # SSH session model
│   │   │   ├── connect.rs      # connection logic
│   │   │   └── config_parser.rs # ~/.ssh/config importer
│   │   └── models.rs           # shared data types
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                        # React frontend
│   ├── main.tsx                # React entry
│   ├── App.tsx                 # root layout
│   ├── components/
│   │   ├── TitleBar.tsx
│   │   ├── ModeBar.tsx
│   │   ├── Terminal.tsx        # xterm.js wrapper
│   │   ├── InputBar.tsx        # custom mouse-aware input
│   │   ├── QuickCommands.tsx
│   │   ├── StatusBar.tsx
│   │   └── sidebar/
│   │       ├── Sidebar.tsx
│   │       ├── SSHPanel.tsx
│   │       ├── FilesPanel.tsx
│   │       ├── ToolsPanel.tsx
│   │       ├── MemoryPanel.tsx
│   │       └── ObsidianPanel.tsx
│   ├── panels/
│   │   └── FileEditor.tsx      # Monaco editor right panel
│   ├── store/                  # Zustand state
│   │   ├── sessions.ts
│   │   ├── terminal.ts
│   │   ├── modes.ts
│   │   └── cost.ts
│   ├── hooks/
│   │   ├── useSSH.ts
│   │   ├── usePTY.ts
│   │   ├── useCost.ts
│   │   └── useObsidian.ts
│   ├── lib/
│   │   ├── modes.ts            # mode presets config
│   │   ├── pricing.ts          # model pricing constants
│   │   └── sshConfig.ts        # SSH config parser (JS side)
│   └── styles/
│       ├── global.css
│       └── theme.css           # CSS custom properties
│
├── docs/
│   ├── SECURITY.md
│   ├── CONTRIBUTING.md
│   └── ARCHITECTURE.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # test + lint + audit
│       └── release.yml         # build universal dmg + notarize
│
├── README.md
├── LICENSE                     # MIT
├── CHANGELOG.md
└── package.json
```

---

## 11. BUILD & DISTRIBUTION

### 11.1 Development

```bash
# Install prerequisites
brew install rustup node
rustup toolchain install stable
npm install -g @tauri-apps/cli

# Clone and run
git clone https://github.com/<org>/claude-terminal
cd claude-terminal
npm install
npm run tauri dev
```

### 11.2 Production Build

```bash
# Universal binary (arm64 + x86_64)
npm run tauri build -- --target universal-apple-darwin
```

Output: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

### 11.3 Notarization (required for macOS Gatekeeper)

Store in GitHub Actions secrets:
```
APPLE_ID
APPLE_TEAM_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_CERTIFICATE          # base64 Developer ID Application cert
APPLE_CERTIFICATE_PASSWORD
```

Use `tauri action` in `.github/workflows/release.yml` — it handles signing and notarization automatically.

### 11.4 CI Pipeline

```yaml
# .github/workflows/ci.yml — every PR
jobs:
  security-audit:
    - cargo audit --deny warnings
    - npm audit --audit-level=moderate

  lint:
    - cargo clippy -- -D warnings
    - eslint + prettier check

  test:
    - cargo test
    - npm run test         # Vitest unit tests

  build:
    - npm run tauri build  # ensure it compiles
```

---

## 12. CONTRIBUTING GUIDELINES

**Code style:**
- Rust: `rustfmt` (enforced in CI), `clippy` with `--deny warnings`
- TypeScript: ESLint + Prettier, strict mode
- Commits: Conventional Commits (`feat:`, `fix:`, `sec:`, `docs:`)

**Security contributions:**
- Security bugs → private disclosure via GitHub Security Advisories, NOT public issues
- Response SLA: acknowledge within 48h, patch within 14 days for critical

**Feature additions:**
- Open an issue before implementing to discuss scope
- No telemetry, tracking, or analytics PRs accepted
- All new IPC commands must have corresponding Rust-side validation

**Dependencies:**
- New dependencies require justification in PR
- No dependencies with known CVEs
- Prefer crates/packages with active maintenance

---

## 13. UX SPECIFICATION

### 13.1 Visual Design Language

**Aesthetic direction:** Industrial-minimal dark terminal.

The following are explicitly NOT part of this project:

- General-purpose terminal emulator (use iTerm2, Warp, Ghostty for that)
- Support for Windows or Linux (macOS only by design)
- Cloud sync of sessions or config (security boundary)
- Built-in LLM — this is a frontend for Claude Code CLI only
- Plugin system (keep the codebase auditable)
- Mobile or web version

---

## 14. LICENSE

```
MIT License

Copyright (c) 2025 AGENTDATA.PRO / PETROVICH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

*This specification is the source of truth for the claude-terminal project. When in doubt, refer to this document. When this document is wrong, fix this document first.*

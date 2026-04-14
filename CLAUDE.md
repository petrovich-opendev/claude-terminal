# CLAUDE.md — claude-terminal

## Project Overview

Native macOS desktop terminal application purpose-built for Claude Code CLI.
Tauri 2.0 (Rust backend + React/TypeScript frontend).

**Status:** Implementation in progress.
**Spec:** `SPEC.md` is the source of truth.
**Design prototypes:** `design/terminal-v2.jsx`, `design/ssh-manager.jsx`

## Tech Stack

| Layer | Technology |
|---|---|
| App shell | Tauri 2.0 |
| Backend | Rust 1.78+ |
| PTY | `portable-pty` crate |
| SSH | `ssh2` crate (includes SFTP) |
| Keychain | `security-framework` crate |
| Frontend | React 19 + TypeScript 5.5 |
| Build | Vite 5 |
| Terminal renderer | xterm.js 5 |
| Editor | Monaco Editor (self-hosted WASM) |
| State | Zustand |
| Testing | Vitest (unit), tauri-driver (E2E) |
| Lint | clippy (Rust), ESLint + Prettier (TS) |
| Security | cargo audit + npm audit in CI |

## Target Platform

- macOS 13.0 Ventura+ only (arm64 + x86_64 universal binary)
- NOT a general-purpose terminal — Claude Code CLI workflow only
- Distribution: notarized `.dmg` via GitHub Releases

## Key Commands

```bash
# Development
npm install
npm run tauri dev

# Production build (universal binary)
npm run tauri build -- --target universal-apple-darwin

# Lint
cargo clippy -- -D warnings
npx eslint src/

# Security audit
cargo audit --deny warnings
npm audit --audit-level=moderate

# Tests
cargo test
npm run test
```

## Project Structure

```
src-tauri/src/
  main.rs               — app entry point
  commands/
    ssh.rs              — SSH IPC commands
    pty.rs              — PTY spawn and I/O
    keychain.rs         — macOS Keychain access
    config.rs           — config read/write
    fs.rs               — filesystem operations
    sftp.rs             — SFTP upload/download (drag-and-drop)
  ssh/
    session.rs          — SSH session model
    connect.rs          — connection logic
    config_parser.rs    — ~/.ssh/config importer
  models.rs             — shared data types

src/
  main.tsx              — React entry
  App.tsx               — root layout
  components/
    TitleBar.tsx
    ModeBar.tsx
    Terminal.tsx        — xterm.js wrapper + file-drop handler
    InputBar.tsx
    QuickCommands.tsx
    StatusBar.tsx
    sidebar/
      Sidebar.tsx
      SSHPanel.tsx
      FilesPanel.tsx
      ToolsPanel.tsx
      MemoryPanel.tsx
      ObsidianPanel.tsx
  panels/
    FileEditor.tsx      — Monaco editor right panel
  store/
    sessions.ts
    terminal.ts
    modes.ts
    cost.ts
  hooks/
    useSSH.ts
    usePTY.ts
    useCost.ts
    useObsidian.ts
  lib/
    modes.ts            — mode presets config
    pricing.ts          — model pricing constants
    sshConfig.ts        — SSH config parser
  styles/
    global.css
    theme.css
```

## Architecture Constraints (from SPEC + analysis)

### Security (non-negotiable)
- Credentials ONLY in macOS Keychain — never on disk
- IPC: frontend passes structured data only (session IDs, not raw commands)
- All Rust commands validate input before execution
- SSH: only ed25519 + ecdsa keys
- CSP: no external network calls (Obsidian localhost:22360 is the only exception)
- File Explorer: `canonical()` path check to prevent path traversal

### Critical Technical Requirements
- PTY MUST send SIGWINCH on window resize (otherwise vim/tmux break)
- Monaco WASM: lazy-load on first file open (8–12 MB, don't block startup)
- Config migrations: version-gated runner in Rust on startup
- CLAUDE.md watcher: `notify` crate watches for external edits

### Features Beyond Original SPEC (from analysis)
- **SFTP drag-and-drop:** `src-tauri/src/commands/sftp.rs` — Finder → SSH session upload
- **Multi-tab terminal:** tab bar for multiple sessions
- **macOS notifications:** `UNUserNotificationCenter` via Tauri plugin on command completion
- **ProxyJump support:** parse `ProxyJump` from `~/.ssh/config`
- **SIGWINCH handling:** explicit in PTY resize flow

## Mode Presets (Claude Code CLI)

| Mode | Model | Tools | Permissions |
|---|---|---|---|
| Coding | sonnet-4-6 | Bash,Edit,Write,Glob,Grep | auto |
| Reasoning | opus-4-6 | Glob,Grep,WebSearch,WebFetch + thinking(10k) | manual |
| Design | sonnet-4-6 | Write,Glob,WebSearch,WebFetch | auto |
| Research | haiku-4-5 | Grep,WebSearch,WebFetch | skip |

## Config Location

```
~/.config/claude-terminal/
  config.json           — app settings, NO credentials
  sessions.json         — session metadata, NO credentials (mode 0600)
  quick-commands.json   — user-defined commands
  themes/               — optional custom themes
  audit.log             — append-only connection log
```

## What NOT to Do

- No general-purpose terminal features (use iTerm2/Warp for that)
- No Windows/Linux support
- No cloud sync of sessions/config
- No bundled LLM — frontend for Claude Code CLI only
- No plugin system
- No telemetry without explicit opt-in
- No RSA keys (only ed25519 + ecdsa)
- No credentials in config files or logs

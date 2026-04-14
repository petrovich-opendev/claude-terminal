# claude-terminal

**AI-native terminal for Claude Code CLI on macOS.**

> Purpose-built replacement for Terminal.app when working with Claude Code.  
> SSH session manager · Mode presets · Tool permissions · Cost tracking · Obsidian MCP

---

## What's in this repo

```
SPEC.md              — full build specification (architecture, security, features)
design/
  terminal-v1.jsx    — UX prototype v1: 3-panel layout (files · terminal · editor)
  terminal-v2.jsx    — UX prototype v2: adds mode bar, tools, memory, obsidian panels
  ssh-manager.jsx    — SSH Session Manager: list, search, connect, Keychain auth
```

## Tech stack

- **Tauri 2.0** (Rust + React) — native macOS, no Electron
- **xterm.js 5** — terminal renderer
- **portable-pty** (Rust) — PTY management  
- **ssh2** (Rust) — SSH client
- **macOS Keychain** — credential storage (never plaintext)

## Running the design prototypes

The `design/*.jsx` files are React components. To preview:

```bash
# Paste any .jsx file into claude.ai artifact runner
# or use a local Vite + React setup:
npm create vite@latest preview -- --template react
cd preview && npm install
# replace src/App.jsx content with the .jsx file content
npm run dev
```

## Status

📐 Specification complete  
🎨 UX prototypes complete  
🔨 Implementation — not started  

**Contributions welcome.** See `SPEC.md` section 12 for contributing guidelines.

## License

MIT — see `SPEC.md` section 14.

**Author:** [AGENTDATA.PRO / PETROVICH](https://github.com/petrovich-opendev)

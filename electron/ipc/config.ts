import type { IpcMain } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
const CONFIG_DIR = path.join(os.homedir(), '.config', 'claude-terminal')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

/** Keep in sync with `src/lib/defaultQuickCommands.ts` */
const DEFAULT_QUICK_COMMANDS = [
  { id: 'start',    label: 'Start',    category: 'session', cmd: 'claude',              icon: '▶' },
  { id: 'continue', label: 'Continue', category: 'session', cmd: 'claude --continue',   icon: '↺' },
  { id: 'resume',   label: 'Resume',   category: 'session', cmd: 'claude --resume',     icon: '⏯' },
  { id: 'cost',     label: 'Cost',     category: 'session', cmd: '/cost',               icon: '$' },
  { id: 'compact',  label: 'Compact',  category: 'session', cmd: '/compact',            icon: '⊡' },
  { id: 'review',   label: 'Review',   category: 'code',    cmd: 'claude "Review this code for quality, bugs, and best practices"',    icon: '◉' },
  { id: 'fix',      label: 'Fix',      category: 'code',    cmd: 'claude "Fix the bug or issue in this code"',                         icon: '⚡' },
  { id: 'tests',    label: 'Tests',    category: 'code',    cmd: 'claude "Write comprehensive tests for this code"',                   icon: '✓' },
  { id: 'refactor', label: 'Refactor', category: 'code',    cmd: 'claude "Refactor this code for clarity and maintainability"',        icon: '↻' },
  { id: 'explain',  label: 'Explain',  category: 'code',    cmd: 'claude "Explain what this code does and how it works"',              icon: '?' },
  { id: 'pr',       label: 'PR',       category: 'git',     cmd: 'claude "Create a pull request for these changes"',                  icon: '⇡' },
  { id: 'commit',   label: 'Commit',   category: 'git',     cmd: 'claude "Commit these changes with a descriptive commit message"',   icon: '●' },
  { id: 'design',   label: 'Design',   category: 'arch',    cmd: 'claude "Design the architecture for this feature"',                 icon: '◇' },
  { id: 'adr',      label: 'ADR',      category: 'arch',    cmd: 'claude "Write an Architecture Decision Record for this decision"',  icon: '▣' },
] as const

const DEFAULT_CONFIG = {
  version: '0.1.0',
  theme: 'dark',
  terminal: { fontFamily: '"JetBrains Mono", monospace', fontSize: 13, lineHeight: 1.6, scrollback: 10000 },
  defaultMode: 'coding',
  costAlertThresholdUSD: 0.5,
  contextAlertPercent: 70,
  obsidianPort: 27123,
  editor: { readOnlyDefault: true, wordWrap: true },
  updates: { checkOnLaunch: true, channel: 'stable' as const },
  quickCommands: [...DEFAULT_QUICK_COMMANDS],
}

const QC_CATS = new Set(['session', 'code', 'git', 'arch'])

function normalizeQuickCommands(raw: unknown): unknown[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: unknown[] = []
  for (const row of raw) {
    if (out.length >= 64) break
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id.length > 64) continue
    if (typeof r.label !== 'string' || r.label.length > 120) continue
    if (typeof r.cmd !== 'string' || r.cmd.length > 4000) continue
    if (typeof r.icon !== 'string' || r.icon.length > 8) continue
    if (typeof r.category !== 'string' || !QC_CATS.has(r.category)) continue
    out.push({ id: r.id, label: r.label, category: r.category, cmd: r.cmd, icon: r.icon })
  }
  return out.length > 0 ? out : undefined
}
function ensureDir() { if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 }) }
export function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('config:get', async () => {
    ensureDir()
    if (!fs.existsSync(CONFIG_FILE)) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), { mode: 0o600 }); return DEFAULT_CONFIG }
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as Record<string, unknown>
      const qc = normalizeQuickCommands(parsed.quickCommands)
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        quickCommands: qc ?? DEFAULT_CONFIG.quickCommands,
      }
    } catch { return DEFAULT_CONFIG }
  })
  ipcMain.handle('config:set', async (_e, config: unknown) => {
    ensureDir()
    if (typeof config !== 'object' || !config) throw new Error('Invalid config')
    // Security: never allow credential-like fields in config
    const FORBIDDEN_KEYS = ['password', 'secret', 'token', 'apiKey', 'api_key', 'privateKey']
    const configStr = JSON.stringify(config)
    for (const key of FORBIDDEN_KEYS) {
      if (configStr.includes(`"${key}"`)) {
        throw new Error(`Config must not contain credential fields (found: ${key})`)
      }
    }
    const c = config as Record<string, unknown>
    if ('quickCommands' in c) {
      const qc = normalizeQuickCommands(c.quickCommands)
      if (c.quickCommands !== undefined && qc === undefined) {
        throw new Error('Invalid quickCommands: expected a non-empty array of { id, label, category, cmd, icon }')
      }
      if (qc) c.quickCommands = qc
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
    return { ok: true }
  })
}

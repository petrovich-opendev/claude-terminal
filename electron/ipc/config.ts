import type { IpcMain } from 'electron'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
const CONFIG_DIR = path.join(app.getPath('home'), '.config', 'claude-terminal')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const DEFAULT_CONFIG = { version: '0.1.0', theme: 'dark', terminal: { fontFamily: '"JetBrains Mono", monospace', fontSize: 13, lineHeight: 1.6, scrollback: 10000 }, defaultMode: 'coding', costAlertThresholdUSD: 0.5, contextAlertPercent: 70, obsidianPort: 27123, editor: { readOnlyDefault: true, wordWrap: true }, updates: { checkOnLaunch: true, channel: 'stable' } }
function ensureDir() { if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 }) }
export function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('config:get', async () => {
    ensureDir()
    if (!fs.existsSync(CONFIG_FILE)) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), { mode: 0o600 }); return DEFAULT_CONFIG }
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) } } catch { return DEFAULT_CONFIG }
  })
  ipcMain.handle('config:set', async (_e, config: unknown) => {
    ensureDir()
    if (typeof config !== 'object' || !config) throw new Error('Invalid config')
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
    return { ok: true }
  })
}

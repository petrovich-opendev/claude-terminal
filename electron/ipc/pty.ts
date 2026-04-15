import type { IpcMain, BrowserWindow } from 'electron'
import os from 'os'

let pty: typeof import('node-pty') | null = null
try { pty = require('node-pty') } catch { pty = null }
type IPty = import('node-pty').IPty

const sessions = new Map<string, IPty>()
let _id = 1

const ALLOWED = new Set(['bash', 'zsh', 'fish', 'sh', 'ssh', 'claude', 'tmux'])

function validateCmd(cmd: string): string {
  const base = cmd.split('/').pop() ?? ''
  if (!ALLOWED.has(base)) throw new Error(`Disallowed command: ${base}`)
  return cmd
}

/** Resolve cwd — expand ~ to HOME, fall back to HOME if invalid */
function resolveCwd(cwd: string): string {
  const home = os.homedir()
  const expanded = cwd === '~' ? home : cwd.replace(/^~\//, home + '/')
  // Validate directory exists, fall back to HOME
  try {
    const fs = require('fs')
    if (fs.existsSync(expanded) && fs.statSync(expanded).isDirectory()) return expanded
  } catch { /* fall through */ }
  return home
}

/** Detect user's default shell from env or fall back to /bin/zsh */
function defaultShell(): string {
  return process.env.SHELL || '/bin/zsh'
}

export function registerPtyHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('pty:create', async (_e, opts: { cols: number; rows: number; cwd: string; cmd: string; args: string[] }) => {
    if (!pty) throw new Error('node-pty not available')
    const resolvedCmd = (opts.cmd === '/bin/zsh' || opts.cmd === '~') ? defaultShell() : opts.cmd
    const cmd = validateCmd(resolvedCmd)
    const cwd = resolveCwd(opts.cwd ?? '~')
    const id = String(_id++)
    const proc = pty.spawn(cmd, opts.args ?? [], {
      name: 'xterm-256color',
      cols: Math.max(1, opts.cols || 80),
      rows: Math.max(1, opts.rows || 24),
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    })
    sessions.set(id, proc)
    proc.onData((d: string) => {
      if (!win.isDestroyed()) win.webContents.send('pty:data', id, d)
    })
    proc.onExit(({ exitCode }: { exitCode: number }) => {
      sessions.delete(id)
      if (!win.isDestroyed()) win.webContents.send('pty:exit', id, exitCode)
    })
    return { id }
  })

  ipcMain.handle('pty:write', async (_e, id: string, data: string) => {
    const p = sessions.get(id)
    if (!p) throw new Error('PTY session not found')
    p.write(data)
    return { ok: true }
  })

  // CRITICAL: pty.resize() sends SIGWINCH so vim/tmux/htop reflow correctly
  ipcMain.handle('pty:resize', async (_e, id: string, cols: number, rows: number) => {
    const p = sessions.get(id)
    if (p) p.resize(Math.max(1, cols), Math.max(1, rows))
    return { ok: true }
  })

  ipcMain.handle('pty:destroy', async (_e, id: string) => {
    const p = sessions.get(id)
    if (p) { p.kill(); sessions.delete(id) }
    return { ok: true }
  })
}

export function destroyAllPtySessions(): void {
  for (const p of sessions.values()) { try { p.kill() } catch { /* ignore */ } }
  sessions.clear()
}

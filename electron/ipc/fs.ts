import { dialog } from 'electron'
import type { IpcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

const IGNORE = new Set(['.git', 'node_modules', '__pycache__', 'dist', 'dist-electron', '.vite'])
const HOME = os.homedir()

/**
 * Resolve and validate a file path.
 * - Expands ~ to $HOME
 * - Resolves to absolute via fs.realpathSync (canonical)
 * - Rejects paths outside $HOME to prevent path traversal (e.g. /etc/shadow)
 */
function safe(p: string): string {
  if (typeof p !== 'string' || !p.trim()) throw new Error('Path must be a non-empty string')
  const expanded = p.replace(/^~(?=$|\/)/, HOME)
  const resolved = path.resolve(expanded)
  // Use canonical path to defeat symlink traversal
  const canonical = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved
  if (!canonical.startsWith(HOME + '/') && canonical !== HOME) {
    throw new Error('Access denied: path outside home directory')
  }
  return canonical
}

export function registerFsHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('fs:pick-files', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to upload',
    })
    if (result.canceled) return []
    // Validate all selected paths are within HOME
    return result.filePaths.filter(p => {
      const resolved = path.resolve(p)
      return resolved.startsWith(HOME + '/') || resolved === HOME
    })
  })

  ipcMain.handle('fs:list', async (_e, dir: string) => {
    const t = safe(dir)
    if (!fs.existsSync(t)) return []

    // Parse .gitignore if present
    const ignorePatterns: string[] = []
    const gitignorePath = path.join(t, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf-8')
        content.split('\n').forEach(line => {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
            // Strip trailing slash for directory patterns
            ignorePatterns.push(trimmed.replace(/\/$/, ''))
          }
        })
      } catch { /* ignore read errors */ }
    }

    function matchesGitignore(name: string): boolean {
      return ignorePatterns.some(pat => {
        // Simple glob: * matches anything except /
        const re = '^' + pat.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$'
        try { return new RegExp(re).test(name) } catch { return name === pat }
      })
    }

    return fs.readdirSync(t, { withFileTypes: true })
      .filter(e => !IGNORE.has(e.name) && !e.name.startsWith('.') && !matchesGitignore(e.name))
      .map(e => ({ name: e.name, path: path.join(t, e.name), isDirectory: e.isDirectory(), extension: e.isFile() ? path.extname(e.name).toLowerCase() : undefined }))
      .sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1)
  })

  ipcMain.handle('fs:read', async (_e, filePath: string) => {
    const t = safe(filePath)
    if (!fs.existsSync(t)) throw new Error('File not found')
    const stat = fs.statSync(t)
    if (!stat.isFile()) throw new Error('Not a regular file')
    if (stat.size > 5 * 1024 * 1024) throw new Error('File too large (>5 MB)')
    return fs.readFileSync(t, 'utf-8')
  })

  ipcMain.handle('fs:write', async (_e, filePath: string, content: string) => {
    if (typeof content !== 'string') throw new Error('Content must be a string')
    const t = safe(filePath)
    // Ensure parent directory exists and is within HOME
    const dir = path.dirname(t)
    if (!dir.startsWith(HOME)) throw new Error('Access denied: path outside home directory')
    fs.writeFileSync(t, content, 'utf-8')
    return { ok: true }
  })
}

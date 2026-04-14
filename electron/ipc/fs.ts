import type { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
const IGNORE = new Set(['.git','node_modules','__pycache__','dist','dist-electron','.vite'])
function safe(p: string) { return path.resolve(p.replace(/^~/, process.env.HOME ?? '')) }
export function registerFsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('fs:list', async (_e, dir: string) => {
    const t = safe(dir)
    if (!fs.existsSync(t)) return []
    return fs.readdirSync(t, { withFileTypes: true })
      .filter(e => !IGNORE.has(e.name) && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: path.join(t, e.name), isDirectory: e.isDirectory(), extension: e.isFile() ? path.extname(e.name).toLowerCase() : undefined }))
      .sort((a,b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1)
  })
  ipcMain.handle('fs:read', async (_e, filePath: string) => {
    const t = safe(filePath)
    if (!fs.existsSync(t)) throw new Error('File not found')
    if (fs.statSync(t).size > 5*1024*1024) throw new Error('File too large (>5MB)')
    return fs.readFileSync(t, 'utf-8')
  })
  ipcMain.handle('fs:write', async (_e, filePath: string, content: string) => {
    if (typeof content !== 'string') throw new Error('Content must be string')
    fs.writeFileSync(safe(filePath), content, 'utf-8')
    return { ok: true }
  })
}

import type { IpcMain } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
const SESS_FILE = () => path.join(os.homedir(),'.config','claude-terminal','sessions.json')
/** Accepts FQDN/IPv4 (alphanumeric + . _ -), bare IPv6 (hex + colons), or bracketed IPv6 */
function isValidHost(h: string): boolean {
  if (/^[a-zA-Z0-9._-]+$/.test(h)) return true
  // IPv6 bare, e.g. "::1" or "2001:db8::1"
  if (/^[a-fA-F0-9:]+$/.test(h) && h.includes(':')) return true
  // IPv6 bracketed, e.g. "[::1]"
  if (/^\[[a-fA-F0-9:]+\]$/.test(h)) return true
  return false
}
const SAFE = /^[a-zA-Z0-9._@-]+$/
function readSessions() { const f=SESS_FILE(); if(!fs.existsSync(f))return []; try{return JSON.parse(fs.readFileSync(f,'utf-8'))}catch{return []} }
function writeSessions(s: unknown[]) { const d=path.dirname(SESS_FILE()); if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true,mode:0o700}); fs.writeFileSync(SESS_FILE(),JSON.stringify(s,null,2),{mode:0o600}) }
export function registerSshHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ssh:list', async () => readSessions())
  ipcMain.handle('ssh:save', async (_e, session: unknown) => {
    if (typeof session !== 'object' || !session) throw new Error('Invalid session')
    const s = session as { id: string; host: string; user: string; port?: number; authType?: string }
    if (!s.id || !s.host || !s.user) throw new Error('Missing required fields: id, host, user')
    // Validate host and user characters to prevent injection. Supports IPv4, FQDN, and IPv6 (bare or bracketed).
    if (!isValidHost(s.host)) throw new Error('Invalid hostname characters')
    if (!SAFE.test(s.user)) throw new Error('Invalid username characters')
    if (s.port !== undefined && (s.port < 1 || s.port > 65535)) throw new Error('Port must be 1-65535')
    // Ensure no credential fields leak into session file
    const sanitized = { ...s }
    delete (sanitized as Record<string, unknown>).password
    delete (sanitized as Record<string, unknown>).passphrase
    const all = readSessions()
    const i = all.findIndex((x: { id: string }) => x.id === s.id)
    if (i >= 0) all[i] = sanitized; else all.push(sanitized)
    writeSessions(all)
    return { ok: true }
  })
  ipcMain.handle('ssh:delete', async (_e, id: string) => { writeSessions(readSessions().filter((s:{id:string})=>s.id!==id)); return {ok:true} })
  ipcMain.handle('ssh:disconnect', async () => ({ok:true}))
  ipcMain.handle('ssh:connect', async () => ({ok:true}))
  ipcMain.handle('ssh:import-config', async () => {
    const {parseSshConfig}=require('./ssh_config_parser'); return parseSshConfig()
  })
}

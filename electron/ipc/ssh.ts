import type { IpcMain } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
const SESS_FILE = () => path.join(os.homedir(),'.config','claude-terminal','sessions.json')
function readSessions() { const f=SESS_FILE(); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf-8')):[] }
function writeSessions(s: unknown[]) { const d=path.dirname(SESS_FILE()); if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true,mode:0o700}); fs.writeFileSync(SESS_FILE(),JSON.stringify(s,null,2),{mode:0o600}) }
export function registerSshHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ssh:list', async () => readSessions())
  ipcMain.handle('ssh:save', async (_e, session: unknown) => {
    if (typeof session!=='object'||!session) throw new Error('Invalid session')
    const s=session as {id:string;host:string;user:string}
    if (!s.id||!s.host||!s.user) throw new Error('Missing required fields: id, host, user')
    const all=readSessions(); const i=all.findIndex((x:{id:string})=>x.id===s.id)
    if(i>=0) all[i]=s; else all.push(s)
    writeSessions(all); return {ok:true}
  })
  ipcMain.handle('ssh:delete', async (_e, id: string) => { writeSessions(readSessions().filter((s:{id:string})=>s.id!==id)); return {ok:true} })
  ipcMain.handle('ssh:disconnect', async () => ({ok:true}))
  ipcMain.handle('ssh:connect', async () => ({ok:true}))
  ipcMain.handle('ssh:import-config', async () => {
    const {parseSshConfig}=require('./ssh_config_parser'); return parseSshConfig()
  })
}

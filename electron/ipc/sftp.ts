import type { IpcMain, BrowserWindow } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
let ssh2: { Client: new() => import('ssh2').Client } | null = null
try { ssh2 = require('ssh2') } catch { ssh2 = null }
function loadSessions() { const f=path.join(os.homedir(),'.config','claude-terminal','sessions.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf-8')):[] }
export function registerSftpHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('sftp:upload', async (_e, sessionId:string, localPaths:string[], remoteDir:string) => {
    if (!ssh2) throw new Error('ssh2 not available')
    if (!Array.isArray(localPaths)||!localPaths.length) throw new Error('No files')
    if (!remoteDir.startsWith('/')) throw new Error('Remote dir must be absolute')
    const sess = loadSessions().find((s:{id:string})=>s.id===sessionId)
    if (!sess) throw new Error('Session not found')
    return new Promise((resolve,reject) => {
      const conn = new ssh2.Client()
      conn.on('ready', () => conn.sftp((err,sftp) => {
        if (err) { conn.end(); return reject(err) }
        let done=0
        for (const lp of localPaths) {
          const name=path.basename(lp), rp=path.posix.join(remoteDir,name), total=fs.statSync(lp).size; let up=0
          const rs=fs.createReadStream(lp), ws=sftp.createWriteStream(rp)
          rs.on('data',(chunk:string|Buffer)=>{ const len=Buffer.isBuffer(chunk)?chunk.length:Buffer.byteLength(chunk); up+=len; if(!win.isDestroyed()) win.webContents.send('sftp:progress',{file:name,percent:total>0?Math.round(up/total*100):0}) })
          ws.on('close',()=>{ done++; if(done===localPaths.length){conn.end();resolve({ok:true,count:done})} })
          ws.on('error',(e:Error)=>{conn.end();reject(e)})
          rs.pipe(ws)
        }
      }))
      conn.on('error',(e:Error)=>reject(e))
      const o: Record<string,unknown> = {host:sess.host,port:sess.port||22,username:sess.user}
      if (sess.authType==='key'&&sess.keyPath) o.privateKey=fs.readFileSync(sess.keyPath.replace(/^~/,os.homedir()))
      conn.connect(o as import('ssh2').ConnectConfig)
    })
  })
}

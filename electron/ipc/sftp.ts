import type { IpcMain, BrowserWindow } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
let ssh2: { Client: new() => import('ssh2').Client } | null = null
try { ssh2 = require('ssh2') } catch { ssh2 = null }
let keytar: typeof import('keytar') | null = null
try { keytar = require('keytar') } catch { keytar = null }
const KEYCHAIN_SERVICE = 'claude-terminal'
// Accept any non-empty alphanumeric session ID (including legacy non-UUID IDs
// generated before commit 7869ca4). Real security is the sessions.json lookup below.
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/

function loadSessions() { const f=path.join(os.homedir(),'.config','claude-terminal','sessions.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf-8')):[] }

const SFTP_IGNORE = new Set(['.git','node_modules','__pycache__','dist','dist-electron','.vite'])

function validateRemotePath(p: string): void {
  const normalized = path.posix.normalize(p)
  if (normalized.includes('/../') || normalized.endsWith('/..') || normalized === '..') {
    throw new Error('Path traversal not allowed')
  }
}

async function buildConnectOpts(sess: {
  host: string; port?: number; user: string;
  authType: string; keyPath?: string; id: string
}): Promise<Record<string, unknown>> {
  const o: Record<string, unknown> = { host: sess.host, port: sess.port || 22, username: sess.user }
  if (sess.authType === 'key' && sess.keyPath) {
    o.privateKey = fs.readFileSync(sess.keyPath.replace(/^~/, os.homedir()))
  } else if (sess.authType === 'password') {
    const pw = keytar ? await keytar.getPassword(KEYCHAIN_SERVICE, sess.id) : null
    if (!pw) throw new Error('Password not found in Keychain')
    o.password = pw
  } else if (sess.authType === 'keychain' && sess.keyPath) {
    const passphrase = keytar ? await keytar.getPassword(KEYCHAIN_SERVICE, sess.id) : null
    o.privateKey = fs.readFileSync(sess.keyPath.replace(/^~/, os.homedir()))
    if (passphrase) o.passphrase = passphrase
  }
  return o
}

export function registerSftpHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('sftp:list', async (_e, sessionId: string, remotePath: string) => {
    if (!ssh2) throw new Error('ssh2 not available')
    console.log('[sftp:list] sessionId=', JSON.stringify(sessionId), 'type=', typeof sessionId, 'remotePath=', JSON.stringify(remotePath))
    if (!SESSION_ID_RE.test(sessionId)) {
      console.error('[sftp:list] INVALID SESSION ID — value:', JSON.stringify(sessionId))
      throw new Error(`Invalid session ID: ${JSON.stringify(sessionId)}`)
    }
    if (typeof remotePath !== 'string' || !remotePath) throw new Error('Path must be a non-empty string')
    validateRemotePath(remotePath)
    const sess = loadSessions().find((s: {id:string}) => s.id === sessionId)
    if (!sess) throw new Error('Session not found')
    const expanded = remotePath.replace(/^~($|\/)/, `/home/${sess.user}$1`)
    const opts = await buildConnectOpts(sess)
    const Ssh2Client = ssh2.Client
    return new Promise<Array<{name:string;path:string;isDirectory:boolean;extension?:string}>>((resolve, reject) => {
      const conn = new Ssh2Client()
      conn.on('ready', () => conn.sftp((err, sftp) => {
        if (err) { conn.end(); return reject(err) }
        sftp.readdir(expanded, (err2, list) => {
          conn.end()
          if (err2) return reject(err2)
          const items = list
            .filter(e => !SFTP_IGNORE.has(e.filename) && !e.filename.startsWith('.'))
            .map(e => {
              const isDir = !!(e.attrs.mode && (e.attrs.mode & 0o170000) === 0o040000)
              const ext = isDir ? undefined : path.extname(e.filename).toLowerCase() || undefined
              return { name: e.filename, path: path.posix.join(expanded, e.filename), isDirectory: isDir, extension: ext }
            })
            .sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1)
          resolve(items)
        })
      }))
      conn.on('error', (e: Error) => reject(e))
      conn.connect(opts as import('ssh2').ConnectConfig)
    })
  })

  ipcMain.handle('sftp:upload', async (_e, sessionId:string, localPaths:string[], remoteDir:string) => {
    if (!ssh2) throw new Error('ssh2 not available')
    if (!SESSION_ID_RE.test(sessionId)) throw new Error('Invalid session ID')
    if (!Array.isArray(localPaths)||!localPaths.length) throw new Error('No files')
    if (!remoteDir.startsWith('/') && !remoteDir.startsWith('~')) throw new Error('Remote dir must be absolute or start with ~')
    // Validate local paths are within HOME
    const home = os.homedir()
    for (const lp of localPaths) {
      const resolved = path.resolve(lp)
      if (!resolved.startsWith(home + '/') && resolved !== home) {
        throw new Error('Upload source must be within home directory')
      }
    }
    const sess = loadSessions().find((s:{id:string})=>s.id===sessionId)
    if (!sess) throw new Error('Session not found')
    const opts = await buildConnectOpts(sess)
    const Ssh2Client = ssh2.Client
    return new Promise((resolve,reject) => {
      const conn = new Ssh2Client()
      conn.on('ready', () => conn.sftp((err,sftp) => {
        if (err) { conn.end(); return reject(err) }
        let done=0
        for (const lp of localPaths) {
          const name=path.basename(lp), rp=path.posix.join(remoteDir,name), total=fs.statSync(lp).size; let up=0
          const rs=fs.createReadStream(lp), ws=sftp.createWriteStream(rp)
          rs.on('data',(chunk:string|Buffer)=>{ const len=Buffer.isBuffer(chunk)?chunk.length:Buffer.byteLength(chunk); up+=len; if(!win.isDestroyed()) win.webContents.send('sftp:progress',{file:name,percent:total>0?Math.round(up/total*100):0}) })
          rs.on('error',(e:Error)=>{conn.end();reject(e)})
          ws.on('close',()=>{ done++; if(done===localPaths.length){conn.end();resolve({ok:true,count:done})} })
          ws.on('error',(e:Error)=>{conn.end();reject(e)})
          rs.pipe(ws)
        }
      }))
      conn.on('error',(e:Error)=>reject(e))
      conn.connect(opts as import('ssh2').ConnectConfig)
    })
  })
}

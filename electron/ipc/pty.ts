import type { IpcMain, BrowserWindow } from 'electron'
let pty: typeof import('node-pty') | null = null
try { pty = require('node-pty') } catch { pty = null }
type IPty = import('node-pty').IPty
const sessions = new Map<string, IPty>()
let _id = 1
const ALLOWED = new Set(['bash','zsh','fish','sh','ssh','claude'])
function validateCmd(cmd: string) { const b = cmd.split('/').pop()??''; if (!ALLOWED.has(b)) throw new Error(`Disallowed: ${b}`); return cmd }
export function registerPtyHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('pty:create', async (_e, opts: { cols:number;rows:number;cwd:string;cmd:string;args:string[] }) => {
    if (!pty) throw new Error('node-pty not available')
    validateCmd(opts.cmd)
    const id = String(_id++)
    const proc = pty.spawn(opts.cmd, opts.args??[], { name:'xterm-256color', cols:Math.max(1,opts.cols||80), rows:Math.max(1,opts.rows||24), cwd:opts.cwd??process.env.HOME??'/', env:{...process.env,TERM:'xterm-256color',COLORTERM:'truecolor'} })
    sessions.set(id, proc)
    proc.onData((d:string) => { if (!win.isDestroyed()) win.webContents.send('pty:data',id,d) })
    proc.onExit(({exitCode}:{exitCode:number}) => { sessions.delete(id); if (!win.isDestroyed()) win.webContents.send('pty:exit',id,exitCode) })
    return { id }
  })
  ipcMain.handle('pty:write', async (_e,id:string,data:string) => { const p=sessions.get(id); if(!p) throw new Error('Not found'); p.write(data); return {ok:true} })
  // CRITICAL: pty.resize() sends SIGWINCH so vim/tmux/htop reflow correctly
  ipcMain.handle('pty:resize', async (_e,id:string,cols:number,rows:number) => { const p=sessions.get(id); if(p) p.resize(Math.max(1,cols),Math.max(1,rows)); return {ok:true} })
  ipcMain.handle('pty:destroy', async (_e,id:string) => { const p=sessions.get(id); if(p){p.kill();sessions.delete(id)} return {ok:true} })
}
export function destroyAllPtySessions(): void { for(const p of sessions.values()){try{p.kill()}catch{}} sessions.clear() }

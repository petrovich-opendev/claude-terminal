import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

// Expose ONLY typed, named IPC channels — never expose raw ipcRenderer
contextBridge.exposeInMainWorld('electronAPI', {
  // PTY
  ptyCreate: (opts: { cols: number; rows: number; cwd: string; cmd: string; args: string[] }) =>
    ipcRenderer.invoke('pty:create', opts),
  ptyWrite: (id: string, data: string) =>
    ipcRenderer.invoke('pty:write', id, data),
  ptyResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty:resize', id, cols, rows),
  ptyDestroy: (id: string) =>
    ipcRenderer.invoke('pty:destroy', id),
  onPtyData: (id: string, cb: (data: string) => void) => {
    const listener = (_: IpcRendererEvent, ptyId: string, data: string) => {
      if (ptyId === id) cb(data)
    }
    ipcRenderer.on('pty:data', listener)
    return () => ipcRenderer.removeListener('pty:data', listener)
  },
  onPtyExit: (id: string, cb: (code: number) => void) => {
    const listener = (_: IpcRendererEvent, ptyId: string, code: number) => {
      if (ptyId === id) cb(code)
    }
    ipcRenderer.on('pty:exit', listener)
    return () => ipcRenderer.removeListener('pty:exit', listener)
  },
  // SSH
  sshConnect: (sessionId: string) => ipcRenderer.invoke('ssh:connect', sessionId),
  sshDisconnect: (sessionId: string) => ipcRenderer.invoke('ssh:disconnect', sessionId),
  sshList: () => ipcRenderer.invoke('ssh:list'),
  sshSave: (session: unknown) => ipcRenderer.invoke('ssh:save', session),
  sshDelete: (id: string) => ipcRenderer.invoke('ssh:delete', id),
  sshSaveOrder: (ids: string[]) => ipcRenderer.invoke('ssh:save-order', ids),
  sshImportConfig: () => ipcRenderer.invoke('ssh:import-config'),
  // Keychain
  keychainSet: (account: string, password: string) => ipcRenderer.invoke('keychain:set', account, password),
  keychainGet: (account: string) => ipcRenderer.invoke('keychain:get', account),
  keychainDelete: (account: string) => ipcRenderer.invoke('keychain:delete', account),
  // Config
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (config: unknown) => ipcRenderer.invoke('config:set', config),
  // FS
  fsList: (dir: string) => ipcRenderer.invoke('fs:list', dir),
  fsPickFiles: () => ipcRenderer.invoke('fs:pick-files'),
  fsRead: (filePath: string) => ipcRenderer.invoke('fs:read', filePath),
  fsWrite: (filePath: string, content: string) => ipcRenderer.invoke('fs:write', filePath, content),
  // SFTP
  sftpList: (sessionId: string, remotePath: string) =>
    ipcRenderer.invoke('sftp:list', sessionId, remotePath),
  sftpUpload: (sessionId: string, localPaths: string[], remoteDir: string) =>
    ipcRenderer.invoke('sftp:upload', sessionId, localPaths, remoteDir),
  sftpDownload: (sessionId: string, remotePath: string, localDir: string) =>
    ipcRenderer.invoke('sftp:download', sessionId, remotePath, localDir),
  onSftpProgress: (cb: (progress: { file: string; percent: number }) => void) => {
    const listener = (_: IpcRendererEvent, progress: { file: string; percent: number }) => cb(progress)
    ipcRenderer.on('sftp:progress', listener)
    return () => ipcRenderer.removeListener('sftp:progress', listener)
  },
  // Tray / window
  trayShow: () => ipcRenderer.invoke('tray:show'),
  trayHide: () => ipcRenderer.invoke('tray:hide'),
  trayQuit: () => ipcRenderer.invoke('tray:quit'),
})

/**
 * Claude Terminal — AI-native macOS terminal for Claude Code CLI
 * Copyright (c) 2026 AGENTDATA.PRO / Ruslan Karimov (Petrovich)
 * https://agentdata.pro | MIT License
 */
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { registerPtyHandlers, destroyAllPtySessions } from './ipc/pty'
import { registerSshHandlers } from './ipc/ssh'
import { registerKeychainHandlers } from './ipc/keychain'
import { registerConfigHandlers } from './ipc/config'
import { registerFsHandlers } from './ipc/fs'
import { registerSftpHandlers } from './ipc/sftp'

const isDev = process.env.NODE_ENV === 'development'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 640,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#08080a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (isDev) { win.loadURL('http://localhost:5173'); win.webContents.openDevTools() }
  else win.loadFile(path.join(__dirname, '../dist/index.html'))
  return win
}

app.whenReady().then(() => {
  const win = createWindow()
  registerPtyHandlers(ipcMain, win)
  registerSshHandlers(ipcMain)
  registerKeychainHandlers(ipcMain)
  registerConfigHandlers(ipcMain)
  registerFsHandlers(ipcMain)
  registerSftpHandlers(ipcMain, win)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => destroyAllPtySessions())
app.on('web-contents-created', (_e, contents) => { contents.on('new-window', (e) => e.preventDefault()) })

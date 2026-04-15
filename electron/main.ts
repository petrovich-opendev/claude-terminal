/**
 * Claude Terminal — AI-native macOS terminal for Claude Code CLI
 * Copyright (c) 2026 AGENTDATA.PRO / Ruslan Karimov (Petrovich)
 * https://agentdata.pro | MIT License
 */
import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { registerPtyHandlers, destroyAllPtySessions } from './ipc/pty'
import { registerSshHandlers } from './ipc/ssh'
import { registerKeychainHandlers } from './ipc/keychain'
import { registerConfigHandlers } from './ipc/config'
import { registerFsHandlers } from './ipc/fs'
import { registerSftpHandlers } from './ipc/sftp'

const isDev = process.env.NODE_ENV === 'development'
let mainWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// Global error handlers — prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

// ── Tray icon ─────────────────────────────────────────────────────────────────
function buildTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '../resources/tray-icon.png')
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath)
    img.setTemplateImage(true)   // auto-adapts to dark/light macOS menu bar
    return img
  }
  // Fallback: tiny transparent image so Tray doesn't crash
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAKElEQVQ4jWNgYGD4z8BAAIx6MurJqCejnox6MurJqCejngxzTxAAAAD//wMABFkBf3nWEgAAAABJRU5ErkJggg=='
  )
}

function buildTrayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Show Claude Terminal',
      click: () => {
        mainWin?.show()
        app.dock?.show()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
}

function createTray(): void {
  tray = new Tray(buildTrayIcon())
  tray.setToolTip('Claude Terminal')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    if (mainWin?.isVisible()) {
      mainWin.hide()
      app.dock?.hide()
    } else {
      mainWin?.show()
      app.dock?.show()
    }
  })
}

// ── Window ─────────────────────────────────────────────────────────────────────
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

  // Security: block navigation to external URLs — only allow dev server and local files
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('http://localhost:5173') || url.startsWith('file://')
    if (!allowed) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 24/7: close button hides window instead of quitting
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
      app.dock?.hide()
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

// ── IPC: tray control from renderer ──────────────────────────────────────────
function registerTrayHandlers(): void {
  ipcMain.handle('tray:show', () => {
    mainWin?.show()
    app.dock?.show()
  })
  ipcMain.handle('tray:hide', () => {
    mainWin?.hide()
    app.dock?.hide()
  })
  ipcMain.handle('tray:quit', () => {
    isQuitting = true
    app.quit()
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  mainWin = createWindow()
  createTray()

  registerPtyHandlers(ipcMain, mainWin)
  registerSshHandlers(ipcMain)
  registerKeychainHandlers(ipcMain)
  registerConfigHandlers(ipcMain)
  registerFsHandlers(ipcMain)
  registerSftpHandlers(ipcMain, mainWin)
  registerTrayHandlers()

  app.on('activate', () => {
    // macOS: clicking dock icon re-shows window
    mainWin?.show()
    app.dock?.show()
  })
})

// Only quit via tray menu "Quit" or Cmd+Q
app.on('window-all-closed', () => {
  // macOS: keep alive in tray even when all windows are hidden
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
  destroyAllPtySessions()
})

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

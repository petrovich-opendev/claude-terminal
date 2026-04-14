/**
 * Keychain IPC — macOS Keychain via keytar
 * SECURITY: credentials never logged, never returned in error messages
 */
import type { IpcMain } from 'electron'
let keytar: typeof import('keytar') | null = null
try { keytar = require('keytar') } catch { keytar = null }
const SERVICE = 'claude-terminal'
export function registerKeychainHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('keychain:set', async (_e, account: string, password: string) => {
    if (!keytar) throw new Error('Keychain not available')
    if (!account) throw new Error('Invalid account')
    await keytar.setPassword(SERVICE, account, password)
    return { ok: true }
  })
  ipcMain.handle('keychain:get', async (_e, account: string) => {
    if (!keytar) throw new Error('Keychain not available')
    return keytar.getPassword(SERVICE, account)
  })
  ipcMain.handle('keychain:delete', async (_e, account: string) => {
    if (!keytar) throw new Error('Keychain not available')
    await keytar.deletePassword(SERVICE, account)
    return { ok: true }
  })
}

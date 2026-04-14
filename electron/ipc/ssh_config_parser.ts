import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

interface ParsedSession {
  id: string
  name: string
  group: string
  host: string
  port: number
  user: string
  authType: 'key'
  keyPath?: string
  tags: string[]
  note: string
  status: 'idle'
}

/**
 * Parse ~/.ssh/config and return session profiles.
 * Each session gets a stable UUID derived from the Host alias (deterministic
 * so re-importing doesn't create duplicates by ID).
 */
export function parseSshConfig(): ParsedSession[] {
  const configPath = path.join(os.homedir(), '.ssh', 'config')
  if (!fs.existsSync(configPath)) return []

  const lines = fs.readFileSync(configPath, 'utf-8').split('\n')
  const results: ParsedSession[] = []
  let cur: Partial<ParsedSession> & { alias?: string } | null = null

  const flush = () => {
    if (cur && cur.alias && cur.alias !== '*' && cur.host) {
      // Generate a deterministic UUID v5-style ID from the alias
      const hash = crypto.createHash('sha256').update(`ssh-import:${cur.alias}`).digest('hex')
      const id = [hash.slice(0, 8), hash.slice(8, 12), '4' + hash.slice(13, 16), '8' + hash.slice(17, 20), hash.slice(20, 32)].join('-')
      results.push({
        id,
        name: cur.alias,
        group: 'Imported',
        host: cur.host,
        port: cur.port || 22,
        user: cur.user || os.userInfo().username,
        authType: 'key',
        keyPath: cur.keyPath,
        tags: ['imported'],
        note: 'Imported from ~/.ssh/config',
        status: 'idle',
      })
    }
  }

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('#') || !t) continue
    const [k, ...v] = t.split(/\s+/)
    const val = v.join(' ')
    const kl = k.toLowerCase()
    if (kl === 'host') {
      flush()
      cur = { alias: val }
    } else if (cur) {
      if (kl === 'hostname') cur.host = val
      else if (kl === 'user') cur.user = val
      else if (kl === 'port') cur.port = parseInt(val, 10) || 22
      else if (kl === 'identityfile') cur.keyPath = val.replace(/^~/, os.homedir())
    }
  }
  flush()
  return results
}

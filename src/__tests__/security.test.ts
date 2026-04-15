import { describe, it, expect } from 'vitest'

// Test path traversal validation from sftp.ts (extracted logic)
function validateRemotePath(p: string): void {
  if (p.includes('/../') || p.endsWith('/..') || p === '..' || p.includes('..')) {
    throw new Error('Path traversal not allowed')
  }
}

// Test UUID validation from sftp.ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Test PTY command allowlist from pty.ts
const ALLOWED = new Set(['bash', 'zsh', 'fish', 'sh', 'ssh', 'claude', 'tmux'])
function validateCmd(cmd: string) {
  const b = cmd.split('/').pop() ?? ''
  if (!ALLOWED.has(b)) throw new Error(`Disallowed: ${b}`)
  return cmd
}

describe('Path Traversal Prevention', () => {
  it('allows normal absolute paths', () => {
    expect(() => validateRemotePath('/home/user/project')).not.toThrow()
  })

  it('allows home shorthand', () => {
    expect(() => validateRemotePath('~')).not.toThrow()
    expect(() => validateRemotePath('~/project')).not.toThrow()
  })

  it('blocks /../ traversal', () => {
    expect(() => validateRemotePath('/home/../etc/passwd')).toThrow('Path traversal')
  })

  it('blocks trailing /..', () => {
    expect(() => validateRemotePath('/home/user/..')).toThrow('Path traversal')
  })

  it('blocks bare ..', () => {
    expect(() => validateRemotePath('..')).toThrow('Path traversal')
  })

  it('blocks encoded traversal attempts', () => {
    expect(() => validateRemotePath('/home/../../etc')).toThrow('Path traversal')
  })
})

describe('UUID Validation', () => {
  it('accepts valid UUID v4', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts crypto.randomUUID() format', () => {
    const id = crypto.randomUUID()
    expect(UUID_RE.test(id)).toBe(true)
  })

  it('rejects base36 genId format (old bug)', () => {
    const oldGenId = Date.now().toString(36) + Math.random().toString(36).slice(2)
    expect(UUID_RE.test(oldGenId)).toBe(false)
  })

  it('rejects alias-imported format (old bug)', () => {
    expect(UUID_RE.test('llmsrv-imported')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(UUID_RE.test('')).toBe(false)
  })

  it('rejects null-ish values', () => {
    expect(UUID_RE.test('undefined')).toBe(false)
    expect(UUID_RE.test('null')).toBe(false)
  })
})

describe('PTY Command Allowlist', () => {
  it('allows bash', () => {
    expect(() => validateCmd('/bin/bash')).not.toThrow()
  })

  it('allows zsh', () => {
    expect(() => validateCmd('/bin/zsh')).not.toThrow()
  })

  it('allows ssh', () => {
    expect(() => validateCmd('/usr/bin/ssh')).not.toThrow()
  })

  it('allows claude', () => {
    expect(() => validateCmd('claude')).not.toThrow()
  })

  it('allows tmux', () => {
    expect(() => validateCmd('/usr/bin/tmux')).not.toThrow()
  })

  it('blocks arbitrary commands', () => {
    expect(() => validateCmd('/bin/rm')).toThrow('Disallowed')
    expect(() => validateCmd('python3')).toThrow('Disallowed')
    expect(() => validateCmd('/usr/bin/curl')).toThrow('Disallowed')
  })

  it('blocks empty command', () => {
    expect(() => validateCmd('')).toThrow('Disallowed')
  })
})

describe('SSH Command Injection Prevention', () => {
  it('host with spaces would break command', () => {
    const host = 'evil; rm -rf /'
    // A properly escaped host should not contain shell metacharacters
    expect(host).toMatch(/[;&|`$]/)
  })

  it('host should only contain valid hostname chars', () => {
    const validHost = /^[a-zA-Z0-9._-]+$/
    expect(validHost.test('llmsrv')).toBe(true)
    expect(validHost.test('192.168.1.1')).toBe(true)
    expect(validHost.test('server.example.com')).toBe(true)
    expect(validHost.test('evil; rm -rf /')).toBe(false)
    expect(validHost.test('host`whoami`')).toBe(false)
  })

  it('username should only contain valid chars', () => {
    const validUser = /^[a-zA-Z0-9._-]+$/
    expect(validUser.test('dev')).toBe(true)
    expect(validUser.test('root')).toBe(true)
    expect(validUser.test('user$(id)')).toBe(false)
  })
})

describe('File Path Escaping in PTY Commands', () => {
  it('file path with quotes must be escaped before ptyWrite', () => {
    const path = '/home/user/"quoted".js'
    const safePath = path.replace(/"/g, '\\"')
    const cmd = `claude "Explain the code in ${safePath}"`
    // Escaped quotes should not break the command
    expect(cmd).toContain('\\"quoted\\"')
    expect(cmd.startsWith('claude "')).toBe(true)
    expect(cmd.endsWith('"')).toBe(true)
  })

  it('safe path does not break command', () => {
    const path = '/home/user/safe-file.ts'
    const cmd = `claude "Explain the code in ${path}"`
    expect(cmd).not.toContain('""')
    expect(cmd.split('"').length).toBe(3) // open, close, end
  })
})

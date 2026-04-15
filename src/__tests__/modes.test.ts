import { describe, it, expect } from 'vitest'
import { MODES, MODEL_IDS, buildCliCommand } from '../lib/modes'
import type { ClaudeModeId } from '../lib/models'

describe('MODES', () => {
  const MODE_IDS: ClaudeModeId[] = ['coding', 'reasoning', 'design', 'research']

  it('defines all four modes', () => {
    expect(Object.keys(MODES).sort()).toEqual([...MODE_IDS].sort())
  })

  it('each mode has required fields', () => {
    for (const id of MODE_IDS) {
      const m = MODES[id]
      expect(m.id).toBe(id)
      expect(m.label).toBeTruthy()
      expect(m.icon).toBeTruthy()
      expect(m.color).toMatch(/^#/)
      expect(['haiku', 'sonnet', 'opus']).toContain(m.model)
      expect(['auto', 'manual', 'skip']).toContain(m.permissionsMode)
      expect(m.tools).toBeDefined()
      expect(typeof m.extendedThinking).toBe('boolean')
      expect(typeof m.thinkingBudget).toBe('number')
      expect(Array.isArray(m.cliFlags)).toBe(true)
    }
  })

  it('reasoning mode uses opus with extended thinking', () => {
    const r = MODES.reasoning
    expect(r.model).toBe('opus')
    expect(r.extendedThinking).toBe(true)
    expect(r.thinkingBudget).toBeGreaterThan(0)
  })

  it('research mode is read-only (no Bash, Edit, Write)', () => {
    const r = MODES.research
    expect(r.tools.Bash).toBe(false)
    expect(r.tools.Edit).toBe(false)
    expect(r.tools.Write).toBe(false)
  })

  it('coding mode has Bash, Edit, Write enabled', () => {
    const c = MODES.coding
    expect(c.tools.Bash).toBe(true)
    expect(c.tools.Edit).toBe(true)
    expect(c.tools.Write).toBe(true)
  })
})

describe('MODEL_IDS', () => {
  it('maps short names to full model IDs', () => {
    expect(MODEL_IDS.haiku).toContain('haiku')
    expect(MODEL_IDS.sonnet).toContain('sonnet')
    expect(MODEL_IDS.opus).toContain('opus')
  })
})

describe('buildCliCommand', () => {
  it('produces valid claude CLI command for coding mode', () => {
    const cmd = buildCliCommand(MODES.coding)
    expect(cmd).toContain('claude')
    expect(cmd).toContain('--model')
    expect(cmd).toContain('claude-sonnet-4-6')
    expect(cmd).toContain('--allowedTools')
    expect(cmd).toContain('Bash')
    expect(cmd).toContain('--continue')
  })

  it('adds --thinking for reasoning mode', () => {
    const cmd = buildCliCommand(MODES.reasoning)
    expect(cmd).toContain('--thinking')
    expect(cmd).toContain('--thinking-budget')
    expect(cmd).toContain('10000')
  })

  it('adds --dangerously-skip-permissions only once for research', () => {
    const cmd = buildCliCommand(MODES.research)
    const count = (cmd.match(/--dangerously-skip-permissions/g) || []).length
    expect(count).toBe(1)
  })

  it('applies tool overrides', () => {
    const cmd = buildCliCommand(MODES.coding, { Bash: false })
    expect(cmd).not.toContain('Bash')
    expect(cmd).toContain('Edit')
  })

  it('does not include disabled tools', () => {
    const cmd = buildCliCommand(MODES.research)
    expect(cmd).not.toContain('Bash')
    expect(cmd).not.toContain('Edit')
    expect(cmd).not.toContain('Write')
  })
})

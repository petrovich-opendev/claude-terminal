import type { QuickCommand } from './models'

const QC_CATS = new Set<string>(['session', 'code', 'git', 'arch'])

/** Parse user-provided quick commands from config; `null` means fall back to defaults. */
export function parseQuickCommands(raw: unknown): QuickCommand[] | null {
  if (!Array.isArray(raw)) return null
  const out: QuickCommand[] = []
  for (const row of raw) {
    if (out.length >= 64) break
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id.length > 64) continue
    if (typeof r.label !== 'string' || r.label.length > 120) continue
    if (typeof r.cmd !== 'string' || r.cmd.length > 4000) continue
    if (typeof r.icon !== 'string' || r.icon.length > 8) continue
    if (typeof r.category !== 'string' || !QC_CATS.has(r.category)) continue
    out.push({
      id: r.id,
      label: r.label,
      category: r.category as QuickCommand['category'],
      cmd: r.cmd,
      icon: r.icon,
    })
  }
  return out.length > 0 ? out : null
}

import { useState, useEffect, useMemo } from 'react'
import type { SSHSession } from '@/lib/models'
import { useSessionsStore } from '@/store/sessions'
import styles from './SSHPanel.module.css'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const EMPTY_FORM: Omit<SSHSession, 'id' | 'status' | 'lastConnected'> = {
  name: '',
  group: 'Default',
  host: '',
  port: 22,
  user: '',
  authType: 'key',
  keyPath: '',
  tags: [],
  note: '',
}

interface FormState extends Omit<SSHSession, 'id' | 'status' | 'lastConnected'> {
  tagsRaw: string
}

function toFormState(s?: SSHSession): FormState {
  if (!s) return { ...EMPTY_FORM, tagsRaw: '' }
  return { ...s, tagsRaw: s.tags.join(', ') }
}

function StatusDot({ status }: { status: SSHSession['status'] }) {
  return <span className={`${styles.dot} ${styles['dot_' + status]}`} title={status} />
}

export default function SSHPanel() {
  const { sessions, addSession, updateSession, removeSession } = useSessionsStore()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null) // null = closed, '' = new
  const [form, setForm] = useState<FormState>(toFormState())

  // Load sessions from IPC on mount — merge with store
  useEffect(() => {
    window.electronAPI.sshList().then((list) => {
      const remote = list as SSHSession[]
      remote.forEach((s) => {
        if (!sessions.find((x) => x.id === s.id)) {
          addSession({ ...s, status: 'idle' })
        }
      })
    }).catch(() => {/* IPC not available in browser dev */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return sessions
    return sessions.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.note.toLowerCase().includes(q)
    )
  }, [sessions, search])

  const groups = useMemo(() => {
    const map = new Map<string, SSHSession[]>()
    filtered.forEach((s) => {
      const g = s.group || 'Default'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(s)
    })
    return map
  }, [filtered])

  function toggleGroup(g: string) {
    setCollapsed((c) => ({ ...c, [g]: !c[g] }))
  }

  function openNew() {
    setEditId('')
    setForm(toFormState())
  }

  function openEdit(s: SSHSession) {
    setEditId(s.id)
    setForm(toFormState(s))
  }

  function closeForm() {
    setEditId(null)
  }

  function handleFormChange(field: keyof FormState, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    const tags = form.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    const isNew = editId === ''
    const id = isNew ? genId() : editId!
    const session: SSHSession = {
      id,
      name: form.name,
      group: form.group || 'Default',
      host: form.host,
      port: Number(form.port) || 22,
      user: form.user,
      authType: form.authType,
      keyPath: form.authType === 'key' ? form.keyPath : undefined,
      tags,
      note: form.note,
      status: 'idle',
    }
    await window.electronAPI.sshSave(session).catch(() => {})
    if (isNew) {
      addSession(session)
    } else {
      updateSession(id, session)
    }
    closeForm()
  }

  async function handleDelete(s: SSHSession) {
    await window.electronAPI.sshDelete(s.id).catch(() => {})
    removeSession(s.id)
  }

  async function handleConnect(s: SSHSession) {
    updateSession(s.id, { status: 'connecting' })
    const result = await window.electronAPI.sshConnect(s.id).catch(() => ({ ok: false }))
    updateSession(s.id, { status: result.ok ? 'connected' : 'error' })
  }

  async function handleImport() {
    const list = await window.electronAPI.sshImportConfig().catch(() => [] as unknown[])
    const remote = list as SSHSession[]
    remote.forEach((s) => {
      const exists = sessions.find((x) => x.id === s.id || (x.host === s.host && x.user === s.user))
      if (!exists) addSession({ ...s, status: 'idle' })
    })
  }

  const isEditing = editId !== null

  return (
    <div className={styles.panel}>
      {/* Search */}
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Session groups */}
      <div className={styles.list}>
        {groups.size === 0 && (
          <div className={styles.empty}>No sessions. Add one below.</div>
        )}
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group} className={styles.group}>
            <button
              className={styles.groupHeader}
              onClick={() => toggleGroup(group)}
            >
              <span className={`${styles.chevron} ${collapsed[group] ? styles.chevronCollapsed : ''}`}>▾</span>
              <span className={styles.groupName}>{group}</span>
              <span className={styles.groupCount}>{items.length}</span>
            </button>
            {!collapsed[group] && (
              <div className={styles.groupItems}>
                {items.map((s) => (
                  <div
                    key={s.id}
                    className={styles.sessionRow}
                    onMouseEnter={() => setHoverId(s.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <StatusDot status={s.status} />
                    <div className={styles.sessionInfo}>
                      <span className={styles.sessionName}>{s.name}</span>
                      <span className={styles.sessionHost}>{s.host}:{s.port}</span>
                      {s.tags.length > 0 && (
                        <div className={styles.tags}>
                          {s.tags.map((t) => (
                            <span key={t} className={styles.tag}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {hoverId === s.id && (
                      <div className={styles.actions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionConnect}`}
                          onClick={() => handleConnect(s)}
                          title="Connect"
                        >⚡</button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionEdit}`}
                          onClick={() => openEdit(s)}
                          title="Edit"
                        >✎</button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionDelete}`}
                          onClick={() => handleDelete(s)}
                          title="Delete"
                        >✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={openNew}>+ Add Session</button>
        <button className={styles.toolBtn} onClick={handleImport}>↓ Import ~/.ssh/config</button>
      </div>

      {/* Add/Edit Form */}
      {isEditing && (
        <div className={styles.form}>
          <div className={styles.formTitle}>{editId === '' ? 'New Session' : 'Edit Session'}</div>

          <label className={styles.fieldLabel}>Name</label>
          <input className={styles.fieldInput} value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} placeholder="e.g. llmsrv" />

          <label className={styles.fieldLabel}>Group</label>
          <input className={styles.fieldInput} value={form.group} onChange={(e) => handleFormChange('group', e.target.value)} placeholder="e.g. AI Infra" />

          <label className={styles.fieldLabel}>Host</label>
          <input className={styles.fieldInput} value={form.host} onChange={(e) => handleFormChange('host', e.target.value)} placeholder="hostname or IP" />

          <div className={styles.fieldRow}>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>Port</label>
              <input className={styles.fieldInput} type="number" value={form.port} onChange={(e) => handleFormChange('port', e.target.value)} />
            </div>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>User</label>
              <input className={styles.fieldInput} value={form.user} onChange={(e) => handleFormChange('user', e.target.value)} placeholder="username" />
            </div>
          </div>

          <label className={styles.fieldLabel}>Auth Type</label>
          <select className={styles.fieldSelect} value={form.authType} onChange={(e) => handleFormChange('authType', e.target.value)}>
            <option value="key">SSH Key</option>
            <option value="password">Password</option>
            <option value="keychain">Keychain</option>
          </select>

          {form.authType === 'key' && (
            <>
              <label className={styles.fieldLabel}>Key Path</label>
              <input className={styles.fieldInput} value={form.keyPath ?? ''} onChange={(e) => handleFormChange('keyPath', e.target.value)} placeholder="~/.ssh/id_ed25519" />
            </>
          )}

          <label className={styles.fieldLabel}>Tags (comma-separated)</label>
          <input className={styles.fieldInput} value={form.tagsRaw} onChange={(e) => handleFormChange('tagsRaw', e.target.value)} placeholder="prod, ai, infra" />

          <label className={styles.fieldLabel}>Note</label>
          <input className={styles.fieldInput} value={form.note} onChange={(e) => handleFormChange('note', e.target.value)} placeholder="Optional description" />

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={handleSave}>Save</button>
            <button className={styles.cancelBtn} onClick={closeForm}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

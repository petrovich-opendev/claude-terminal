import { useModesStore } from '@/store/modes'
import { MODES, buildCliCommand } from '@/lib/modes'
import type { ClaudeModeId } from '@/lib/models'
import styles from './ModeBar.module.css'
const ORDER: ClaudeModeId[] = ['coding','reasoning','design','research']
export default function ModeBar() {
  const active = useModesStore(s=>s.activeMode)
  const overrides = useModesStore(s=>s.toolOverrides)
  const setMode = useModesStore(s=>s.setMode)
  const mode = MODES[active]
  const cmd = buildCliCommand(mode, overrides)
  return (
    <div className={styles.bar}>
      {ORDER.map(id=>{
        const m=MODES[id]
        return <button key={id} className={`${styles.btn} ${active===id?styles.active:''}`} style={{'--mc':m.color} as React.CSSProperties} onClick={()=>setMode(id)} title={m.description}><span className={styles.icon}>{m.icon}</span><span>{m.label}</span></button>
      })}
      <div className={styles.preview}><span className={styles.dollar}>$</span><span className={styles.cmd}>{cmd}</span></div>
    </div>
  )
}

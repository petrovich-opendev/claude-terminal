import {useCostStore} from '@/store/cost'
import {useTerminalStore} from '@/store/terminal'
import {useActiveTabStatus} from '@/store/tabs'
import {useSessionsStore} from '@/store/sessions'
import {MODEL_PRICING} from '@/lib/pricing'
import styles from './StatusBar.module.css'
export default function StatusBar(){
  const cost=useCostStore(s=>s.current)
  const status=useActiveTabStatus()
  const upload=useTerminalStore(s=>s.uploadProgress)
  const sessions=useSessionsStore(s=>s.sessions)
  const activeId=useSessionsStore(s=>s.activeSessionId)
  const session=sessions.find(s=>s.id===activeId)
  const pricing=cost?MODEL_PRICING[cost.model]:null
  const ctx=cost?Math.round((cost.inputTokens+cost.outputTokens)/200000*100):0
  const ctxColor=ctx>80?'var(--red)':ctx>50?'var(--amber)':'var(--green)'
  return(
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={`${styles.dot} ${styles[status]??''}`}/>
        <span className={styles.text}>{session?session.name:'No session'}</span>
        {session&&<span className={styles.host}>{session.host}</span>}
        {upload&&<span className={styles.upload}>⬆ {upload.file} {upload.percent}%</span>}
      </div>
      <div className={styles.right}>
        {cost&&<>
          <span className={styles.text} style={{color:ctxColor}}>ctx {ctx}%</span>
          <span className={styles.sep}>·</span>
          <span className={styles.text}>{pricing?.label??cost.model}</span>
          <span className={styles.sep}>·</span>
          <span className={styles.text} style={{color:cost.estimatedUSD>0.5?'var(--red)':'var(--t2)'}}>${cost.estimatedUSD.toFixed(4)}</span>
        </>}
        <span className={styles.copy}>© 2026 AGENTDATA.PRO</span>
      </div>
    </div>
  )
}

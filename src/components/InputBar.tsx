import {useState,useCallback,KeyboardEvent} from 'react'
import {useTerminalStore} from '@/store/terminal'
import styles from './InputBar.module.css'
export default function InputBar(){
  const [val,setVal]=useState('')
  const [hist,setHist]=useState<string[]>([])
  const [idx,setIdx]=useState(-1)
  const ptyId=useTerminalStore(s=>s.ptyId)
  const status=useTerminalStore(s=>s.status)
  const up=useTerminalStore(s=>s.uploadProgress)
  const submit=useCallback(()=>{
    if(!val.trim()||!ptyId)return
    window.electronAPI.ptyWrite(ptyId,val+'\r')
    setHist(h=>[val,...h.slice(0,49)]); setIdx(-1); setVal('')
  },[val,ptyId])
  const onKey=(e:KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}
    else if(e.key==='ArrowUp'){e.preventDefault();const i=Math.min(idx+1,hist.length-1);setIdx(i);if(hist[i])setVal(hist[i])}
    else if(e.key==='ArrowDown'){e.preventDefault();const i=idx-1;setIdx(Math.max(i,-1));setVal(i<0?'':(hist[i]??''))}
    else if(e.key==='c'&&e.ctrlKey&&ptyId)window.electronAPI.ptyWrite(ptyId,'\x03')
  }
  return(
    <div className={styles.bar}>
      {up&&<div className={styles.prog}><span className={styles.pf}>{up.file}</span><div className={styles.pt}><div className={styles.pfi} style={{width:`${up.percent}%`}}/></div><span className={styles.pp}>{up.percent}%</span></div>}
      <div className={styles.row}>
        <span className={styles.prompt}>❯</span>
        <input className={styles.input} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={onKey} placeholder={status==='running'?'Type command...':'No active session'} disabled={!ptyId||status!=='running'} spellCheck={false} autoComplete='off'/>
        <button className={styles.run} onClick={submit} disabled={!val.trim()||!ptyId}>RUN</button>
      </div>
      {idx>=0&&<div className={styles.hint}>history [{idx+1}/{hist.length}] ↑↓ to navigate</div>}
    </div>
  )
}

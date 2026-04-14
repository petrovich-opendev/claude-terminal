import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/store/terminal'
import { useSessionsStore } from '@/store/sessions'
import styles from './Terminal.module.css'

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm|null>(null)
  const fitRef = useRef<FitAddon|null>(null)
  const ptyIdRef = useRef<string|null>(null)
  const [isDragOver,setIsDragOver] = useState(false)
  const setPtyId = useTerminalStore(s=>s.setPtyId)
  const setStatus = useTerminalStore(s=>s.setStatus)
  const setUploadProgress = useTerminalStore(s=>s.setUploadProgress)
  const activeSessionId = useSessionsStore(s=>s.activeSessionId)

  useEffect(()=>{
    if (!containerRef.current) return
    const term = new XTerm({
      fontFamily:'"JetBrains Mono","Cascadia Code",monospace',
      fontSize:13,lineHeight:1.6,
      theme:{background:'#08080a',foreground:'#e8e8f0',cursor:'#f59e0b',cursorAccent:'#000000',selectionBackground:'rgba(245,158,11,0.2)',black:'#1c1c28',brightBlack:'#363650',red:'#ef4444',brightRed:'#f87171',green:'#22c55e',brightGreen:'#4ade80',yellow:'#f59e0b',brightYellow:'#fcd34d',blue:'#60a5fa',brightBlue:'#93c5fd',magenta:'#a78bfa',brightMagenta:'#c4b5fd',cyan:'#34d399',brightCyan:'#6ee7b7',white:'#a0a0b8',brightWhite:'#e8e8f0'},
      allowProposedApi:true,macOptionIsMeta:true,rightClickSelectsWord:true,scrollback:10000,cursorBlink:true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()
    xtermRef.current=term; fitRef.current=fit
    const spawnPty = async()=>{
      const {cols,rows}=term
      const r=await window.electronAPI.ptyCreate({cols,rows,cwd:process.env.HOME??'/',cmd:process.env.SHELL??'/bin/zsh',args:[]})
      ptyIdRef.current=r.id; setPtyId(r.id); setStatus('running')
      const offData=window.electronAPI.onPtyData(r.id,d=>term.write(d))
      const offExit=window.electronAPI.onPtyExit(r.id,()=>{setStatus('exited');term.write('\r\n[Process exited]\r\n')})
      term.onData(d=>{ if(ptyIdRef.current) window.electronAPI.ptyWrite(ptyIdRef.current,d) })
      return ()=>{offData();offExit()}
    }
    const cleanupPty=spawnPty()
    // ResizeObserver sends SIGWINCH via pty:resize
    const ro=new ResizeObserver(()=>{ fit.fit(); if(ptyIdRef.current) window.electronAPI.ptyResize(ptyIdRef.current,term.cols,term.rows) })
    ro.observe(containerRef.current)
    const offProgress=window.electronAPI.onSftpProgress(p=>setUploadProgress(p))
    return ()=>{ ro.disconnect(); offProgress(); cleanupPty.then(off=>off?.()); if(ptyIdRef.current) window.electronAPI.ptyDestroy(ptyIdRef.current); term.dispose() }
  },[])

  const handleDrop=async(e:React.DragEvent)=>{
    e.preventDefault(); setIsDragOver(false)
    if (!activeSessionId) return
    const files=Array.from(e.dataTransfer.files).map((f:File&{path?:string})=>f.path??'').filter(Boolean)
    if (!files.length) return
    setUploadProgress({file:files[0],percent:0})
    try { await window.electronAPI.sftpUpload(activeSessionId,files,'~') }
    finally { setTimeout(()=>setUploadProgress(null),2000) }
  }

  return (
    <div className={styles.wrap} onDragOver={e=>{e.preventDefault();setIsDragOver(true)}} onDragLeave={()=>setIsDragOver(false)} onDrop={handleDrop}>
      <div ref={containerRef} className={styles.term}/>
      {isDragOver&&activeSessionId&&<div className={styles.overlay}><span className={styles.overlayMsg}>⬆ Drop to upload via SFTP</span></div>}
    </div>
  )
}

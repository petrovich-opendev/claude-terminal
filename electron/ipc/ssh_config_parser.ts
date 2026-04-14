import fs from 'fs'; import os from 'os'; import path from 'path'
interface P{id:string;name:string;group:string;host:string;port:number;user:string;authType:'key';keyPath?:string;tags:string[];note:string;status:'idle'}
export function parseSshConfig(): P[] {
  const f=path.join(os.homedir(),'.ssh','config'); if(!fs.existsSync(f)) return []
  const lines=fs.readFileSync(f,'utf-8').split('\n'); const results:P[]=[]
  let cur: Partial<P>&{alias?:string}|null=null
  const flush=()=>{ if(cur&&cur.alias&&cur.alias!=='*'&&cur.host) results.push({id:cur.alias+'-imported',name:cur.alias,group:'Imported',host:cur.host,port:cur.port||22,user:cur.user||os.userInfo().username,authType:'key',keyPath:cur.keyPath,tags:['imported'],note:'Imported from ~/.ssh/config',status:'idle'}) }
  for(const line of lines){const t=line.trim();if(t.startsWith('#')||!t)continue;const[k,...v]=t.split(/\s+/);const val=v.join(' ');const kl=k.toLowerCase();if(kl==='host'){flush();cur={alias:val}}else if(cur){if(kl==='hostname')cur.host=val;else if(kl==='user')cur.user=val;else if(kl==='port')cur.port=parseInt(val,10)||22;else if(kl==='identityfile')cur.keyPath=val.replace(/^~/,os.homedir())}}
  flush(); return results
}

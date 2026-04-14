declare global {
  interface Window {
    electronAPI: {
      ptyCreate(opts:{cols:number;rows:number;cwd:string;cmd:string;args:string[]}):Promise<{id:string}>
      ptyWrite(id:string,data:string):Promise<{ok:boolean}>
      ptyResize(id:string,cols:number,rows:number):Promise<{ok:boolean}>
      ptyDestroy(id:string):Promise<{ok:boolean}>
      onPtyData(id:string,cb:(data:string)=>void):()=>void
      onPtyExit(id:string,cb:(code:number)=>void):()=>void
      sshConnect(id:string):Promise<{ok:boolean}>
      sshDisconnect(id:string):Promise<{ok:boolean}>
      sshList():Promise<unknown[]>
      sshSave(s:unknown):Promise<{ok:boolean}>
      sshDelete(id:string):Promise<{ok:boolean}>
      sshImportConfig():Promise<unknown[]>
      keychainSet(account:string,password:string):Promise<{ok:boolean}>
      keychainGet(account:string):Promise<string|null>
      keychainDelete(account:string):Promise<{ok:boolean}>
      configGet():Promise<unknown>
      configSet(c:unknown):Promise<{ok:boolean}>
      fsList(dir:string):Promise<Array<{name:string;path:string;isDirectory:boolean;extension?:string}>>
      fsRead(p:string):Promise<string>
      fsWrite(p:string,content:string):Promise<{ok:boolean}>
      sftpList(sessionId:string,remotePath:string):Promise<Array<{name:string;path:string;isDirectory:boolean;extension?:string}>>
      sftpUpload(sessionId:string,localPaths:string[],remoteDir:string):Promise<{ok:boolean;count:number}>
      sftpDownload(sessionId:string,remotePath:string,localDir:string):Promise<{ok:boolean}>
      onSftpProgress(cb:(p:{file:string;percent:number})=>void):()=>void
      trayShow():Promise<void>
      trayHide():Promise<void>
      trayQuit():Promise<void>
    }
  }
}
export {}

/* ExamIA 0.3 · authenticated Apps Script transport. No browser role is trusted. */
'use strict';
window.ExamIAClient = class {
  constructor(config) {
    this.url=config.apiUrl;
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(this.url))throw new Error('Configure una URL válida de Apps Script terminada en /exec.');
    this.transport=config.transport||'bridge';this.pending=new Map();this.channel=this.random();
    this.key='examia-session:'+this.url;this.token=sessionStorage.getItem(this.key)||'';
    this.acceptCallback();
    if(this.transport==='bridge')this.ready=null;
    else if(this.transport==='fetch')this.ready=Promise.resolve();
    else throw new Error('Transporte no reconocido.');
  }
  random(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
  acceptCallback(){
    const p=new URLSearchParams(location.hash.slice(1));if(!p.has('auth'))return;
    history.replaceState(null,'',location.pathname+location.search);
    const nonce=sessionStorage.getItem('examia-login-nonce');sessionStorage.removeItem('examia-login-nonce');
    if(!nonce||nonce!==p.get('nonce'))throw new Error('El acceso no se inició en esta pestaña. Vuelva a iniciar sesión.');
    this.token=p.get('auth');sessionStorage.setItem(this.key,this.token);
  }
  signIn(){const nonce=this.random();sessionStorage.setItem('examia-login-nonce',nonce);location.assign(this.url+'?mode=login&nonce='+nonce);}
  async signOut(){try{await this.call('logout');}finally{sessionStorage.removeItem(this.key);this.token='';}}
  connect(){return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');frame.hidden=true;frame.title='Canal seguro de ExamIA';
    const sourceMatches=(root,source,depth=0)=>{
      if(root===source)return true;if(depth>3)return false;
      try{for(let i=0;i<root.length;i++)if(sourceMatches(root.frames[i],source,depth+1))return true;}catch{}return false;
    };
    const timeout=setTimeout(()=>reject(new Error('No se abrió el canal de Apps Script. Compruebe la implementación y el acceso «Cualquier usuario». Consulte docs/INSTALACION.md.')),25000);
    this.onMessage=event=>{
      const m=event.data;
      if(!m||m.nonce!==this.channel||!/^https:\/\/([a-z0-9-]+\.)?googleusercontent\.com$/.test(event.origin))return;
      if(m.type==='examia-ready'&&!this.peer&&sourceMatches(frame.contentWindow,event.source)){
        this.peer=event.source;this.peerOrigin=event.origin;clearTimeout(timeout);resolve();return;
      }
      if(event.source!==this.peer||event.origin!==this.peerOrigin||m.type!=='examia-result')return;
      const req=this.pending.get(m.id);if(req){clearTimeout(req.timeout);this.pending.delete(m.id);req.resolve(m.result);}
    };
    window.addEventListener('message',this.onMessage);
    frame.src=this.url+'?mode=bridge&nonce='+this.channel;document.body.append(frame);this.frame=frame;
  });}
  async call(action,payload={}){
    if(this.transport==='bridge'&&!this.ready)this.ready=this.connect();await this.ready;const request={token:this.token,action,payload};let result;
    if(this.transport==='fetch'){
      const r=await fetch(this.url,{method:'POST',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(request),signal:AbortSignal.timeout(45000)});
      if(!r.ok)throw new Error('El servicio no respondió correctamente.');result=await r.json();
    }else{
      result=await new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timeout=setTimeout(()=>{this.pending.delete(id);reject(new Error('Tiempo de respuesta agotado. No se ha confirmado el guardado.'));},45000);this.pending.set(id,{resolve,reject,timeout});this.peer.postMessage({type:'examia-rpc',nonce:this.channel,id,request},this.peerOrigin);});
    }
    if(!result||result.ok!==true){const message=result?.error||'Respuesta inválida del servidor.';throw new Error(message);}
    this.serverNow=result.serverNow;return result.data;
  }
};

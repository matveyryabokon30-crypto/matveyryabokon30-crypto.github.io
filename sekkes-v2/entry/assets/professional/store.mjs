import {mergeData,inspectDocument} from './model.mjs?v=733ad495211fd9070f41e4b72313613b5025a6234e97be0f25373845ab316974';
export class ProfessionalStore {
 constructor(account){this.account=account;this.session=account.session;this.backing=account.backing;this.current=null;this.disposed=false;}
 guard(){this.account.current?.();if(this.disposed)throw Error('AUTH_CHANGED');}
 async rpc(action,payload={}){this.guard();const{data,error}=this.account.professionalTransport?await this.account.professionalTransport(action,payload):await this.session.client.rpc('marius_professional_workspace',{p_action:action,p_payload:payload});this.guard();if(error)throw error;if(!data||typeof data!=='object')throw Error('INVALID_RESPONSE');return data;}
 list(scope='own',offset=0,search='',status=''){return this.rpc('list',{scope,offset,search,status});}
 async get(id){const value=await this.rpc('get',{id});this.current=value;return value;}
 async create(kind){const value=await this.rpc('create',{id:crypto.randomUUID(),kind});this.current=value;return value;}
 async save(base,data){
  for(let attempt=0;attempt<3;attempt++){
   const remote=await this.rpc('get',{id:base.id}),merged=mergeData(base.data,data,remote.profile.data);
   try{const value=await this.rpc('save',{id:base.id,expected:remote.profile.revision,data:merged});this.current=value;return value;}catch(e){if(e.message!=='PROFILE_CONFLICT'||attempt===2)throw e;}
  }
 }
 async action(action,extra={}){const p=this.current.profile;const value=await this.rpc(action,{id:p.id,expected:p.revision,...extra});this.current=value;return value;}
 draft(id){try{return JSON.parse(this.backing?.getItem('professional-draft:'+id)||'null');}catch{return null;}}
 keep(base,data){this.backing?.setItem('professional-draft:'+base.id,JSON.stringify({base,data}));}
 clear(id){this.backing?.removeItem('professional-draft:'+id);}
 async upload(file,kind,retry){
  const meta=await inspectDocument(file);let doc=retry;
  if(doc&&(doc.sha256!==meta.sha256||doc.bytes!==meta.bytes))throw Error('DOCUMENT_INVALID');
  if(!doc){const documentId=crypto.randomUUID();const value=await this.action('reserve_document',{documentId,kind,...meta});doc=value.documents.find(x=>x.id===documentId);}
  if(this.account.professionalUpload){await this.account.professionalUpload(doc,file);}
  else{
   const bucket=this.session.client.storage.from('marius-credentials');
   const{error}=await bucket.upload(doc.path,file,{contentType:doc.mime,upsert:false});this.guard();
   if(error){const existing=await bucket.download(doc.path);this.guard();if(existing.error)throw error;const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await existing.data.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');if(sha!==doc.sha256)throw error;}
  }
  return this.action('confirm_document',{documentId:doc.id});
 }
 async download(doc){this.guard();const{data,error}=this.account.professionalDownload?await this.account.professionalDownload(doc):await this.session.client.storage.from('marius-credentials').download(doc.path);this.guard();if(error)throw error;return data;}
 async assist(message){this.guard();const p=this.current.profile;
  const result=this.account.professionalAssistant?await this.account.professionalAssistant({id:p.id,revision:p.revision,message}):await this.session.client.functions.invoke('marius-profile-assistant',{body:{id:p.id,revision:p.revision,message}});this.guard();
  if(result.error){let code;try{code=(await result.error.context.json()).code;}catch{}throw Error(code||'ASSISTANT_UNAVAILABLE');}return result.data;
 }
 destroy(){this.disposed=true;}
}

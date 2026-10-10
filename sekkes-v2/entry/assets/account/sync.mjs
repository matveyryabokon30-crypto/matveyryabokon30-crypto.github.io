import {validSnapshot,mergePatch,accountMessage} from './model.mjs?v=f5f28edbbebc28207659c61c1afed773c3843413f7ec955e7274935b94a4313d';
export class AccountSync {
 constructor(session,{backing,transport}={}){this.session=session;this.uid=session.user.id;this.epoch=session.epoch;this.backing=backing;this.snapshot=null;this.status='Загружаем профиль…';this.busy=false;this.listeners=new Set();this.tail=Promise.resolve();this.transport=transport;this.avatarURL=null;this.avatarPath=null;this.avatarGeneration=0;this.destroyed=false;
  try{const cached=JSON.parse(backing?.getItem('account:v1')||'null');if(validSnapshot(cached))this.snapshot=cached;}catch{}
 }
 current(){if(this.destroyed||this.session.user?.id!==this.uid||this.session.epoch!==this.epoch)throw Object.assign(Error('AUTH_CHANGED'),{code:'AUTH_CHANGED'});}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn();}
 async rpc(body={}){this.current();const {data,error}=this.transport?await this.transport(body):await this.session.client.rpc('marius_account_sync',body);this.current();if(error)throw error;if(!validSnapshot(data))throw Error('INVALID_ACCOUNT_RESPONSE');return data;}
 adopt(value){this.current();if(this.snapshot&&['profile','account'].some(k=>value[k].revision<this.snapshot[k].revision))return;this.snapshot=value;try{this.backing?.setItem('account:v1',JSON.stringify(value));}catch{}this.status='Синхронизировано';this.emit();void this.loadAvatar(value.account.data.avatarPath||'');}
 async refresh(){if(this.busy)return;try{this.adopt(await this.rpc());}catch(e){this.status=accountMessage(e);this.emit();}}
 start(){void this.refresh();this.focus=()=>void this.refresh();this.tick=setInterval(()=>{if(document.visibilityState==='visible')void this.refresh();},6000);window.addEventListener('focus',this.focus);window.addEventListener('online',this.focus);return this;}
 save(base,profile={},account={}){
  const work=async()=>{this.current();this.busy=true;this.status='Сохраняем…';this.emit();try{
   for(let attempt=0;attempt<3;attempt++){
    const remote=await this.rpc(),p=mergePatch(base.profile.data,profile,remote.profile.data),a=mergePatch(base.account.data,account,remote.account.data);
    if(!Object.keys(p).length&&!Object.keys(a).length){this.adopt(remote);return remote;}
    try{const value=await this.rpc({...(Object.keys(p).length?{p_profile_patch:p,p_profile_revision:remote.profile.revision}:{}),...(Object.keys(a).length?{p_account_patch:a,p_account_revision:remote.account.revision}:{})});this.adopt(value);return value;}
    catch(e){if(!['ACCOUNT_CONFLICT','PROFILE_CONFLICT'].includes(e.message)||attempt===2)throw e;}
   }
  }catch(e){this.status=accountMessage(e);this.emit();throw e;}finally{this.busy=false;this.emit();}};
  const promise=this.tail.catch(()=>{}).then(work);this.tail=promise;return promise;
 }
 async loadAvatar(path){
  if(path===this.avatarPath)return;this.avatarPath=path;const generation=++this.avatarGeneration;
  if(!path){if(this.avatarURL)URL.revokeObjectURL(this.avatarURL);this.avatarURL=null;this.emit();return;}
  if(!new RegExp('^'+this.uid+'/[a-f0-9-]{36}\\.jpg$').test(path))return;
  try{const {data,error}=await this.session.client.storage.from('marius-avatars').download(path);this.current();if(error)throw error;if(generation!==this.avatarGeneration)return;
   if(this.avatarURL)URL.revokeObjectURL(this.avatarURL);this.avatarURL=URL.createObjectURL(data);this.emit();
  }catch{this.avatarPath=null;}
 }
 async setAvatar(file){
  this.current();if(!this.snapshot)throw Error('NOT_LOADED');const base=structuredClone(this.snapshot);
  if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)||file.size>20*1024*1024)throw Error('IMAGE_INVALID');
  const image=await createImageBitmap(file);const scale=Math.min(1,800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob||blob.size>3*1024*1024)throw Error('IMAGE_INVALID');this.current();
  const path=this.uid+'/'+crypto.randomUUID()+'.jpg';const {error}=await this.session.client.storage.from('marius-avatars').upload(path,blob,{contentType:'image/jpeg',upsert:false});this.current();if(error)throw error;return this.save(base,{}, {avatarPath:path});
 }
 destroy(){this.destroyed=true;clearInterval(this.tick);window.removeEventListener('focus',this.focus);window.removeEventListener('online',this.focus);this.avatarGeneration++;if(this.avatarURL)URL.revokeObjectURL(this.avatarURL);this.listeners.clear();}
}

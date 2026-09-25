import {openProfileStore} from './ui/profile-store.mjs';
export const PROFILE_FIELDS=Object.freeze({name:60,surname:60,username:40,pronouns:40,bio:280,birthday:10,gender:40,city:80,interests:160,category:80});
export function profileText(value){return Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([k,n])=>[k,typeof value?.[k]==='string'?value[k].trim().slice(0,n):'']));}
const same=(a,b)=>JSON.stringify(profileText(a))===JSON.stringify(profileText(b));
// One store retains immutable Blob references across reads and edits.
export function createProfileSync(api,{store=openProfileStore(),locks=globalThis.navigator?.locks}={}){
 let tail=Promise.resolve();
 function run(uid,work){
  const epoch=api.authEpoch;
  const current=()=>{if(!uid||api.user?.id!==uid||api.authEpoch!==epoch)throw Error('Аккаунт изменился. Открой профиль заново.');};
  const task=async()=>{current();await api.sessionController?.ensureFresh();current();
   const rpc=async args=>{current();const r=await api.transport(api.config.projectUrl+'/rest/v1/rpc/sekkes_profile_sync',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{...api.auth(),'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await r.json();current();if(!r.ok){const e=Error(d.message==='PROFILE_CONFLICT'?'Профиль изменён на другом устройстве. Закрой редактор и открой заново.':'Не удалось синхронизировать анкету. Проверь подключение и повтори.');e.code=d.message;throw e;}return {...d,data:profileText(d.data)};};
   return work({rpc,current});};
  const promise=tail.catch(()=>{}).then(()=>locks?locks.request('sekkes-profile-'+uid,task):task());tail=promise;return promise;
 }
 async function canonical(uid,local,remote,current){current();const result={...local,...remote.data,_profileSync:{revision:remote.revision,data:remote.data}};if(!same(local,remote.data)||local._profileSync?.revision!==remote.revision){await store.save(uid,result);current();}return result;}
 return {
  load(uid=api.user?.id){return run(uid,async({rpc,current})=>{
   const local=await store.load(uid);current();let remote=await rpc({});
   // Migrate this device's existing text once. Never overwrite an existing server profile.
   if(remote.revision===0){try{remote=await rpc({p_data:profileText(local),p_revision:0});}catch(e){if(e.code!=='PROFILE_CONFLICT')throw e;remote=await rpc({});}}
   return canonical(uid,local,remote,current);
  });},
  save(uid,next){return run(uid,async({rpc,current})=>{
   const local=await store.load(uid);current();const remote=await rpc({});
   const baseline=profileText(next._profileSync?.data||local._profileSync?.data||local),desired=profileText(next),merged={...remote.data};
   for(const key of Object.keys(PROFILE_FIELDS))if(desired[key]!==baseline[key]){
    if(remote.revision&&remote.data[key]!==baseline[key]&&remote.data[key]!==desired[key])throw Error('Это поле изменено на другом устройстве. Закрой редактор и открой заново перед сохранением.');
    merged[key]=desired[key];
   }
   const saved=remote.revision===0?await rpc({p_data:desired,p_revision:0}):same(merged,remote.data)?remote:await rpc({p_data:merged,p_revision:remote.revision});
   current();const result={...next,...saved.data,_profileSync:{revision:saved.revision,data:saved.data}};await store.save(uid,result);current();return result;
  });}
 };
}

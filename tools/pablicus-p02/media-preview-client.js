/* P02: bounded, account-scoped batch authorization and server derivative requests.
 * No interception of fetch/SDK methods. Positive authorization is required even
 * when image bytes are local. Unavailable optimization falls back to Storage RLS.
 */
(function(g){'use strict';
 if(g.PablicusPreviewClient)return;
 const ENDPOINT='pablicus-media-preview';
 let queue=[],timer=0,running=0,buildActive=0,buildQueue=[],downUntil=0;
 const leases=new Map(),preparing=new Map(),cooldown=new Map();
 const counters={batches:0,items:0,builds:0,previewLeases:0,originalLeases:0,fallbacks:0};
 const size=w=>w<=192?192:w<=960?960:1600;
 const live=s=>g.PablicusController?.state().sessionUserId===s.id&&g.PablicusController?.state().sessionGeneration===s.sessionGeneration;
 const abort=()=>new DOMException('Media scope changed','AbortError');
 const key=(s,b,p,w)=>JSON.stringify([s.id,s.sessionGeneration,b,p,w]);
 function checked(s,item,data,ttl){
  if(!live(s))throw abort();
  if(data?.error)throw Object.assign(Error('Media not available'),{denied:true});
  const u=new URL(data?.url);if(u.protocol!=='https:'||!['ctcoqgsztdtsazdiwcmd.supabase.co','ctcoqgsztdtsazdiwcmd.storage.supabase.co'].includes(u.hostname)||u.username||u.password)throw Error('Invalid preview origin');
  const until=Date.now()+Math.min(105,ttl-15,Number(data.expiresIn)||0)*1000;
  if(until<=Date.now())throw Error('Invalid preview lease');
  return {...data,url:u.href,until,width:item.width};
 }
 async function invoke(s,body,ms=6500){
  if(!live(s))throw abort();
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
  try{const result=await Promise.race([s.client.functions.invoke(ENDPOINT,{body,signal:ac.signal}),new Promise((_,reject)=>ac.signal.addEventListener('abort',()=>reject(Error('Preview timeout')),{once:true}))]);if(!live(s))throw abort();if(result.error)throw result.error;return result.data;}finally{clearTimeout(t);}
 }
 function flush(){timer=0;if(running>=2||!queue.length)return;
  queue.sort((a,b)=>a.priority-b.priority);const s=queue[0].s,take=[];
  queue=queue.filter(j=>{if(j.s.id===s.id&&j.s.sessionGeneration===s.sessionGeneration&&take.length<24){take.push(j);return false;}return true;});
  running++;counters.batches++;counters.items+=take.length;
  invoke(s,{action:'resolve',items:take.map(j=>j.item)}).then(data=>{
   for(const j of take){try{const v=data?.items?.find(x=>x.bucket===j.item.bucket&&x.path===j.item.path&&x.width===j.item.width);if(!v)throw Error('Incomplete preview response');const answer=checked(s,j.item,v,j.ttl);counters[answer.kind==='preview'?'previewLeases':'originalLeases']++;j.resolve(answer);}catch(e){j.reject(e);}}
  },e=>{downUntil=Date.now()+30000;take.forEach(j=>j.reject(e));}).finally(()=>{running--;flush();});
  if(queue.length)timer=setTimeout(flush,8);
 }
 function lease(s,bucket,path,width,ttl=300,priority=0){
  if(Date.now()<downUntil||!s.client.functions?.invoke)return Promise.reject(Error('Preview service unavailable'));
  const item={bucket,path,width:size(width)},k=key(s,bucket,path,item.width),cached=leases.get(k);
  if(cached&&cached.until>Date.now())return cached.promise;
  let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
  const record={until:Date.now()+6000,promise};leases.set(k,record);
  promise.then(v=>{record.until=v.until;},()=>{if(leases.get(k)===record)leases.delete(k);});
  if(leases.size>256)leases.delete(leases.keys().next().value);
  queue.push({s,item,ttl,priority,resolve,reject});if(!timer)timer=setTimeout(flush,8);return promise;
 }
 function build(s,bucket,path,width=960,priority=0){
  const item={bucket,path,width:size(width)},k=key(s,bucket,path,item.width);
  if(Date.now()<downUntil||(cooldown.get(k)||0)>Date.now())return Promise.reject(Error('Preview preparation deferred'));
  if(preparing.has(k))return preparing.get(k);
  const promise=new Promise((resolve,reject)=>{buildQueue.push({s,item,priority,resolve,reject,k});pumpBuild();});
  preparing.set(k,promise);promise.finally(()=>preparing.delete(k)).catch(()=>{});return promise;
 }
 function pumpBuild(){if(buildActive>=1||!buildQueue.length)return;buildQueue.sort((a,b)=>a.priority-b.priority);const j=buildQueue.shift();if(!live(j.s)){j.reject(abort());pumpBuild();return;}buildActive++;counters.builds++;
  invoke(j.s,{action:'build',items:[j.item]},10000).then(v=>{const a=checked(j.s,j.item,v,120);leases.set(j.k,{until:a.until,promise:Promise.resolve(a)});j.resolve(a);},e=>{cooldown.set(j.k,Date.now()+300000);downUntil=Date.now()+30000;j.reject(e);}).finally(()=>{buildActive--;pumpBuild();});
 }
 function clear(){for(const j of queue)j.reject(abort());queue=[];for(const j of buildQueue)j.reject(abort());buildQueue=[];leases.clear();preparing.clear();cooldown.clear();}
 g.PablicusPreviewClient=Object.freeze({lease,build,clear,size,stats:()=>({...counters,queued:queue.length,buildQueued:buildQueue.length})});
})(window);

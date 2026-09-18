/* P03: a single account-scoped metadata source for the home screen.
 * No media bytes, private notes, tokens, or contact book are persisted here.
 * The server composes existing authorized card/feed reads; failure falls back
 * to the same individual RPCs. This module never replaces fetch or auth.
 */
(function(g){
 'use strict';if(g.PablicusHomeData)return;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const cards=new Map(),feeds=new Map(),avatarProofs=new Map();let account='',queue=[],timer=0,active=0,feedFlight=null,feedFlightKey='',fallbackUntil=0;
 const counts={batches:0,individualCards:0,feedRequests:0,cardHits:0,feedHits:0};
 const state=()=>g.PablicusController?.state(),scope=s=>(s?.sessionUserId||'')+':'+s?.sessionGeneration;
 const valid=s=>!!s?.sessionUserId&&scope(s)===scope(state());
 const abort=()=>new DOMException('Home session changed','AbortError');
 const service=()=>g.PablicusController?.getServices();
 function reset(){for(const j of queue)j.reject(abort());queue=[];cards.clear();feeds.clear();avatarProofs.clear();feedFlight=null;feedFlightKey='';clearTimeout(timer);timer=0;account=scope(state());}
 function identity(){const s=state();if(account!==scope(s))reset();if(!s?.sessionUserId)throw abort();return s;}
 function rememberFeed(s,data,ids){
  if(!valid(s)||!Array.isArray(data?.stories)||!Number.isFinite(Date.parse(data?.server_now)))return;
  const now=Date.now();for(const id of ids)feeds.set(id,{at:now,offset:Date.parse(data.server_now)-now,stories:data.stories.filter(x=>x.owner_id===id&&UUID.test(x.id)&&Date.parse(x.expires_at)>Date.parse(data.server_now))});
  g.dispatchEvent(new CustomEvent('pablicus:home-feed',{detail:{sessionUserId:s.sessionUserId,sessionGeneration:s.sessionGeneration,owners:ids,feed:data}}));
 }
 function feedView(ids){const records=ids.map(id=>feeds.get(id));if(records.some(x=>!x||Date.now()-x.at>10000))return null;return{server_now:new Date(Date.now()+(records[0]?.offset||0)).toISOString(),stories:records.flatMap(x=>x.stories).filter(x=>Date.parse(x.expires_at)>Date.now()+(records[0]?.offset||0))};}
 function sanitize(d,id){
  if(d?.conversation_id!==id)return null;
  if(d.kind==='self')return{kind:'self',conversation_id:id};
  if(d.kind==='group')return{kind:'group',conversation_id:id};
  if(d.kind!=='contact'||!UUID.test(d.profile?.id))return null;
  const p=d.profile,personal=d.personal||{};return{kind:'contact',conversation_id:id,profile:{id:p.id,username:p.username||'',display_name:p.display_name||'',avatar_url:p.avatar_url||null},personal:{first_name:personal.first_name||'',last_name:personal.last_name||''}};
 }
 async function fallback(s,jobs){
  let i=0;await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(i<jobs.length){const job=jobs[i++];try{if(!valid(s))throw abort();counts.individualCards++;const r=await service().client.rpc('pablicus_contact_card',{p_conversation_id:job.id});if(!valid(s))throw abort();if(r.error)throw r.error;job.resolve(sanitize(r.data,job.id));}catch(e){job.reject(e);}}}));
 }
 async function flush(){
  timer=0;if(active>=2||!queue.length)return;
  const s=queue[0].s,jobs=[];queue=queue.filter(j=>{if(scope(j.s)===scope(s)&&jobs.length<24){jobs.push(j);return false;}return true;});active++;
  try{
   if(!valid(s))throw abort();if(Date.now()<fallbackUntil){await fallback(s,jobs);return;}
   const started=Date.now();counts.batches++;const r=await service().client.rpc('pablicus_home_cards',{p_conversation_ids:jobs.map(j=>j.id)});if(!valid(s))throw abort();
   if(r.error||!Array.isArray(r.data?.cards)){fallbackUntil=Date.now()+30000;await fallback(s,jobs);return;}
   for(const v of r.data.avatars||[])if(v.bucket==='profile-media'&&typeof v.path==='string'&&UUID.test(v.object_id||'')&&typeof v.version==='string'&&String(v.mime).startsWith('image/'))avatarProofs.set(v.path,{...v,until:started+30000,sessionUserId:s.sessionUserId,sessionGeneration:s.sessionGeneration});
   rememberFeed(s,r.data.feed,Array.isArray(r.data.owners)?r.data.owners.filter(x=>UUID.test(x)):[]);
   for(const j of jobs)j.resolve(sanitize(r.data.cards.find(d=>d.conversation_id===j.id),j.id));
  }catch(e){jobs.forEach(j=>j.reject(e));}finally{active--;if(queue.length)flush();}
 }
 function card(id,snapshot){
  let s;try{s=identity();if(snapshot&&!valid(snapshot)||!UUID.test(id))throw abort();}catch(e){return Promise.reject(e);}
  const old=cards.get(id);if(old&&old.until>Date.now()){counts.cardHits++;return old.promise;}
  let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});const entry={promise,until:Date.now()+30000,value:null};cards.set(id,entry);promise.then(v=>{entry.value=v;},()=>{});
  promise.catch(()=>{if(cards.get(id)===entry)cards.delete(id);});if(cards.size>512)cards.delete(cards.keys().next().value);
  queue.push({s,id,resolve,reject});if(!timer)timer=setTimeout(flush,8);return promise;
 }
 function prime(ids){return Promise.all(ids.slice(0,24).map((id,i)=>card(id).then(d=>{if(i<8&&d?.profile)void g.PablicusAvatarStoriesUI?.preload(d.profile).catch(()=>{});return d;}).catch(()=>null)));}
 function peekCard(id){const c=cards.get(id);return c?.until>Date.now()?c.value:null;}
 function avatarProof(path){const p=avatarProofs.get(path);return p&&valid(p)&&p.until>Date.now()?p:null;}
 async function feed(ids,force=false){
  const s=identity();ids=[...new Set(ids.filter(x=>UUID.test(x)))].slice(0,100);if(!ids.length)return{server_now:new Date().toISOString(),stories:[]};
  const cached=!force&&feedView(ids);if(cached){counts.feedHits++;return cached;}
  const k=scope(s)+':'+ids.slice().sort().join(',');if(feedFlight&&feedFlightKey===k)return feedFlight;
  const work=(async()=>{counts.feedRequests++;const r=await service().client.rpc('pablicus_story_feed',{p_owners:ids});if(!valid(s))throw abort();if(r.error)throw r.error;rememberFeed(s,r.data,ids);return r.data;})();feedFlight=work;feedFlightKey=k;
  try{return await work;}finally{if(feedFlight===work){feedFlight=null;feedFlightKey='';}}
 }
 function invalidate(){cards.clear();feeds.clear();avatarProofs.clear();}
 g.PablicusHomeData=Object.freeze({card,prime,peekCard,avatarProof,feed,reset,invalidate,stats:()=>({...counts,queued:queue.length,active}),mark(name){if(!performance.getEntriesByName('pablicus:'+name).length)performance.mark('pablicus:'+name);}});
 g.PablicusController?.subscribe(s=>{if(account!==scope(s))reset();});
})(window);

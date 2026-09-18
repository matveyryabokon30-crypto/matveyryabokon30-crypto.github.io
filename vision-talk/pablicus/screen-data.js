/* P05. Read-only screen orchestration. Proofs are transient, caller-RLS-bound
 * and version checked. No private data or permission proof is stored here.
 * Only visible images are prepared; audio/video bytes are never prefetched.
 */
(function(g){'use strict';if(g.PablicusScreenData)return;
 const proofs=new Map(),decoded=new Map(),flights=new Map();let account='';
 const counts={screenReads:0,proofReads:0,decodedHits:0,decodeRequests:0,prepareTimeouts:0};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const state=()=>g.PablicusController?.state(),scope=s=>(s?.sessionUserId||'')+':'+s?.sessionGeneration;
 const live=s=>!!s?.sessionUserId&&scope(s)===scope(state());
 const aborted=()=>new DOMException('Screen account changed','AbortError');
 function reset(){account=scope(state());proofs.clear();decoded.clear();flights.clear();}
 function identity(){if(account!==scope(state()))reset();const s=state();if(!s?.sessionUserId)throw aborted();return s;}
 function accept(s,media,started){if(!live(s))throw aborted();for(const v of media||[]){if(!['message-media','profile-media'].includes(v.bucket)||typeof v.path!=='string'||!UUID.test(v.object_id||'')||typeof v.version!=='string'||!String(v.mime).startsWith('image/'))continue;proofs.set(v.bucket+':'+v.path,{...v,until:started+30000,sessionUserId:s.sessionUserId,sessionGeneration:s.sessionGeneration});}while(proofs.size>96)proofs.delete(proofs.keys().next().value);}
 function proof(bucket,path,width){identity();if(![192,960,1280].includes(width))return null;const p=proofs.get(bucket+':'+path);return p&&live(p)&&p.until>Date.now()?p:null;}
 async function read(name,args,validate){const s=identity(),started=Date.now();counts.screenReads++;const r=await g.PablicusController.getServices().client.rpc(name,args);if(!live(s))throw aborted();if(r.error)throw r.error;if(!validate(r.data,s))throw Error('Invalid screen response');accept(s,r.data.media,started);return r.data;}
 const history=id=>read('pablicus_conversation_screen',{p_conversation_id:id,p_limit:150},d=>d?.conversation_id===id&&Array.isArray(d.messages));
 const profile=()=>read('pablicus_profile_screen',{},(d,s)=>d?.owner_id===s.sessionUserId&&Array.isArray(d.posts)&&Array.isArray(d.albums));
 function idFor(bucket,path,width){return JSON.stringify([account,bucket,path,width]);}
 function image(bucket,path,width=960){
  identity();const id=idFor(bucket,path,width),r=decoded.get(id);if(!r||r.until<Date.now())return null;
  const url=/^https:\/\//i.test(path)?path:g.PablicusMediaCache.peek(bucket,path,{width});if(url!==r.url||!r.image.complete||!r.image.naturalWidth){decoded.delete(id);return null;}
  decoded.delete(id);decoded.set(id,r);counts.decodedHits++;const img=r.image.cloneNode(true);img.loading='eager';img.decoding='sync';return img;
 }
 async function preload(bucket,path,width=960,priority=0){
  const s=identity();if(!path)return null;const warm=image(bucket,path,width);if(warm)return warm;
  const id=idFor(bucket,path,width);if(flights.has(id))return flights.get(id);
  const task=(async()=>{const external=/^https:\/\//i.test(path);let url;if(external){const u=new URL(path);if(u.username||u.password)throw Error('Invalid media origin');url=u.href;}else url=await g.PablicusMediaCache.resolve(bucket,path,{type:'image',width,priority});if(!live(s))throw aborted();
   const img=new Image();img.loading='eager';img.decoding='sync';img.draggable=false;img.referrerPolicy='no-referrer';img.src=url;counts.decodeRequests++;await img.decode();if(!live(s))throw aborted();decoded.set(id,{url,image:img,until:Date.now()+20000,pixels:img.naturalWidth*img.naturalHeight});
   let pixels=[...decoded.values()].reduce((n,x)=>n+x.pixels,0);for(const [key,r] of decoded){if(decoded.size<=16&&pixels<=6000000)break;if(key===id)continue;pixels-=r.pixels;decoded.delete(key);}return img;
  })();flights.set(id,task);task.finally(()=>{if(flights.get(id)===task)flights.delete(id);}).catch(()=>{});return task;
 }
 function avatarReady(p){if(!p?.avatar_url)return null;for(const width of [960,1280,192]){const img=image('profile-media',p.avatar_url,width);if(img)return img;}
  const url=g.PablicusMediaCache?.peek('profile-media',p.avatar_url,{width:192});return url?g.PablicusAvatarStoriesUI?.imageFor(url,'Фотография профиля'):null;
 }
 async function avatar(p){const ready=avatarReady(p);if(ready)return ready;const img=await preload('profile-media',p?.avatar_url,192,-1);return img?.cloneNode(true)||null;}
 async function bounded(work,ms=800){let timer;try{return await Promise.race([Promise.resolve(work),new Promise(resolve=>{timer=setTimeout(()=>{counts.prepareTimeouts++;resolve(null);},ms);})]);}finally{clearTimeout(timer);}}
 async function prepareProfile(p,posts){return bounded(Promise.allSettled([avatar(p),...(posts||[]).filter(x=>!x.archived&&x.media?.[0]?.type==='image').slice(0,6).map(x=>preload('profile-media',x.media[0].path,960,0))]));}
 async function prepareConversation(isCurrent){if(!isCurrent())return;const canvas=document.getElementById('canvas'),vp=document.getElementById('vp');if(!canvas||!vp)return;const rect=vp.getBoundingClientRect(),work=[];
  for(const row of canvas.querySelectorAll('.row:not([hidden])')){const b=row.getBoundingClientRect();if(b.bottom<rect.top||b.top>rect.bottom)continue;for(const rich of row.querySelectorAll('.richMessage'))if(rich.prepareVisible)work.push(rich.prepareVisible(rect));for(const im of row.querySelectorAll('img.messageImage')){im.loading='eager';work.push(im._pablicusReady||im.decode().catch(()=>{}));}}
  await bounded(Promise.allSettled(work),800);if(!isCurrent())return;await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
 }
 g.PablicusScreenData=Object.freeze({profile,history,proof,image,preload,avatar,avatarReady,prepareProfile,prepareConversation,bounded,reset,stats:()=>({...counts,proofEntries:proofs.size,decodedEntries:decoded.size})});
 g.PablicusController?.subscribe(s=>{if(account!==scope(s))reset();});
})(window);

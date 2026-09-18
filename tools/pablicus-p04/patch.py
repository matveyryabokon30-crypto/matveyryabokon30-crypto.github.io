from pathlib import Path
import json,hashlib,re,sys
R=Path(sys.argv[1])
def patch(f,a,b,n=1):
 p=R/f;s=p.read_text();assert s.count(a)==n,(f,s.count(a),a[:140]);p.write_text(s.replace(a,b))
patch('home-data.js','const cards=new Map(),feeds=new Map();','const cards=new Map(),feeds=new Map(),avatarProofs=new Map();')
patch('home-data.js','queue=[];cards.clear();feeds.clear();','queue=[];cards.clear();feeds.clear();avatarProofs.clear();')
patch('home-data.js',"counts.batches++;const r=await service().client.rpc", "const started=Date.now();counts.batches++;const r=await service().client.rpc")
patch('home-data.js','   rememberFeed(s,r.data.feed,',"""   for(const v of r.data.avatars||[])if(v.bucket==='profile-media'&&typeof v.path==='string'&&UUID.test(v.object_id||'')&&typeof v.version==='string'&&String(v.mime).startsWith('image/'))avatarProofs.set(v.path,{...v,until:started+30000,sessionUserId:s.sessionUserId,sessionGeneration:s.sessionGeneration});
   rememberFeed(s,r.data.feed,""")
patch('home-data.js','const entry={promise,until:Date.now()+30000};cards.set(id,entry);','const entry={promise,until:Date.now()+30000,value:null};cards.set(id,entry);promise.then(v=>{entry.value=v;},()=>{});')
patch('home-data.js',' function prime(ids){for(const id of ids.slice(0,48))void card(id).catch(()=>{});}',""" function prime(ids){return Promise.all(ids.slice(0,24).map(id=>card(id).then(d=>{if(d?.profile)void g.PablicusAvatarStoriesUI?.preload(d.profile).catch(()=>{});return d;}).catch(()=>null)));}
 function peekCard(id){const c=cards.get(id);return c?.until>Date.now()?c.value:null;}
 function avatarProof(path){const p=avatarProofs.get(path);return p&&valid(p)&&p.until>Date.now()?p:null;}""")
patch('home-data.js','function invalidate(){cards.clear();feeds.clear();}','function invalidate(){cards.clear();feeds.clear();avatarProofs.clear();}')
patch('home-data.js','Object.freeze({card,prime,feed,reset,invalidate,stats:', 'Object.freeze({card,prime,peekCard,avatarProof,feed,reset,invalidate,stats:')
patch('media-cache.js','previewFallbacks:0};','previewFallbacks:0,homeProofHits:0};')
patch('media-cache.js','    let lease=await imageLease(s,bucket,path,width,ttl,priority);assert(s);',"""    if(bucket==='profile-media'&&width===192){
     const proof=g.PablicusHomeData?.avatarProof(path);
     if(proof){const local=await diskRead;assert(s);const current=g.PablicusHomeData?.avatarProof(path);
      if(local&&current&&current.object_id===proof.object_id&&current.version===proof.version&&local.sourceVersion===proof.version){stats.diskHits++;stats.homeProofHits++;return remember(key,local.blob,Math.min(proof.until,expiry),s);}
     }
    }
    let lease=await imageLease(s,bucket,path,width,ttl,priority);assert(s);""")
p=R/'avatar-stories.js';s=p.read_text();where=s.index(' async function avatarUrl(')
s=s[:where]+''' const prepared=new Map(),prepareFlights=new Map();
 function readyProfile(p){const r=prepared.get(p?.id);return r&&r.path===(p.avatar_url||'')&&r.until>Date.now()?r:null;}
 function imageFor(url,alt=''){
  const ready=[...prepared.values()].find(r=>r.url===url&&r.until>Date.now()&&r.image?.complete&&r.image.naturalWidth);
  if(!ready)return null;const img=ready.image.cloneNode(true);img.alt=alt;img.decoding='sync';img.loading='eager';return img;
 }
 async function preload(p){
  if(!UUID.test(p?.id||''))return null;const snapshot=state(),path=p.avatar_url||'',k=key(snapshot)+'|'+p.id+'|'+path;
  const ready=readyProfile(p);if(ready)return ready;if(prepareFlights.has(k))return prepareFlights.get(k);
  const task=(async()=>{
   const url=await avatarUrl(p,snapshot);if(!live(snapshot))return null;let img=null;
   if(url){img=el('img');img.alt='';img.draggable=false;img.referrerPolicy='no-referrer';img.loading='eager';img.decoding='sync';img.src=url;try{await img.decode();}catch{return null;}if(!live(snapshot))return null;}
   const proof=global.PablicusHomeData?.avatarProof(path),record={path,url,image:img,until:Math.min(Date.now()+25000,proof?.until||Infinity)};
   if(path&&!url)return null;prepared.set(p.id,record);while(prepared.size>32)prepared.delete(prepared.keys().next().value);return record;
  })();prepareFlights.set(k,task);try{return await task;}finally{if(prepareFlights.get(k)===task)prepareFlights.delete(k);}
 }
 async function prepareHome(profile,conversations){
  const snapshot=state(),ids=conversations.slice(0,8).map(d=>d.id);
  const cardsReady=Promise.all(ids.map(id=>card(id,snapshot).then(async d=>{if(!d)return;const r=await preload(d.profile);if(!live(snapshot)||!r)return;remember(d.profile,r.url,id,d.personal?.first_name||conversations.find(c=>c.id===id)?.title);}))); 
  const ownReady=preload(profile).then(r=>{if(live(snapshot)&&r)remember(profile,r.url);});
  let timeout;await Promise.race([Promise.allSettled([cardsReady,ownReady]),new Promise(resolve=>{timeout=setTimeout(resolve,1000);})]);clearTimeout(timeout);
 }
''' +s[where:];p.write_text(s)
patch('avatar-stories.js',"  if(url){n.dataset.avatarLoading=stamp;const img=el('img');", "  const decoded=url&&imageFor(url,'Фотография профиля');if(decoded){delete n.dataset.avatarLoading;n.replaceChildren(decoded);return;}\n  if(url){n.dataset.avatarLoading=stamp;const img=el('img');")
patch('avatar-stories.js',"const fallback=()=>{if(!keep)n.textContent=Array.from(name)[0]?.toUpperCase()||'?';};", "const fallback=()=>{if(!keep)n.textContent=p.avatar_url?'':(Array.from(name)[0]?.toUpperCase()||'?');};")
patch('avatar-stories.js','  const d=await card(id,snapshot);if(!live(snapshot)||!row.isConnected||!d)return;',"""  const cached=global.PablicusHomeData?.peekCard(id),pre=cached?.profile&&readyProfile(cached.profile);
  if(pre){const name=cached.personal?.first_name||row.querySelector('.chatText strong')?.textContent;remember(cached.profile,pre.url,id,name);ring(n,cached.profile.id);paint(n,cached.profile,pre.url);return;}
  const d=await card(id,snapshot);if(!live(snapshot)||!row.isConnected||!d)return;""")
patch('avatar-stories.js',"const name=d.personal?.first_name||row.querySelector('.chatText strong')?.textContent;remember(d.profile,'',id,name);ring(n,d.profile.id);queueFeed();", "const name=d.personal?.first_name||row.querySelector('.chatText strong')?.textContent;ring(n,d.profile.id);queueFeed();")
patch('avatar-stories.js',"  const url=await avatarUrl(d.profile,snapshot);if(!live(snapshot)||!row.isConnected)return;remember(d.profile,url,id,name);paint(n,d.profile,url);", "  const r=await preload(d.profile);if(!live(snapshot)||!row.isConnected)return;const url=r?.url||'';remember(d.profile,url,id,name);paint(n,d.profile,url);")
patch('avatar-stories.js',"  ring(a,own.id);remember(own,'');const snapshot=state(),ticket=", "  ring(a,own.id);const ready=readyProfile(own);if(ready){remember(own,ready.url);const stamp=own.id+'|'+ready.url;if(a.dataset.avatarStamp!==stamp){a.dataset.avatarStamp=stamp;const img=ready.url&&imageFor(ready.url,'Ваш профиль');if(img)a.replaceChildren(img);else a.textContent=ready.path?'':Array.from(own.display_name||own.username||'Я')[0];}return;}const snapshot=state(),ticket=")
patch('avatar-stories.js','people.clear();emitStories();cards.clear();', 'people.clear();prepared.clear();prepareFlights.clear();emitStories();cards.clear();')
patch('avatar-stories.js','Object.freeze({snapshot,refresh:schedule,compose,view,', 'Object.freeze({snapshot,preload,prepareHome,imageFor,flushHome:layout,refresh:schedule,compose,view,')
patch('stories-v3-core.js',"if(u){const i=E('img');i.alt='';i.draggable=false;i.src=u;a.append(i);}", "if(u){const i=D()?.imageFor?.(u)||E('img');i.alt='';i.draggable=false;i.decoding='sync';i.src=u;a.append(i);}")
patch('stories-v3-core.js',"a.dataset.pendingUrl=url;const img=E('img');", "a.dataset.pendingUrl=url;const decoded=D()?.imageFor?.(url);if(decoded){a.replaceChildren(decoded);delete a.dataset.pendingUrl;return;}const img=E('img');")
patch('stories-v3-core.js','Object.freeze({C,S,E,$,UUID,state,own,','Object.freeze({flush:update,C,S,E,$,UUID,state,own,')
patch('app.js',"VERSION='P03'","VERSION='P04'")
patch('app.js',"  if(navigator.onLine)void fetchDialogSnapshot().catch(()=>{});", """  const previousDialogs=safeGet(cacheKey())||[];
  window.PablicusHomeData?.prime(previousDialogs.map(d=>d.id));
  if(navigator.onLine)void fetchDialogSnapshot().then(([ds])=>{if(user?.id===uid)window.PablicusHomeData?.prime(ds.map(d=>d.id));}).catch(()=>{});""")
patch('app.js',"safeSet('pablicus:'+uid+':profile',profile);window.PablicusHomeData?.mark('approved');window.PablicusShell.authentication(true);dialogs=safeGet(cacheKey())||[];renderHome();$('home').classList.remove('auth-booting');await loadDialogs();", """safeSet('pablicus:'+uid+':profile',profile);window.PablicusHomeData?.mark('approved');dialogs=previousDialogs;
  if(dialogsRequest?.uid===uid){try{let timer;const first=await Promise.race([dialogsRequest.promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),300);})]);clearTimeout(timer);if(attempt!==authVersion||user?.id!==uid)return;if(first){const [ds,prefs]=first;chatPrefs.clear();for(const p of prefs)chatPrefs.set(p.conversation_id,p);dialogs=ds.map(withChatPreference);}}catch{}}
  await window.PablicusAvatarStoriesUI?.prepareHome(profile,dialogs);
  if(attempt!==authVersion||signal?.aborted||user?.id!==uid)return;
  renderHome();window.PablicusAvatarStoriesUI?.flushHome();window.PablicusStoriesCore?.flush();window.PablicusShell.authentication(true);window.PablicusShell.project(window.PablicusController.state());$('home').classList.remove('auth-booting');window.PablicusHomeData?.mark('home-visible');await loadDialogs();""")
patch('app.js',"avatar=el('span','avatar',(d.title||'?').replace('@','').slice(0,1).toUpperCase())", "avatar=el('span','avatar','')")
patch('app.js',"window.PablicusHomeData?.prime(ds.map(d=>d.id));window.PablicusHomeData?.mark('home-rows');", "window.PablicusHomeData?.prime(ds.map(d=>d.id));window.PablicusAvatarStoriesUI?.flushHome();window.PablicusHomeData?.mark('home-rows');")
patch('index.html','content="P03"','content="P04"')
p=R/'sw.js';s=p.read_text();old=json.loads(re.search(r'const ASSETS=(.*?);\n',s).group(1));manifest={f:hashlib.sha256((R/('index.html' if f=='./' else f)).read_bytes()).hexdigest() for f in old}
s=re.sub(r'const ASSETS=.*?;\n',lambda m:'const ASSETS='+json.dumps(manifest,separators=(',',':'))+';\n',s,count=1).replace("const VERSION='pablicus-shell-p03-20260918';","const VERSION='pablicus-shell-p04-20260918';");p.write_text(s)
report=json.loads((R/'release-p01r2.json').read_text());report.update(release='P04',base='400519b4ab66e98dfaf8fa5623e8d205c52d5dfb',assets=manifest)
for f in ['release-p01r2.json','release-p04.json']:(R/f).write_text(json.dumps(report,indent=2))
print('P04 patched',len(manifest),'shell assets')

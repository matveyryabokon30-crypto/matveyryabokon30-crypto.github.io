/* P01-R2: explicit image bytes cache, partitioned by account. No fetch patches.
 * Cache reads require the original short storage authorization lease. Videos
 * retain network/range URLs. Eviction indexes never read full image payloads.
 */
(function(g){
 'use strict';if(g.PablicusMediaCache)return;
 const BUCKETS=new Set(['message-media','profile-media','pablicus-story-media']);
 const MAX_DISK=128*1024*1024,MAX_MEMORY=48*1024*1024,MAX_FILE=50*1024*1024,MAX_ENTRIES=96;
 const memo=new Map(),signs=new Map(),pending=new Map(),controllers=new Set();
 let owner=null,generation=0,subscribed=false,dbPromise=null,diskWrites=Promise.resolve(),active=0,queue=[],used=0;
 const stats={imageDownloads:0,downloadBytes:0,memoryHits:0,diskHits:0,signRequests:0,coalesced:0,errors:0,peakDownloads:0,evictions:0,diskWrites:0,diskErrors:0,lastDiskError:null};
 const aborted=()=>new DOMException('Media scope changed','AbortError');
 function diskError(e){stats.diskErrors++;stats.lastDiskError=e?.name||'StorageError';}
 function session(){
  const c=g.PablicusController,s=c?.state?.();
  if(!subscribed&&c?.subscribe){subscribed=true;c.subscribe(next=>{if(next.sessionUserId!==owner)changeOwner(next.sessionUserId||null);});}
  if((s?.sessionUserId||null)!==owner)changeOwner(s?.sessionUserId||null);
  if(!owner)throw aborted();return{id:owner,generation,client:c.getServices().client};
 }
 function valid(s){return s.id===owner&&s.generation===generation&&g.PablicusController?.state().sessionUserId===s.id;}
 function assert(s){if(!valid(s))throw aborted();}
 function changeOwner(id){
  if(owner===id)return;const previous=owner;owner=id;generation++;
  for(const c of controllers)c.abort();controllers.clear();for(const job of queue)job.reject(aborted());queue=[];
  for(const e of memo.values())URL.revokeObjectURL(e.url);memo.clear();signs.clear();pending.clear();used=0;
  if(previous)diskWrites=diskWrites.catch(()=>{}).then(()=>purge(previous)).catch(diskError);
 }
 function check(bucket,path){if(!BUCKETS.has(bucket)||typeof path!=='string'||!path||path.startsWith('/')||path.includes('..')||path.includes('://')||/[\u0000-\u001f]/.test(path))throw Error('Invalid media path');}
 function k(s,bucket,path,variant='original'){return JSON.stringify([s.id,bucket,path,variant]);}
 function openDB(){
  if(!g.indexedDB)return Promise.resolve(null);
  if(!dbPromise)dbPromise=new Promise(resolve=>{
   let settled=false;const finish=db=>{if(settled){db?.close();return;}settled=true;clearTimeout(timer);resolve(db);};
   const timer=setTimeout(()=>{diskError({name:'StorageOpenTimeout'});finish(null);dbPromise=null;},3000);
   let r;try{r=indexedDB.open('pablicus-images-p01r2',2);}catch(e){diskError(e);finish(null);return;}
   r.onupgradeneeded=()=>{const db=r.result;if(db.objectStoreNames.contains('images'))db.deleteObjectStore('images');db.createObjectStore('images',{keyPath:'key'});const meta=db.createObjectStore('metadata',{keyPath:'key'});meta.createIndex('owner','owner');};
   r.onerror=()=>{diskError(r.error);finish(null);dbPromise=null;};
   r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();dbPromise=null;};finish(r.result);};
  });return dbPromise;
 }
 async function read(key,s){
  const db=await openDB();assert(s);if(!db)return null;
  return new Promise(resolve=>{try{
   const t=db.transaction(['images','metadata'],'readonly'),r=t.objectStore('images').get(key),m=t.objectStore('metadata').get(key);let v=null,meta=null;
   r.onsuccess=()=>v=r.result;m.onsuccess=()=>meta=m.result;
   t.oncomplete=()=>{if(!valid(s)||!meta||meta.owner!==s.id||meta.until<=Date.now()||!v?.data||!String(v.type).startsWith('image/')){resolve(null);return;}
    try{const blob=new Blob([v.data],{type:v.type});resolve(blob.size===meta.size?{blob}:null);}catch(e){diskError(e);resolve(null);}};
   t.onerror=t.onabort=()=>{diskError(t.error);resolve(null);};
  }catch(e){diskError(e);resolve(null);}});
 }
 async function purge(id){
  const db=await openDB();if(!db)return;
  await new Promise(resolve=>{try{const t=db.transaction(['images','metadata'],'readwrite'),meta=t.objectStore('metadata'),images=t.objectStore('images'),r=meta.index('owner').openCursor(IDBKeyRange.only(id));
   r.onsuccess=()=>{const c=r.result;if(c){images.delete(c.primaryKey);c.delete();c.continue();}};t.oncomplete=()=>resolve();t.onerror=t.onabort=()=>{diskError(t.error);resolve();};
  }catch(e){diskError(e);resolve();}});
 }
 async function prune(db){
  await new Promise(resolve=>{try{const t=db.transaction(['images','metadata'],'readwrite'),meta=t.objectStore('metadata'),images=t.objectStore('images'),r=meta.openCursor(),all=[];let bytes=0;
   r.onsuccess=()=>{const c=r.result;if(c){const v=c.value;if(v.until<=Date.now()){images.delete(c.primaryKey);c.delete();}else{bytes+=v.size;all.push(v);}c.continue();return;}
    all.sort((a,b)=>a.touched-b.touched);while((bytes>MAX_DISK||all.length>512)&&all.length){const v=all.shift();bytes-=v.size;meta.delete(v.key);images.delete(v.key);}};
   t.oncomplete=()=>resolve();t.onerror=t.onabort=()=>{diskError(t.error);resolve();};
  }catch(e){diskError(e);resolve();}});
 }
 function write(key,blob,s,bucket,expiry){
  diskWrites=diskWrites.catch(()=>{}).then(async()=>{
   if(!valid(s))return;const db=await openDB();if(!db||!valid(s))return;
   // ArrayBuffer works independently of WebKit's temporary Blob backing files.
   const data=await blob.arrayBuffer();if(!valid(s))return;
   const until=Math.min(Date.now()+24*3600000,expiry||Infinity);
   const saved=await new Promise(resolve=>{try{const t=db.transaction(['images','metadata'],'readwrite');
    t.objectStore('images').put({key,data,type:blob.type});t.objectStore('metadata').put({key,owner:s.id,bucket,size:data.byteLength,touched:Date.now(),until});
    t.oncomplete=()=>{stats.diskWrites++;resolve(true);};t.onerror=t.onabort=()=>{diskError(t.error);resolve(false);};
   }catch(e){diskError(e);resolve(false);}});
   if(saved&&valid(s))await prune(db);
  }).catch(diskError);return diskWrites;
 }
 function remember(key,blob,lease,s){
  assert(s);const prior=memo.get(key);if(prior){prior.until=lease;return prior.url;}
  const entry={url:URL.createObjectURL(blob),bytes:blob.size,until:lease};memo.set(key,entry);used+=entry.bytes;
  for(const [id,e]of memo){if(memo.size<=MAX_ENTRIES&&used<=MAX_MEMORY)break;if(id===key)continue;memo.delete(id);used-=e.bytes;URL.revokeObjectURL(e.url);stats.evictions++;}return entry.url;
 }
 function hit(key){const e=memo.get(key);if(!e||e.until<=Date.now())return null;memo.delete(key);memo.set(key,e);return e;}
 function sign(s,bucket,path,ttl=300){
  const key=k(s,bucket,path,'signed:'+ttl),now=Date.now(),old=signs.get(key);if(old&&old.until>now)return old.promise;
  const until=now+Math.max(1,ttl-15)*1000;stats.signRequests++;
  const promise=(async()=>{const r=await s.client.storage.from(bucket).createSignedUrl(path,ttl);assert(s);if(r.error)throw r.error;const u=new URL(r.data?.signedUrl);
   if(u.protocol!=='https:'||u.username||u.password||!['ctcoqgsztdtsazdiwcmd.supabase.co','ctcoqgsztdtsazdiwcmd.storage.supabase.co'].includes(u.hostname))throw Error('Invalid media origin');return{url:u.href,until};})();
  signs.set(key,{until,promise});if(signs.size>256)signs.delete(signs.keys().next().value);promise.catch(()=>{if(signs.get(key)?.promise===promise)signs.delete(key);});return promise;
 }
 function schedule(s,fn,priority=0){return new Promise((resolve,reject)=>{queue.push({s,fn,resolve,reject,priority});queue.sort((a,b)=>a.priority-b.priority);drain();});}
 function drain(){while(active<3&&queue.length){const job=queue.shift();if(!valid(job.s)){job.reject(aborted());continue;}active++;stats.peakDownloads=Math.max(stats.peakDownloads,active);Promise.resolve().then(job.fn).then(job.resolve,job.reject).finally(()=>{active--;drain();});}}
 async function download(url,s){
  assert(s);const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),25000);
  try{stats.imageDownloads++;const r=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'default'});assert(s);
   if(!r.ok)throw Error('Image HTTP '+r.status);const type=r.headers.get('content-type')||'';if(!type.startsWith('image/'))throw Error('Unexpected media type');if(Number(r.headers.get('content-length')||0)>MAX_FILE)throw Error('Image exceeds cache limit');
   const reader=r.body?.getReader();let blob;if(reader){const chunks=[];let size=0;for(;;){const part=await reader.read();assert(s);if(part.done)break;size+=part.value.byteLength;if(size>MAX_FILE){await reader.cancel();throw Error('Image exceeds cache limit');}chunks.push(part.value);}blob=new Blob(chunks,{type});}else blob=await r.blob();
   assert(s);if(!blob.size||blob.size>MAX_FILE)throw Error('Invalid image size');stats.downloadBytes+=blob.size;return blob;
  }finally{clearTimeout(timer);controllers.delete(controller);}
 }
 async function preview(blob,width,s){
  if(!width||/gif|svg/i.test(blob.type))return blob;assert(s);let bitmap=null,img=null,url=null;
  try{if(g.createImageBitmap)try{bitmap=await createImageBitmap(blob);}catch{}
   if(!bitmap){url=URL.createObjectURL(blob);img=new Image();img.loading='eager';img.src=url;await img.decode();}
   assert(s);const source=bitmap||img,w=source.width||source.naturalWidth,h=source.height||source.naturalHeight;if(w<=width&&h<=width)return blob;
   const scale=Math.min(1,width/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
   const small=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));canvas.width=canvas.height=1;assert(s);return small&&small.size<blob.size?small:blob;
  }catch(e){assert(s);return blob;}finally{bitmap?.close();if(url)URL.revokeObjectURL(url);}
 }
 function resolve(bucket,path,options={}){
  const s=session();check(bucket,path);const type=options.type||(/\.(?:jpe?g|png|webp|gif|heic|avif)(?:$|\?)/i.test(path)?'image':'other');
  const ttl=Math.min(300,Math.max(30,options.ttl||300)),expiry=Number(options.expiresAt)||Infinity;if(expiry<=Date.now())return Promise.reject(Error('Media expired'));
  if(type!=='image')return sign(s,bucket,path,ttl).then(v=>{assert(s);return v.url;});
  const width=options.width===0?0:(options.width||1280),variant=width?'image:'+width:'original',key=k(s,bucket,path,variant),cached=hit(key);
  if(cached){cached.until=Math.min(cached.until,expiry);stats.memoryHits++;return Promise.resolve(cached.url);}
  if(pending.has(key)){stats.coalesced++;return pending.get(key);}
  const job=(async()=>{
   try{const lease=await sign(s,bucket,path,ttl);assert(s);const until=Math.min(lease.until,expiry),mem=memo.get(key);if(mem){mem.until=until;stats.memoryHits++;return mem.url;}
    const saved=await read(key,s);if(saved){stats.diskHits++;return remember(key,saved.blob,until,s);}
    const originalKey=k(s,bucket,path,'original'),baseKey=k(s,bucket,path,'bytes');let base=pending.get(baseKey);
    if(!base){base=(async()=>{const disk=width?await read(originalKey,s):null;if(disk){stats.diskHits++;return disk.blob;}return schedule(s,async()=>{const fresh=lease.until>Date.now()?lease:await sign(s,bucket,path,ttl);const b=await download(fresh.url,s);void write(originalKey,b,s,bucket,expiry);return b;},options.priority||0);})();pending.set(baseKey,base);base.finally(()=>{if(pending.get(baseKey)===base)pending.delete(baseKey);}).catch(()=>{});}else stats.coalesced++;
    const original=await base;assert(s);const blob=width?await preview(original,width,s):original;assert(s);if(width)void write(key,blob,s,bucket,expiry);return remember(key,blob,until,s);
   }catch(e){stats.errors++;const entry=memo.get(key);if(entry){used-=entry.bytes;URL.revokeObjectURL(entry.url);memo.delete(key);}throw e;}
  })();pending.set(key,job);job.finally(()=>{if(pending.get(key)===job)pending.delete(key);}).catch(()=>{});return job;
 }
 function peek(bucket,path,options={}){try{const s=session(),width=options.width===0?0:(options.width||1280),e=hit(k(s,bucket,path,width?'image:'+width:'original'));return e?e.url:null;}catch{return null;}}
 function invalidate(bucket,path){const s=session();for(const[key,e]of memo){const[id,b,p]=JSON.parse(key);if(id===s.id&&b===bucket&&p===path){used-=e.bytes;URL.revokeObjectURL(e.url);memo.delete(key);}}for(const key of signs.keys()){const[id,b,p]=JSON.parse(key);if(id===s.id&&b===bucket&&p===path)signs.delete(key);}}
 g.PablicusMediaCache=Object.freeze({resolve,peek,invalidate,stats:()=>({...stats,activeDownloads:active,queuedDownloads:queue.length,memoryEntries:memo.size,memoryBytes:used}),settled:()=>diskWrites,clear(){changeOwner(null);}});
})(window);

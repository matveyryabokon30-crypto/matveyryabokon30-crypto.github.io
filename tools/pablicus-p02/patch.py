from pathlib import Path
import json,hashlib,re,sys
R=Path(sys.argv[1])
def patch(f,a,b,n=1):
 p=R/f;s=p.read_text();assert s.count(a)==n,(f,s.count(a),a[:160]);p.write_text(s.replace(a,b))
patch('media-cache.js',"return{id:owner,generation,client:c.getServices().client};","return{id:owner,generation,sessionGeneration:s.sessionGeneration,client:c.getServices().client};")
patch('media-cache.js',"if(owner===id)return;const previous=owner;owner=id;generation++;","if(owner===id)return;const previous=owner;owner=id;generation++;g.PablicusPreviewClient?.clear();")
patch('media-cache.js',"lastDiskError:null};","lastDiskError:null,serverPreviews:0,sourceBytesAvoided:0,parallelDiskReads:0,previewFallbacks:0};")
patch('media-cache.js','resolve(blob.size===meta.size?{blob}:null);','resolve(blob.size===meta.size?{blob,sourceVersion:meta.sourceVersion||null}:null);')
patch('media-cache.js','function write(key,blob,s,bucket,expiry){','function write(key,blob,s,bucket,expiry,sourceVersion=null){')
patch('media-cache.js','touched:Date.now(),until});','touched:Date.now(),until,sourceVersion});')
patch('media-cache.js','function drain(){while(active<3&&queue.length){','function drain(){while(queue.length&&(active<3||(active<4&&queue[0].priority<0))){')
s=(R/'media-cache.js').read_text();start=s.index(' function resolve(bucket,path,options={}){');end=s.index('\n function peek(',start)
s=s[:start]+''' async function imageLease(s,bucket,path,width,ttl,priority){
  if(width&&g.PablicusPreviewClient){try{return await g.PablicusPreviewClient.lease(s,bucket,path,width,ttl,priority);}catch(e){assert(s);if(e.denied)throw e;stats.previewFallbacks++;}}
  return sign(s,bucket,path,ttl);
 }
 function resolve(bucket,path,options={}){
  const s=session();check(bucket,path);const type=options.type||(/\\.(?:jpe?g|png|webp|gif|heic|avif)(?:$|\\?)/i.test(path)?'image':'other');
  const ttl=Math.min(300,Math.max(30,options.ttl||300)),expiry=Number(options.expiresAt)||Infinity;if(expiry<=Date.now())return Promise.reject(Error('Media expired'));
  if(type!=='image')return sign(s,bucket,path,ttl).then(v=>{assert(s);return v.url;});
  const width=options.width===0?0:(options.width||1280),variant=width?'image:'+width:'original',key=k(s,bucket,path,variant),cached=hit(key),priority=options.priority||0;
  if(cached){cached.until=Math.min(cached.until,expiry);stats.memoryHits++;return Promise.resolve(cached.url);}
  if(pending.has(key)){stats.coalesced++;return pending.get(key);}
  const job=(async()=>{
   try{
    // Disk I/O and authorization overlap, but bytes are not exposed before authorization.
    stats.parallelDiskReads++;const diskRead=read(key,s);diskRead.catch(()=>{});
    let lease=await imageLease(s,bucket,path,width,ttl,priority);assert(s);
    const until=Math.min(lease.until,expiry),mem=memo.get(key);if(mem){mem.until=until;stats.memoryHits++;return mem.url;}
    const saved=await diskRead;assert(s);
    if(saved&&(!saved.sourceVersion||!lease.sourceVersion||saved.sourceVersion===lease.sourceVersion)){stats.diskHits++;return remember(key,saved.blob,until,s);}
    if(width&&lease.canPrepare){try{lease=await g.PablicusPreviewClient.build(s,bucket,path,width,priority);assert(s);}catch(e){assert(s);stats.previewFallbacks++;}}
    if(width&&lease.kind==='preview'){
     const blob=await schedule(s,async()=>{assert(s);const fresh=lease.until>Date.now()?lease:await imageLease(s,bucket,path,width,ttl,priority);return download(fresh.url,s);},priority);
     assert(s);stats.serverPreviews++;stats.sourceBytesAvoided+=Math.max(0,(lease.sourceBytes||blob.size)-blob.size);
     void write(key,blob,s,bucket,expiry,lease.sourceVersion);return remember(key,blob,Math.min(lease.until,expiry),s);
    }
    const originalKey=k(s,bucket,path,'original'),baseKey=k(s,bucket,path,'bytes');let base=pending.get(baseKey);
    if(!base){base=(async()=>{const disk=width?await read(originalKey,s):null;if(disk&&(!disk.sourceVersion||!lease.sourceVersion||disk.sourceVersion===lease.sourceVersion)){stats.diskHits++;return disk.blob;}
     return schedule(s,async()=>{const fresh=lease.until>Date.now()?lease:await sign(s,bucket,path,ttl);const b=await download(fresh.url,s);void write(originalKey,b,s,bucket,expiry,lease.sourceVersion);return b;},priority);})();pending.set(baseKey,base);base.finally(()=>{if(pending.get(baseKey)===base)pending.delete(baseKey);}).catch(()=>{});}else stats.coalesced++;
    const original=await base;assert(s);const blob=width?await preview(original,width,s):original;assert(s);if(width)void write(key,blob,s,bucket,expiry,lease.sourceVersion);return remember(key,blob,Math.min(lease.until,expiry),s);
   }catch(e){stats.errors++;const entry=memo.get(key);if(entry){used-=entry.bytes;URL.revokeObjectURL(entry.url);memo.delete(key);}throw e;}
  })();pending.set(key,job);job.finally(()=>{if(pending.get(key)===job)pending.delete(key);}).catch(()=>{});return job;
 }
 async function prepare(bucket,path){try{const s=session();check(bucket,path);if(g.PablicusPreviewClient)await g.PablicusPreviewClient.build(s,bucket,path,960,2);}catch{/* Never fail an upload because optional preparation failed. */}}
''' + s[end:]
s=s.replace('Object.freeze({resolve,peek,invalidate,stats:', 'Object.freeze({resolve,prepare,peek,invalidate,stats:');(R/'media-cache.js').write_text(s)
patch('index.html','<script src="media-cache.js">','<script src="media-preview-client.js"></script><script src="media-cache.js">')
patch('index.html','content="P01-R2"','content="P02"')
patch('app.js',"VERSION='P01-R2'","VERSION='P02'")
patch('app.js',"resolveUrl:(path,block)=>local?PablicusChat.localAssetUrl(block.assetId):signedUrl(path,{type:block.type,width:960}),", "resolveUrl:(path,block,hint={})=>local?PablicusChat.localAssetUrl(block.assetId):signedUrl(path,{type:block.type,width:960,priority:hint.priority||0}),")
p=R/'rich-message.js';s=p.read_text();a="const resolved = warm || await options.resolveUrl(item.block.path || item.block.assetId || item.block.id, item.block);";assert s.count(a)==2;s=s.replace(a,"const box=item.button.getBoundingClientRect();\n        const resolved = warm || await options.resolveUrl(item.block.path || item.block.assetId || item.block.id, item.block,{priority:box.bottom>0&&box.top<innerHeight?0:2});",1);p.write_text(s)
patch('stories-v3-core.js',"type:story.media.type,width:1600,ttl:120", "type:story.media.type,width:1600,priority:-10,ttl:120")
patch('app.js',"if(r.error&&!await objectExists(path))throw r.error;return{path,id}", "if(r.error&&!await objectExists(path))throw r.error;if(f.type?.startsWith('image/')){await PablicusMediaCache.prepare(BUCKET,path);check();}return{path,id}")
patch('app.js',"  return{path,id};\n }\n async function pump", "  if(f.type?.startsWith('image/')){await PablicusMediaCache.prepare(BUCKET,path);check();}\n  return{path,id};\n }\n async function pump")
patch('profile-page.js',"await result(bucket.upload(path,file,{contentType:file.type,upsert:false}));return", "await result(bucket.upload(path,file,{contentType:file.type,upsert:false}));if(file.type.startsWith('image/'))await scope.PablicusMediaCache.prepare('profile-media',path);return")
patch('profile-photos.js',"if(r.error)throw r.error;paths.push(path);", "if(r.error)throw r.error;await root.PablicusMediaCache.prepare('profile-media',path);if(!live())return;paths.push(path);")
patch('avatar-stories.js',"if(r.error&&String(r.error.statusCode)!=='409')throw r.error;uploaded=", "if(r.error&&String(r.error.statusCode)!=='409')throw r.error;if(file.type.startsWith('image/'))await global.PablicusMediaCache.prepare('pablicus-story-media',path);if(!valid(m))return;uploaded=")
patch('profile-page.js',"resolveUrl:item=>resolve(item.path)", "resolveUrl:item=>resolve(item.path,0)")
patch('profile-page.js',"async function resolve(path){", "async function resolve(path,width=960){")
patch('profile-page.js',"scope.PablicusMediaCache.resolve('profile-media',path)}", "scope.PablicusMediaCache.resolve('profile-media',path,{width})}")
p=R/'sw.js';s=p.read_text();old=json.loads(re.search(r'const ASSETS=(.*?);\n',s).group(1));names=list(old)+['media-preview-client.js'];manifest={f:hashlib.sha256((R/('index.html' if f=='./' else f)).read_bytes()).hexdigest() for f in names}
s=re.sub(r'const ASSETS=.*?;\n',lambda m:'const ASSETS='+json.dumps(manifest,separators=(',',':'))+';\n',s,count=1)
s=s.replace("const VERSION='pablicus-shell-p01r2-20260917';","const VERSION='pablicus-shell-p02-20260918';");p.write_text(s)
report=json.loads((R/'release-p01r2.json').read_text());report.update(release='P02',base='3c4a42edb803203277611304a5e759d1af38dd81',assets=manifest)
(R/'release-p01r2.json').write_text(json.dumps(report,indent=2));(R/'release-p02.json').write_text(json.dumps(report,indent=2))
print('Patched',len(manifest),'shell assets')

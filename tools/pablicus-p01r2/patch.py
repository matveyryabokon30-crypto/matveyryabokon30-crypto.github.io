from pathlib import Path
import hashlib,re,json,sys
R=Path(sys.argv[1])
def patch(name,old,new,count=1):
 p=R/name;s=p.read_text();assert s.count(old)==count,(name,'pattern count',s.count(old),old[:100]);p.write_text(s.replace(old,new))
(R/'performance-p01.js').write_text('/* P01 retired. Media is resolved explicitly by media-cache.js. No global fetch, lifetime extension or DOM observer. */\n')
p=R/'app-shell.js';s=p.read_text();assert s.startswith('/* P01 must patch');p.write_text(s[s.index('/* Stateless'):])
patch('app.js',"BUCKET='message-media',VERSION='0.1.0-rc5'","BUCKET='message-media',VERSION='P01-R2'")
patch('app.js',"async function signedUrl(path){const old=signed.get(path);if(old&&old.until>Date.now())return old.url;const r=await sb.storage.from(BUCKET).createSignedUrl(path,300);if(r.error)throw r.error;signed.set(path,{url:r.data.signedUrl,until:Date.now()+240000});return r.data.signedUrl}","async function signedUrl(path,options={}){return PablicusMediaCache.resolve(BUCKET,path,{width:0,...options});}")
patch('app.js',"resolveUrl:(path,block)=>local?PablicusChat.localAssetUrl(block.assetId):signedUrl(path),", "resolveUrl:(path,block)=>local?PablicusChat.localAssetUrl(block.assetId):signedUrl(path,{type:block.type,width:960}),\n  peekUrl:(path,block)=>local?null:PablicusMediaCache.peek(BUCKET,path,{width:960}),")
patch('app.js',"signedUrl(r.attachment_path).then(u=>", "signedUrl(r.attachment_path,{type:'image',width:960}).then(u=>")
patch('app.js',"await signedUrl(item.path);if(user?.id!==uid)", "await signedUrl(item.path,{type:item.type,width:0});if(user?.id!==uid)")
patch('app.js',"user=null;profile=null;dialogs=[];rows=[];current=null;epoch++;signed.clear();", "user=null;profile=null;dialogs=[];rows=[];current=null;epoch++;signed.clear();window.PablicusMediaCache?.clear();")
p=R/'app.js';s=p.read_text();start=s.index(" if('serviceWorker'in navigator){let approveUpdate=false;");end=s.index(' window.PablicusDebug=',start)
s=s[:start]+" window.PablicusUpdateGuards={busy:()=>worker||opening||!!PablicusChat.rich?.recording||!!PablicusChat.rich?.pending||!!PablicusChat.rich?.composing||chatCanvas.hasUnsavedChanges()||!!document.querySelector('form.youForm,dialog[open]'),prepare:()=>PablicusChat.prepareUpdate()};\n"+s[end:];p.write_text(s)
patch('app.js',"'Поделиться Пабликусом');shareAppButton", "'Пригласить в Pablicus');shareAppButton")
# IntersectionObserver already owns load scheduling. Keep one loading gate.
patch('rich-message.js',"image.loading = 'lazy';", "image.loading = 'eager'; // IntersectionObserver owns scheduling; visibility changes on load.")
patch('rich-message.js',"const resolved = await options.resolveUrl(item.block.path || item.block.assetId || item.block.id, item.block);", "const warm = options.peekUrl?.(item.block.path || item.block.assetId || item.block.id, item.block);\n        const resolved = warm || await options.resolveUrl(item.block.path || item.block.assetId || item.block.id, item.block);",2)
# Retain a bounded set of recently viewed image rows. Video/audio are released.
patch('chat.js',"const m=this.messages[i];wanted.add(m.id);let n=this.nodes.get(m.id);", "const m=this.messages[i];wanted.add(m.id);let n=this.nodes.get(m.id);\nif(n){n.hidden=false;this.nodes.delete(m.id);this.nodes.set(m.id,n);}")
patch('chat.js',"for(const[id,n]of this.nodes)if(!wanted.has(id)){n.remove();this.nodes.delete(id)}", """for(const[id,n]of this.nodes)if(!wanted.has(id)){
 if(!this.index.has(id)||n.querySelector('video,audio')){n.remove();this.nodes.delete(id);}else n.hidden=true;
}
let warmRows=0,warmImages=0;
for(const[id,n]of [...this.nodes].reverse())if(!wanted.has(id)){
 warmRows++;warmImages+=n.querySelectorAll('img').length;
 if(warmRows>12||warmImages>32||this.nodes.size>LIMIT){n.remove();this.nodes.delete(id);}
}""")
patch('chat.js',"const nodes=[...canvas.querySelectorAll('.row')].sort", "const nodes=[...canvas.querySelectorAll('.row:not([hidden])')].sort")
# Profile geometry remains owned by its existing motion system.
patch('profile-page.js',"const cached=urls.get(path);if(cached&&cached.until>Date.now())return cached.url;const data=await result(bucket.createSignedUrl(path,300));urls.set(path,{url:data.signedUrl,until:Date.now()+240000});return data.signedUrl", "return scope.PablicusMediaCache.resolve('profile-media',path)")
patch('profile-photos.js',"const c=cache.get(path);if(c&&c.until>Date.now())return c.url;if(pending.has(path))return pending.get(path);const p=(async()=>{const r=await client.storage.from('profile-media').createSignedUrl(path,300);if(!live())throw new DOMException('Closed','AbortError');if(r.error)throw r.error;const u=new URL(r.data?.signedUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid image URL');cache.set(path,{url:u.href,until:Date.now()+240000});return u.href;})();pending.set(path,p);try{return await p;}finally{if(pending.get(path)===p)pending.delete(path);}", "const value=await root.PablicusMediaCache.resolve('profile-media',path,{type:'image'});if(!live())throw new DOMException('Closed','AbortError');return value;")
patch('avatar-stories.js',"const k=key(snapshot)+':'+path,hit=signed.get(k);if(hit&&hit.until>Date.now())return hit.url;\n  const r=await client.storage.from('profile-media').createSignedUrl(path,300);if(!live(snapshot)||r.error)return '';\n  const u=new URL(r.data.signedUrl);if(u.protocol!=='https:'||u.username||u.password)return '';signed.set(k,{url:u.href,until:Date.now()+240000});return u.href;", "try{const url=await global.PablicusMediaCache.resolve('profile-media',path,{type:'image',width:192});return live(snapshot)?url:'';}catch{return '';}")
patch('contact-card.js',"const cached=urlCache.get(path);if(cached?.until>Date.now())return cached.url;\n   const r=await client.storage.from('profile-media').createSignedUrl(path,300);if(!session(s))throw Error('Account changed');if(r.error)throw r.error;\n   const u=new URL(r.data?.signedUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid media URL');urlCache.set(path,{url:u.href,until:Date.now()+240000});return u.href;", "const url=await scope.PablicusMediaCache.resolve('profile-media',path);if(!session(s))throw Error('Account changed');return url;")
p=R/'stories-v3-core.js';s=p.read_text();a=s.index('  const k=key(),ck=k+\':media:\'');b=s.index('\n }\n function open(',a)
s=s[:a]+"  if(retry)g.PablicusMediaCache.invalidate('pablicus-story-media',path);return g.PablicusMediaCache.resolve('pablicus-story-media',path,{type:story.media.type,width:1600,ttl:120,expiresAt:Date.parse(story.expires_at)-serverOffset});"+s[b:];p.write_text(s)
p=R/'index.html';s=p.read_text();assert 'media-cache.js' not in s;s=s.replace('<script src="app-shell.js">','<script src="media-cache.js"></script><script src="app-shell.js">')
s=s.replace('<title>Pablicus</title>','<title>Pablicus</title><meta name="pablicus-release" content="P01-R2">')
s=s.replace('</body>', '<script src="share-invite.js"></script><script src="auto-update.js"></script></body>');p.write_text(s)
# Preserve the deployed push handlers byte-for-byte. Only replace shell management.
p=R/'sw.js';old=p.read_text();push=old[old.index('const PUSH_UUID='):]
files=[]
for name in ['EXTRA','BASE']:
 m=re.search(r'\b'+name+r'=\[(.*?)\]',old);assert m,name;files+=re.findall(r"'([^']+)'",m.group(1))
files=list(dict.fromkeys(files+['media-cache.js']))
missing=[f for f in files if not (R/f).exists()];assert not missing,missing
manifest={f:hashlib.sha256((R/'index.html' if f=='./' else R/f).read_bytes()).hexdigest() for f in files if f not in ['performance-p01.js']}
shell='''/* P01-R2: one coherent public shell; no private media in shell caches. */
const VERSION='pablicus-shell-p01r2-20260917';
const ASSETS=__ASSETS__;
const allowed=new Map(Object.entries(ASSETS).map(([p,h])=>[new URL(p,self.registration.scope).href,h]));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(VERSION),entries=[...allowed];let cursor=0;
 const tasks=Array.from({length:4},async()=>{while(cursor<entries.length){const [url,sha]=entries[cursor++];const response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok)throw Error('Shell fetch failed');
 const bytes=await response.clone().arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==sha)throw Error('Incoherent release');await cache.put(url,response);}});
 const settled=await Promise.allSettled(tasks),failed=settled.find(x=>x.status==='rejected');if(failed){await caches.delete(VERSION);throw failed.reason;}
})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')event.waitUntil(self.skipWaiting());if(event.data?.type==='PABLICUS_RELEASE')event.ports?.[0]?.postMessage({version:VERSION});});
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();for(const name of await caches.keys())if(name.startsWith('pablicus-shell-')&&name!==VERSION)await caches.delete(name);
 await caches.delete('pablicus-media-p01');})()));
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const u=new URL(request.url),scope=new URL(self.registration.scope);let key=u.href;
 if(request.mode==='navigate'&&u.origin===scope.origin&&(u.pathname===scope.pathname||u.pathname===scope.pathname+'index.html'))key=new URL('index.html',scope).href;
 if(!allowed.has(key))return;
 event.respondWith((async()=>{const cache=await caches.open(VERSION),hit=await cache.match(key);return hit||fetch(request);})());
});
'''.replace('__ASSETS__',json.dumps(manifest,separators=(',',':')))
p.write_text(shell+push)
(R/'release-p01r2.json').write_text(json.dumps({'release':'P01-R2','base':'3c1623992cfe7df3efa59ba15955f29eb4b336e5','assets':manifest,'push_sha256':hashlib.sha256(push.encode()).hexdigest()},indent=2))
print('Applied P01-R2; shell assets',len(manifest))

/* Pablicus Performance Pass P01 — network/media hot-path.
   Keeps private signed URLs in memory only, coalesces duplicate work, extends
   signed-media lifetime at request time, and lets the browser/CDN reuse one URL. */
(function(g){'use strict';if(g.PablicusPerformanceP01)return;
 const nativeFetch=g.fetch.bind(g),signMemo=new Map(),inflight=new Map();
 const stats={signHit:0,signMiss:0,coalesced:0,mediaHit:0,mediaMiss:0};
 const now=()=>Date.now(),SIGN_TTL=50*60*1000;
 function isSign(u){try{return /\/storage\/v1\/object\/sign\//.test(new URL(typeof u==='string'?u:u.url,location.href).pathname)}catch{return false}}
 function isMedia(u){try{const x=new URL(typeof u==='string'?u:u.url,location.href);return x.hostname.endsWith('.supabase.co')&&/\/storage\/v1\/object\/sign\//.test(x.pathname)&&x.searchParams.has('token')}catch{return false}}
 function authKey(h){try{const v=new Headers(h).get('authorization')||'';return v.slice(-32)}catch{return''}}
 function bodyText(body){return typeof body==='string'?body:''}
 async function cachedSign(input,init){
  let body=bodyText(init?.body),parsed=null;try{parsed=body?JSON.parse(body):null}catch{}
  if(parsed&&Number(parsed.expiresIn)<3600){parsed.expiresIn=3600;body=JSON.stringify(parsed);init={...init,body};}
  const key=(typeof input==='string'?input:input.url)+'|'+authKey(init?.headers||input?.headers)+'|'+body;
  const hit=signMemo.get(key);if(hit&&hit.until>now()){stats.signHit++;return new Response(hit.body,{status:hit.status,headers:hit.headers});}
  if(inflight.has(key)){stats.coalesced++;const saved=await inflight.get(key);return new Response(saved.body,{status:saved.status,headers:saved.headers});}
  stats.signMiss++;
  const job=(async()=>{const r=await nativeFetch(input,init);const text=await r.clone().text();const saved={body:text,status:r.status,headers:[...r.headers],until:now()+SIGN_TTL};if(r.ok)signMemo.set(key,saved);return saved})();
  inflight.set(key,job);try{const saved=await job;return new Response(saved.body,{status:saved.status,headers:saved.headers});}finally{inflight.delete(key)}
 }
 async function mediaFetch(input,init){
  const request=new Request(input,init);if(request.method!=='GET')return nativeFetch(input,init);
  const key=request.url;if(inflight.has(key)){stats.coalesced++;return (await inflight.get(key)).clone();}
  const job=(async()=>{if('caches'in g){try{const c=await caches.open('pablicus-media-p01');const hit=await c.match(request);if(hit){stats.mediaHit++;return hit}stats.mediaMiss++;const r=await nativeFetch(request);if(r.ok&&(/image\//.test(r.headers.get('content-type')||'')||/video\//.test(r.headers.get('content-type')||'')))c.put(request,r.clone()).catch(()=>{});return r}catch{}}
   return nativeFetch(request)})();inflight.set(key,job);try{return (await job).clone()}finally{inflight.delete(key)}
 }
 g.fetch=function(input,init){if(isSign(input)&&String(init?.method||input?.method||'GET').toUpperCase()==='POST')return cachedSign(input,init);if(isMedia(input))return mediaFetch(input,init);return nativeFetch(input,init)};
 function tuneImage(img){if(!(img instanceof HTMLImageElement))return;img.decoding='async';if(!img.hasAttribute('loading'))img.loading='lazy';}
 const mo=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes){if(n.nodeType!==1)continue;tuneImage(n);n.querySelectorAll?.('img').forEach(tuneImage);}});if(document.documentElement)mo.observe(document.documentElement,{subtree:true,childList:true});
 g.PablicusPerformanceP01=Object.freeze({version:'P01',stats,clear(){signMemo.clear();inflight.clear();caches?.delete?.('pablicus-media-p01').catch(()=>{});}});
})(window);
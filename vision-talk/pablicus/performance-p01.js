/* Pablicus Performance Pass P01 — network/media hot-path. */
(function(g){'use strict';if(g.PablicusPerformanceP01)return;
 const nativeFetch=g.fetch.bind(g),signMemo=new Map(),inflight=new Map();
 const stats={signHit:0,signMiss:0,coalesced:0,mediaHit:0,mediaMiss:0};
 const now=()=>Date.now(),SIGN_TTL=50*60*1000;
 function urlOf(u){return typeof u==='string'?u:u?.url||String(u)}
 function isSign(u){try{return /\/storage\/v1\/object\/sign\//.test(new URL(urlOf(u),location.href).pathname)}catch{return false}}
 function isMedia(u){try{const x=new URL(urlOf(u),location.href);return x.hostname.endsWith('.supabase.co')&&/\/storage\/v1\/object\/sign\//.test(x.pathname)&&x.searchParams.has('token')}catch{return false}}
 function authKey(h){try{return(new Headers(h).get('authorization')||'').slice(-32)}catch{return''}}
 async function cachedSign(input,init){let body=typeof init?.body==='string'?init.body:'',parsed=null;try{parsed=body?JSON.parse(body):null}catch{}
  if(parsed&&Number(parsed.expiresIn)<3600){parsed.expiresIn=3600;body=JSON.stringify(parsed);init={...init,body};}
  const key=urlOf(input)+'|'+authKey(init?.headers||input?.headers)+'|'+body,hit=signMemo.get(key);
  if(hit&&hit.until>now()){stats.signHit++;return new Response(hit.body,{status:hit.status,headers:hit.headers});}
  if(inflight.has(key)){stats.coalesced++;const saved=await inflight.get(key);return new Response(saved.body,{status:saved.status,headers:saved.headers});}
  stats.signMiss++;const job=(async()=>{const r=await nativeFetch(input,init),text=await r.clone().text(),saved={body:text,status:r.status,headers:[...r.headers],until:now()+SIGN_TTL};if(r.ok)signMemo.set(key,saved);return saved})();inflight.set(key,job);
  try{const saved=await job;return new Response(saved.body,{status:saved.status,headers:saved.headers});}finally{inflight.delete(key)}}
 async function mediaFetch(input,init){const request=new Request(input,init);if(request.method!=='GET')return nativeFetch(input,init);const key=request.url;if(inflight.has(key)){stats.coalesced++;return(await inflight.get(key)).clone();}
  const job=(async()=>{if('caches'in g)try{const c=await g.caches.open('pablicus-media-p01'),hit=await c.match(request);if(hit){stats.mediaHit++;return hit}stats.mediaMiss++;const r=await nativeFetch(request),type=r.headers.get('content-type')||'';if(r.ok&&(/image\//.test(type)||/video\//.test(type)))c.put(request,r.clone()).catch(()=>{});return r}catch{}return nativeFetch(request)})();inflight.set(key,job);try{return(await job).clone()}finally{inflight.delete(key)}}
 g.fetch=function(input,init){const method=String(init?.method||input?.method||'GET').toUpperCase();if(isSign(input)&&method==='POST')return cachedSign(input,init);if(isMedia(input)&&method==='GET')return mediaFetch(input,init);return nativeFetch(input,init)};
 function tune(img){if(!(img instanceof HTMLImageElement))return;img.decoding='async';if((img.closest('.richMessage')||img.classList.contains('messageImage'))&&!img.hasAttribute('loading'))img.loading='lazy';}
 const mo=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes){if(n.nodeType!==1)continue;tune(n);n.querySelectorAll?.('img').forEach(tune);}});if(document.documentElement)mo.observe(document.documentElement,{subtree:true,childList:true});
 g.addEventListener('pagehide',()=>{inflight.clear()},{passive:true});
 g.PablicusPerformanceP01=Object.freeze({version:'P01',stats,clear(){signMemo.clear();inflight.clear();if('caches'in g)g.caches.delete('pablicus-media-p01').catch(()=>{});}});
})(window);
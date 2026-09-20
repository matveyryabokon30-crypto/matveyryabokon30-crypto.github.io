// Preview has an isolated scope. Cache immutable shell as one release; no API/private responses.
const BUILD='2026.09.20-ui.1';
const BASE=new URL('./',self.location.href);
const CACHE='sekkes-ui-preview-'+BUILD;
const FILES=['./','index.html','assets/ui/boot.mjs','assets/ui/app.mjs','assets/ui/app.css','assets/ui/tokens.css','assets/ui/components.mjs','assets/ui/registry.mjs','assets/ui/preferences.mjs','assets/ui/rich-message.mjs','assets/ui/product-adapters.mjs',...['home','chat','settings','profile','games','world'].map(x=>'assets/ui/screens/'+x+'.mjs'),'assets/voice-s3-0.mjs?v=2026.09.20-ui.1',...['voice-finalize','voice-identity','preferences','voice-picker','s3-api','preview-player','registry-foundation'].map(x=>'assets/'+x+'.mjs?v=2026.09.20-s3.28')].map(x=>new URL(x,BASE).href);
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);const responses=await Promise.all(FILES.map(async url=>{const r=await fetch(url,{cache:'reload'});if(!r.ok)throw Error('Incomplete shell');return [url,r]}));await Promise.all(responses.map(([url,r])=>cache.put(url,r)));})()));
// No skipWaiting, clients.claim or origin-wide deletion. A live page keeps its release.
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!FILES.includes(e.request.url))return;e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));});

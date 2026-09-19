/* CacheStorage is origin-wide. Never delete caches belonging to Pablicus or another app. */
'use strict';
const BUILD = '2026.09.19-s3.24';
const PREFIX = 'sekkes-v2-';
const CACHE = PREFIX + BUILD;
const BASE = new URL('./', self.location.href);
const SHELL = ['./', 'index.html', 'assets/ui-s1-1.css', 'assets/ui-s2-3.js','assets/voice-s3-0.mjs','assets/voice-s3-0.css','assets/s3-api.mjs', 'manifest.webmanifest'].map(p => new URL(p, BASE).href);
const ownPath = url => url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of SHELL) {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error('Incomplete SEKKES shell');
      await cache.put(path, response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith(PREFIX) && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    clients.filter(c => ownPath(new URL(c.url))).forEach(c => c.postMessage({ app: 'sekkes-v2', type: 'VERSION_READY', version: BUILD }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || !ownPath(url)) return;
  if (['version.json','s2-config.json'].some(p=>url.pathname===new URL(p,BASE).pathname)) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => new Response('', { status: 503 })));
    return;
  }
  // Explicit allowlist: no conversations, arbitrary API results, or other apps are cached.
  const clean = new URL(url); clean.search = ''; clean.hash = '';
  const key = request.mode === 'navigate' && [BASE.pathname, new URL('index.html', BASE).pathname].includes(url.pathname) ? BASE.href : clean.href;
  if (!SHELL.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (response.ok) { event.waitUntil(cache.put(key, response.clone()).catch(() => {})); return response; }
      return (await cache.match(key)) || response;
    } catch {
      return (await cache.match(key)) || new Response('SEKKES: нет соединения. Откройте приложение после восстановления сети.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});


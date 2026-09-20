"""Build/check a coherent Pablicus release. No network, credentials or data writes."""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


def digest(data):
    return hashlib.sha256(data).hexdigest()


def local_file(root, name):
    url = urlsplit(name)
    if url.scheme or url.netloc or url.path.startswith('/') or url.fragment:
        raise ValueError('Non-local asset: ' + name)
    path = root / ('index.html' if name == './' else unquote(url.path))
    if not path.resolve().is_relative_to(root.resolve()) or not path.is_file() or path.is_symlink():
        raise ValueError('Missing/unsafe asset: ' + name)
    return path


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script':
            ref = a.get('src')
        elif tag == 'link' and a.get('rel') in {'stylesheet', 'manifest', 'preload', 'icon', 'apple-touch-icon'}:
            ref = a.get('href')
        else:
            return
        if ref and not urlsplit(ref).scheme and not urlsplit(ref).netloc:
            self.paths.add(ref)


def referenced(root, html):
    parser = Links()
    parser.feed(html)
    manifest = json.loads((root / 'manifest.webmanifest').read_text())
    return parser.paths | {i['src'] for i in manifest['icons']}


def push_digest(sw):
    # The existing push/account/task handlers are outside this release-only change.
    return digest(sw[sw.index('const PUSH_UUID='):].encode())


def build(root, sha):
    if not re.fullmatch('[a-f0-9]{40}', sha):
        raise ValueError('Expected full input Git SHA')
    identity = 'git:' + sha
    worker_version = 'pablicus-shell-' + sha
    html = (root / 'index.html').read_text()
    html, n = re.subn(r'<meta name="pablicus-release" content="[^"]*">',
                      '<meta name="pablicus-release" content="' + identity + '">', html)
    if n != 1:
        raise ValueError('Expected exactly one release meta tag')
    html, count = re.subn(r'(<p\b[^>]*\bid="releaseLabel"[^>]*>)[^<]*(</p>)',
                          lambda m: m.group(1) + 'UI-H5 · ' + sha[:12] + m.group(2), html, count=1)
    if count != 1:
        raise ValueError('Expected one visible release label')
    script = '<script src="release-info.js"></script>'
    if script not in html:
        html = html.replace('</head>', script + '</head>', 1)
    (root / 'index.html').write_text(html)
    info = """/* Generated build identity. Contains no user identifiers or credentials. */
(function(g){'use strict';
 const id=IDENTITY,sourceSha=SOURCE;
 async function inspect(){
  let worker=null;
  const controller=navigator.serviceWorker?.controller;
  if(controller)worker=await new Promise(resolve=>{
   const ch=new MessageChannel();let done=false;
   const finish=v=>{if(done)return;done=true;clearTimeout(timer);ch.port1.close();ch.port2.close();resolve(v);};
   const timer=setTimeout(()=>finish(null),2000);
   ch.port1.onmessage=e=>finish(e.data);
   try{controller.postMessage({type:'PABLICUS_RELEASE'},[ch.port2]);}catch{finish(null);}
  });
  return {buildId:id,sourceSha,stage:'UI-H5',htmlBuildId:document.querySelector('meta[name="pablicus-release"]')?.content||null,workerBuildId:worker?.buildId||null,workerVersion:worker?.version||null,coherent:worker?.buildId===id,notificationPermission:g.Notification?.permission||'unsupported',standalone:!!(g.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)};
 }
 g.PablicusBuild=Object.freeze({id,sourceSha,stage:'UI-H5',inspect});
})(window);
""".replace('IDENTITY', json.dumps(identity)).replace('SOURCE', json.dumps(sha))
    (root / 'release-info.js').write_text(info)
    old = json.loads((root / 'release-p01r2.json').read_text())
    names = set(old['assets']) | referenced(root, html) | {'./', 'index.html', 'release-info.js'}
    # Manifests/SW cannot be part of their own hash graph.
    if names & {'sw.js', 'release.json', 'release-p01r2.json'}:
        raise ValueError('Circular release inventory')
    assets = {n: digest(local_file(root, n).read_bytes()) for n in sorted(names)}
    sw = (root / 'sw.js').read_text()
    original_push = push_digest(sw)
    sw, n = re.subn(r"const VERSION='[^']+';", "const VERSION='" + worker_version + "';", sw, count=1)
    if n != 1:
        raise ValueError('Worker version declaration not found')
    sw = re.sub(r'const BUILD_ID=.*?;\n', '', sw)
    sw = re.sub(r'const BUILD_SOURCE_SHA=.*?;\n', '', sw)
    sw = sw.replace('const ASSETS=', 'const BUILD_ID=' + json.dumps(identity) + ';\nconst BUILD_SOURCE_SHA=' + json.dumps(sha) + ';\nconst ASSETS=', 1)
    sw, n = re.subn(r'const ASSETS=.*?;\n', lambda _: 'const ASSETS=' + json.dumps(assets, separators=(',', ':')) + ';\n', sw, count=1)
    if n != 1:
        raise ValueError('Worker inventory declaration not found')
    sw = sw.replace('postMessage({version:VERSION})', 'postMessage({version:VERSION,buildId:BUILD_ID,sourceSha:BUILD_SOURCE_SHA})')
    cache_diagnostic = """/* BUILD_CACHE_DIAGNOSTIC_START */
self.addEventListener('message',event=>{if(event.data?.type!=='PABLICUS_RELEASE_CACHE')return;
 event.waitUntil((async()=>{const names=await caches.keys(),present=names.includes(VERSION);
 const cache=present?await caches.open(VERSION):null,urls=new Set();
 if(cache)for(const url of allowed.keys()){const response=await cache.match(url);if(response){urls.add(url);await response.body?.cancel();}}
 event.ports?.[0]?.postMessage({version:VERSION,buildId:BUILD_ID,present,cacheEntries:urls.size,missing:[...allowed.keys()].filter(u=>!urls.has(u)),shellCaches:names.filter(n=>n.startsWith('pablicus-shell-')),error:null});
 })().catch(()=>event.ports?.[0]?.postMessage({version:VERSION,error:'CACHE_READ_FAILED'})));
});
/* BUILD_CACHE_DIAGNOSTIC_END */
"""
    sw = re.sub(r'/\* BUILD_CACHE_DIAGNOSTIC_START \*/.*?/\* BUILD_CACHE_DIAGNOSTIC_END \*/\n', '', sw, flags=re.S)
    marker = "self.addEventListener('activate',"
    if marker not in sw:
        raise ValueError('Activation handler missing')
    sw = sw.replace(marker, cache_diagnostic + marker, 1)
    if 'buildId:BUILD_ID,sourceSha:BUILD_SOURCE_SHA' not in sw or push_digest(sw) != original_push:
        raise ValueError('Worker identity/push preservation failed')
    (root / 'sw.js').write_text(sw)
    release = dict(schema=1, release='UI-H5', build_id=identity, source_sha=sha,
                   worker_version=worker_version, assets=assets, sw_sha256=digest(sw.encode()),
                   push_sha256=original_push)
    text = json.dumps(release, ensure_ascii=False, indent=2) + '\n'
    (root / 'release.json').write_text(text)
    (root / 'release-p01r2.json').write_text(text)
    return check(root)


def check(root):
    m = json.loads((root / 'release.json').read_text())
    if m != json.loads((root / 'release-p01r2.json').read_text()):
        raise ValueError('Release manifest aliases diverge')
    if m['build_id'] != 'git:' + m['source_sha'] or not re.fullmatch('[a-f0-9]{40}', m['source_sha']):
        raise ValueError('Invalid release identity')
    sw = (root / 'sw.js').read_text()
    embedded = json.loads(re.search(r'const ASSETS=(.*?);\n', sw).group(1))
    if embedded != m['assets']:
        raise ValueError('Worker inventory diverges')
    mismatches = [n for n, h in m['assets'].items() if digest(local_file(root, n).read_bytes()) != h]
    if mismatches:
        raise ValueError('Asset integrity mismatch: ' + ', '.join(mismatches))
    if digest(sw.encode()) != m['sw_sha256'] or push_digest(sw) != m['push_sha256']:
        raise ValueError('Worker/push integrity mismatch')
    html = (root / 'index.html').read_text()
    if not referenced(root, html).issubset(m['assets']):
        raise ValueError('Referenced resources missing from inventory')
    if ('UI-H5 · ' + m['source_sha'][:12]) not in html:
        raise ValueError('Visible release label diverges')
    if f'content="{m["build_id"]}"' not in html or json.dumps(m['build_id']) not in (root / 'release-info.js').read_text():
        raise ValueError('HTML/diagnostic build identity diverges')
    if f"const VERSION='{m['worker_version']}';" not in sw or 'const BUILD_ID=' + json.dumps(m['build_id']) + ';' not in sw:
        raise ValueError('Worker identity diverges')
    return {'build_id': m['build_id'], 'assets': len(m['assets']), 'integrity': 'PASS'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--root', type=Path, default=Path('vision-talk/pablicus'))
    p.add_argument('--source-sha')
    p.add_argument('--check', action='store_true')
    a = p.parse_args()
    print(json.dumps(check(a.root) if a.check else build(a.root, a.source_sha or ''), indent=2))

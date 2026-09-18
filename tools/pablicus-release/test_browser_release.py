"""Real SW upgrade, rejected mixed release, IDB preservation; synthetic origin only."""
import argparse
import http.server
import json
import pathlib
import threading
import traceback
import urllib.parse
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--baseline', required=True)
p.add_argument('--engine', choices=['chromium', 'webkit'], required=True)
a = p.parse_args()
root = pathlib.Path(a.root).resolve()
baseline = pathlib.Path(a.baseline).resolve()
out = pathlib.Path('results');out.mkdir(exist_ok=True)
m = json.loads((root / 'release.json').read_text())
state = {'current': baseline, 'corrupt': False}
probe = '''<!doctype html><meta charset="utf-8"><input id="draft"><div id="updateNotice" hidden></div>
<script>sessionStorage.loads=String(+(sessionStorage.loads||0)+1);window.PablicusUpdateGuards={busy:()=>sessionStorage.busy==='1',prepare:async()=>{sessionStorage.prepared=String(+(sessionStorage.prepared||0)+1);}};</script><script src="auto-update.js"></script>'''


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.directory = str(state['current'])
        path = urllib.parse.urlsplit(self.path).path
        if path == '/probe.html':
            text, mime = probe, 'text/html'
        elif path == '/sw.js' and state['corrupt']:
            text = (root / 'sw.js').read_text().replace(m['worker_version'], m['worker_version'] + '-broken', 1)
            mime = 'text/javascript'
        elif path == '/media-cache.js' and state['corrupt']:
            text, mime = (root / 'media-cache.js').read_text() + '\n/* corruption probe */', 'text/javascript'
        else:
            return super().do_GET()
        b = text.encode();self.send_response(200)
        self.send_header('Content-Type', mime);self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(b)));self.end_headers();self.wfile.write(b)


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
checks = []


def record(name, passed, details=None):
    checks.append(dict(name=name, passed=bool(passed), details=details))
    print(('PASS ' if passed else 'FAIL ') + name, details or '', flush=True)
    if not passed:
        raise AssertionError(name)


with sync_playwright() as pw:
    browser = getattr(pw, a.engine).launch(headless=True)
    ctx = browser.new_context();page = ctx.new_page()
    ctx.route('https://ctcoqgsztdtsazdiwcmd.supabase.co/**', lambda r: r.fulfill(status=401, content_type='application/json', body='{"message":"No test account"}'))

    def version():
        return page.evaluate("""()=>new Promise(resolve=>{const ch=new MessageChannel();const t=setTimeout(()=>{ch.port1.close();resolve(null)},3000);ch.port1.onmessage=e=>{clearTimeout(t);ch.port1.close();resolve(e.data.version)};navigator.serviceWorker.controller.postMessage({type:'PABLICUS_RELEASE'},[ch.port2]);})""")

    try:
        page.goto(origin + '/probe.html');page.wait_for_function('navigator.serviceWorker.controller', timeout=60000);page.wait_for_timeout(6500)
        initial = version()
        record('previous production worker controls fixture', initial == 'pablicus-shell-f01-20260918', initial)
        page.evaluate("""async()=>{sessionStorage.busy='1';localStorage.setItem('r0-sentinel','keep');await new Promise((resolve,reject)=>{const o=indexedDB.open('r0-fixture',1);o.onupgradeneeded=()=>o.result.createObjectStore('blobs');o.onsuccess=()=>{const db=o.result,t=db.transaction('blobs','readwrite');t.objectStore('blobs').put(new Blob(['draft-original-bytes']),'draft');t.oncomplete=()=>{db.close();resolve()};t.onerror=reject;};});await new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=()=>{ch.port1.close();resolve()};navigator.serviceWorker.controller.postMessage({type:'PABLICUS_PUSH_BIND',recipientId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},[ch.port2]);});}""")
        loads = page.evaluate('Number(sessionStorage.loads)')
        state['current'] = root
        page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
        page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)', timeout=60000)
        page.wait_for_timeout(4000)
        record('busy draft prevents update reload', version() == initial and page.evaluate('Number(sessionStorage.loads)') == loads)
        page.evaluate("sessionStorage.removeItem('busy');document.activeElement?.blur()")
        page.wait_for_function('(n)=>Number(sessionStorage.loads)>n', arg=loads, timeout=30000)
        page.wait_for_timeout(1500)
        record('actual candidate activates automatically when safe', version() == m['worker_version'])
        record('exactly one controlled reload', page.evaluate('Number(sessionStorage.loads)') == loads + 1)
        record('prepare guard executed', page.evaluate('Number(sessionStorage.prepared)') > 0)
        record('local storage preserved', page.evaluate("localStorage.getItem('r0-sentinel')") == 'keep')
        preserved = page.evaluate("""async()=>{async function get(name,store,key){return new Promise((resolve,reject)=>{const o=indexedDB.open(name);o.onsuccess=()=>{const db=o.result,r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>{const v=r.result;db.close();resolve(v)};r.onerror=reject;};});}return {draft:await (await get('r0-fixture','blobs','draft')).text(),owner:await get('pablicus-push-state','settings','recipient')};}""")
        record('IndexedDB original Blob survives', preserved['draft'] == 'draft-original-bytes')
        record('push account binding survives worker upgrade', preserved['owner'] == 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        installed = page.evaluate('(v)=>caches.open(v).then(c=>c.keys()).then(a=>a.length)', m['worker_version'])
        record('all versioned icon and shell assets cached', installed == len(m['assets']), installed)
        state['corrupt'] = True
        page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())');page.wait_for_timeout(8500)
        record('corrupt candidate cannot replace good release', version() == m['worker_version'])
        record('failed partial cache removed', m['worker_version'] + '-broken' not in page.evaluate('caches.keys()'))
        state['corrupt'] = False
        errors = [];page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script('window.initialNativeFetch=window.fetch;')
        page.goto(origin + '/', wait_until='domcontentloaded')
        page.wait_for_function('window.PablicusDebug && window.PablicusBuild', timeout=45000)
        status = page.evaluate('PablicusBuild.inspect()')
        record('HTML, diagnostics and active worker share one build', status['coherent'] and status['buildId'] == status['htmlBuildId'] == m['build_id'], status)
        record('legacy P06 feature contract remains', page.evaluate('PablicusDebug.version') == 'P06')
        record('native fetch preserved', page.evaluate('fetch===initialNativeFetch'))
        record('manual update banner remains hidden', page.locator('#updateNotice').is_hidden())
        record('real app boot has no JavaScript exceptions', not errors, errors)
        page.screenshot(path=str(out / (a.engine + '-r0-boot.png')))
    except Exception as exc:
        checks.append(dict(name='browser completion', passed=False, details=str(exc), traceback=traceback.format_exc()))
        page.screenshot(path=str(out / (a.engine + '-r0-failure.png')))
        print(traceback.format_exc())
    finally:
        result = dict(engine=a.engine, build_id=m['build_id'], passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks), checks=checks, boundary='Synthetic browser origin, no real users or push delivery. Not physical iPhone acceptance.')
        (out / (a.engine + '-r0.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2))
        browser.close();server.shutdown()
if result['failed']:
    raise SystemExit(1)

"""Two real installed service-worker releases, cached launches and preserved local data.
Loopback HTTP only. No production accounts, messages, push consent or subscriptions.
"""
import argparse,hashlib,http.server,json,pathlib,shutil,sys,tempfile,threading,traceback,urllib.parse
from playwright.sync_api import sync_playwright
from build_release import build
p=argparse.ArgumentParser();p.add_argument('--root',default='vision-talk/pablicus');p.add_argument('--baseline',default='update-baseline/vision-talk/pablicus');p.add_argument('--engine',required=True);a=p.parse_args()
r=pathlib.Path(a.root).resolve();old=pathlib.Path(a.baseline).resolve();out=pathlib.Path('results');out.mkdir(exist_ok=True)
checks=[];errors=[];requests=[];state={'root':old,'offline':False}
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=urllib.parse.unquote(urllib.parse.urlsplit(self.path).path);requests.append(path)
  if state['offline']:self.send_error(503);return
  if not path.startswith('/app/'):self.send_error(404);return
  target=state['root']/(path[5:] or 'index.html')
  if not target.is_file() or not target.resolve().is_relative_to(state['root']):self.send_error(404);return
  data=target.read_bytes();self.send_response(200);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
  self.send_header('Content-Type',{'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.webmanifest':'application/manifest+json'}.get(target.suffix,'application/octet-stream'));self.end_headers()
  try:self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_POST(self):self.send_error(405)
def check(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail));print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';url=origin+'/app/'
ids={'old':json.loads((old/'release.json').read_text())['build_id'],'new':json.loads((r/'release.json').read_text())['build_id'],'next':'git:'+'b'*40}
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 future=pathlib.Path(tmp)/'future';shutil.copytree(r,future);build(future,'b'*40)
 browser=getattr(pw,a.engine).launch(headless=True);ctx=browser.new_context(viewport={'width':390,'height':844});ctx.route('**/*',lambda q:q.continue_() if q.request.url.startswith((origin+'/', 'data:', 'blob:')) else q.abort())
 page=ctx.new_page();navigations=[];page.on('framenavigated',lambda frame:navigations.append(frame.url) if frame==page.main_frame else None);page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto(url);page.wait_for_function('window.PablicusUpdateGuards&&window.PablicusChat&&navigator.serviceWorker.controller',timeout=30000);page.wait_for_timeout(4500)
  check('published baseline installed with actual service worker',page.evaluate('PablicusBuild.id')==ids['old'])
  check('registration bypasses HTTP cache',page.evaluate('async()=> (await navigator.serviceWorker.getRegistration()).updateViaCache')=='none')
  # Local account-scoped store and file bytes, not fabricated backend messages.
  page.evaluate('''async()=>{window.fixtureOwner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.fixtureChat='cccccccc-cccc-4ccc-8ccc-cccccccccccc';await PablicusChat.open(fixtureOwner,fixtureChat,[]);await PablicusChat.fillDraft('Черновик переживает обновление');await PablicusChat.flush();localStorage.setItem('update-fixture-session','preserve');const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('update-fixture-bytes',1);q.onupgradeneeded=()=>q.result.createObjectStore('files');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(new Blob(['original-file-bytes']),'photo');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();document.activeElement.blur();}''')
  # Return to a cached old app after publishing the new assets. No update click.
  state['root']=r;before=len(navigations);page.reload();page.wait_for_function('(id)=>window.PablicusBuild?.id===id',arg=ids['new'],timeout=35000);page.wait_for_timeout(1600)
  check('cached old launch automatically reaches new release without clicks',page.evaluate('PablicusBuild.id')==ids['new'])
  check('new UI has no manual update banner or button',page.locator('#updateNotice,#applyUpdate').count()==0)
  check('updated HTML and active worker identities agree',page.evaluate('async()=> (await PablicusBuild.inspect()).coherent'))
  check('local session state survives update',page.evaluate('localStorage.getItem("update-fixture-session")')=='preserve')
  saved=page.evaluate('''async()=>{const s=new PablicusRichStore('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc');try{return (await s.read()).text}finally{s.close()}}''')
  check('real scoped draft survives automatic page replacement',saved=='Черновик переживает обновление',saved)
  check('original file bytes survive automatic update',page.evaluate('''async()=>{const db=await new Promise(resolve=>{const q=indexedDB.open('update-fixture-bytes',1);q.onsuccess=()=>resolve(q.result)});const blob=await new Promise(resolve=>{const q=db.transaction('files').objectStore('files').get('photo');q.onsuccess=()=>resolve(q.result)});db.close();return await blob.text()}''')=='original-file-bytes')
  same=len(navigations);page.wait_for_timeout(4400);check('same-version startup does not enter a reload loop',len(navigations)==same)
  # Existing client returns less than 30s after its previous check. A busy call
  # blocks activation; the guard releases it without a user update action.
  page.evaluate('window.originalCallGuard=window.PablicusCallsActive;window.fixtureCall=true;PablicusCallsActive=()=>fixtureCall');state['root']=future
  page.evaluate('window.dispatchEvent(new Event("pageshow"))');page.wait_for_function('async()=>!!(await navigator.serviceWorker.getRegistration()).waiting',timeout=30000)
  page.wait_for_timeout(2800);check('newly downloaded release does not interrupt active call',page.evaluate('PablicusBuild.id')==ids['new'])
  check('foreground check bypasses old periodic cooldown',requests.count('/app/sw.js')>=3)
  page.evaluate('fixtureCall=false');page.wait_for_function('(id)=>window.PablicusBuild?.id===id',arg=ids['next'],timeout=20000)
  check('release applies automatically when active work ends',page.evaluate('PablicusBuild.id')==ids['next'])
  page.wait_for_function('async()=> (await PablicusBuild.inspect()).coherent',timeout=15000)
  check('future-release upgrade has coherent worker and page',page.evaluate('async()=> (await PablicusBuild.inspect()).coherent'))
  same=len(navigations);page.wait_for_timeout(4000);check('future release also stays stable without repeated reloads',len(navigations)==same)
  # Independently installed client has exactly the same automatic policy.
  other=browser.new_context();other.route('**/*',lambda q:q.continue_() if q.request.url.startswith((origin+'/', 'data:', 'blob:')) else q.abort());second=other.new_page();second.goto(url);second.wait_for_function('(id)=>window.PablicusBuild?.id===id&&navigator.serviceWorker.controller',arg=ids['next'],timeout=30000)
  check('new independent client receives current version without a button',second.locator('#applyUpdate').count()==0 and second.evaluate('PablicusBuild.id')==ids['next']);other.close()
  state['offline']=True;page.reload();page.wait_for_function('(id)=>window.PablicusBuild?.id===id',arg=ids['next'],timeout=15000)
  check('offline launch retains last complete installed version',page.evaluate('PablicusBuild.id')==ids['next']);check('offline launch retains session state',page.evaluate('localStorage.getItem("update-fixture-session")')=='preserve')
  state['offline']=False;page.evaluate('window.dispatchEvent(new Event("online"))');page.wait_for_timeout(2200)
  check('returning online does not downgrade or require interaction',page.evaluate('PablicusBuild.id')==ids['next'])
  page.screenshot(path=str(out/('auto-native-'+a.engine+'.png')))
  check('no application JavaScript errors',not errors,errors)
 except Exception as e:
  checks.append(dict(name='suite completion',passed=False,detail=str(e),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/('auto-native-'+a.engine+'-failure.png')))
 finally:
  result=dict(engine=a.engine,passed=sum(c['passed'] for c in checks),failed=sum(not c['passed'] for c in checks),checks=checks,navigations=navigations,source_sha256={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['auto-update.js','index.html','sw.js']},boundary='Actual browser SW/Cache Storage and IndexedDB on local HTTP, no physical iPhone or production user identity.')
  (out/('auto-native-'+a.engine+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close();server.shutdown();server.server_close()
if result['failed']:raise SystemExit(1)

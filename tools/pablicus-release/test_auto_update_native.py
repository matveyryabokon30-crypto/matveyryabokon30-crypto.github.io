"""Two real installed service-worker releases, cached launches and preserved local data.
Loopback HTTP only. No production accounts, messages, push consent or subscriptions.
"""
import argparse,hashlib,http.server,json,pathlib,shutil,sys,tempfile,threading,traceback,urllib.parse,urllib.request,time
from playwright.sync_api import sync_playwright
from build_release import build
p=argparse.ArgumentParser();p.add_argument('--root',default='vision-talk/pablicus');p.add_argument('--baseline',default='update-baseline/vision-talk/pablicus');p.add_argument('--engine',required=True);a=p.parse_args()
r=pathlib.Path(a.root).resolve();old=pathlib.Path(a.baseline).resolve();out=pathlib.Path('results');out.mkdir(exist_ok=True)
checks=[];errors=[];console=[];diagnostic=None;requests=[];state={'root':old,'offline':False}
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=urllib.parse.unquote(urllib.parse.urlsplit(self.path).path);requests.append(path)
  if state['offline']:self.send_error(503);return
  if not path.startswith('/app/'):self.send_error(404);return
  root=state['root'].resolve();target=root/(path[5:] or 'index.html')
  if not target.is_file() or not target.resolve().is_relative_to(root):self.send_error(404);return
  data=target.read_bytes();self.send_response(200);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
  self.send_header('Content-Type',{'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.webmanifest':'application/manifest+json'}.get(target.suffix,'application/octet-stream'));self.end_headers()
  try:self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_POST(self):self.send_error(405)
def check(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail));print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
def wait_async(page,expression,timeout=30000):
 deadline=time.monotonic()+timeout/1000
 while time.monotonic()<deadline:
  result=page.evaluate(expression)
  if result:return result
  page.wait_for_timeout(150)
 raise AssertionError('Asynchronous browser condition did not resolve: '+expression)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';url=origin+'/app/'
ids={'old':json.loads((old/'release.json').read_text())['build_id'],'new':json.loads((r/'release.json').read_text())['build_id'],'next':'git:'+'b'*40}
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 future=pathlib.Path(tmp)/'future';shutil.copytree(r,future);build(future,'b'*40)
 browser=getattr(pw,a.engine).launch(headless=True);ctx=browser.new_context(viewport={'width':390,'height':844});ctx.route('**/*',lambda q:q.continue_() if q.request.url.startswith((origin+'/', 'data:', 'blob:')) else q.abort())
 ctx.add_init_script("""(()=>{window.workerMessages=[];const native=ServiceWorker.prototype.postMessage;ServiceWorker.prototype.postMessage=function(...args){workerMessages.push({at:performance.now(),state:this.state,type:typeof args[0]==='string'?args[0]:args[0]?.type});return native.apply(this,args)};navigator.serviceWorker.addEventListener('controllerchange',()=>workerMessages.push({at:performance.now(),event:'controllerchange',state:navigator.serviceWorker.controller?.state}));})()""")
 page=ctx.new_page();page.on('console',lambda m:console.append({'type':m.type,'text':m.text}));navigations=[];page.on('framenavigated',lambda frame:navigations.append(frame.url) if frame==page.main_frame else None);page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto(url);page.wait_for_function('window.PablicusUpdateGuards&&window.PablicusChat&&navigator.serviceWorker.controller',timeout=30000);page.wait_for_timeout(4500)
  check('published baseline installed with actual service worker',page.evaluate('PablicusBuild.id')==ids['old'])
  check('registration bypasses HTTP cache',page.evaluate('async()=> (await navigator.serviceWorker.getRegistration()).updateViaCache')=='none')
  # Use the product's real scoped store for attachment bytes, including its
  # existing WebKit byte fallback; a bare fixture DB would bypass that path.
  seeded=page.evaluate('''async()=>{let stage='open';try{
   const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',chat='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
   await PablicusChat.open(user,chat,[]);stage='text';await PablicusChat.fillDraft('Черновик переживает обновление');
   stage='attachment';await PablicusChat.addFiles([new File(['original-file-bytes'],'fixture.txt',{type:'text/plain'})]);
   stage='flush';await PablicusChat.flush();stage='read';const saved=await PablicusChat.store.read();
   localStorage.setItem('update-fixture-session','preserve');document.activeElement.blur();
   return {text:saved.text,files:saved.files.length,bytes:await saved.files[0].file.text()};
  }catch(e){throw Error(stage+': '+(e?.name||'unknown')+' '+(e?.message||String(e)));}}''')
  check('actual product draft and file seeded before upgrade',seeded['files']==1 and seeded['bytes']=='original-file-bytes' and seeded['text'].strip()=='Черновик переживает обновление',seeded)
  # Return to a cached old app after publishing the new assets. No update click.
  state['root']=r;before=len(navigations);page.reload();page.wait_for_function('(id)=>window.PablicusBuild?.id===id',arg=ids['new'],timeout=35000);page.wait_for_timeout(1600)
  check('cached old launch automatically reaches new release without clicks',page.evaluate('PablicusBuild.id')==ids['new'])
  check('new UI has no manual update banner or button',page.locator('#updateNotice,#applyUpdate').count()==0)
  check('updated HTML and active worker identities agree',page.evaluate('async()=> (await PablicusBuild.inspect()).coherent'))
  check('local session state survives update',page.evaluate('localStorage.getItem("update-fixture-session")')=='preserve')
  saved=page.evaluate('''async()=>{const s=new PablicusRichStore('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc');try{const d=await s.read();return {text:d.text,files:d.files.length,bytes:await d.files[0].file.text()}}finally{s.close()}}''')
  check('real scoped draft survives automatic page replacement',saved['text']==seeded['text'],saved['text'])
  check('original product attachment bytes survive automatic update',saved['files']==1 and saved['bytes']==seeded['bytes'])
  same=len(navigations);page.wait_for_timeout(4400);check('same-version startup does not enter a reload loop',len(navigations)==same)
  # Existing client returns less than 30s after its previous check. A busy call
  # blocks activation; the guard releases it without a user update action.
  page.evaluate('window.originalCallGuard=window.PablicusCallsActive;window.fixtureCall=true;PablicusCallsActive=()=>fixtureCall');state['root']=future
  check('next-release fixture serves exact worker bytes',urllib.request.urlopen(origin+'/app/sw.js',timeout=5).read()==(future/'sw.js').read_bytes())
  page.evaluate('window.dispatchEvent(new Event("pageshow"))');wait_async(page,'async()=> (await navigator.serviceWorker.getRegistration())?.waiting?.state==="installed"')
  page.wait_for_timeout(2800);check('newly downloaded release does not interrupt active call',page.evaluate('PablicusBuild.id')==ids['new'])
  check('foreground check bypasses old periodic cooldown',requests.count('/app/sw.js')>=3)
  page.evaluate('fixtureCall=false');page.wait_for_function('(id)=>window.PablicusBuild?.id===id',arg=ids['next'],timeout=20000)
  check('release applies automatically when active work ends',page.evaluate('PablicusBuild.id')==ids['next'])
  wait_async(page,'async()=> (await PablicusBuild.inspect()).coherent',timeout=15000)
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
  try:diagnostic=page.evaluate("""async()=>{const r=await navigator.serviceWorker.getRegistration();return {ready:document.readyState,hidden:document.hidden,active:document.activeElement?.outerHTML?.slice(0,200),call:PablicusCallsActive?.(),busy:PablicusUpdateGuards?.busy(),build:await PablicusBuild?.inspect(),waiting:r?.waiting?.state,installing:r?.installing?.state,activeWorker:r?.active?.state,controller:navigator.serviceWorker.controller?.state,messages:window.workerMessages}}""");print('DIAGNOSTIC',json.dumps(diagnostic),flush=True)
  except Exception as detail:diagnostic=str(detail)
  checks.append(dict(name='suite completion',passed=False,detail=str(e),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/('auto-native-'+a.engine+'-failure.png')))
 finally:
  result=dict(engine=a.engine,passed=sum(c['passed'] for c in checks),failed=sum(not c['passed'] for c in checks),checks=checks,navigations=navigations,diagnostic=diagnostic,console=console,errors=errors,source_sha256={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['auto-update.js','index.html','sw.js']},boundary='Actual browser SW/Cache Storage and IndexedDB on local HTTP, no physical iPhone or production user identity.')
  (out/('auto-native-'+a.engine+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close();server.shutdown();server.server_close()
if result['failed']:raise SystemExit(1)

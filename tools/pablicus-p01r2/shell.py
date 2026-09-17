"""Isolated SW upgrade tests against the complete candidate. No production session."""
import argparse,http.server,json,pathlib,threading,urllib.parse,traceback
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser();P.add_argument('--root',required=True);P.add_argument('--engine',default='chromium');A=P.parse_args();R=pathlib.Path(A.root).resolve();OUT=pathlib.Path('results');OUT.mkdir(exist_ok=True)
release={'suffix':'','corrupt':False}
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(R),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  path=urllib.parse.urlparse(self.path).path
  if path=='/update-test.html':
   text='''<!doctype html><meta charset="utf-8"><input id="draft"><div id="updateNotice" hidden></div><script>sessionStorage.loads=String(+(sessionStorage.loads||0)+1);window.PablicusUpdateGuards={busy:()=>sessionStorage.busy==='1',prepare:async()=>{sessionStorage.prepared=String(+(sessionStorage.prepared||0)+1);}};</script><script src="auto-update.js"></script>''';mime='text/html'
  elif path=='/sw.js':text=(R/'sw.js').read_text().replace("pablicus-shell-p01r2-20260917","pablicus-shell-p01r2-20260917"+release['suffix'],1);mime='text/javascript'
  elif path=='/media-cache.js' and release['corrupt']:text=(R/'media-cache.js').read_text()+'\n/* simulate mixed deployment */';mime='text/javascript'
  else:return super().do_GET()
  body=text.encode();self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
checks=[]
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details or '',flush=True)
 if not ok:raise AssertionError(name)
with sync_playwright() as p:
 browser=getattr(p,A.engine).launch(headless=True);ctx=browser.new_context();page=ctx.new_page()
 def version():return page.evaluate("""()=>new Promise(resolve=>{if(!navigator.serviceWorker.controller){resolve(null);return;}const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data.version);navigator.serviceWorker.controller.postMessage({type:'PABLICUS_RELEASE'},[ch.port2]);setTimeout(()=>resolve('timeout'),2000);})""")
 try:
  page.goto(origin+'/update-test.html');page.wait_for_function('navigator.serviceWorker.controller',timeout=45000);page.wait_for_timeout(6500)
  initial=version();check('complete verified shell is installed',initial=='pablicus-shell-p01r2-20260917',initial)
  installed=page.evaluate("()=>caches.open('pablicus-shell-p01r2-20260917').then(c=>c.keys()).then(x=>x.length)")
  expected=len(json.loads((R/'release-p01r2.json').read_text())['assets']);check('all shell assets installed atomically',installed==expected,{'installed':installed,'expected':expected})
  page.evaluate("()=>{sessionStorage.busy='1';localStorage.setItem('p01r2-data-sentinel','keep');}");loads=page.evaluate('()=>+sessionStorage.loads')
  release['suffix']='-next';page.evaluate('()=>navigator.serviceWorker.getRegistration().then(r=>r.update())')
  page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)',timeout=45000);page.wait_for_timeout(4500)
  check('new release waits while upload or draft guard is busy',version()==initial and page.evaluate('()=>+sessionStorage.loads')==loads)
  page.evaluate("()=>{sessionStorage.removeItem('busy');document.activeElement?.blur();}");page.wait_for_timeout(6500)
  check('idle release activates and reloads automatically',version()==initial+'-next' and page.evaluate('()=>+sessionStorage.loads')==loads+1)
  check('draft preparation occurs before activation',page.evaluate('()=>+sessionStorage.prepared')>0)
  check('application data survives shell update',page.evaluate("()=>localStorage.getItem('p01r2-data-sentinel')")=='keep')
  release['suffix']='-broken';release['corrupt']=True
  page.evaluate('()=>navigator.serviceWorker.getRegistration().then(r=>r.update())');page.wait_for_timeout(8500)
  check('mismatched asset cannot replace the working release',version()==initial+'-next')
  names=page.evaluate('()=>caches.keys()');check('failed installation leaves no partial release cache',initial+'-broken' not in names,names)
  release['corrupt']=False;release['suffix']='-next'
  # Load the real index and all application modules, no injected production identity.
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  ctx.route('https://ctcoqgsztdtsazdiwcmd.supabase.co/**',lambda r:r.fulfill(status=401,content_type='application/json',body='{"message":"No test account"}'))
  page.add_init_script('window.initialNativeFetch=window.fetch;');page.goto(origin+'/');page.wait_for_timeout(4500)
  check('real application shell reaches the current release',page.evaluate("()=>window.PablicusDebug?.version")=='P01-R2')
  check('native fetch is not monkey patched',page.evaluate('()=>window.fetch===window.initialNativeFetch'))
  check('retired manual update banner stays hidden',page.locator('#updateNotice').is_hidden())
  check('real shell has no runtime exceptions',not errors,errors)
 except Exception as e:
  checks.append({'name':'shell test failure','pass':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc());page.screenshot(path=str(OUT/(A.engine+'-shell-failure.png')))
 finally:
  result={'engine':A.engine,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'fixture':'isolated HTTP origin, real candidate shell, synthetic upgrade only'}
  (OUT/(A.engine+'-shell.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close();server.shutdown()
if result['failed']:raise SystemExit(1)

"""Diagnostic only: synthetic local profiles, no production/user state or mutations."""
import http.server,json,pathlib,shutil,tempfile,threading,traceback,urllib.parse
from playwright.sync_api import sync_playwright

root=pathlib.Path('vision-talk/pablicus').resolve()
base=pathlib.Path('baseline/vision-talk/pablicus').resolve()
out=pathlib.Path('probe-results');out.mkdir(exist_ok=True)
manifest=json.loads((root/'release.json').read_text())
state={'dir':base,'offline':False}
DIAG='''
self.addEventListener('message',e=>{if(e.data?.type!=='R0_CACHE_PROBE')return;
 e.waitUntil((async()=>{let names=await caches.keys(),rows=[];for(const n of names){const c=await caches.open(n),keys=await c.keys();const r=await c.match(new URL('index.html',self.registration.scope).href);rows.push({name:n,count:keys.length,first:keys.slice(0,3).map(x=>x.url),indexMatch:!!r});}e.ports[0].postMessage({rows,scope:self.registration.scope});})().catch(x=>e.ports[0].postMessage({error:x.name+': '+x.message})));
});
'''
MINIMAL='''
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open('minimal-v1');await c.put(new URL('data',self.registration.scope),new Response('CONTROL'));await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.url.endsWith('/minimal/data'))e.respondWith(caches.open('minimal-v1').then(c=>c.match(e.request)).then(r=>r||new Response('MISS',{status:404})));});
'''+DIAG

class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  path=urllib.parse.urlsplit(self.path).path
  if state['offline']:
   self.send_response(503);self.send_header('Cache-Control','no-store');self.end_headers();return
  if path in ['/probe.html','/minimal/probe.html']:
   text='<!doctype html><meta charset="utf-8"><title>Isolated cache test</title>';mime='text/html'
  elif path=='/minimal/sw.js':text=MINIMAL;mime='text/javascript'
  elif path=='/sw.js':text=(state['dir']/'sw.js').read_text()+DIAG;mime='text/javascript'
  else:self.directory=str(state['dir']);return super().do_GET()
  data=text.encode();self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'

with sync_playwright() as pw:
 for engine in ['chromium','webkit']:
  report={'engine':engine,'disk_free':shutil.disk_usage('/tmp').free,'observations':[]}
  profile=tempfile.TemporaryDirectory(prefix='pablicus-cache-probe-')
  ctx=getattr(pw,engine).launch_persistent_context(profile.name,headless=True)
  page=ctx.new_page()
  def note(name,fn):
   try:value=fn()
   except Exception as e:value={'error':str(e)}
   report['observations'].append({'name':name,'value':value});print(engine,name,json.dumps(value),flush=True)
   return value
  def inspect(which='active',scope='./'):
   return page.evaluate('''async({which,scope})=>{const r=await navigator.serviceWorker.getRegistration(scope),w=r?.[which];if(!w)return {error:'no '+which};return new Promise(resolve=>{const c=new MessageChannel();const timer=setTimeout(()=>{c.port1.close();resolve({error:'probe timeout'})},5000);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data)};w.postMessage({type:'R0_CACHE_PROBE'},[c.port2]);});}''',{'which':which,'scope':scope})
  def window_cache():
   return page.evaluate('''async()=>{const rows=[];for(const n of await caches.keys()){const c=await caches.open(n),k=await c.keys(),r=await c.match('index.html'),control=await c.match('control');rows.push({name:n,count:k.length,indexMatch:!!r,control:control?await control.text():null});}return rows;}''')
  try:
   state['dir']=base;state['offline']=False
   page.goto(origin+'/probe.html')
   note('browser UA',lambda:page.evaluate('navigator.userAgent'))
   note('window control write',lambda:page.evaluate("caches.open('probe-window-control').then(c=>c.put('control',new Response('CONTROL'))).then(()=>true)"))
   note('window control read',window_cache)
   page.evaluate("navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'})")
   page.wait_for_function('navigator.serviceWorker.controller',timeout=60000)
   note('old F01 active immediately',inspect);page.wait_for_timeout(2000)
   note('old F01 active after settle',inspect);note('window after old activation',window_cache)
   state['dir']=root
   page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
   page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)',timeout=60000)
   note('candidate waiting before activation',lambda:inspect('waiting'))
   note('window while candidate waiting',window_cache)
   page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.waiting.postMessage('ACTIVATE'))")
   page.wait_for_function('(id)=>navigator.serviceWorker.getRegistration().then(r=>r.active && !r.waiting)',arg=manifest['build_id'],timeout=30000)
   page.wait_for_timeout(2000)
   note('candidate active no reload',inspect);note('window after candidate activation',window_cache)
   page.reload();page.wait_for_timeout(1500)
   note('candidate active after plain reload',inspect);note('window after reload',window_cache)
   state['offline']=True
   note('offline actual cache response',lambda:page.evaluate("fetch('media-cache.js',{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(async r=>({status:r.status,bytes:(await r.arrayBuffer()).byteLength})).catch(e=>({error:e.name}))"))
   state['offline']=False
   page.goto(origin+'/minimal/probe.html')
   page.evaluate("navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'})")
   page.wait_for_function("navigator.serviceWorker.getRegistration('./').then(r=>r?.active?.scriptURL.endsWith('/minimal/sw.js'))",timeout=20000)
   page.wait_for_timeout(1000)
   note('minimal worker cache',lambda:inspect('active','./'))
   note('minimal worker fetch',lambda:page.evaluate("fetch('data',{cache:'no-store'}).then(async r=>({status:r.status,text:await r.text()}))"))
   note('all caches after minimal worker',window_cache)
  except Exception as e:report['fatal']={'error':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc())
  finally:
   state['offline']=False
   (out/(engine+'.json')).write_text(json.dumps(report,indent=2))
   ctx.close();profile.cleanup()
server.shutdown()

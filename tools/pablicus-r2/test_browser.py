"""Actual HTTP origin, browser Web Locks, release SW and IDB. Synthetic PushManager/Auth/Edge."""
import argparse,http.server,json,pathlib,threading,traceback,urllib.parse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',choices=['chromium','webkit'],required=True);a=p.parse_args()
root=pathlib.Path(a.root).resolve();out=pathlib.Path('results');out.mkdir(exist_ok=True)
release=json.loads((root/'release.json').read_text());checks=[]
probe='<!doctype html><meta charset="utf-8"><title>R2 isolated lifecycle fixture</title><script src="push-notifications.js"></script>'
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
 def log_message(self,*args):pass
 def do_GET(self):
  if urllib.parse.urlsplit(self.path).path!='/r2-probe.html':return super().do_GET()
  data=probe.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def record(name,result):
 checks.append(dict(name=name,passed=bool(result)));print(('PASS 'if result else'FAIL ')+name,flush=True)
 if not result:raise AssertionError(name)
setup="""async(build)=>{
 window.A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.B='cccccccc-cccc-4ccc-8ccc-cccccccccccc';window.currentUser=A;
 window.PablicusBuild={id:build};localStorage.setItem('pablicus:push-owner',A);
 const deadline=(p)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('R2 worker activation deadline')),60000))]);const reg=await navigator.serviceWorker.register('sw.js');await deadline(navigator.serviceWorker.ready);
 await deadline(new Promise(resolve=>{if(navigator.serviceWorker.controller)return resolve();navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});}));
 window.realReg=reg;window.counts={subscribe:0,unsubscribe:0,permission:0};window.calls=[];
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);window.key=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
 window.publicKey=btoa(String.fromCharCode(...key)).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');
 window.makeSub=()=>({endpoint:'https://push.synthetic.invalid/'+crypto.randomUUID(),options:{applicationServerKey:key.buffer},toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'SYNTHETIC',auth:'SYNTHETIC'}}},async unsubscribe(){counts.unsubscribe++;if(window.subscription===this)window.subscription=null;return true;}});
 window.subscription=makeSub();Object.defineProperty(reg,'pushManager',{value:{async getSubscription(){return window.subscription;},async subscribe(opts){counts.subscribe++;if(window.subscribeGate)await window.subscribeGate;window.subscription=makeSub();return window.subscription;}}});
 navigator.serviceWorker.getRegistration=async()=>reg;
 Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted',async requestPermission(){counts.permission++;return'granted';}}});
 if(!window.PushManager)window.PushManager=function(){};
 const originalFetch=window.fetch;window.fetch=async(url,opts)=>{if(String(url)!==location.origin+'/functions/v1/pablicus-push')return originalFetch(url,opts);const body=opts.body?JSON.parse(opts.body):null;calls.push({method:opts.method,body});if(window.failConfig&&opts.method==='GET')throw new TypeError('synthetic config offline');return Response.json(opts.method==='GET'?{publicKey}:{ok:true,installation_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',tracking:'ready'});};
 window.makeClient=(health=false)=>PablicusPush.create({enableHealthTracking:health,projectUrl:location.origin,apiKey:'SYNTHETIC_PUBLIC',getUserId:()=>currentUser,getSession:async()=>({access_token:'SYNTHETIC_USER_JWT',user:{id:currentUser}})});window.client=makeClient();
 window.dbGet=async(name,store,key)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>{const db=r.result,q=db.transaction(store).objectStore(store).get(key);q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=reject;};r.onerror=reject;});
 return !!navigator.locks&&!!navigator.serviceWorker.controller;
}"""
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch(headless=True);ctx=browser.new_context();page=ctx.new_page();page.set_default_timeout(45000)
 try:
  page.goto(origin+'/r2-probe.html');record('actual release worker activates and native Web Locks available',page.evaluate(setup,release['build_id']))
  record('healthy endpoint reused with real worker binding',page.evaluate("async()=>{const old=subscription.endpoint;await client.refresh();return client.enabled&&subscription.endpoint===old&&counts.subscribe===0&&await dbGet('pablicus-push-state','settings','recipient')===A;}"))
  record('lifecycle burst remains idempotent',page.evaluate("async()=>{const n=calls.length;for(let i=0;i<15;i++){window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));}await client.refresh();return calls.length===n&&counts.subscribe===0;}"))
  record('lost subscription repairs after session restoration',page.evaluate("async()=>{client.destroy();window.subscription=null;client=makeClient();await client.sessionRestored();return client.enabled&&counts.subscribe===1&&counts.permission===0;}"))
  record('real native lock excludes concurrent client subscribe',page.evaluate("async()=>{client.destroy();window.subscription=null;window.subscribeGate=new Promise(r=>window.releaseSubscribe=r);client=makeClient();window.other=makeClient();const p=client.refresh();for(let i=0;i<200&&counts.subscribe<2;i++)await new Promise(r=>setTimeout(r,10));await other.refresh();const before=counts.subscribe;releaseSubscribe();await p;other.destroy();window.subscribeGate=null;return before===2&&client.enabled;}"))
  record('explicit disable clears real worker recipient and persists consent',page.evaluate("async()=>{await client.disable();return !client.enabled&&localStorage.getItem('pablicus:r2:consent:'+A)==='disabled'&&await dbGet('pablicus-push-state','settings','recipient')===null;}"))
  record('granted OS permission does not override app disable',page.evaluate("async()=>{const n=calls.length;window.dispatchEvent(new Event('pageshow'));await client.refresh();return calls.length===n&&!client.enabled&&Notification.permission==='granted';}"))
  record('explicit enable after disable restores same account',page.evaluate("async()=>{await client.enable();return client.enabled&&await dbGet('pablicus-push-state','settings','recipient')===A;}"))
  record('default OS permission never prompts on restore',page.evaluate("async()=>{client.destroy();Notification.permission='default';const n=calls.length;client=makeClient();await client.sessionRestored();return calls.length===n&&counts.permission===0;}"))
  record('denied OS permission never prompts on restore',page.evaluate("async()=>{Notification.permission='denied';const n=calls.length;await client.refresh();return calls.length===n&&counts.permission===0;}"))
  record('logout detaches real IDB binding and prevents lifecycle rebind',page.evaluate("async()=>{Notification.permission='granted';await client.sessionRestored();await client.signOut();currentUser=null;window.dispatchEvent(new Event('pageshow'));await client.refresh();return !client.enabled&&subscription===null&&await dbGet('pablicus-push-state','settings','recipient')===null;}"))
  record('new account requires own app consent',page.evaluate("async()=>{currentUser=B;const n=calls.length;await client.sessionRestored();return calls.length===n&&!client.enabled&&await dbGet('pablicus-push-state','settings','recipient')===null;}"))
  record('new account explicit enable binds only current user',page.evaluate("async()=>{await client.enable();return client.enabled&&await dbGet('pablicus-push-state','settings','recipient')===B;}"))
  record('worker state contains no user JWT',page.evaluate("async()=>new Promise((resolve,reject)=>{const r=indexedDB.open('pablicus-push-state');r.onsuccess=()=>{const db=r.result,q=db.transaction('settings').objectStore('settings').getAll();q.onsuccess=()=>{db.close();resolve(!JSON.stringify(q.result).includes('SYNTHETIC_USER_JWT'))};q.onerror=reject;};r.onerror=reject;})"))
  record('health reads exact active release worker identity',page.evaluate("async()=>{client.destroy();client=makeClient(true);await client.refresh();await client.reportHealth();const h=calls.filter(x=>x.body?.action==='client_health').at(-1).body.health;return h.worker_build===PablicusBuild.id&&h.registration==='current'&&h.subscription==='present';}"))
  record('missing consent is reported without subscribing or prompting',page.evaluate("async()=>{await client.disable();client.destroy();localStorage.removeItem('pablicus:r2:consent:'+B);localStorage.removeItem('pablicus:r2:paused:'+B);const n=counts.subscribe;client=makeClient(true);await client.sessionRestored();await client.reportHealth();const h=calls.filter(x=>x.body?.action==='client_health').at(-1).body.health;return h.consent==='unknown'&&h.subscription==='missing'&&counts.subscribe===n&&counts.permission===0;}"))
  record('existing consented subscription locally binds before failed network config',page.evaluate("async()=>{client.destroy();localStorage.setItem('pablicus:push-owner',B);localStorage.setItem('pablicus:r2:consent:'+B,'enabled');window.subscription=makeSub();window.failConfig=true;client=makeClient(true);const n=counts.subscribe;await client.refresh();await client.reportHealth();const h=calls.filter(x=>x.body?.action==='client_health').at(-1).body.health;return await dbGet('pablicus-push-state','settings','recipient')===B&&counts.subscribe===n&&!client.enabled&&h.error==='network';}"))
  page.screenshot(path=str(out/(a.engine+'-r2-lifecycle.png')))
 except Exception as exc:
  checks.append(dict(name='browser completion',passed=False,error=str(exc),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True)
 finally:
  result=dict(engine=a.engine,build_id=release['build_id'],passed=sum(x['passed']for x in checks),failed=sum(not x['passed']for x in checks),checks=checks,boundary='Actual HTTP origin, native Web Locks, release Service Worker and IndexedDB. Synthetic PushManager, Notification permission, authentication and Edge network. No physical iPhone or live push delivery proof.')
  (out/(a.engine+'-r2-browser.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));ctx.close();browser.close();server.shutdown()
if result['failed']:raise SystemExit(1)

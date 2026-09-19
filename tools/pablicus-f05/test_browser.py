"""F05 real browser UI and full application auth integration; synthetic accounts/HTTP only."""
import argparse,base64,faulthandler,http.server,json,pathlib,threading,time,urllib.parse
faulthandler.dump_traceback_later(45,repeat=True)
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',choices=['chromium','webkit'],required=True);p.add_argument('--output');a=p.parse_args()
root=pathlib.Path(a.root).resolve()
if (root/'vision-talk/pablicus').is_dir():root=root/'vision-talk/pablicus'
uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';eid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';pid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';checks=[]
query='?joined='+eid+'&recipient='+uid
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(root),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/f05-probe.html':
   content=b'<!doctype html><html lang="ru"><head><link rel="stylesheet" href="people.css"><link rel="stylesheet" href="joined-notifications.css"><script src="joined-notifications.js"></script></head><body><form id="loginForm"></form></body></html>';self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(content);return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def check(name,value):
 assert value,name
 checks.append(name);print('PASS '+name,flush=True)
fixture="""window.calls=[];window.user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};window.mode='normal';window.api=PablicusJoined.create({getUser:()=>user,onOpen:()=>calls.push('chat'),client:{rpc:async(name,args)=>{calls.push(args);if(mode==='late')return new Promise(resolve=>window.resolveLate=resolve);if(mode==='unavailable')return{data:{ok:false,error:'unavailable'}};if(mode==='conflict'&&args.p_action==='preferences')return{data:{ok:false,error:'revision_conflict'}};if(args.p_action==='event')return{data:{ok:true,event:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',person:{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',display_name:'Fixture Person'}}}};return{data:{ok:true,revision:0,receive_enabled:false,announce_enabled:false,announce_available:true,feature_enabled:true}}}}});api.mount(document.body);"""
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch();ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block');page=ctx.new_page();page.set_default_timeout(15000)
 try:
  page.goto(origin+'/f05-probe.html'+query);page.evaluate(fixture)
  check('click identifiers scrubbed before auth',page.evaluate("!location.search&&!!sessionStorage.getItem('pablicus:pending-joined')"))
  page.evaluate('user=null;api.clear({preservePending:true});api.ready()')
  check('guest click does not query protected event',page.evaluate('calls.length===0'))
  page.reload();page.evaluate(fixture);page.evaluate('api.ready()');page.get_by_role('button',name='Открыть чат',exact=True).wait_for()
  check('same-tab login handoff verifies event without automatic chat',page.evaluate("calls.length===1&&calls[0].p_action==='event'"))
  check('mobile dialog focus and width',page.locator('dialog').evaluate('(d)=>d.contains(document.activeElement)&&d.getBoundingClientRect().right<=innerWidth'))
  page.get_by_role('button',name='Открыть чат',exact=True).click()
  check('explicit chat action clears event',page.evaluate("calls.at(-1)==='chat'&&!sessionStorage.getItem('pablicus:pending-joined')"))
  page.get_by_role('button',name='Новые знакомые',exact=True).click();page.get_by_role('button',name='Сохранить',exact=True).wait_for()
  check('both preferences off by default',page.locator('dialog input:checked').count()==0)
  page.get_by_label('Сообщать мне, когда приглашённый мной человек присоединится',exact=True).check();page.get_by_role('button',name='Сохранить',exact=True).click();page.wait_for_function("calls.at(-1).p_action==='preferences'")
  check('explicit preferences save uses revision and independent booleans',page.evaluate("calls.at(-1).p_input.expected_revision===0&&calls.at(-1).p_input.receive_enabled&&!calls.at(-1).p_input.announce_enabled"))
  page.evaluate("mode='conflict'");page.get_by_role('button',name='Сохранить',exact=True).click();page.wait_for_function("document.querySelector('[role=status]').textContent.includes('другом устройстве')")
  check('conflict offers explicit refresh',page.get_by_role('button',name='Обновить',exact=True).is_enabled())
  page.evaluate("api.close();mode='late';void api.open()");page.wait_for_function("typeof resolveLate==='function'");page.evaluate("user={id:'other'};api.clear();resolveLate({data:{ok:true,revision:0}})")
  check('logout and late response cannot reveal controls',page.locator('dialog').evaluate('(d)=>!d.open'))
  page.goto(origin+'/f05-probe.html'+query+'&case=unavailable');page.evaluate(fixture);page.evaluate("mode='unavailable';api.ready()");page.wait_for_function("document.querySelector('[role=status]').textContent.includes('недоступно')")
  check('revoked event exposes no person or chat',page.get_by_role('button',name='Открыть чат',exact=True).count()==0)
  ctx.close()
  # The real index.html, all application scripts and bundled Supabase SDK run here.
  # Only server HTTP responses are synthetic; no real OAuth provider or device-picker claim.
  ctx=browser.new_context(service_workers='block');ctx.route_web_socket('**',lambda ws:None);page=ctx.new_page();page.set_default_timeout(25000);errors=[];rpc=[];traffic=[];network_failures=[];console_errors=[]
  page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR '+str(e),flush=True)))
  page.on('console',lambda m:(console_errors.append(m.text),print('CONSOLE ERROR '+m.text,flush=True)) if m.type=='error' else print(m.text,flush=True) if m.text.startswith('F04_PHASE') else None)
  page.on('requestfailed',lambda r:network_failures.append({'path':urllib.parse.urlsplit(r.url).path,'failure':r.failure}))
  uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';sender={'id':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','username':'fixture_sender','display_name':'Fixture Sender'}
  user={'id':uid,'aud':'authenticated','role':'authenticated','email':'fixture@example.test','app_metadata':{'provider':'email'},'user_metadata':{},'identities':[]}
  enc=lambda value:base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
  jwt=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'aud':'authenticated','role':'authenticated','exp':int(time.time())+3600})+'.'+base64.urlsafe_b64encode(bytes(32)).decode().rstrip('=')
  session={'access_token':jwt,'refresh_token':'synthetic-refresh','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
  def route(r):
   path=urllib.parse.urlsplit(r.request.url).path
   traffic.append({'method':r.request.method,'path':path});print('HTTP '+r.request.method+' '+path,flush=True)
   cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':r.request.headers.get('access-control-request-headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version'),'Access-Control-Max-Age':'0'}
   if r.request.method=='OPTIONS':
    r.fulfill(status=204,headers=cors,body='');return
   if path.endswith('/token'):data=session
   elif path.endswith('/user'):data=user
   elif '/profiles' in path:data={**user,'username':'fixture_owner','display_name':'Fixture Owner','is_approved':True,'avatar_url':None}
   elif '/rpc/' in path:
    name=path.rsplit('/',1)[-1];args=r.request.post_data_json or {};rpc.append((name,args))
    if name=='pablicus_joined':data={'ok':True,'event':{'id':eid,'person':sender}}
    elif name=='pablicus_story_feed':data={'server_now':'2026-09-19T00:00:00Z','stories':[]}
    else:data=[]
   elif '/functions/' in path:data={'ok':False}
   else:data=[]
   r.fulfill(status=200,content_type='application/json',headers=cors,body=json.dumps(data));print('HTTP FULFILLED '+r.request.method+' '+path,flush=True)
  ctx.route('https://ctcoqgsztdtsazdiwcmd.supabase.co/**',route)
  page.goto(origin+'/'+query);page.wait_for_function('window.PablicusDebug && window.PablicusController')
  check('full app guest preserves scrubbed event',page.evaluate("!location.search&&!!sessionStorage.getItem('pablicus:pending-joined')"))
  sdk=page.evaluate('async(session)=>{const r=await Promise.race([PablicusController.getServices().client.auth.setSession(session),new Promise((_,reject)=>setTimeout(()=>reject(Error("SDK timeout")),10000))]);return{error:r.error?.message||null,userId:r.data.user?.id||null}}',session)
  assert sdk['error'] is None and sdk['userId']==uid
  page.get_by_role('button',name='Открыть чат',exact=True).wait_for()
  check('full app approved login queries current recipient event',any(name=='pablicus_joined' and args.get('p_action')=='event' and args['p_input']['event_id']==eid for name,args in rpc))
  check('full app event landing never starts conversation',not any(name=='start_direct_conversation' for name,_ in rpc))
  page.evaluate("Promise.race([PablicusController.getServices().client.auth.signOut({scope:'local'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('signOut timeout')),10000))])")
  page.wait_for_function("!document.querySelector('.joinedNotices').open")
  check('full app logout clears event and dialog',page.evaluate("!sessionStorage.getItem('pablicus:pending-joined')"))
  check('full app joined flow has no JavaScript errors',not errors)
  ctx.close();browser.close();server.shutdown()
 except Exception as exc:
  out=pathlib.Path(a.output or f'results/f05-{a.engine}.json');out.parent.mkdir(parents=True,exist_ok=True)
  print('FAILURE '+str(exc),flush=True)
  diagnostics={}
  if 'traffic' in locals():diagnostics.update({'traffic':traffic,'networkFailures':network_failures,'consoleErrors':console_errors})
  if 'rpc' in locals():diagnostics['rpcActions']=[{'name':name,'action':args.get('p_action')} for name,args in rpc]
  out.write_text(json.dumps({'engine':a.engine,'passed':len(checks),'failed':1,'checks':checks,'error':str(exc),'diagnostics':diagnostics},ensure_ascii=False,indent=2))
  print(json.dumps({'failure':str(exc),'diagnostics':diagnostics},ensure_ascii=False),flush=True)
  try:page.screenshot(path=str(out.with_suffix('.failure.png')),timeout=2000)
  except Exception:pass
  browser.close();server.shutdown();raise

result={'engine':a.engine,'passed':len(checks),'checks':checks,'boundary':'Synthetic contacts/accounts and backend HTTP. Real modules plus real index/app/Supabase SDK authentication integration. No real OAuth provider, SMS, external messages, native share acceptance or physical iPhone claim.'}
out=pathlib.Path(a.output or f'results/f05-{a.engine}.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))

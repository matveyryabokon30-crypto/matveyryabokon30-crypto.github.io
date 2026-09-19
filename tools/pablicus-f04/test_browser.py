"""F04 real browser UI and full application auth integration; synthetic accounts/HTTP only."""
import argparse,base64,http.server,json,pathlib,threading,time,urllib.parse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',choices=['chromium','webkit'],required=True);p.add_argument('--output');a=p.parse_args()
root=pathlib.Path(a.root).resolve()
if (root/'vision-talk/pablicus').is_dir():root=root/'vision-talk/pablicus'
token='a'*64;checks=[]
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(root),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/f04-probe.html':
   content=b'<!doctype html><html lang="ru"><head><script src="personal-invites.js"></script></head><body><form id="loginForm"></form></body></html>';self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(content);return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def check(name,value):
 assert value,name
 checks.append(name);print('PASS '+name,flush=True)
fixture="""window.calls=[];window.user={id:'owner'};window.mode='normal';window.sender={id:'sender',username:'sender',display_name:'Fixture Sender'};window.api=PablicusPersonalInvites.create({getUser:()=>user,onOpen:()=>calls.push('chat'),client:{rpc:async(name,args)=>{calls.push(args);if(mode==='late')return new Promise(resolve=>window.resolveLate=resolve);if(mode==='unavailable')return{data:{ok:false,error:'unavailable'}};if(args.p_action==='inspect')return{data:{ok:true,invite:{status:'active',inviter:sender}}};if(args.p_action==='accept')return{data:{ok:true,inviter:sender}};if(args.p_action==='create')return{data:{ok:true,token:'a'.repeat(64)}};if(args.p_action==='list')return{data:{ok:true,invites:[{id:'one',status:'active',created_at:'2026-09-19T00:00:00Z'}]}};return{data:{ok:true}}}}});api.mount(document.body);"""
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch();ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block');page=ctx.new_page();page.on('pageerror',lambda e:print('BROWSER ERROR '+str(e),flush=True));page.set_default_timeout(15000)
 try:
  page.goto(origin+'/f04-probe.html#invite='+token);page.evaluate(fixture)
  check('fragment removed before application authentication',page.evaluate("location.hash===''&&!!sessionStorage.getItem('pablicus:pending-invite')"))
  page.evaluate('user=null;api.clear({preserveUnbound:true})');page.evaluate('api.ready()')
  check('initial guest session preserves invitation without RPC',page.evaluate('calls.length===0'))
  page.reload();page.evaluate(fixture);page.evaluate('api.ready()');page.get_by_role('button',name='Принять приглашение',exact=True).wait_for()
  check('same-tab redirect handoff restores pending invitation',page.evaluate("calls.length===1&&calls[0].p_action==='inspect'"))
  check('dialog focus and mobile width',page.locator('dialog').evaluate('(d)=>d.contains(document.activeElement)&&d.getBoundingClientRect().right<=innerWidth'))
  page.get_by_role('button',name='Принять приглашение',exact=True).click();page.get_by_role('button',name='Открыть чат',exact=True).wait_for()
  check('explicit acceptance clears capability without opening chat',page.evaluate("!sessionStorage.getItem('pablicus:pending-invite')&&!calls.includes('chat')"))
  page.get_by_role('button',name='Открыть чат',exact=True).click()
  check('separate chat action opens contact',page.evaluate("calls.at(-1)==='chat'&&!document.querySelector('dialog').open"))
  page.get_by_role('button',name='Личные приглашения',exact=True).click();page.get_by_role('button',name='Создать приглашение',exact=True).click();page.get_by_role('button',name='Копировать ссылку',exact=True).wait_for()
  check('create prepares fragment link for separate sharing gesture',page.get_by_label('Ссылка приглашения').input_value().endswith('#invite='+token))
  page.evaluate("Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}})")
  page.get_by_role('button',name='Отправить приглашение',exact=True).click();page.wait_for_function("document.querySelector('[role=status]').textContent.includes('отменена')")
  check('native share cancellation keeps manual share controls',page.get_by_role('button',name='Копировать ссылку',exact=True).is_enabled())
  page.keyboard.press('Escape');page.get_by_role('button',name='Личные приглашения',exact=True).click();page.get_by_role('button',name='Отозвать',exact=True).click();page.wait_for_function("calls.at(-1).p_action==='revoke'")
  check('list supports explicit revocation',page.evaluate("calls.at(-1).p_input.id==='one'"))
  page.evaluate("api.close();mode='late';void api.open()");page.wait_for_function("typeof resolveLate==='function'");page.evaluate("user={id:'other'};api.clear();resolveLate({data:{ok:true,invites:[]}})")
  check('late previous-account response cannot reopen dialog',page.locator('dialog').evaluate('(d)=>!d.open'))
  page.goto(origin+'/f04-probe.html?case=unavailable#invite='+token);page.evaluate(fixture);page.evaluate("mode='unavailable';api.ready()");page.wait_for_function("document.querySelector('[role=status]').textContent.includes('недоступно')")
  check('revoked expired or used link offers no acceptance',page.get_by_role('button',name='Принять приглашение',exact=True).count()==0)
  ctx.close()
  # The real index.html, all application scripts and bundled Supabase SDK run here.
  # Only server HTTP responses are synthetic; no real OAuth provider or device-picker claim.
  ctx=browser.new_context(service_workers='block');ctx.route_web_socket('**',lambda ws:ws.close());page=ctx.new_page();page.set_default_timeout(25000);errors=[];rpc=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';sender={'id':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','username':'fixture_sender','display_name':'Fixture Sender'}
  user={'id':uid,'aud':'authenticated','role':'authenticated','email':'fixture@example.test','app_metadata':{'provider':'email'},'user_metadata':{},'identities':[]}
  enc=lambda value:base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
  jwt=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'aud':'authenticated','role':'authenticated','exp':int(time.time())+3600})+'.'+base64.urlsafe_b64encode(bytes(32)).decode().rstrip('=')
  session={'access_token':jwt,'refresh_token':'synthetic-refresh','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
  def route(r):
   path=urllib.parse.urlsplit(r.request.url).path
   if path.endswith('/token'):data=session
   elif path.endswith('/user'):data=user
   elif '/profiles' in path:data={**user,'username':'fixture_owner','display_name':'Fixture Owner','is_approved':True,'avatar_url':None}
   elif '/rpc/' in path:
    name=path.rsplit('/',1)[-1];args=r.request.post_data_json or {};rpc.append((name,args))
    if name=='pablicus_invites':data={'ok':True,'invite':{'status':'active','inviter':sender}} if args['p_action']=='inspect' else {'ok':True,'inviter':sender}
    elif name=='pablicus_story_feed':data={'server_now':'2026-09-19T00:00:00Z','stories':[]}
    else:data=[]
   elif '/functions/' in path:data={'ok':False}
   else:data=[]
   r.fulfill(status=200,content_type='application/json',body=json.dumps(data))
  ctx.route('https://ctcoqgsztdtsazdiwcmd.supabase.co/**',route)
  page.goto(origin+'/#invite='+token);page.wait_for_function('window.PablicusDebug && window.PablicusController')
  page.wait_for_function("!!document.getElementById('personalInviteLoginHint')")
  check('full app guest boot keeps invite without authenticated RPC',not rpc and page.evaluate("!location.hash&&!!sessionStorage.getItem('pablicus:pending-invite')"))
  # Existing SDK sign-in flow, equivalent to password form; authenticate via actual SDK event.
  sdk=page.evaluate('async(session)=>{const r=await PablicusController.getServices().client.auth.setSession(session);return{error:r.error?.message||null,userId:r.data.user?.id||null,hasSession:!!r.data.session}}',session)
  assert sdk['error'] is None and sdk['userId']==uid and sdk['hasSession'], 'Synthetic SDK session import failed: '+str(sdk)
  page.get_by_role('button',name='Принять приглашение',exact=True).wait_for()
  check('full app approved session resumes invitation inspect only',[(name,args.get('p_action')) for name,args in rpc if name=='pablicus_invites']==[('pablicus_invites','inspect')])
  check('full app does not create conversation during invite landing',not any(name=='start_direct_conversation' for name,_ in rpc))
  page.get_by_role('button',name='Принять приглашение',exact=True).click();page.get_by_role('button',name='Открыть чат',exact=True).wait_for()
  check('full app acceptance uses existing authenticated RPC without autochat',any(name=='pablicus_invites' and args.get('p_action')=='accept' for name,args in rpc) and not any(name=='start_direct_conversation' for name,_ in rpc))
  page.evaluate("PablicusController.getServices().client.auth.signOut({scope:'local'})")
  page.wait_for_function("!document.querySelector('.personalInvites').open")
  check('full app signout closes invite and deletes pending capability',page.evaluate("!sessionStorage.getItem('pablicus:pending-invite')"))
  check('full app invitation flow has no JavaScript errors',not errors)
  ctx.close();browser.close();server.shutdown()
 except Exception as exc:
  out=pathlib.Path(a.output or f'results/f04-{a.engine}.json');out.parent.mkdir(parents=True,exist_ok=True)
  try:page.screenshot(path=str(out.with_suffix('.failure.png')))
  except Exception:pass
  diagnostics={}
  try:diagnostics=page.evaluate("()=>({userId:window.PablicusDebug?.user||null,sessionUserId:window.PablicusController?.state()?.sessionUserId||null,loginError:document.getElementById('loginError')?.textContent||'',pendingInvite:!!sessionStorage.getItem('pablicus:pending-invite')})")
  except Exception:pass
  if 'rpc' in locals():diagnostics['rpcActions']=[{'name':name,'action':args.get('p_action')} for name,args in rpc]
  out.write_text(json.dumps({'engine':a.engine,'passed':len(checks),'failed':1,'checks':checks,'error':str(exc),'diagnostics':diagnostics},ensure_ascii=False,indent=2))
  print(json.dumps({'failure':str(exc),'diagnostics':diagnostics},ensure_ascii=False),flush=True)
  browser.close();server.shutdown();raise

result={'engine':a.engine,'passed':len(checks),'checks':checks,'boundary':'Synthetic contacts/accounts and backend HTTP. Real modules plus real index/app/Supabase SDK authentication integration. No real OAuth provider, SMS, external messages, native share acceptance or physical iPhone claim.'}
out=pathlib.Path(a.output or f'results/f04-{a.engine}.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))

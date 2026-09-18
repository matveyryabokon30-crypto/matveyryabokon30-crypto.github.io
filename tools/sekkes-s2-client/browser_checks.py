"""Actual browser network/DOM tests with explicit synthetic Auth/AI fixtures, no live paid calls."""
import json,threading,http.server,functools
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('sekkes-qa');checks=[]
def check(n,v,detail=None):
 checks.append({'name':n,'pass':bool(v),'detail':detail});print(('PASS ' if v else 'FAIL ')+n,flush=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(out/'candidate')))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=getattr(p,engine).launch(headless=True);ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block',is_mobile=True,has_touch=True)
   page=ctx.new_page();errors=[];calls=[];facts=[];fail_next=[False]
   page.on('pageerror',lambda e:errors.append(str(e)))
   def fixture(route):
    req=route.request;data=req.post_data_json or {};url=req.url;calls.append({'path':url,'method':req.method,'body':data})
    headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS'}
    if req.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
    if url.endswith('/status'):resp={'configured':True,'liveValidated':False}
    elif '/auth/v1/token' in url:
     if data.get('password')=='wrong':route.fulfill(status=400,json={'error':'invalid_grant'},headers=headers);return
     resp={'access_token':'TEST-FIXTURE-TOKEN','expires_in':3600}
    elif url.endswith('/memory'):
     if req.method=='GET':resp={'items':facts.copy()}
     elif req.method=='DELETE':facts[:]=[f for f in facts if f['id']!=data['id']];resp={'deleted':True}
     elif data.get('action')=='save':facts.append({'id':'11111111-1111-4111-8111-111111111111','text':data['text']});resp={'item':facts[-1]}
     elif data.get('action')=='update':facts[0]['text']=data['text'];resp={'item':facts[0]}
    elif url.endswith('/turn'):
     if fail_next[0]:fail_next[0]=False;route.fulfill(status=503,json={'code':'PROVIDER_UNAVAILABLE'},headers=headers);return
     resp={'id':data['id'],'text':data.get('text','Synthetic speech'),'reply':'[TEST FIXTURE] Ответ проверочного сервера.','source':'openai','speech':None,'memoryUsed':data.get('useMemory',False)}
    else:resp={'items':facts.copy()}
    route.fulfill(json=resp,headers=headers)
   page.route('https://wqwqhagyevbszadqcoqj.supabase.co/**',fixture)
   page.goto(base,wait_until='networkidle');page.wait_for_function('Boolean(window.SekkesS2)')
   check(engine+' module loaded',page.locator('script[src="assets/voice-s2.mjs"]').count()==1)
   box=page.locator('#hero').bounding_box();check(engine+' edge-to-edge unchanged',box['x']==0 and box['y']==0 and box['width']==390)
   page.locator('.hero-header [data-open="profile"]').click();check(engine+' profile opens real login',page.locator('#s2Login').is_visible())
   page.screenshot(path=str(out/(engine+'-login.png')))
   page.locator('#s2Email').fill('test@example.invalid');page.locator('#s2Password').fill('wrong');page.get_by_role('button',name='Войти',exact=True).click();page.wait_for_timeout(400)
   check(engine+' wrong password explained',bool(page.locator('#s2LoginError').inner_text()))
   page.locator('#s2Password').fill('FIXTURE-NOT-A-REAL-PASSWORD');page.get_by_role('button',name='Войти',exact=True).click();page.locator('#s2Consent').wait_for()
   check(engine+' consent explicit',page.locator('#s2Agree').is_disabled())
   check(engine+' no paid request before consent',not any(c['path'].endswith('/turn') for c in calls))
   page.locator('#s2Consent').check();page.locator('#s2Agree').click()
   page.locator('#openText').click();page.locator('#draft').fill('Синтетический вопрос');page.locator('#micButton').click()
   page.wait_for_function('document.querySelectorAll("#s2Transcript .s2-line").length===2')
   turn=[c for c in calls if c['path'].endswith('/turn') and c['method']=='POST']
   check(engine+' exactly one turn',len(turn)==1)
   check(engine+' confirmed consent in payload',turn[-1]['body']['consent']=='sekkes-s2-openai-20260918')
   check(engine+' memory default off',turn[-1]['body']['useMemory'] is False)
   check(engine+' draft cleared after success',page.locator('#draft').input_value()=='')
   check(engine+' reply not hidden behind collapsed details',page.locator('#s2TranscriptWrap').evaluate('(e)=>e.open'))
   check(engine+' transcript protects update',page.evaluate('window.SekkesS2.dirty'))
   page.screenshot(path=str(out/(engine+'-conversation-fixture.png')))
   fail_next[0]=True;page.locator('#draft').fill('Сохранить при ошибке');page.locator('#micButton').click();page.wait_for_timeout(500)
   check(engine+' error keeps draft',page.locator('#draft').input_value()=='Сохранить при ошибке')
   check(engine+' no automatic repeat after failure',len([c for c in calls if c['path'].endswith('/turn') and c['method']=='POST'])==2)
   page.locator('#s2MemoryButton').click();page.locator('#s2MemoryText').fill('<img src=x onerror=alert(1)>');page.get_by_role('button',name='Подтверждаю · сохранить',exact=True).click();page.wait_for_function('document.querySelectorAll(".s2-memory textarea").length===1')
   check(engine+' stored text not HTML',page.locator('#s2MemoryList img').count()==0)
   check(engine+' changed memory clears conversation',page.locator('#s2Transcript .s2-line').count()==0)
   page.get_by_role('button',name='Забыть',exact=True).click();page.wait_for_function('document.querySelectorAll(".s2-memory textarea").length===0');check(engine+' forget works',not facts)
   page.locator('#dialogClose').click();page.locator('#s2End').click();check(engine+' logout clears context',not page.evaluate('window.SekkesS2.dirty'))
   storage=page.evaluate('Object.entries(localStorage)');check(engine+' no credentials in localStorage',not any('TOKEN' in str(v) or 'PASSWORD' in str(v) or 'Синтетический' in str(v) for v in storage))
   check(engine+' JS errors absent',not errors,errors)
   ctx.close();browser.close()
except Exception as e:check('browser tests completed',False,str(e))
finally:
 server.shutdown();report={'scope':'Chromium/WebKit local HTTP with synthetic Auth/AI fixtures only','live_ai_calls':0,'physical_iphone':False,'checks':checks,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks)};out.joinpath('BROWSER_RESULTS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(1 if report['failed'] else 0)

"""Browser regression with synthetic Auth/AI fixtures. No real login or model call."""
import functools,http.server,json,threading,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path('.').resolve();OUT=ROOT/'sekkes-qa';OUT.mkdir(exist_ok=True)
checks=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'pass':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=getattr(p,engine).launch(headless=True)
   context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
   page=context.new_page();errors=[];calls=[];facts=[];reject={'budget':False,'login':True}
   page.on('pageerror',lambda e:errors.append(str(e)))
   def fixture(route):
    req=route.request;url=req.url;data=req.post_data_json if req.method in ['POST','DELETE'] else {};data=data or {}
    calls.append({'url':url,'method':req.method})
    headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'}
    if req.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
    code=200
    if '/auth/v1/token?' in url:
     if reject['login']:code=400;result={'error':'invalid_grant'}
     else:result={'access_token':'SYNTHETIC-ACCESS-TOKEN','expires_in':3600}
    elif url.endswith('/status'):result={'configured':True,'liveValidated':False}
    elif url.endswith('/memory'):
     if req.method=='GET':result={'items':facts.copy()}
     elif req.method=='DELETE':facts[:]=[f for f in facts if f['id']!=data['id']];result={'deleted':True}
     elif data.get('action')=='save':facts.append({'id':'11111111-1111-4111-8111-111111111111','text':data['text']});result={'item':facts[-1]}
     else:result={'items':facts.copy()}
    elif url.endswith('/turn'):
     if reject['budget']:code=429;result={'code':'BUDGET_STOP'}
     else:result={'id':data['id'],'text':data.get('text','SYNTHETIC AUDIO'),'reply':'[TEST FIXTURE] Какой результат разговора был бы полезен?','source':'openai','speech':None,'speechError':None}
    elif url.endswith('/export'):result={'items':facts.copy()}
    else:code=404;result={'code':'NOT_FOUND'}
    route.fulfill(status=code,json=result,headers=headers)
   context.route('https://*.supabase.co/**',fixture)
   page.goto(base+'/sekkes-v2/',wait_until='networkidle')
   page.wait_for_function('Boolean(window.SekkesS2)');page.wait_for_timeout(100)
   check(engine+' build',page.locator('html').get_attribute('data-build')=='2026.09.18-s2.3')
   box=page.locator('#hero').bounding_box();check(engine+' full bleed S1 geometry retained',box['x']==0 and box['y']==0 and box['width']==390,box)
   check(engine+' no automatic model request',not any(c['url'].endswith('/turn') for c in calls))
   page.locator('#micButton').click();page.locator('#s2Login').wait_for()
   check(engine+' microphone opens login before recording',page.locator('#s2Password').get_attribute('type')=='password')
   page.screenshot(path=str(OUT/(engine+'-login.png')))
   page.locator('#s2Email').fill('owner@example.invalid');page.locator('#s2Password').fill('FAKE-PASSWORD')
   page.get_by_role('button',name='Войти',exact=True).click();page.wait_for_function('document.querySelector("#s2LoginError").textContent.length>0')
   check(engine+' wrong password handled without exit','пароль' in page.locator('#s2LoginError').inner_text())
   reject['login']=False;page.get_by_role('button',name='Войти',exact=True).click();page.locator('#s2Consent').wait_for()
   check(engine+' explicit consent before provider',page.locator('#s2Agree').is_disabled() and not any(c['url'].endswith('/turn') for c in calls))
   page.locator('#s2Consent').check();page.locator('#s2Agree').click()
   page.locator('#openText').click();page.locator('#draft').fill('Тестовый вопрос без личных данных.')
   page.locator('#micButton').click();page.wait_for_function('document.querySelectorAll("#s2Transcript .s2-line").length===2')
   check(engine+' text reaches synthetic API exactly once',sum(c['url'].endswith('/turn') for c in calls)==1)
   check(engine+' success clears only submitted draft',page.locator('#draft').input_value()=='')
   check(engine+' text transcript visible',page.locator('#s2TranscriptWrap').get_attribute('open') is not None)
   check(engine+' conversation blocks automatic reload',page.evaluate('window.SekkesS2.dirty') is True)
   page.screenshot(path=str(OUT/(engine+'-synthetic-conversation.png')))
   reject['budget']=True;page.locator('#draft').fill('Лимит: синтетическая проверка.');page.locator('#micButton').click()
   page.wait_for_function('document.querySelector("#toast").textContent.includes("Тестовый лимит")')
   count=sum(c['url'].endswith('/turn') for c in calls);page.wait_for_timeout(500)
   check(engine+' quota error retains draft and does not retry',page.locator('#draft').input_value()=='Лимит: синтетическая проверка.' and sum(c['url'].endswith('/turn') for c in calls)==count)
   reject['budget']=False;page.locator('#draft').fill('')
   page.locator('#s2MemoryButton').click();page.locator('#s2MemoryText').fill('<img src=x onerror=alert(1)>')
   page.get_by_role('button',name='Подтверждаю · сохранить',exact=True).click();page.wait_for_function('document.querySelectorAll(".s2-memory textarea").length===1')
   check(engine+' memory stored as text not markup',facts[0]['text']=='<img src=x onerror=alert(1)>' and page.locator('#s2MemoryList img').count()==0)
   check(engine+' memory mutation clears old context',page.locator('#s2Transcript .s2-line').count()==0)
   page.get_by_role('button',name='Забыть',exact=True).click();page.wait_for_function('document.querySelectorAll(".s2-memory textarea").length===0')
   check(engine+' forget removes selected memory',not facts)
   page.locator('#dialogClose').click();page.locator('#openText').click()
   page.evaluate("navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}")
   page.locator('#micButton').click();page.wait_for_function('document.querySelector("#toast").textContent.includes("Микрофон не разрешён")')
   check(engine+' mic denial handled without paid call',sum(c['url'].endswith('/turn') for c in calls)==count)
   page.locator('#s2End').click();check(engine+' end clears local context',page.evaluate('window.SekkesS2.dirty') is False)
   page.locator('#micButton').click();page.locator('#s2Password').wait_for();page.locator('#s2Password').fill('NOT-TO-RETAIN');page.locator('#dialogClose').click()
   check(engine+' dismissed form clears password',page.locator('#s2Password').input_value()=='')
   stored=page.evaluate('Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])')
   check(engine+' no auth or conversation in localStorage',all('TOKEN' not in str(x) and 'FAKE' not in str(x) and 'Тестовый' not in str(x) for x in stored))
   check(engine+' no JavaScript errors',not errors,errors)
   context.close();browser.close()
 # Live READ ONLY status. No real Auth login, user messages, paid turns or provider probes.
 status_url='https://wqwqhagyevbszadqcoqj.supabase.co/functions/v1/sekkes-s2/status'
 with urllib.request.urlopen(status_url,timeout=20) as r:live=json.load(r)
 check('live backend is configured and does not claim completed real test',live.get('configured') is True and live.get('liveValidated') is False)
except Exception as e:check('suite completed',False,type(e).__name__+': '+str(e))
finally:
 server.shutdown();report={'scope':'Synthetic auth/AI browser regressions + read-only backend status; no real credentials or paid provider calls','checks':checks,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks)}
 (OUT/'RESULTS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(1 if any(not c['pass'] for c in checks) else 0)

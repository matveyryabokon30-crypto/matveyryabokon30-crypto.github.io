"""Verify actual Pages bytes, current SW and public app boot. No user identity."""
import concurrent.futures,hashlib,json,os,pathlib,time,urllib.request
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('vision-talk/pablicus');OUT=pathlib.Path('public-evidence');OUT.mkdir(exist_ok=True)
BASE='https://matveyryabokon30-crypto.github.io/vision-talk/pablicus/'
SHA=os.environ['GITHUB_SHA'];manifest=json.loads((ROOT/'release-p01r2.json').read_text());checks=[];fatal=None

def digest(b):return hashlib.sha256(b).hexdigest()
def fetch(path,cache_bust=True):
 url=BASE+('' if path=='./' else path)
 if cache_bust:url+='?verify='+SHA
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=25) as r:return r.read()
def record(name,passed,details=None):
 checks.append({'name':name,'pass':bool(passed),'details':details});print(('PASS ' if passed else 'FAIL ')+name,details or '',flush=True)
 if not passed:raise AssertionError(name)
try:
 expected=digest((ROOT/'sw.js').read_bytes());last=None
 for attempt in range(24):
  try:
   if digest(fetch('sw.js'))==expected and digest(fetch('index.html'))==manifest['assets']['index.html']:break
  except Exception as e:last=type(e).__name__
  time.sleep(10)
 else:raise RuntimeError('Submitted release has not reached Pages: '+str(last))
 record('Pages serves submitted release shell',True,{'commit':SHA})
 def check_asset(item):
  name,sha=item
  try:return {'path':name,'pass':digest(fetch(name))==sha}
  except Exception as e:return {'path':name,'pass':False,'error':type(e).__name__}
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:files=list(executor.map(check_asset,manifest['assets'].items()))
 record('All release assets match tested content hashes',all(f['pass'] for f in files),{'verified':len(files),'failed':[f for f in files if not f['pass']]})
 record('Canonical non-versioned URL serves current HTML',digest(fetch('index.html',False))==manifest['assets']['index.html'])
 record('Canonical non-versioned SW serves current release',digest(fetch('sw.js',False))==expected)
 for engine in ['chromium','webkit']:
  with sync_playwright() as p:
   browser=getattr(p,engine).launch(headless=True);ctx=browser.new_context();page=ctx.new_page();errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.initialNativeFetch=window.fetch;')
   page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
   page.wait_for_function("window.PablicusDebug?.version==='P06'",timeout=45000)
   page.wait_for_function('navigator.serviceWorker.controller',timeout=90000);page.wait_for_timeout(6500)
   status=page.evaluate("""async()=>{const worker=navigator.serviceWorker.controller;const result=await new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);worker.postMessage({type:'PABLICUS_RELEASE'},[ch.port2]);setTimeout(()=>resolve(null),3000);});return {worker:result,version:PablicusDebug.version,nativeFetch:fetch===initialNativeFetch,cache:!!window.PablicusMediaCache,manualNotice:!document.getElementById('updateNotice').hidden};}""")
   record(engine+' cold boot installs and controls with P06',status['worker'] and status['worker']['version']=='pablicus-shell-p06-20260918',status)
   record(engine+' has explicit cache and no manual prompt',status['nativeFetch'] and status['cache'] and not status['manualNotice'])
   record(engine+' actual public app has no JavaScript exceptions',not errors,errors)
   page.screenshot(path=str(OUT/(engine+'-public-boot.png')));browser.close()
except Exception as e:
 fatal=str(e)
 if not any(not c['pass'] for c in checks):checks.append({'name':'Public verification completed','pass':False,'details':fatal})
 raise
finally:
 result={'commit':SHA,'release':'P06','passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'boundary':'Public unauthenticated app boot and byte integrity; owner iPhone is not tested here.','error':fatal}
 (OUT/'public-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))

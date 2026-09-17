"""Read-only production verification. No user credentials, uploads or messages."""
import asyncio, hashlib, json, time
from pathlib import Path
from urllib.request import Request, urlopen
from playwright.async_api import async_playwright

ORIGIN='https://matveyryabokon30-crypto.github.io'
BASE=ORIGIN+'/vision-talk/pablicus/'
REVISION='f3c91a177f748162fe33cc4caba6b78484e94138'
EXPECTED={
 'avatar-ring-system.css':'6a43b486f18229af3c049598c9e018d84bf85197786ee1fb58a3cd79caff7f19',
 'stories-v2.css':'113d89394abb3096827c80594e94104898f4e504ce086489a84879478acec1c5',
 'avatar-rings.css':'3c38daf2e67b896437f7bf7a20e15b6ab3514ec9e0c020f0bd64eb0a46ffdafd',
 'sw.js':'60cc77dff46ece58ed9e8082466ac9a8fd611005b271690e178b8bd27057e916',
 'stories-v3-viewer.js':'2a8ba7f2c711545912076d0dbd47c3071f78f3681f6ce8627d05a70d198b7c54',
 'chat.js':'1234dd2dd0cc62a092c36fded23c11ae9d84f6401cf582de0cf48e0b7d4c5aba',
 'profile-appearance.js':'ac55360f53bb7451048090471ced88ca09935a65854fcea63882b4f301ccf320',
 'avatar-stories.js':'5333199c9cdbfd073786cb1a39831416f617350d87fae5bed126228053dd5728',
 'stories-v3-core.js':'fd81d968643e88028c9f96f50e07fb1586711ead6f025f5ee40e262cc54c0b80',
 'index.html':'d5a3d575f2555407eba95886eb1618f4773157a14018681d0820f255b04283a9',
 'chat-list-view.js':'07702a82635ba3c5f7f79996a52dc5a443f7409e01c1a8ad0c9a76b397fdb847'
}
OUT=Path('live-evidence');OUT.mkdir(exist_ok=True)
report={'deployment_revision':REVISION,'scope':'Read-only public HTTP and anonymous browser startup; no customer accounts.','checks':[]}
def check(name,ok,actual=None):
 report['checks'].append({'name':name,'pass':bool(ok),'actual':actual})
 if not ok:print('FAIL',name,actual,flush=True)
def get(url):
 with urlopen(Request(url,headers={'User-Agent':'Pablicus-release-verification','Cache-Control':'no-cache'}),timeout=30) as r:return r.status,r.read()
async def main():
 for attempt in range(8):
  got={};failure=False
  for name,expected in EXPECTED.items():
   try:
    status,data=await asyncio.to_thread(get,BASE+name)
    digest=hashlib.sha256(data).hexdigest();got[name]={'status':status,'sha256':digest,'bytes':len(data),'pass':digest==expected}
    failure=failure or digest!=expected
   except Exception as e:got[name]={'pass':False,'error':str(e)};failure=True
  if not failure:break
  await asyncio.sleep(12)
 for name,result in got.items():check('live-hash-'+name,result['pass'],result)
 for path in ['/vision-talk/','/vision-talk/pablicus/','/vision-talk/pablicus/sw.js']:
  status,data=await asyncio.to_thread(get,ORIGIN+path);check('live-route-'+path,status==200,{'status':status,'bytes':len(data)})
 async with async_playwright() as pw:
  browser=await pw.chromium.launch()
  context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  response=await page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
  await page.wait_for_function('!!window.PablicusController && !!window.PablicusStoriesCore && !!window.PablicusStoriesViewer',timeout=30000)
  await page.wait_for_timeout(1500)
  state=await page.evaluate('PablicusController.state()')
  check('anonymous-page-http',response.status==200,response.status)
  check('anonymous-session',not state.get('sessionUserId'),state)
  check('anonymous-login-visible',await page.locator('#loginPane').is_visible())
  check('no-uncaught-javascript',not errors,errors)
  fatal=await page.locator('#fatal').is_visible() if await page.locator('#fatal').count() else False
  check('no-fatal-overlay',not fatal)
  await page.wait_for_function("navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(r=>!!r.active)",timeout=60000)
  await page.evaluate('navigator.serviceWorker.ready')
  caches=await page.evaluate('caches.keys()')
  check('new-pwa-cache-installed','pablicus-shell-shared-stories-20260917-final1' in caches,caches)
  cached=await page.evaluate("""async()=>{const c=await caches.open('pablicus-shell-shared-stories-20260917-final1');const r=await c.match(new URL('stories-v3-core.js',location.href));if(!r)return null;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('')}""")
  check('cached-runtime-matches-verified',cached==EXPECTED['stories-v3-core.js'],cached)
  await page.screenshot(path=str(OUT/'anonymous-startup.png'))
  await context.close();await browser.close()
try:
 asyncio.run(main())
except Exception as error:
 report['error']=str(error);check('verification-completed',False,str(error))
finally:
 report['passed']=sum(c['pass'] for c in report['checks']);report['failed']=sum(not c['pass'] for c in report['checks'])
 (OUT/'publication.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('LIVE_PUBLICATION_RESULT '+json.dumps(report,ensure_ascii=False),flush=True)
 if report['failed']:raise SystemExit(1)

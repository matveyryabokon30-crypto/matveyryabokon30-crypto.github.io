"""Whole application + real auth SDK. Synthetic accounts, 180ms per backend reply.
No production user credentials or private media. Equal latency before/after.
"""
import argparse,asyncio,base64,http.server,json,pathlib,threading,time,traceback,urllib.parse
from playwright.async_api import async_playwright
P=argparse.ArgumentParser();P.add_argument('--root',required=True);P.add_argument('--baseline',required=True);P.add_argument('--engine',default='chromium');P.add_argument('--out',default='results');A=P.parse_args()
OUT=pathlib.Path(A.out);OUT.mkdir(parents=True,exist_ok=True)
UID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';REMOTE='https://ctcoqgsztdtsazdiwcmd.supabase.co';DELAY=.18
peers=[f'bbbbbbbb-bbbb-4bbb-8bbb-{i:012d}' for i in range(1,5)];cids=[f'cccccccc-cccc-4ccc-8ccc-{i:012d}' for i in range(1,5)]
profiles={id:{'id':id,'username':'tester'+str(i),'display_name':'Test '+str(i),'avatar_url':id+'/avatar.png','is_approved':True} for i,id in enumerate([UID]+peers)}
def stories(ids):
 return {'server_now':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'stories':[{'id':f'dddddddd-dddd-4ddd-8ddd-{i:012d}','owner_id':p,'created_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()-60)),'expires_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+3600)),'body':'Synthetic story','media':{'path':p+'/story.png','type':'image'}} for i,p in enumerate([UID]+peers) if p in ids]}
def card(cid):
 if cid not in cids:return {'kind':'group','conversation_id':cid}
 return {'kind':'contact','conversation_id':cid,'conversation_ids':[cid],'profile':profiles[peers[cids.index(cid)]],'personal':{'first_name':'','last_name':'','note':'','revision':0}}
def jwt():
 enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':UID,'aud':'authenticated','role':'authenticated','exp':int(time.time()+7200),'iss':REMOTE+'/auth/v1'})+'.synthetic-not-signed'
TOKEN=jwt();user={'id':UID,'aud':'authenticated','role':'authenticated','email':'fixture@example.invalid','app_metadata':{'provider':'email','providers':['email']},'user_metadata':{},'identities':[],'created_at':'2026-01-01T00:00:00Z'}
SESSION={'access_token':TOKEN,'refresh_token':'synthetic-token-not-used','token_type':'bearer','expires_in':7200,'expires_at':int(time.time()+7200),'user':user}
checks=[]
def check(name,value,details=None):
 checks.append({'name':name,'pass':bool(value),'details':details});print(('PASS ' if value else 'FAIL ')+name,details or '',flush=True)
 if not value:raise AssertionError(name)
async def run_case(browser,root,label):
 root=pathlib.Path(root).resolve();picture=(root/'assets/icon-glass-20260909-512.png').read_bytes()
 class Handler(http.server.SimpleHTTPRequestHandler):
  def __init__(self,*args,**kw):super().__init__(*args,directory=str(root),**kw)
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
 ctx=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,service_workers='block')
 await ctx.add_init_script("localStorage.setItem('sb-ctcoqgsztdtsazdiwcmd-auth-token',"+json.dumps(json.dumps(SESSION))+");window.imageChanges=0;new MutationObserver(rows=>{imageChanges+=rows.filter(r=>r.target.closest?.('.chatCard .avatar')).length;}).observe(document,{subtree:true,childList:true});")
 await ctx.route_web_socket('**/realtime/**',lambda ws:ws.close())
 requests=[];downloaded=0;changed=False
 async def route(r):
  nonlocal downloaded
  req=r.request;path=urllib.parse.unquote(urllib.parse.urlparse(req.url).path);query=urllib.parse.parse_qs(urllib.parse.urlparse(req.url).query);data=json.loads(req.post_data or '{}') if req.method=='POST' else {}
  if req.method=='OPTIONS':await r.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});return
  requests.append({'path':path,'method':req.method,'at':time.monotonic()});await asyncio.sleep(DELAY)
  body=[];status=200;headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}
  if req.method=='GET' and ('/object/sign/' in path or '/preview/' in path):
   downloaded+=1;await r.fulfill(status=200,body=picture,content_type='image/png',headers=headers);return
  if path=='/rest/v1/profiles':
   id_filter=query.get('id',[''])[0]
   if id_filter.startswith('eq.'):body=profiles.get(id_filter[3:])
   else:body=[p for p in profiles.values() if p['id'] in id_filter]
  elif path=='/rest/v1/conversations':body=[{'id':cid,'type':'direct'} for cid in cids]
  elif path=='/rest/v1/conversation_members':body=[{'conversation_id':cid,'user_id':u} for cid,peer in zip(cids,peers) for u in [UID,peer]]
  elif path.endswith('/my_conversations_v3') or path.endswith('/my_conversations_v2'):
   body=[{'id':cid,'type':'direct','title':profiles[peer]['display_name'],'last_message':'Updated fixture' if changed and i==0 else 'Fixture message','last_seq':2 if changed and i==0 else 1,'unread_count':1 if changed and i==0 else 0,'last_read_seq':1} for i,(cid,peer) in enumerate(zip(cids,peers))]
  elif path.endswith('/pablicus_chat_preferences'):body=[]
  elif path.endswith('/pablicus_contact_card'):body=card(data['p_conversation_id'])
  elif path.endswith('/pablicus_home_cards'):
   cards=[card(id) for id in data['p_conversation_ids']];owners=[UID]+[c['profile']['id'] for c in cards if c['kind']=='contact'];body={'cards':cards,'owners':owners,'feed':stories(owners)}
  elif path.endswith('/pablicus_story_feed'):body=stories(data['p_owners'])
  elif path.endswith('/pablicus-media-preview'):
   body={'items':[{**x,'kind':'preview','url':REMOTE+'/preview/'+x['path'],'sourceVersion':'fixture-v1','sourceBytes':len(picture),'expiresIn':105} for x in data['items']]}
  elif path.startswith('/storage/v1/object/sign/'):body={'signedURL':path.replace('/storage/v1','')+'?token=fixture'}
  elif path=='/auth/v1/user':body=user
  elif path=='/rest/v1/pablicus_profile_posts':body=[]
  elif path.startswith('/functions/'):body={}
  await r.fulfill(status=status,content_type='application/json',headers=headers,body=json.dumps(body))
 await ctx.route(REMOTE+'/**',route)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  start=time.monotonic();await page.goto(url,wait_until='domcontentloaded')
  await page.wait_for_function("document.querySelectorAll('.chatCard').length===4 && !document.querySelector('#home').hidden",timeout=15000)
  rows_ms=round((time.monotonic()-start)*1000)
  await page.wait_for_function("document.querySelectorAll('.storyShelfItem').length===5",timeout=15000)
  metadata_ms=round((time.monotonic()-start)*1000)
  await page.wait_for_function("[...document.querySelectorAll('.chatCard .avatar img')].filter(x=>x.complete&&x.naturalWidth).length===4 && [...document.querySelectorAll('.storyShelfItem img')].filter(x=>x.complete&&x.naturalWidth).length===5",timeout=15000)
  avatars_ms=round((time.monotonic()-start)*1000);cold_downloads=downloaded
  await page.screenshot(path=str(OUT/(A.engine+'-'+label+'-home.png')))
  initial=list(requests);requests.clear()
  await page.evaluate("()=>{window.initialRows=[...document.querySelectorAll('.chatCard')];window.initialImages=[...document.querySelectorAll('.chatCard .avatar img')];window.initialStoryItems=[...document.querySelectorAll('.storyShelfItem')];}")
  await page.wait_for_timeout(6500)
  quiet=list(requests);requests.clear();stability=await page.evaluate("()=>({rows:initialRows.every((x,i)=>document.querySelectorAll('.chatCard')[i]===x),images:initialImages.every((x,i)=>document.querySelectorAll('.chatCard .avatar img')[i]===x),shelf:initialStoryItems.every((x,i)=>document.querySelectorAll('.storyShelfItem')[i]===x)})")
  if label=='candidate':
   check('unchanged home rows and avatars retain their DOM identity',stability['rows'] and stability['images'] and stability['shelf'],stability)
   check('idle homepage does not poll every 1.3 seconds',sum(x['path'].endswith('/my_conversations_v3') for x in quiet)<=1,{'requestsIn6_5s':[x['path'] for x in quiet]})
   check('home has only one private-avatar download per identity',cold_downloads==5,{'downloads':cold_downloads})
   changed=True;await page.evaluate("()=>window.dispatchEvent(new Event('online'))")
   await page.wait_for_function("document.querySelector('.previewText')?.textContent==='Updated fixture'",timeout=8000)
   keep=await page.evaluate("()=>initialRows.slice(1).every((n,i)=>document.querySelectorAll('.chatCard')[i+1]===n)")
   check('a changed conversation does not rebuild other rows',keep)
   await page.evaluate("()=>{document.getElementById('workspace').scrollTop=81;}");await page.wait_for_timeout(150)
   mid=await page.evaluate("()=>({same:initialStoryItems.every((n,i)=>document.querySelectorAll('.storyShelfItem')[i]===n),p:document.getElementById('storyShelfV3').dataset.progress})")
   check('shared-element story transition still uses the same nodes',mid['same'] and 0<float(mid['p'])<1,mid)
   await page.evaluate("()=>{document.getElementById('workspace').scrollTop=0;}")
  await page.evaluate('()=>window.PablicusMediaCache.settled()');before=downloaded
  t=time.monotonic();await page.reload(wait_until='domcontentloaded')
  await page.wait_for_function("[...document.querySelectorAll('.chatCard .avatar img')].filter(x=>x.complete&&x.naturalWidth).length===4 && [...document.querySelectorAll('.storyShelfItem img')].filter(x=>x.complete&&x.naturalWidth).length===5",timeout=15000)
  warm_ms=round((time.monotonic()-t)*1000);warm_downloads=downloaded-before
  if label=='candidate':
   check('reopened home uses persistent avatar bytes without downloading again',warm_downloads==0,{'networkImageDownloads':warm_downloads,'homeMs':warm_ms})
   check('whole application boot has no JavaScript errors',not errors,errors)
  return {'rowsMs':rows_ms,'storyMetadataMs':metadata_ms,'avatarsMs':avatars_ms,'warmHomeMs':warm_ms,'coldImageDownloads':cold_downloads,'warmImageDownloads':warm_downloads,'initialRequests':[x['path'] for x in initial],'quietRequests':[x['path'] for x in quiet],'stability':stability,'errors':errors}
 except Exception:
  await page.screenshot(path=str(OUT/(A.engine+'-'+label+'-failure.png')))
  (OUT/(A.engine+'-'+label+'-diagnostic.json')).write_text(json.dumps({'errors':errors,'requests':requests,'loginError':await page.locator('#loginError').text_content(),'html':await page.locator('#screenContent').inner_html()},ensure_ascii=False,indent=2))
  raise
 finally:
  await ctx.close();server.shutdown()
async def main():
 result={}
 async with async_playwright() as p:
  browser=await getattr(p,A.engine).launch(headless=True)
  try:
   result['baseline']=await run_case(browser,A.baseline,'baseline');result['candidate']=await run_case(browser,A.root,'candidate')
   b=result['baseline'];c=result['candidate']
   check('authenticated first-home avatars appear faster under equal latency',c['avatarsMs']<b['avatarsMs'],{'beforeMs':b['avatarsMs'],'afterMs':c['avatarsMs']})
   check('home bootstrap uses fewer backend requests',len(c['initialRequests'])<len(b['initialRequests']),{'before':len(b['initialRequests']),'after':len(c['initialRequests'])})
  except Exception as e:checks.append({'name':'startup test failure','pass':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc())
  finally:await browser.close()
 result.update(engine=A.engine,passed=sum(x['pass'] for x in checks),failed=sum(not x['pass'] for x in checks),checks=checks,fixture='Real application modules and SDK; synthetic four-conversation accounts, 180 ms per API/image response; not owner-device timings')
 (OUT/(A.engine+'-startup.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
 if result['failed']:raise SystemExit(1)
asyncio.run(main())

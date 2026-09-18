"""Actual app/SDK/IndexedDB, synthetic accounts and equal 180ms network latency.
Not an owner-device benchmark. No private media or real credentials are used.
"""
import argparse,asyncio,base64,http.server,json,pathlib,threading,time,traceback,urllib.parse
from playwright.async_api import async_playwright
P=argparse.ArgumentParser();P.add_argument('--root',required=True);P.add_argument('--baseline',required=True);P.add_argument('--engine',default='chromium');A=P.parse_args();OUT=pathlib.Path('results');OUT.mkdir(exist_ok=True)
UID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';PEER='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';CID='cccccccc-cccc-4ccc-8ccc-000000000001';REMOTE='https://ctcoqgsztdtsazdiwcmd.supabase.co';DELAY=.18
profiles={u:{'id':u,'username':'tester'+str(i),'display_name':'Test '+str(i),'avatar_url':u+'/avatar.png','is_approved':True} for i,u in enumerate([UID,PEER])}
enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
user={'id':UID,'aud':'authenticated','role':'authenticated','email':'fixture@example.invalid','app_metadata':{'provider':'email','providers':['email']},'user_metadata':{},'identities':[],'created_at':'2026-01-01T00:00:00Z'}
TOKEN=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':UID,'aud':'authenticated','role':'authenticated','exp':int(time.time()+7200),'iss':REMOTE+'/auth/v1'})+'.not-a-real-signature'
SESSION={'access_token':TOKEN,'refresh_token':'fixture-not-used','token_type':'bearer','expires_in':7200,'expires_at':int(time.time()+7200),'user':user}
posts=[{'id':f'ffffffff-ffff-4fff-8fff-{i:012d}','owner_id':UID,'body':'Synthetic publication','media':[{'type':'image','path':UID+'/post-'+str(i)+'.png'}],'album_id':None,'archived':False,'created_at':f'2026-01-01T00:00:0{i}Z'} for i in [2,1]]
messages=[{'id':f'eeeeeeee-eeee-4eee-8eee-{i:012d}','conversation_id':CID,'sender_id':PEER,'type':'rich','body':'','server_seq':i,'created_at':f'2026-01-01T00:00:0{i}Z','attachment_metadata':{'v':1,'blocks':[{'id':'image-'+str(i),'type':'image','path':CID+'/photo-'+str(i)+'.png','width':512,'height':512,'mime':'image/png'}]}} for i in [1,2]]
def media(bucket,paths):return [{'bucket':bucket,'path':path,'object_id':f'99999999-9999-4999-8999-{i:012d}','version':'fixture-v1','mime':'image/png'} for i,path in enumerate(paths)]
def feed(ids):return {'server_now':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'stories':[]}
def card():return {'kind':'contact','conversation_id':CID,'conversation_ids':[CID],'profile':profiles[PEER],'personal':{'first_name':'','last_name':'','note':'','revision':0}}
checks=[]
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details or '',flush=True)
 if not ok:raise AssertionError(name)
CAPTURE="""
window.profileFrames=[];window.chatFrames=[];window.contactFrames=[];
const painted=n=>n&&n.isConnected&&getComputedStyle(n).visibility!=='hidden'&&!n.closest('[hidden]');
const ready=n=>!!(n?.complete&&n.naturalWidth>0);
function capture(){
 const p=document.querySelector('.youPage'),app=document.getElementById('app'),vp=document.getElementById('vp'),contact=document.getElementById('pablicusContactCard');
 if(painted(p)&&p.querySelector('.youName')&&profileFrames.length<180){const face=p.querySelector('.contactPhotoButton');profileFrames.push({t:performance.now(),avatar:ready(face?.querySelector('img')),initials:face?.querySelector('.contactFace')?.textContent?.trim()||'',tiles:[...p.querySelectorAll('.youTile img')].map(ready)});}
 if(painted(app)&&painted(vp)&&chatFrames.length<180){const v=vp.getBoundingClientRect(),imgs=[...document.querySelectorAll('#canvas .row:not([hidden]) .richMedia-image')].filter(n=>{const r=n.getBoundingClientRect();return r.height>0&&r.bottom>v.top&&r.top<v.bottom;});if(imgs.length)chatFrames.push({t:performance.now(),images:imgs.length,ready:imgs.filter(n=>n.classList.contains('richImageReady')&&ready(n.querySelector('img'))).length});}
 if(contact?.open&&contact.querySelector('.contactName')&&contactFrames.length<120)contactFrames.push({t:performance.now(),avatar:ready(contact.querySelector('.contactPhotoButton img'))});
 requestAnimationFrame(capture);
}requestAnimationFrame(capture);
"""
async def run_case(browser,root,label):
 root=pathlib.Path(root).resolve();picture=(root/'assets/icon-glass-20260909-512.png').read_bytes()
 class Handler(http.server.SimpleHTTPRequestHandler):
  def __init__(self,*args,**kw):super().__init__(*args,directory=str(root),**kw)
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
 ctx=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,service_workers='block')
 await ctx.add_init_script("localStorage.setItem('sb-ctcoqgsztdtsazdiwcmd-auth-token',"+json.dumps(json.dumps(SESSION))+");"+CAPTURE)
 await ctx.route_web_socket('**/realtime/**',lambda ws:ws.close())
 requests=[];downloads=[];slow=False
 async def route(r):
  req=r.request;u=urllib.parse.urlparse(req.url);path=urllib.parse.unquote(u.path);query=urllib.parse.parse_qs(u.query);data=json.loads(req.post_data or '{}') if req.method=='POST' else {}
  headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}
  if req.method=='OPTIONS':await r.fulfill(status=204,headers={**headers,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});return
  requests.append(path);await asyncio.sleep(DELAY)
  if req.method=='GET' and ('/object/sign/' in path or '/preview/' in path):downloads.append(path);await r.fulfill(status=200,body=picture,content_type='image/png',headers=headers);return
  body=[]
  if path=='/rest/v1/profiles':
   v=query.get('id',[''])[0];body=profiles.get(v[3:]) if v.startswith('eq.') else list(profiles.values())
  elif path=='/auth/v1/user':body=user
  elif path.endswith('/my_conversations_v3') or path.endswith('/my_conversations_v2'):body=[{'id':CID,'type':'direct','title':'Test 1','last_message':'Fixture','last_seq':2,'unread_count':0,'last_read_seq':2}]
  elif path.endswith('/pablicus_home_cards'):body={'cards':[card()],'owners':[UID,PEER],'feed':feed([UID,PEER]),'avatars':media('profile-media',[profiles[UID]['avatar_url'],profiles[PEER]['avatar_url']])}
  elif path.endswith('/pablicus_contact_card'):body=card()
  elif path.endswith('/pablicus_story_feed'):body=feed(data.get('p_owners',[]))
  elif path.endswith('/pablicus_profile_photos_list'):
   owner=data['p_owner_id'];body={'owner_id':owner,'photos':[{'path':profiles[owner]['avatar_url'],'is_main':True}],'total':1,'next_offset':None}
  elif path.endswith('/pablicus_profile_screen'):body={'owner_id':UID,'details':{},'posts':posts,'albums':[],'posts_more':False,'albums_more':False,'media':media('profile-media',[profiles[UID]['avatar_url']]+[x['media'][0]['path'] for x in posts])}
  elif path.endswith('/pablicus_conversation_screen'):body={'conversation_id':CID,'messages':messages[::-1],'media':media('message-media',[m['attachment_metadata']['blocks'][0]['path'] for m in messages])}
  elif path.endswith('/pablicus-media-preview'):body={'items':[{**x,'kind':'preview','url':REMOTE+'/preview/'+str(x['width'])+'/'+x['path'],'sourceVersion':'fixture-v1','sourceBytes':len(picture),'expiresIn':105} for x in data['items']]}
  elif path.startswith('/storage/v1/object/sign/'):body={'signedURL':path.replace('/storage/v1','')+'?token=fixture'}
  elif path=='/rest/v1/pablicus_profile_details':body={}
  elif path=='/rest/v1/pablicus_profile_posts':body=posts if UID in query.get('owner_id',[''])[0] else []
  elif path=='/rest/v1/pablicus_profile_albums':body=[]
  elif path=='/rest/v1/messages':body=[] if 'gt.' in query.get('server_seq',[''])[0] else messages[::-1]
  elif path=='/rest/v1/conversations':body=[{'id':CID,'type':'direct'}]
  elif path=='/rest/v1/conversation_members':body=[{'conversation_id':CID,'user_id':PEER,'last_read_seq':2}]
  elif path.startswith('/functions/'):body={}
  await r.fulfill(status=200,content_type='application/json',headers=headers,body=json.dumps(body))
 await ctx.route(REMOTE+'/**',route);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));result={}
 async def home():await page.wait_for_function("document.querySelector('.chatCard .avatar img')?.naturalWidth>0 && getComputedStyle(document.getElementById('home')).visibility!=='hidden'",timeout=15000)
 async def profile_visit():
  await page.evaluate('()=>{profileFrames=[];}');start=time.monotonic();await page.click('#mainNav>[data-page="profile"]')
  await page.wait_for_function("document.querySelector('.youTile img')?.naturalWidth>0 && document.querySelector('.contactPhotoButton img')?.naturalWidth>0 && getComputedStyle(document.querySelector('.youPage')).visibility!=='hidden'",timeout=15000)
  await page.wait_for_timeout(80);return {'completeMs':round((time.monotonic()-start)*1000),'first':await page.evaluate('()=>profileFrames[0]')}
 async def chat_visit():
  await page.click('#mainNav>[data-page="chats"]');await home();await page.evaluate('()=>{chatFrames=[];}');start=time.monotonic()
  await page.evaluate('(id)=>PablicusController.getServices().openConversation({id,title:"Test 1"})',CID)
  await page.wait_for_function("chatFrames.some(x=>x.images===x.ready)&&!document.getElementById('app').hidden",timeout=15000)
  return {'completeMs':round((time.monotonic()-start)*1000),'first':await page.evaluate('()=>chatFrames[0]')}
 try:
  await page.goto(url,wait_until='domcontentloaded');await home();result['profileCold']=await profile_visit();await page.screenshot(path=str(OUT/(A.engine+'-'+label+'-profile.png')))
  result['chatCold']=await chat_visit();await page.screenshot(path=str(OUT/(A.engine+'-'+label+'-chat.png')))
  await page.fill('#input','P05 saved draft');await page.click('#chatBack');await home();await page.evaluate('()=>PablicusMediaCache.settled()')
  before=len(downloads);result['profileWarm']=await profile_visit();result['chatWarm']=await chat_visit();result['repeatDownloads']=len(downloads)-before
  result['draft']=await page.input_value('#input');await page.click('#chatBack');await page.evaluate('()=>PablicusMediaCache.settled()')
  await page.reload(wait_until='domcontentloaded');await home();before=len(downloads);requests.clear()
  result['profileAfterReload']=await profile_visit();result['chatAfterReload']=await chat_visit();result['reloadDownloads']=len(downloads)-before;result['reloadRequests']=list(requests)
  if label=='candidate':
   for name in ['profileCold','profileWarm','profileAfterReload']:
    f=result[name]['first'];check(name+' first visible frame already has avatar and publication thumbnails',f and f['avatar'] and not f['initials'] and len(f['tiles'])==2 and all(f['tiles']),result[name])
   for name in ['chatCold','chatWarm','chatAfterReload']:
    f=result[name]['first'];check(name+' first visible frame has decoded visible photos',f and f['images']>0 and f['images']==f['ready'],result[name])
   check('repeat visits do not download previously displayed images',result['repeatDownloads']==0,result['repeatDownloads'])
   check('document reload reuses stored profile and chat image bytes',result['reloadDownloads']==0,result['reloadDownloads'])
   check('fresh screen metadata avoids separate preview authorization on warm start',not any('/functions/v1/pablicus-media-preview' in x for x in result['reloadRequests']),result['reloadRequests'])
   check('chat draft survives screen preparation and navigation',result['draft']=='P05 saved draft',result['draft'])
   check('existing cache uses fresh screen proofs',await page.evaluate('()=>PablicusMediaCache.stats().screenProofHits')>=4,await page.evaluate('()=>PablicusMediaCache.stats()'))
   await page.click('#chatBack');await home();await page.evaluate('(id)=>PablicusContacts.open(id)',CID);await page.wait_for_timeout(300)
   f=await page.evaluate('()=>contactFrames[0]');check('contact header reuses already decoded avatar',f and f['avatar'],f);await page.evaluate('()=>PablicusContacts.close(true)')
   await page.evaluate('()=>PablicusController.sessionChanged(null)');check('account change discards transient screen proofs and decoded images',await page.evaluate('()=>PablicusScreenData.stats().proofEntries===0&&PablicusScreenData.stats().decodedEntries===0'))
   check('no uncaught runtime exceptions',not errors,errors)
  result['errors']=errors;return result
 except Exception:
  await page.screenshot(path=str(OUT/(A.engine+'-'+label+'-screens-failure.png')));(OUT/(A.engine+'-'+label+'-screens-diagnostic.json')).write_text(json.dumps({'errors':errors,'requests':requests,'profileFrames':await page.evaluate('()=>profileFrames.slice(0,6)'),'chatFrames':await page.evaluate('()=>chatFrames.slice(0,6)')},indent=2));raise
 finally:await ctx.close();server.shutdown()
async def main():
 result={}
 async with async_playwright() as p:
  browser=await getattr(p,A.engine).launch(headless=True)
  try:
   result['baseline']=await run_case(browser,A.baseline,'baseline');result['candidate']=await run_case(browser,A.root,'candidate')
   check('warm profile complete frame is not slowed by readiness gate',result['candidate']['profileAfterReload']['completeMs']<result['baseline']['profileAfterReload']['completeMs']+200,{'before':result['baseline']['profileAfterReload']['completeMs'],'after':result['candidate']['profileAfterReload']['completeMs']})
  except Exception as e:checks.append({'name':'screens test failure','pass':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc())
  finally:await browser.close()
 result.update(engine=A.engine,passed=sum(x['pass'] for x in checks),failed=sum(not x['pass'] for x in checks),checks=checks,fixture='Actual application + SDK + IndexedDB; isolated synthetic account, 180ms API/image responses; not physical iPhone')
 (OUT/(A.engine+'-screens.json')).write_text(json.dumps(result,indent=2))
 if result['failed']:raise SystemExit(1)
asyncio.run(main())

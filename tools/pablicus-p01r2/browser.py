"""Real browser/network/IndexedDB checks. Synthetic media, no production accounts."""
import argparse,http.server,json,pathlib,re,threading,traceback,urllib.parse
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser();P.add_argument('--root',required=True);P.add_argument('--baseline');P.add_argument('--engine',default='chromium');A=P.parse_args()
R=pathlib.Path(A.root).resolve();BASE=pathlib.Path(A.baseline).resolve() if A.baseline else R
OUT=pathlib.Path('results');OUT.mkdir(exist_ok=True)
PROJECT='https://ctcoqgsztdtsazdiwcmd.supabase.co'
BOOT=r"""window.testUser='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.testGeneration=1;window.testSubscribers=[];window.testDenied=false;window.signCallCount=0;
window.testClient={storage:{from:bucket=>({createSignedUrl:async(path,ttl)=>{signCallCount++;if(testDenied)return {error:Error('Permission denied')};const r=await fetch('https://ctcoqgsztdtsazdiwcmd.supabase.co/storage/v1/object/sign/'+bucket+'/'+path,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer test-only'},body:JSON.stringify({expiresIn:ttl})});return r.ok?{data:await r.json()}:{error:Error('denied')};}})},rpc:async(name)=>({data:{server_now:new Date().toISOString(),stories:[window.testStory]}})};
window.testStory={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',owner_id:testUser,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),media:{type:'image',path:testUser+'/story.png'},body:''};
window.testState=()=>({sessionUserId:testUser,sessionGeneration:testGeneration,screen:'conversation',section:'chats',conversationId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'});
window.PablicusController={state:testState,subscribe:fn=>{testSubscribers.push(fn);return()=>{}},getServices:()=>({client:testClient,getProfile:()=>({id:testUser,display_name:'Tester',is_approved:true}),notify:()=>{}})};
window.PablicusAvatarStoriesUI={snapshot:()=>({people:[{id:testUser,name:'Tester',url:''}],stories:[testStory],now:Date.now()}),compose:()=>{}};
window.changeTestUser=id=>{testUser=id;testGeneration++;testSubscribers.forEach(f=>f(testState()))};
window.PablicusHost={notify:()=>{},acceptFile:()=>true,canSend:()=>true,paintReplyDraft:()=>{},messageMeta:()=>document.createElement('span'),composerSources:async()=>[],composerAction:async()=>{},showOutbox:()=>{},historyTop:()=>{},unavailable:()=>{}};
"""
SCRIPTS=['component-registry.js','app-shell.js','vault.js','outbox.js','transport-store.js','rich-store.js','icons-r2.js','composer-r2.js','rich-composer.js','message-menu.js','rich-message.js','chat.js','stories-v3-core.js','stories-v3-viewer.js','profile-photos.js']
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(R),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  path=urllib.parse.urlparse(self.path).path
  if path in ['/test.html','/baseline.html']:
   base=BASE if path.startswith('/baseline') else R;prefix='/baseline/' if path.startswith('/baseline') else '/'
   html=(base/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
   html=html.replace('href="','href="'+prefix)
   files=(['media-cache.js'] if (base/'media-cache.js').exists() else [])+SCRIPTS
   html=html.replace('</body>','<script>'+BOOT+'</script>'+''.join('<script src="'+prefix+x+'"></script>' for x in files)+'</body>')
   b=html.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
  if path.startswith('/baseline/'):
   p=(BASE/path[len('/baseline/'):]);
   if p.is_file():
    b=p.read_bytes();self.send_response(200);self.send_header('Content-Type',self.guess_type(str(p)));self.end_headers();self.wfile.write(b);return
  return super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
picture=(R/'assets/icon-glass-20260909-512.png').read_bytes()
checks=[]
def check(name,condition,details=None):
 checks.append({'name':name,'pass':bool(condition),'details':details});print(('PASS ' if condition else 'FAIL ')+name,details or '',flush=True)
 if not condition:raise AssertionError(name)
with sync_playwright() as p:
 browser=getattr(p,A.engine).launch(headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 counts={};signs={};errors=[]
 def route(r):
  q=r.request;url=q.url;parts=urllib.parse.urlparse(url);path=parts.path
  if q.method=='OPTIONS':
   r.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'authorization,content-type'});return
  if q.method=='POST':
   signs[path]=signs.get(path,0)+1
   r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'signedUrl':PROJECT+path+'?token='+str(signs[path])}));return
  counts[path]=counts.get(path,0)+1
  r.fulfill(status=200,content_type='image/png',headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'},body=picture)
 context.route(PROJECT+'/**',route)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  if A.baseline:
   page.goto(origin+'/baseline.html');page.wait_for_timeout(250)
   page.evaluate("()=>{document.getElementById('home').hidden=true;document.getElementById('app').hidden=false;document.getElementById('startPanel').hidden=true;document.getElementById('canvas').style.height='600px';window.baselineRender=()=>{const host=document.getElementById('canvas');host.replaceChildren();const v=PablicusRichMessage.render({v:1,blocks:[{id:'one',type:'image',path:'test.png'}]},{resolveUrl:async()=> '"+PROJECT+"/storage/v1/object/sign/message-media/baseline.png?token=one'});host.append(v);v.activate();};baselineRender();}")
   page.wait_for_timeout(1400);first=counts.get('/storage/v1/object/sign/message-media/baseline.png',0)
   page.evaluate('()=>baselineRender()');page.wait_for_timeout(1400);second=counts.get('/storage/v1/object/sign/message-media/baseline.png',0)
   checks.append({'name':'baseline network after row recreation','pass':True,'details':{'first':first,'second':second,'note':'Observation, not a performance guarantee'}})
  page.goto(origin+'/test.html');page.wait_for_function('window.PablicusMediaCache && window.PablicusChat')
  counts.clear();signs.clear();errors.clear()
  data=page.evaluate("""async()=>{const c=PablicusMediaCache;const results=await Promise.all(Array.from({length:8},()=>c.resolve('message-media','shared.png',{type:'image',width:960})));await c.settled();return {same:results.every(x=>x===results[0]),stats:c.stats()};}""")
  check('parallel consumers share one transfer',data['same'] and data['stats']['imageDownloads']==1,data)
  data=page.evaluate("""async()=>{const u=await PablicusMediaCache.resolve('message-media','shared.png',{type:'image',width:960});const image=new Image;image.src=u;await image.decode();return {width:image.naturalWidth,stats:PablicusMediaCache.stats()};}""")
  check('cached bytes decode without network',data['width']==512 and data['stats']['imageDownloads']==1,data)
  page.evaluate("""async()=>{PablicusHost.renderMessage=m=>{const row=document.createElement('article');row.className='row';row.dataset.id=m.id;row.dataset.rev=m.revision;const b=document.createElement('div');b.className='bubble';b.append(PablicusRichMessage.render(m.content,{resolveUrl:(p,bl)=>PablicusMediaCache.resolve('message-media',p,{type:bl.type,width:960}),peekUrl:p=>PablicusMediaCache.peek('message-media',p,{width:960})}));row.append(b);return row;};PablicusHost.renderPendingMessage=PablicusHost.renderMessage;
   document.getElementById('home').hidden=true;document.getElementById('app').hidden=false;
   window.messages=Array.from({length:32},(_,i)=>({id:'message-'+i,number:i,revision:1,remote:{id:'message-'+i},text:'',content:{v:1,blocks:[{id:'photo-'+i,type:'image',path:'conversation/photo-'+i+'.png',width:512,height:512}]}}));
   await PablicusChat.open(testUser,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',messages);
  }""")
  page.wait_for_timeout(1200)
  for i in [31,24,17,10,3,0]:
   page.evaluate('(i)=>PablicusChat.list.go(i)',i);page.wait_for_timeout(550)
  page.wait_for_timeout(1000);firstDownloads=sum(v for k,v in counts.items() if '/conversation/' in k)
  for i in [3,10,17,24,31,24,17,10,3,0]:
   page.evaluate('(i)=>PablicusChat.list.go(i)',i);page.wait_for_timeout(350)
  secondDownloads=sum(v for k,v in counts.items() if '/conversation/' in k)
  check('scroll down and back does not redownload viewed images',firstDownloads==secondDownloads and firstDownloads>0,{'cold':firstDownloads,'after_two_returns':secondDownloads})
  data=page.evaluate("""()=>({rows:PablicusChat.list.nodes.size,live:document.querySelectorAll('#canvas .row:not([hidden])').length,ready:[...document.querySelectorAll('#canvas .row:not([hidden]) img')].every(i=>i.complete&&i.naturalWidth>0),audit:gate.audit()})""")
  check('warm rows remain painted and bounded',data['rows']<=120 and data['ready'],data)
  page.evaluate("""async()=>{await PablicusChat.leave();await PablicusChat.open(testUser,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',messages);}""");page.wait_for_timeout(750)
  check('reopen conversation reuses loaded media',sum(v for k,v in counts.items() if '/conversation/' in k)==secondDownloads)
  page.evaluate("()=>PablicusStoriesViewer.open(testUser)")
  page.wait_for_function("document.querySelector('.storyViewerV3')?.querySelector('div')?.shadowRoot?.querySelector('img.media')?.naturalWidth>0",timeout=10000)
  n=sum(v for k,v in counts.items() if k.endswith('/story.png'))
  page.evaluate('()=>PablicusStoriesViewer.close()');page.evaluate('()=>PablicusStoriesViewer.open(testUser)')
  page.wait_for_function("document.querySelector('.storyViewerV3')?.querySelector('div')?.shadowRoot?.querySelector('img.media')?.naturalWidth>0",timeout=10000)
  check('reopened story performs no second image transfer',n==1 and sum(v for k,v in counts.items() if k.endswith('/story.png'))==n)
  page.screenshot(path=str(OUT/(A.engine+'-story.png')))
  page.evaluate('()=>PablicusStoriesViewer.close()')
  page.evaluate('()=>PablicusMediaCache.settled()');before=sum(counts.values());page.reload();page.wait_for_function('window.PablicusMediaCache')
  data=page.evaluate("""async()=>{const url=await PablicusMediaCache.resolve('message-media','shared.png',{type:'image',width:960});const im=new Image;im.src=url;await im.decode();return PablicusMediaCache.stats();}""")
  check('document reload uses IndexedDB image, not network body',sum(counts.values())==before and data['diskHits']>0,data)
  check('private cache still requests fresh authorization',data['signRequests']==1)
  page.evaluate("()=>changeTestUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')")
  check('account switch removes in-memory capabilities',page.evaluate("()=>PablicusMediaCache.peek('message-media','shared.png',{width:960})") is None)
  page.evaluate('()=>{testDenied=true;}')
  denied=page.evaluate("""async()=>{try{await PablicusMediaCache.resolve('message-media','shared.png',{type:'image',width:960});return false;}catch{return true;}}""")
  check('denied account does not receive cached media',denied)
  page.evaluate('()=>{testDenied=false;}');before=sum(counts.values())
  data=page.evaluate("""async()=>{const u=await PablicusMediaCache.resolve('message-media','clip.mp4',{type:'video'});return {network:u.startsWith('https:'),stats:PablicusMediaCache.stats()};}""")
  check('video is a range URL, not a full-blob download',data['network'] and sum(counts.values())==before,data)
  page.evaluate("()=>Promise.all(Array.from({length:7},(_,i)=>PablicusMediaCache.resolve('profile-media','profile-'+i+'.png',{type:'image',width:192})))")
  data=page.evaluate('()=>PablicusMediaCache.stats()');check('network work is bounded to three image transfers',data['peakDownloads']<=3,data)
  check('no browser runtime exceptions',not errors,errors)
 except Exception as e:
  checks.append({'name':'unhandled test failure','pass':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc());page.screenshot(path=str(OUT/(A.engine+'-failure.png')))
 finally:
  report={'engine':A.engine,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'network':{'get':counts,'post':signs},'browser_errors':errors,'fixture':'synthetic authorized media, not owner iPhone'}
  (OUT/(A.engine+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close();server.shutdown()
if report['failed']:raise SystemExit(1)

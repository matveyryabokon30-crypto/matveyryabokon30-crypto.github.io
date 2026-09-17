import argparse,http.server,json,pathlib,threading,traceback,urllib.parse
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser();P.add_argument('--root',required=True);P.add_argument('--engine',default='chromium');A=P.parse_args();R=pathlib.Path(A.root).resolve();OUT=pathlib.Path('results');OUT.mkdir(exist_ok=True)
SOURCE=(OUT/'fixtures/original.jpg').read_bytes();PREVIEWS={s:(OUT/f'fixtures/{s}.webp').read_bytes() for s in [192,960,1600]};REMOTE='https://ctcoqgsztdtsazdiwcmd.supabase.co'
BOOT="""window.uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.gen=1;window.subscribers=[];window.legacySigns=0;window.denied=false;window.apiDown=false;
window.client={functions:{invoke:async(n,o)=>{const r=await fetch('https://ctcoqgsztdtsazdiwcmd.supabase.co/functions/v1/'+n,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...o.body,denied,apiDown}),signal:o.signal});return r.ok?{data:await r.json()}:{error:Error('unavailable')};}},storage:{from:b=>({createSignedUrl:async(p,ttl)=>{legacySigns++;return {data:{signedUrl:'https://ctcoqgsztdtsazdiwcmd.supabase.co/original/'+encodeURIComponent(p)}};}})}};
window.PablicusController={state:()=>({sessionUserId:uid,sessionGeneration:gen}),getServices:()=>({client}),subscribe:fn=>{subscribers.push(fn);return()=>{};}};
window.changeUser=()=>{uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';gen++;subscribers.forEach(f=>f(PablicusController.state()));};
"""
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(R),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path=='/p02-test':
   b=('<!doctype html><meta charset="utf-8"><script>'+BOOT+'</script><script src="media-preview-client.js"></script><script src="media-cache.js"></script>').encode();self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b);return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
checks=[];calls=[];gets=[];held=[];prepared=set();errors=[]
def check(n,ok,d=None):
 checks.append({'name':n,'pass':bool(ok),'details':d});print(('PASS ' if ok else 'FAIL ')+n,d or '',flush=True)
 if not ok:raise AssertionError(n)
with sync_playwright() as p:
 browser=getattr(p,A.engine).launch(headless=True);ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  request=r.request;u=urllib.parse.urlparse(request.url)
  headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}
  if request.method=='OPTIONS':r.fulfill(status=204,headers={**headers,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,GET,OPTIONS'});return
  if request.method=='POST':
   data=json.loads(request.post_data);calls.append(data)
   if data.get('apiDown'):r.fulfill(status=503,body='unavailable',headers=headers);return
   items=[]
   for item in data['items']:
    if data.get('denied'):items.append({**item,'error':'not_available'});continue
    fresh=item['path'].startswith('fresh') and item['path'] not in prepared and data['action']!='build'
    if data['action']=='build':prepared.add(item['path'])
    items.append({**item,'url':REMOTE+('/original/' if fresh else '/preview/'+str(item['width'])+'/')+urllib.parse.quote(item['path'],safe=''),'kind':'original' if fresh else 'preview','sourceVersion':'fixture-v1','sourceBytes':len(SOURCE),'expiresIn':105,'canPrepare':fresh})
   r.fulfill(status=200,content_type='application/json',headers=headers,body=json.dumps(items[0] if data['action']=='build' else {'items':items}));return
  gets.append(request.url)
  if '/original/slow-' in request.url:held.append(r);return
  blob=PREVIEWS[int(u.path.split('/')[2])] if u.path.startswith('/preview/') else SOURCE
  r.fulfill(status=200,body=blob,content_type='image/webp' if u.path.startswith('/preview/') else 'image/jpeg',headers=headers)
 ctx.route(REMOTE+'/**',route)
 try:
  page.goto(origin+'/p02-test');page.wait_for_function('window.PablicusMediaCache')
  data=page.evaluate("""async()=>{const urls=await Promise.all(Array.from({length:8},(_,i)=>PablicusMediaCache.resolve('message-media','cold-'+i+'.jpg',{type:'image',width:960})));await Promise.all(urls.map(u=>{const i=new Image;i.src=u;return i.decode();}));await PablicusMediaCache.settled();return PablicusMediaCache.stats();}""")
  check('eight first-screen images use one authorization batch',len(calls)==1 and len(calls[0]['items'])==8,{'batches':len(calls),'items':len(calls[0]['items'])})
  check('cold screen downloads only server previews, not originals',len(gets)==8 and all('/preview/' in u for u in gets),data)
  check('cold image bytes are materially smaller',data['downloadBytes']==8*len(PREVIEWS[960]) and data['downloadBytes']<8*len(SOURCE)*.4,{'originalBytes':8*len(SOURCE),'receivedBytes':data['downloadBytes']})
  before=len(gets);page.evaluate("()=>Promise.all(Array.from({length:8},(_,i)=>PablicusMediaCache.resolve('message-media','cold-'+i+'.jpg',{type:'image',width:960})))")
  check('repeat scroll uses no new network transfer',len(gets)==before)
  page.reload();page.wait_for_function('window.PablicusMediaCache');calls.clear();before=len(gets)
  data=page.evaluate("""async()=>{const urls=await Promise.all(Array.from({length:8},(_,i)=>PablicusMediaCache.resolve('message-media','cold-'+i+'.jpg',{type:'image',width:960})));await Promise.all(urls.map(u=>{const im=new Image;im.src=u;return im.decode();}));return PablicusMediaCache.stats();}""")
  check('warm document start reads disk without image downloads',len(gets)==before and data['diskHits']==8 and data['imageDownloads']==0,data)
  check('warm start still authorizes, once per batch',len(calls)==1 and data['parallelDiskReads']==8)
  before=len(gets);data=page.evaluate("""async()=>{const url=await PablicusMediaCache.resolve('pablicus-story-media','fresh-story.jpg',{type:'image',width:1600,priority:-10});const im=new Image;im.src=url;await im.decode();return {width:im.naturalWidth,stats:PablicusMediaCache.stats()};}""")
  check('new story is prepared on server before phone transfer','fresh-story.jpg' in prepared and len(gets)==before+1 and '/preview/1600/' in gets[-1],data)
  check('original is not fetched while preparing a new preview',not any('/original/' in u for u in gets))
  page.evaluate("()=>{const now=Date.now;Date.now=()=>now()+121000;denied=true;}")
  before=len(gets);blocked=page.evaluate("""async()=>{try{await PablicusMediaCache.resolve('message-media','cold-0.jpg',{type:'image',width:960});return false;}catch{return true;}}""")
  check('revoked permission does not expose persisted image',blocked and len(gets)==before and page.evaluate('()=>legacySigns')==0)
  page.evaluate('()=>{denied=false;}')
  page.evaluate("()=>{window.slow=Promise.all([0,1,2].map(i=>PablicusMediaCache.resolve('message-media','slow-'+i+'.jpg',{type:'image',width:0,priority:2})));}")
  for _ in range(20):
   if len(held)==3:break
   page.wait_for_timeout(100)
  check('background transfer fixture occupies three slots',len(held)==3)
  done=page.evaluate("""async()=>{const url=await PablicusMediaCache.resolve('pablicus-story-media','urgent-story.jpg',{type:'image',width:1600,priority:-10});const im=new Image;im.src=url;await im.decode();return true;}""")
  check('foreground story bypasses blocked background transfers',done and len(held)==3)
  for r in held:r.fulfill(status=200,body=SOURCE,content_type='image/jpeg',headers={'Access-Control-Allow-Origin':'*'})
  held.clear();page.evaluate('()=>window.slow')
  data=page.evaluate('()=>PablicusMediaCache.stats()');check('total image work has a bounded urgent reserve',data['peakDownloads']<=4,data)
  page.evaluate('()=>{apiDown=true;PablicusPreviewClient.clear();}')
  data=page.evaluate("""async()=>{const url=await PablicusMediaCache.resolve('message-media','fallback.jpg',{type:'image',width:960});const im=new Image;im.src=url;await im.decode();return im.naturalWidth;}""")
  check('optimization outage falls back to authorized original',data==960 and page.evaluate('()=>legacySigns')>0)
  page.evaluate('()=>changeUser()');check('switching account clears private memory cache',page.evaluate("()=>PablicusMediaCache.peek('message-media','cold-0.jpg',{width:960})") is None)
  check('no uncaught browser errors',not errors,errors)
 except Exception as e:
  checks.append({'name':'test failure','pass':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc())
 finally:
  result={'engine':A.engine,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'fixture':'Actual P02 client modules, synthetic ACL responses, real WASM-produced preview files; not owner iPhone'};(OUT/f'p02-{A.engine}.json').write_text(json.dumps(result,indent=2));browser.close();server.shutdown()
if result['failed']:raise SystemExit(1)

"""Large-photo and authorization regressions against the real cache implementation."""
import argparse,http.server,io,json,pathlib,random,threading,traceback,urllib.parse
from PIL import Image
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser();P.add_argument('--root',required=True);P.add_argument('--engine',default='chromium');A=P.parse_args();R=pathlib.Path(A.root).resolve();OUT=pathlib.Path('results');OUT.mkdir(exist_ok=True)
rng=random.Random(11);im=Image.frombytes('RGB',(2000,1800),rng.randbytes(2000*1800*3));out=io.BytesIO();im.save(out,format='JPEG',quality=99);LARGE=out.getvalue();small=io.BytesIO();im.resize((64,64)).save(small,format='PNG');SMALL=small.getvalue()
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(R),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/probe':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<!doctype html><title>Private media regression fixture</title>');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';REMOTE='https://ctcoqgsztdtsazdiwcmd.supabase.co'
BOOT="""window.uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.gen=1;window.listeners=[];window.deny=false;window.blockSign=false;window.signs=0;window.leaseLengths=[];
window.PablicusController={state:()=>({sessionUserId:uid,sessionGeneration:gen}),subscribe:f=>{listeners.push(f);return()=>{}},getServices:()=>({client:{storage:{from:bucket=>({createSignedUrl:async(path,ttl)=>{signs++;leaseLengths.push(ttl);if(blockSign)await new Promise(r=>window.releaseSign=r);if(deny)return {error:Error('Denied')};return {data:{signedUrl:'https://ctcoqgsztdtsazdiwcmd.supabase.co/storage/v1/object/sign/'+bucket+'/'+path+'?token='+signs}};}})}}})};
window.switchUser=id=>{uid=id;gen++;listeners.forEach(f=>f(PablicusController.state()))};"""
checks=[]
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details or '',flush=True)
 if not ok:raise AssertionError(name)
with sync_playwright() as p:
 browser=getattr(p,A.engine).launch(headless=True);ctx=browser.new_context();page=ctx.new_page();counts={};fail={'retry':True};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  path=urllib.parse.urlparse(r.request.url).path;counts[path]=counts.get(path,0)+1
  if 'retry.jpg' in path and fail['retry']:r.fulfill(status=503,body='temporary',headers={'Access-Control-Allow-Origin':'*'});return
  data=LARGE if path.endswith('large.jpg') else SMALL
  r.fulfill(status=200,body=data,content_type='image/jpeg' if data is LARGE else 'image/png',headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'})
 ctx.route(REMOTE+'/**',route)
 try:
  page.goto(origin+'/probe');page.evaluate(BOOT);page.add_script_tag(url=origin+'/media-cache.js')
  info=page.evaluate("""async()=>{const u=await PablicusMediaCache.resolve('message-media','large.jpg',{type:'image',width:960});const i=new Image;i.src=u;await i.decode();await PablicusMediaCache.settled();return {width:i.naturalWidth,height:i.naturalHeight,stats:PablicusMediaCache.stats()};}""")
  check('multi-megabyte photo is decoded once into bounded preview',len(LARGE)>3000000 and info['width']==960 and info['stats']['memoryBytes']<len(LARGE)//2,info)
  n=sum(counts.values());info=page.evaluate("""async()=>{const u=await PablicusMediaCache.resolve('message-media','large.jpg',{type:'image',width:0});const i=new Image;i.src=u;await i.decode();return {width:i.naturalWidth,stats:PablicusMediaCache.stats()};}""")
  check('full-resolution original is preserved without another transfer',info['width']==2000 and sum(counts.values())==n,info)
  info=page.evaluate("""async()=>{window.clock=Date.now;Date.now=()=>clock()+310000;deny=true;try{await PablicusMediaCache.resolve('message-media','large.jpg',{type:'image',width:960});return false;}catch{return true;}finally{Date.now=clock;deny=false;}}""")
  check('expired authorization is rechecked before cached private media',info)
  check('signed permissions are not extended to one hour',page.evaluate('()=>leaseLengths.every(x=>x<=300)'))
  info=page.evaluate("""async()=>{try{await PablicusMediaCache.resolve('pablicus-story-media',uid+'/expired.png',{type:'image',expiresAt:Date.now()-1});return false;}catch{return true;}}""")
  check('expired story cannot be served from cache',info)
  page.evaluate("()=>{blockSign=true;window.race=PablicusMediaCache.resolve('profile-media','race.png',{type:'image'}).then(()=>false,()=>true);}")
  page.wait_for_function('typeof releaseSign==="function"');page.evaluate("()=>{switchUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');blockSign=false;releaseSign();}")
  check('old-account async completion is rejected',page.evaluate('()=>race'))
  check('old-account in-memory images were released',page.evaluate('()=>PablicusMediaCache.stats().memoryEntries')==0)
  info=page.evaluate("""async()=>{try{await PablicusMediaCache.resolve('message-media','retry.jpg',{type:'image'});return false;}catch{return true;}}""");check('HTTP failure is not cached as image',info)
  fail['retry']=False;info=page.evaluate("""async()=>{const u=await PablicusMediaCache.resolve('message-media','retry.jpg',{type:'image'});const i=new Image;i.src=u;await i.decode();return i.naturalWidth;}""");check('failed image can be retried successfully',info==64)
  check('no uncaught runtime error in edge cases',not errors,errors)
 except Exception as e:
  checks.append({'name':'extended test failure','pass':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc())
 finally:
  result={'engine':A.engine,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'fixture':'synthetic 2000x1800 JPEG; actual media-cache.js; no production identity','large_photo_bytes':len(LARGE)}
  (OUT/(A.engine+'-extended.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close();server.shutdown()
if result['failed']:raise SystemExit(1)

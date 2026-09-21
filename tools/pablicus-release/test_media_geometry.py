"""Actual NaturalList + production renderMessage/rich renderer, all runtime CSS.
Synthetic media/network/action callbacks only; no fixed-position mock rows, accounts,
user content or production writes. Proves layout, not physical iPhone acceptance.
"""
import argparse,base64,hashlib,http.server,json,pathlib,re,threading,traceback
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',choices=['chromium','webkit'],required=True)
p.add_argument('--full-app',action='store_true');p.add_argument('--executable');p.add_argument('--expect-regression',action='store_true');a=p.parse_args()
root=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True)
label=('baseline-' if a.expect_regression else '')+'media-geometry-'+a.engine
html=(root/'index.html').read_text();styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S);html=re.sub(r'<link\b[^>]*>','',html)
chat=(root/'chat.js').read_text();host=(root/'app.js').read_text()
list_code=chat[chat.index('function historyInsets()'):chat.index('const draft=')]
render_code=host[host.index(' const stamp='):host.index(' function renderPendingMessage')]
setup="""const $=id=>document.getElementById(id),vp=$('vp'),canvas=$('canvas'),app=$('app');
const OVERSCAN=560,LIMIT=120,counters={active_lists:0,created:0,destroyed:0,max_dom:0};
const scrollEvidence={renders:0,events:0,gestures:0,measured_rows:0,programmatic_writes:0,writes_from_scroll:0,min_top:Infinity};
const round=x=>+x.toFixed(3);let list;const peersRead=0,BUCKET='fixture';
const el=(tag,cls,text)=>{const n=document.createElement(tag);window.PablicusUI?.prepareControl?.(n);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const messageTools={decorate:()=>{}}; // Action side effects are outside this layout test.
const signedUrl=(path,options)=>PablicusMediaCache.resolve(BUCKET,path,options);
const nodeFor=m=>renderMessage(m);
"""
expose="""window.Fixture={mount:(m)=>{list?.destroy();list=new NaturalList(m);list.bottom();},
get list(){return list},audit,scrollEvidence,counters,
replace:(m)=>{const a=list.capture(),f=list.follow;list.messages=m;list.sync(a,f,'server-update');}};
"""
fixture="""()=>{
const svg=(w,h)=>URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="orange"/><rect x="10" y="10" width="${w-20}" height="${h-20}" fill="lightblue"/></svg>`],{type:'image/svg+xml'}));
window.testUrls={portrait:svg(600,900),landscape:svg(1600,900),square:svg(800,800),tall:svg(200,1800)};
window.releaseMedia=null;window.mediaReady=new Promise(r=>window.releaseMedia=r);window.mediaRequests=[];
window.PablicusMediaCache={...window.PablicusMediaCache,peek:()=>null,resolve:async(bucket,path)=>{mediaRequests.push(path);await mediaReady;return testUrls[path]||testUrls.portrait;}};
window.raw=(i,type,md={},body='')=>({id:'geometry-'+i,sender_id:i%2?'fixture-owner':'fixture-peer',conversation_id:'fixture-chat',server_seq:i+1,created_at:'2026-09-20T23:54:00Z',type,attachment_path:'portrait',attachment_metadata:md,body});
window.rich=(i,blocks)=>raw(i,'rich',{v:1,blocks});window.im=(id,path)=>({id,type:'image',path});
window.mapped=(r,i)=>({id:r.id,number:r.server_seq,mine:i!==0,text:r.body||'',revision:0,remote:r});
const rows=[raw(0,'image'),...Array.from({length:4},(_,i)=>raw(i+1,'text',{},'Сообщение удалено')),rich(5,[im('portrait','portrait')]),rich(6,[im('a','portrait'),im('b','landscape')]),rich(7,[im('tall','tall')]),raw(8,'text',{},'Последнее сообщение. Текст не должен перекрываться.')];
window.fixtureMessages=rows.map(mapped);
$('home').hidden=true;app.hidden=false;$('startPanel').hidden=true;$('composeBox').classList.add('r2Composer');
Fixture.mount(fixtureMessages);
}"""
checks=[];errors=[]
# Retain progress even if a browser process stops answering during media setup.
def progress():
 (out/(label+'-progress.json')).write_text(json.dumps(checks,ensure_ascii=False,indent=2))
def check(name,passed,details=None):
 checks.append(dict(name=name,passed=bool(passed),details=details));print(('PASS ' if passed else 'FAIL ')+name,details or '',flush=True)
 progress()
 if not passed:raise AssertionError(name)
def geometry(page,name):
 g=page.evaluate('Fixture.audit()');check(name,g['max_overlap_px']<=1.5 and g['max_gap_px']<=1.5 and g['model_error_px']<=1.5 and not g['clipped'] and not g['width_errors'] and g['active']==1,g)
def bottom(page,name):
 value=page.evaluate("""()=>{const n=Fixture.list.nodes.get(Fixture.list.messages.at(-1).id);return {distance:Fixture.list.bottomDistance(),bottom:n?.getBoundingClientRect().bottom,composer:$('composer').getBoundingClientRect().top};}""")
 check(name,value['distance']<=1.5 and value['bottom']<=value['composer']-6,value)
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 browser=getattr(pw,a.engine).launch(**opts);page=browser.new_page(viewport={'width':390,'height':844});page.set_default_timeout(10000)
 page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('blob:','data:')) else r.abort())
 try:
  page.set_content(html)
  for name in styles:page.add_style_tag(content=(root/name).read_text())
  # Use the same local bundled font; no remote font requests.
  font=base64.b64encode((root/'fonts/NotoSans-Regular.ttf').read_bytes()).decode()
  page.add_style_tag(content="@font-face{font-family:'Pablicus Noto';font-style:normal;font-weight:400;src:url(data:font/ttf;base64,"+font+")}")
  for name in ['component-registry.js','rich-message.js','chat-actions.js']:page.add_script_tag(content=(root/name).read_text())
  page.add_script_tag(content=setup+render_code+list_code+expose)
  page.evaluate(fixture);page.wait_for_timeout(150);geometry(page,'unloaded placeholders have consistent row geometry')
  page.evaluate('releaseMedia()');page.wait_for_timeout(600)
  if a.expect_regression:
   g=page.evaluate('Fixture.audit()');check('unmodified UI-V2 reproduces large row overlap',g['max_overlap_px']>100 and g['model_error_px']>100,g)
   page.screenshot(path=str(out/(label+'.png')))
  else:
   geometry(page,'decoded legacy and rich photos reflow adjacent deleted/text rows');bottom(page,'last text remains above composer after delayed decoding')
   check('no resolution from measureBox',page.evaluate('mediaRequests.length')==5,page.evaluate('mediaRequests'))
   clip=page.evaluate("getComputedStyle($('vp')).clipPath")
   check('history has no full-width footer clip',clip=='none',clip)
   check('transparent footer gutters reach history',page.evaluate("!!document.elementFromPoint(2,$('composer').getBoundingClientRect().top+15)?.closest('#vp')"))
   page.screenshot(path=str(out/(label+'-bottom.png')))
   page.evaluate('Fixture.list.go(0)');page.wait_for_timeout(150);geometry(page,'scroll to oldest photo');page.screenshot(path=str(out/(label+'-start.png')))
   # New delayed decode while reading earlier messages: keep the reading anchor.
   page.evaluate("""()=>{window.mediaReady=new Promise(r=>window.releaseMedia=r);Fixture.mount(fixtureMessages);Fixture.list.go(3);window.readAnchor=Fixture.list.capture(false);window.readTop=Fixture.list.nodes.get(readAnchor.id).getBoundingClientRect().top;}""")
   page.evaluate('releaseMedia()');page.wait_for_timeout(450);geometry(page,'late media growth preserves a reading viewport')
   check('reading anchor is not replaced with bottom follow',page.evaluate("!Fixture.list.follow&&Math.abs(Fixture.list.nodes.get(readAnchor.id).getBoundingClientRect().top-readTop)<=1.5"))
   # Many rows force real eviction and remount, not nine fixed demo cards.
   page.evaluate("""()=>{window.longMessages=Array.from({length:72},(_,i)=>mapped(i%3===0?rich(i+100,[im('photo',i%2?'landscape':'portrait')]):raw(i+100,'text',{},'Строка '+i+' '+('Текст '.repeat(i%4+1))),i));Fixture.mount(longMessages);}""")
   for i in [0,9,25,50,71,30,0,71]:
    page.evaluate('(i)=>Fixture.list.go(i)',i);page.wait_for_timeout(180);geometry(page,'virtualized scroll and remount at '+str(i))
   check('bounded DOM after repeated eviction',page.evaluate('Fixture.list.nodes.size<=120'))
   page.evaluate('Fixture.list.bottom()');page.wait_for_timeout(100)
   for width,height in [(844,390),(390,500),(390,844)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200);geometry(page,f'viewport {width}x{height}');bottom(page,f'bottom follows viewport {width}x{height}')
   page.evaluate("$('composer').style.setProperty('height','170px','important')");page.wait_for_timeout(150);geometry(page,'composer grows');bottom(page,'last message clears expanded composer')
   page.evaluate("$('composer').style.removeProperty('height')");page.wait_for_timeout(150);bottom(page,'composer collapses without losing bottom')
   # Last row itself is an unknown-size image; it must be reachable in full.
   page.evaluate("Fixture.list.append(mapped(rich(900,[im('last-photo','tall')]),1),true)");page.wait_for_timeout(250);geometry(page,'append tall photo as last message');bottom(page,'entire last photo ends above composer')
   check('source photo remains contained without crop',page.locator('#canvas [data-id="geometry-900"] img').evaluate('(n)=>n.naturalWidth===200&&n.naturalHeight===1800&&getComputedStyle(n).objectFit==="contain"'))
   # Decode a native H.264 MP4 fixture; no camera, microphone or dimensions in metadata.
   # The previous opaque-origin VP8 fixture stopped the WebKit test before decode.
   # First prove this media fixture independently of the list; do not skip decoding.
   print('BEGIN native MP4 fixture and standalone decode',flush=True)
   encoded_clip = (pathlib.Path(__file__).with_name('media_geometry_portrait.b64')).read_text().strip()
   page.evaluate("""(encoded)=>{testUrls.clip=URL.createObjectURL(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'video/mp4'}));const v=document.createElement('video');v.id='codecProbe';v.muted=true;v.playsInline=true;v.preload='metadata';v.style.cssText='position:fixed;width:90px;height:160px;top:0;left:0;';document.body.append(v);v.src=testUrls.clip;v.load();}""",encoded_clip)
   page.wait_for_function("document.querySelector('#codecProbe')?.videoHeight===320",timeout=10000)
   check('standalone native video fixture actually decodes',page.locator('#codecProbe').evaluate('(v)=>v.videoWidth===180&&v.videoHeight===320'))
   page.evaluate("document.querySelector('#codecProbe').remove()")
   print('BEGIN actual-list video insertion',flush=True)
   page.evaluate("Fixture.list.append(mapped(rich(902,[{id:'clip',type:'video',path:'clip'}]),1),true)")
   print('END actual-list video insertion; await metadata',flush=True)
   page.wait_for_function("document.querySelector('#canvas [data-id=\"geometry-902\"] video')?.videoHeight===320");page.wait_for_timeout(150)
   geometry(page,'decoded portrait video participates in row layout');bottom(page,'video bottom clears composer')
   page.evaluate("Fixture.list.append(mapped(rich(903,[{id:'text-before',type:'text',text:'Перед альбомом'},im('album-photo','square'),{id:'album-video',type:'video',path:'clip'},{id:'text-after',type:'text',text:'После альбома'}]),1),true)")
   page.wait_for_timeout(300);geometry(page,'mixed text-photo-video album retains distinct rows');bottom(page,'mixed album bottom clears composer')
   check('both sides of mixed album retained',page.locator('#canvas [data-id="geometry-903"] .richText').all_text_contents()==['Перед альбомом','После альбома'])
   # Deletion changes a media row into text under the same ID.
   page.evaluate("""()=>{const m=Fixture.list.messages.at(-1);Fixture.replace(Fixture.list.messages.slice(0,-1).concat({...m,revision:1,remote:{...m.remote,deleted_at:'2026-09-21T00:00:00Z'}}));}""")
   page.wait_for_timeout(150);geometry(page,'delete media without orphan row');bottom(page,'deletion recalculates scroll extent')
   page.evaluate("Fixture.list.prepend([mapped(rich(901,[im('older','square')]),0)])");page.wait_for_timeout(150);geometry(page,'prepend older history')
   page.evaluate('Fixture.replace([])');page.wait_for_timeout(100)
   check('empty conversation removes every rendered row',page.evaluate("Fixture.list.nodes.size===0&&!$('canvas').children.length"))
   page.evaluate('Fixture.mount(fixtureMessages);releaseMedia()');page.wait_for_timeout(250);geometry(page,'conversation reopened with one active list')
   page.evaluate('Fixture.list.destroy()');page.wait_for_timeout(80)
   check('list teardown removes rows and measurements',page.evaluate("Fixture.counters.active_lists===0&&!$('canvas').children.length&&!document.querySelector('.measureBox')"))
   check('no programmatic scroll writes from scroll handler',page.evaluate('Fixture.scrollEvidence.writes_from_scroll===0'))
   check('no JavaScript or ResizeObserver errors',not errors,errors)
   if a.full_app:
    class Handler(http.server.SimpleHTTPRequestHandler):
     def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root.resolve()),**kwargs)
     def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
    ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block');live=ctx.new_page();live_errors=[];live.on('pageerror',lambda e:live_errors.append(str(e)))
    def route(request):
     if request.request.url.endswith('/auto-update.js'):return request.fulfill(status=200,content_type='text/javascript',body='/* Worker upgrade has its own retained suite. */')
     if request.request.url.startswith(('http://127.0.0.1:','blob:','data:')):return request.continue_()
     return request.fulfill(status=401,content_type='application/json',body='{"message":"No fixture account"}')
    live.route('**/*',route)
    try:
     live.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='load');live.wait_for_function('window.PablicusHost && window.PablicusChat && window.PablicusDebug');live.wait_for_timeout(500)
     live_fixture=fixture.replace('()=>{','async()=>{const $=id=>document.getElementById(id),app=$("app");',1).replace('Fixture.mount(fixtureMessages);',"await PablicusChat.open('fixture-owner','fixture-chat',fixtureMessages);")
     # TransportStore requires UUID-shaped account/conversation IDs, even in a local fixture.
     for name,value in [('fixture-owner','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('fixture-peer','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),('fixture-chat','cccccccc-cccc-4ccc-8ccc-cccccccccccc')]:
      live_fixture=live_fixture.replace(name,value)
     live.evaluate(live_fixture);live.evaluate('releaseMedia()');live.wait_for_timeout(650)
     live.evaluate("window.$=id=>document.getElementById(id);window.Fixture={get list(){return PablicusChat.list},audit:()=>gate.audit()}")
     geometry(live,'full app + real composer + IndexedDB decoded conversation');bottom(live,'full app last row clears actual composer')
     before_height=live.locator('#composer').evaluate('(n)=>n.getBoundingClientRect().height')
     live.evaluate("gate.fillDraft('Проверка многострочного черновика. '.repeat(12))");live.wait_for_timeout(400)
     check('full app actual input expanded the composer',live.locator('#composer').evaluate('(n)=>n.getBoundingClientRect().height')>before_height+20)
     geometry(live,'full app multiline draft does not overlap history');bottom(live,'full app actual expanded draft leaves last message readable')
     live.screenshot(path=str(out/(label+'-full-app.png')))
     saved=live.evaluate('async()=>{await PablicusChat.flush();return (await PablicusChat.store.read()).text}')
     check('full app draft persisted to actual scoped IndexedDB',saved=='Проверка многострочного черновика. '*12)
     live.evaluate('PablicusChat.leave()');live.wait_for_timeout(100)
     check('full app leave disconnects list',live.evaluate('PablicusChat.list===null'))
     check('full application has no JS or observer errors',not live_errors,live_errors)
    except Exception:
     live.screenshot(path=str(out/(label+'-full-app-failure.png')))
     print('FULL APP ERRORS',live_errors,flush=True)
     raise
    finally:ctx.close();server.shutdown();server.server_close()

 except Exception as exc:
  checks.append(dict(name='suite completion',passed=False,details=str(exc),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/(label+'-failure.png')))
 finally:
  result=dict(engine=a.engine,passed=sum(x['passed'] for x in checks),failed=sum(not x['passed'] for x in checks),checks=checks,
   source_sha256={n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['chat.js','app.js','rich-message.js','public-ui-foundation.css']},
   boundary='Actual list class and host media renderer/CSS; synthetic data and resolver; no authenticated transport or physical-device acceptance.')
  (out/(label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
if result['failed']:raise SystemExit(1)

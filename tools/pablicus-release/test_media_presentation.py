import re,pathlib,base64,json,argparse,traceback,hashlib
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',default='vision-talk/pablicus');p.add_argument('--engine',choices=['chromium','webkit'],required=True);p.add_argument('--executable');a=p.parse_args()
root=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True)
html=(root/'index.html').read_text();styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S);html=re.sub(r'<link\b[^>]*>','',html)
chat=(root/'chat.js').read_text();host=(root/'app.js').read_text()
setup='''const $=id=>document.getElementById(id),vp=$('vp'),canvas=$('canvas'),app=$('app');
const OVERSCAN=560,LIMIT=120,counters={active_lists:0,created:0,destroyed:0,max_dom:0};
const scrollEvidence={renders:0,events:0,gestures:0,measured_rows:0,programmatic_writes:0,writes_from_scroll:0,min_top:Infinity};
const round=x=>+x.toFixed(3);let list;const peersRead=0,BUCKET='fixture';
const el=(tag,cls,text)=>{const n=document.createElement(tag);window.PablicusUI?.prepareControl?.(n);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const signedUrl=(path,options)=>PablicusMediaCache.resolve(BUCKET,path,options);
const mediaViewer={open:(items,index)=>{window.viewerCalls.push({items,index})}}, mediaItem=b=>b, viewAttachment=r=>{viewerCalls.push(r);return Promise.resolve()}, problem=e=>{throw e};
const messageTools=PablicusChatActions.create({getContext:()=>({userId:'owner',conversationId:'chat',epoch:1,rows:window.raws||[]}),rpc:async(name,args)=>{actionCalls.push({name,args});return {data:[]}},onReply:(m,b)=>replyCalls.push({id:m.id,block:b}),onDownload:b=>downloadCalls.push(b),onRows:()=>{},onError:e=>{window.errs.push(String(e))},onForward:()=>{}});
const chooseReply=(...v)=>replyCalls.push(v);
const showOutbox=()=>{outboxCalls++},pump=()=>{pumpCalls++};
const nodeFor=m=>m.richBlocks?renderPendingMessage(m):renderMessage(m);
'''
render=host[host.index(' const stamp='):host.index(' function renderPendingMessage')]
pending=host[host.index(' function renderPendingMessage'):host.index(' function mediaItem')]
listcode=chat[chat.index('function historyInsets()'):chat.index('const draft=')]
fixture='''()=>{window.viewerCalls=[];window.actionCalls=[];window.replyCalls=[];window.downloadCalls=[];window.errs=[];window.outboxCalls=0;window.pumpCalls=0;window.queueCalls=[];
const pic=(w,h)=>URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="cornflowerblue"/><circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/3}" fill="orange"/></svg>`],{type:'image/svg+xml'}));
window.urls={portrait:pic(900,1600),landscape:pic(1600,900),tall:pic(200,1800),square:pic(800,800)};
window.PablicusMediaCache={peek:()=>null,resolve:async(b,path)=>urls[path]};
window.PablicusChat={scope:{user:'owner',chat:'chat'},assets:new Map([['portrait',{name:'portrait.svg',file:new Blob(['fixture'],{type:'image/svg+xml'})}]]),localAssetUrl:id=>urls[id],store:{retry:async id=>queueCalls.push(['retry',id]),cancel:async id=>queueCalls.push(['cancel',id])},refreshQueue:async()=>queueCalls.push(['refresh'])};
window.makeRaw=(id,type='image',path='portrait',mine=true)=>({id,type,attachment_path:path,attachment_metadata:{v:1,blocks:[{type:'image',id:'photo',path,width:707,height:1536}]},body:'',sender_id:mine?'owner':'peer',conversation_id:'chat',created_at:'2026-09-21T07:30:00Z',server_seq:1});
window.toMapped=r=>({id:r.id,number:r.server_seq,mine:r.sender_id==='owner',text:r.body||'',revision:0,remote:r});
window.pendingRow=(state='queued',blocks=[{id:'pending-photo',type:'image',assetId:'portrait'}])=>({id:'out-pending',outboxId:'outbox-group',revision:1,number:100,mine:true,queueState:state,richBlocks:blocks});
window.mount=(items)=>{list?.destroy();window.raws=items.filter(m=>m.remote).map(m=>m.remote);window.fixtureList=list=new NaturalList(items);list.bottom();};
window.show=(raw)=>mount([toMapped(raw)]);
$('home').hidden=true;app.hidden=false;$('startPanel').hidden=true;
}'''
checks=[];errors=[]
def check(name,yes,detail=None):
 checks.append({'name':name,'passed':bool(yes),'details':detail});print(('PASS ' if yes else 'FAIL ')+name,detail or '',flush=True)
 if not yes:raise AssertionError(name)
def tight(page,label):
 result=page.locator('#canvas .row:not([hidden])').evaluate('''row=>{const frame=row.querySelector('.richMessage>.richMedia-image,.richMessage>.richMedia-video,.mediaOpen'),media=frame.querySelector('img,video'),r=frame.getBoundingClientRect(),m=media.getBoundingClientRect(),b=row.querySelector('.bubble').getBoundingClientRect(),cs=getComputedStyle(frame);const nw=media.naturalWidth||media.videoWidth,nh=media.naturalHeight||media.videoHeight;return {natural:[nw,nh],ratioError:Math.abs(r.width/r.height-nw/nh),boxError:Math.abs(r.width-m.width)+Math.abs(r.height-m.height),h:r.height,w:r.width,bubbleWidth:b.width,radius:parseFloat(cs.borderTopLeftRadius),bottomRadius:parseFloat(cs.borderBottomRightRadius),clip:cs.clipPath,drag:media.draggable,select:getComputedStyle(media).userSelect,fit:getComputedStyle(media).objectFit}}''')
 check(label,result['natural'][0]>0 and result['ratioError']<.005 and result['boxError']<1 and result['h']<=421 and result['radius']==16 and result['bottomRadius']==16 and result['clip']!='none' and not result['drag'] and result['fit']=='contain',result)
 check(label+' tight bubble',abs(result['w']-result['bubbleWidth'])<=1,result)
def hold(page,selector='#canvas .row:not([hidden]) .bubble'):
 el=page.locator(selector);bb=el.bounding_box();x=bb['x']+bb['width']/2;y=max(20,min(730,bb['y']+bb['height']/2));page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(600);page.mouse.up();page.wait_for_timeout(60)
def menu_actions(page):return page.locator('.pablicusMessageMenu:not([hidden]) [data-action]').evaluate_all('ns=>ns.map(n=>n.dataset.action)')
def close(page):page.keyboard.press('Escape');page.wait_for_timeout(80)
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 browser=getattr(pw,a.engine).launch(**opts);ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True);page=ctx.new_page();page.set_default_timeout(10000)
 page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('blob:','data:')) else r.abort())
 try:
  page.set_content(html)
  for s in styles:page.add_style_tag(content=(root/s).read_text())
  font=base64.b64encode((root/'fonts/NotoSans-Regular.ttf').read_bytes()).decode();page.add_style_tag(content="@font-face{font-family:'Pablicus Noto';font-style:normal;font-weight:400;src:url(data:font/ttf;base64,"+font+")}")
  for s in ['component-registry.js','rich-message.js','message-menu.js','chat-actions.js']:page.add_script_tag(content=(root/s).read_text())
  page.add_script_tag(content=setup+render+pending+listcode);page.evaluate(fixture)
  for kind in ['image','rich']:
   for path in ['portrait','landscape','square','tall']:
    for mine in [True,False]:
     page.evaluate('([k,p,m])=>show(makeRaw(k+"-"+p,k,p,m))',[kind,path,mine]);page.wait_for_timeout(180);tight(page,f'{kind}/{path}/{mine}: correct ratio, rounded pixels, no CSS bars')
  # Native decoded video, using the retained self-generated file from UI-V3 tests.
  encoded=pathlib.Path(__file__).with_name('media_geometry_portrait.b64').read_text().strip()
  page.evaluate('''s=>{urls.clip=URL.createObjectURL(new Blob([Uint8Array.from(atob(s),c=>c.charCodeAt(0))],{type:'video/mp4'}));const r=makeRaw('video','rich');r.attachment_metadata.blocks=[{id:'clip',type:'video',path:'clip',width:1600,height:900}];show(r)}''',encoded)
  page.wait_for_function('document.querySelector("#canvas video")?.videoHeight===320');page.wait_for_timeout(100);tight(page,'decoded portrait video corrects stale landscape metadata')
  # Sent media keeps original open-on-tap and the actual message-actions menu on hold.
  for kind in ['image','rich']:
   page.evaluate('(k)=>show(makeRaw("sent-"+k,k))',kind);page.wait_for_timeout(200)
   frame=page.locator('#canvas .row:not([hidden]) .mediaOpen,#canvas .row:not([hidden]) .richMedia-image')
   before=frame.bounding_box();hold(page)
   acts=menu_actions(page);check(kind+' hold opens actual sent actions',all(x in acts for x in ['reply','forward','pin','download','delete','select']),acts)
   check(kind+' hold does not also open viewer',page.evaluate('viewerCalls.length')==0)
   # The preview scales uniformly; neither source nor clone acquires a new ratio.
   preview=page.locator('.pmmPreview').bounding_box();check(kind+' menu preview preserves photo ratio',abs(preview['width']/preview['height']-900/1600)<.005,preview)
   check(kind+' actions fit within screen',page.locator('.pmmActions').evaluate('n=>n.getBoundingClientRect().bottom<=innerHeight'))
   page.screenshot(path=str(out/f'presentation-{a.engine}-{kind}-menu.png'))
   page.locator('[data-action="reply"]').click();check(kind+' reply callback addresses selected row',page.evaluate('replyCalls.at(-1).id')=='sent-'+kind)
   page.wait_for_timeout(950);after=frame.bounding_box();check(kind+' menu leaves original geometry unchanged',abs(before['width']-after['width'])+abs(before['height']-after['height'])<1)
   await_count=page.evaluate('viewerCalls.length');frame.click();check(kind+' short tap opens viewer once',page.evaluate('viewerCalls.length')==await_count+1);page.evaluate('viewerCalls=[]')
  # Native HTML drag must be cancelled without turning scroll into a long press.
  page.evaluate('show(makeRaw("drag","rich"))');page.wait_for_timeout(150)
  check('dragstart is prevented on original image',page.locator('#canvas img').evaluate('n=>!n.dispatchEvent(new Event("dragstart",{bubbles:true,cancelable:true}))'))
  b=page.locator('#canvas .bubble').bounding_box();page.mouse.move(b['x']+20,b['y']+30);page.mouse.down();page.mouse.move(b['x']+20,b['y']+70);page.wait_for_timeout(500);page.mouse.up();check('scroll/move cancels long press',not menu_actions(page))
  # Crucial case in owner screenshot: clock/error rows are LOCAL OUTGOING, not server rows.
  for state in ['queued','error','sending']:
   page.evaluate('(state)=>mount([pendingRow(state)])',state);page.wait_for_timeout(180);tight(page,state+' pending photo')
   hold(page);acts=menu_actions(page);check(state+' local media has actions',all(x in acts for x in ['open','download','outbox']),acts)
   check(state+' does not pretend unsent media supports server actions',not any(x in acts for x in ['reply','forward','pin','delete']))
   check(state+' retry/cancel respects in-flight state',(('retry' in acts and 'cancel' in acts) if state!='sending' else 'retry' not in acts and 'cancel' not in acts))
   page.screenshot(path=str(out/f'presentation-{a.engine}-{state}-menu.png'))
   if state=='error':
    page.locator('[data-action="retry"]').click();page.wait_for_timeout(80);check('retry uses original outbox group without duplicate',page.evaluate('queueCalls.filter(x=>x[0]==="retry").length===1&&queueCalls.find(x=>x[0]==="retry")[1]==="outbox-group"&&pumpCalls===1'))
   else:close(page)
  # Session fence applies even with an already open local menu.
  page.evaluate('mount([pendingRow("error")])');page.wait_for_timeout(180);hold(page);page.evaluate('PablicusChat.scope.user="different-owner"');page.locator('[data-action="retry"]').click();check('stale outgoing menu cannot retry after account switch',page.evaluate('queueCalls.filter(x=>x[0]==="retry").length')==1);page.evaluate('PablicusChat.scope.user="owner"')
  # Test DOM-scoped touch events in both engines and actual trusted touch on Chromium.
  page.evaluate('mount([pendingRow("queued")])');page.wait_for_timeout(150)
  target=page.locator('#canvas .richMedia-image');target.dispatch_event('pointerdown',{'pointerId':55,'pointerType':'touch','isPrimary':True,'button':0,'clientX':260,'clientY':500});page.wait_for_timeout(520);target.dispatch_event('pointerup',{'pointerId':55,'pointerType':'touch','isPrimary':True,'button':0});check('touch pointer hold opens local menu',bool(menu_actions(page)));close(page)
  if a.engine=='chromium':
   page.wait_for_timeout(950);bb=target.bounding_box();x=bb['x']+bb['width']/2;y=bb['y']+bb['height']/2
   cdp=ctx.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(600);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});check('trusted Chromium touch opens local menu',bool(menu_actions(page)));close(page);cdp.detach()
  # Joined albums stay joined, with only outside corners rounded.
  page.evaluate('''()=>{const r=makeRaw('album','rich');r.attachment_metadata.blocks=[{id:'a',type:'image',path:'portrait'},{id:'b',type:'image',path:'landscape'}];show(r)}''');page.wait_for_timeout(250)
  check('album grid and original attachment count preserved',page.locator('#canvas .richMediaGallery').evaluate('n=>getComputedStyle(n).display==="grid"&&n.children.length===2&&getComputedStyle(n).borderRadius==="16px"'))
  check('album tile corners remain joined',page.locator('#canvas .richMediaGallery>.richMedia').evaluate_all('ns=>ns.every(n=>getComputedStyle(n).borderRadius==="0px")'))
  page.screenshot(path=str(out/f'presentation-{a.engine}-album.png'))
  check('no JavaScript exceptions',not errors,errors)
 except Exception as e:
  checks.append({'name':'suite completion','passed':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/f'presentation-{a.engine}-failure.png'))
 finally:
  result={'engine':a.engine,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'source_sha256':{n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['app.js','rich-message.js','chat-actions.js','message-menu.js','public-ui-foundation.css']},'boundary':'Actual list, renderers and menu/gesture code with synthetic data and external actions. Chromium native touch + WebKit pointer/mouse. No physical iPhone claim.'}
  (out/f'presentation-{a.engine}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
if result['failed']:raise SystemExit(1)

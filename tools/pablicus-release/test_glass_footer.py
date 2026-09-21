"""No white footer + local glass, using real list, message renderer and composer.
Native pixel comparison proves that media continues through the previous cutoff;
only the capsule blurs it. Synthetic media/services, never user messages.
"""
import argparse,base64,hashlib,io,json,pathlib,re,traceback
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',default='vision-talk/pablicus');p.add_argument('--engine',required=True);p.add_argument('--executable');a=p.parse_args()
r=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True)
raw=(r/'index.html').read_text();styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',raw)
html=re.sub(r'<script\b[^>]*>.*?</script>','',raw,flags=re.S);html=re.sub(r'<link\b[^>]*>','',html)
chat=(r/'chat.js').read_text();host=(r/'app.js').read_text()
list_code=chat[chat.index('function historyInsets()'):chat.index('const draft=')]
render_code=host[host.index(' const stamp='):host.index(' function renderPendingMessage')]
setup="""const $=id=>document.getElementById(id),vp=$('vp'),canvas=$('canvas'),app=$('app');
const OVERSCAN=560,LIMIT=120,counters={active_lists:0,created:0,destroyed:0,max_dom:0};
const scrollEvidence={renders:0,events:0,gestures:0,measured_rows:0,programmatic_writes:0,writes_from_scroll:0,min_top:Infinity};
const round=x=>+x.toFixed(3);let list;const peersRead=0,BUCKET='fixture';
const el=(tag,cls,text)=>{const n=document.createElement(tag);window.PablicusUI?.prepareControl?.(n);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const messageTools={decorate:()=>{}};const signedUrl=(path,options)=>PablicusMediaCache.resolve(BUCKET,path,options);const nodeFor=m=>renderMessage(m);
"""
expose="""window.Fixture={mount:m=>{list?.destroy();list=new NaturalList(m);list.bottom()},get list(){return list},audit};"""
checks=[];errors=[]
def check(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail));print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
def geom(page,label):
 d=page.evaluate('Fixture.audit()');check(label,d['max_overlap_px']<=1.5 and d['max_gap_px']<=1.5 and d['model_error_px']<=1.5 and not d['clipped'] and not d['width_errors'],d)
def glass(page,label):
 d=page.locator('#composeBox').evaluate('''n=>{const s=getComputedStyle(n),b=getComputedStyle(n,'::before');return {base:s.backgroundColor,border:s.borderTopColor,blur:b.backdropFilter||b.webkitBackdropFilter,fill:b.backgroundColor,layer:b.content,pointer:b.pointerEvents,filter:s.filter,footer:getComputedStyle(n.parentNode).backgroundColor,clip:getComputedStyle(document.getElementById('vp')).clipPath}}''')
 check(label+' glass only inside input',d['base']=='rgba(0, 0, 0, 0)' and d['border']!='rgba(0, 0, 0, 0)' and 'blur(16px)' in d['blur'] and d['layer']!='none' and d['pointer']=='none' and d['filter']=='none' and d['footer']=='rgba(0, 0, 0, 0)' and d['clip']=='none',d)
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 b=getattr(pw,a.engine).launch(**opts);page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True);page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda q:q.continue_() if q.request.url.startswith(('blob:','data:')) else q.abort())
 try:
  page.set_content(html)
  for n in styles:page.add_style_tag(content=(r/n).read_text())
  font=base64.b64encode((r/'fonts/NotoSans-Regular.ttf').read_bytes()).decode();page.add_style_tag(content="@font-face{font-family:'Pablicus Noto';font-weight:400;src:url(data:font/ttf;base64,"+font+")}")
  page.evaluate("if(!crypto.randomUUID)crypto.randomUUID=()=> 'fixture-'+Math.random().toString(16).slice(2)")
  for n in ['component-registry.js','icons-r2.js','rich-message.js','chat-actions.js','rich-composer.js','composer-r2.js']:page.add_script_tag(content=(r/n).read_text())
  page.add_script_tag(content=setup+render_code+list_code+expose)
  page.evaluate('''()=>{const $=id=>document.getElementById(id);$('home').hidden=true;$('app').hidden=false;$('startPanel').hidden=true;
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#c83c9e"/><rect x="20" width="20" height="40" fill="#329cca"/></pattern></defs><rect width="600" height="900" fill="url(#p)"/></svg>';
   window.fixturePhoto=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));window.PablicusMediaCache={peek:()=>null,resolve:async()=>fixturePhoto};
   window.rc=PablicusRichComposer.create({container:$('editor'),input:$('input'),acceptFile:()=>true,onChange:()=>window.chrome?.sync(),onGeometry:()=>{},onError:e=>{throw Error(e)}});$('composeBox').append(rc.voiceButton);
   window.actions={send:0,expand:0};$('send').disabled=false;$('send').onclick=()=>actions.send++;$('expand').onclick=()=>actions.expand++;
   window.chrome=PablicusComposerR2.create({root:$('composeBox'),body:$('editor'),input:$('input'),attach:$('attach'),voice:rc.voiceButton,send:$('send'),expand:$('expand'),capture:()=>rc.capture(),recording:()=>false,getScope:()=>({user:'fixture',chat:'fixture'}),onGeometry:()=>{},onChange:()=>{},pick:()=>{}});chrome.sync();window.originalInput=$('input');window.originalSend=$('send');
   window.messages=Array.from({length:16},(_,i)=>({id:'photo-'+i,number:i+1,mine:true,text:'',revision:0,remote:{id:'photo-'+i,sender_id:'fixture',conversation_id:'fixture-chat',server_seq:i+1,type:'rich',body:'',created_at:'2026-09-21T10:00:00Z',attachment_metadata:{v:1,blocks:[{id:'im',type:'image',path:'photo'}]}}}));Fixture.mount(messages);
   window.coverFooter=()=>{const l=Fixture.list,n=l.nodes.get('photo-12');l.go(12);requestAnimationFrame(()=>{const row=l.nodes.get('photo-12'),top=$('composeBox').getBoundingClientRect().top;const target=$('vp').clientHeight-340;$('vp').scrollTop+=row.getBoundingClientRect().top-target;l.follow=false;});};
  }''');page.add_script_tag(content=(r/'glass-ui.js').read_text());page.wait_for_timeout(400);glass(page,'idle');geom(page,'decoded photos remain separate rows')
  page.evaluate('Fixture.list.go(12)');page.wait_for_timeout(180);page.evaluate('coverFooter()');page.wait_for_timeout(150)
  # Compare pixels around and inside the actual capsule, then hide only its paint.
  rect=page.locator('#composeBox').bounding_box();dpr=page.evaluate('devicePixelRatio');im=Image.open(io.BytesIO(page.screenshot())).convert('RGB')
  points={'gutter':(374,rect['y']+rect['height']/2),'below':(330,835),'inside':(250,rect['y']+9)}
  sample=lambda image,xy:image.getpixel((round(xy[0]*dpr),round(xy[1]*dpr)))
  before={k:sample(im,v) for k,v in points.items()}
  check('media paints in former full-width footer gutter',max(before['gutter'])-min(before['gutter'])>40 and min(before['gutter'])<180,before)
  check('media continues to bottom safe-area, no artificial white strip',max(before['below'])-min(before['below'])>40 and min(before['below'])<180,before)
  check('glass is not an opaque white fill',min(before['inside'])<225,before)
  page.screenshot(path=str(out/f'glass-footer-{a.engine}.png'))
  layer=page.add_style_tag(content=':root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen)::before{visibility:hidden!important}')
  page.wait_for_timeout(60);bare=Image.open(io.BytesIO(page.screenshot())).convert('RGB');after={k:sample(bare,v) for k,v in points.items()}
  check('glass changes only capsule pixels, not full-width gutter',before['gutter']==after['gutter'] and sum(abs(x-y) for x,y in zip(before['inside'],after['inside']))>30,{'glass':before,'bare':after});layer.evaluate('n=>n.remove()')
  check('transparent footer gutter allows native history gestures',page.evaluate('''()=>{const r=document.getElementById('composeBox').getBoundingClientRect();return !!document.elementFromPoint(374,r.y+r.height/2)?.closest('#vp')}'''))
  check('input overlays intercept taps before media',page.locator('#input').evaluate('n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n}'))
  for width,height in [(320,844),(390,500),(768,844),(390,844)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150);page.evaluate('chrome.sync()');glass(page,f'{width}x{height} idle')
   page.locator('#input').focus();page.wait_for_timeout(50);glass(page,f'{width}x{height} focused')
   check(f'{width} input remains positioned, no button overlap',page.locator('#input').evaluate('n=>{const r=n.getBoundingClientRect(),s=document.getElementById("send").getBoundingClientRect();return r.width>20&&(r.bottom<=s.top+1||r.right<=s.left+1)}'))
   page.locator('#input').fill('Многострочный текст. '*9);page.evaluate('chrome.sync()');page.wait_for_timeout(100);glass(page,f'{width} multiline');geom(page,f'{width} growing composer preserves rows')
   page.evaluate('Fixture.list.bottom()');page.wait_for_timeout(100)
   check(f'{width} last row fully reachable above glass',page.evaluate('()=>{const l=Fixture.list,n=l.nodes.get(l.messages.at(-1).id);return l.bottomDistance()<1.5&&n.getBoundingClientRect().bottom<=document.getElementById("composer").getBoundingClientRect().top-6}'))
   page.locator('#input').fill('');page.locator('#input').blur();page.evaluate('chrome.sync()')
  page.evaluate('''async()=>{const c=document.createElement('canvas');c.width=80;c.height=100;const x=c.getContext('2d');x.fillStyle='#087aa0';x.fillRect(0,0,80,100);const blob=await new Promise(res=>c.toBlob(res));await rc.addFiles([new File([blob],'fixture.png',{type:'image/png'})]);chrome.sync();}''');page.wait_for_timeout(100);glass(page,'draft media');geom(page,'draft photo preserves history geometry')
  check('draft attachment retains own edge and dimensions',page.locator('#editor .richMedia').evaluate('n=>{const s=getComputedStyle(n),i=n.querySelector("img");return s.outlineWidth==="1px"&&s.outlineStyle==="solid"&&n.offsetHeight===48&&i.width===32&&i.height===32}'))
  check('input and send original nodes unchanged',page.evaluate('originalInput===document.getElementById("input")&&originalSend===document.getElementById("send")'))
  page.locator('#send').click();check('send handler still runs once',page.evaluate('actions.send===1'));page.locator('#expand').click();check('expand handler still runs once',page.evaluate('actions.expand===1'))
  page.locator('#chatActionsToggle').click();check('existing conversation menu opens',page.locator('#chatActionsToggle').get_attribute('aria-expanded')=='true');page.locator('#chatActionsToggle').click()
  page.evaluate('chrome.sync({expanded:true});document.getElementById("app").classList.add("composer-fullscreen")');page.locator('#input').focus();check('fullscreen writing surface preserved',page.locator('#composeBox').evaluate('n=>getComputedStyle(n).backgroundColor==="rgb(255, 255, 255)"'))
  page.evaluate('document.activeElement.blur();chrome.sync({expanded:false});document.getElementById("app").classList.remove("composer-fullscreen")');glass(page,'return from fullscreen')
  check('automatic updater unmodified',hashlib.sha256((r/'auto-update.js').read_bytes()).hexdigest()=='96836ddbeffa00bc1bb57e272b811076dc8c58259ac56d94f655ab608be55125')
  check('no manual update action in HTML','id="applyUpdate"' not in raw and 'id="updateNotice"' not in raw)
  check('no application errors',not errors,errors)
 except Exception as e:
  checks.append(dict(name='suite completion',passed=False,detail=str(e),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/f'glass-footer-{a.engine}-failure.png'))
 finally:
  result=dict(engine=a.engine,passed=sum(x['passed'] for x in checks),failed=sum(not x['passed'] for x in checks),checks=checks,source_sha256={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['glass-ui.css','public-ui-foundation.css','chat.js','app.js','auto-update.js','composer-r2.js','rich-message.js']},boundary='Production list/renderer/composer code and native pixels; isolated synthetic media, no physical iPhone or real messages.')
  (out/f'glass-footer-{a.engine}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
if result['failed']:raise SystemExit(1)

"""Real composer chrome and shipped cascade; no account, upload or production data."""
import argparse, pathlib, re, json, hashlib, traceback
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',default='vision-talk/pablicus');p.add_argument('--engine',required=True);p.add_argument('--executable');a=p.parse_args()
r=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True)
raw=(r/'index.html').read_text();styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',raw)
html=re.sub(r'<script\b[^>]*>.*?</script>','',raw,flags=re.S);html=re.sub(r'<link\b[^>]*>','',html)
checks=[];errors=[]
def check(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail));print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 b=getattr(pw,a.engine).launch(**opts);page=b.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda q:q.continue_() if q.request.url.startswith(('blob:','data:')) else q.abort())
 try:
  page.set_content(html)
  for name in styles:page.add_style_tag(content=(r/name).read_text())
  # about:blank in an isolated local browser may not expose secure randomUUID.
  page.evaluate("if(!crypto.randomUUID)crypto.randomUUID=()=> 'fixture-'+Math.random().toString(16).slice(2)")
  for name in ['component-registry.js','icons-r2.js','rich-message.js','rich-composer.js','composer-r2.js']:page.add_script_tag(content=(r/name).read_text())
  page.evaluate('''()=>{
   const $=id=>document.getElementById(id);$('home').hidden=true;$('app').hidden=false;$('startPanel').hidden=true;
   window.rc=PablicusRichComposer.create({container:$('editor'),input:$('input'),acceptFile:()=>true,onChange:()=>window.chrome?.sync(),onGeometry:()=>{},onError:e=>{throw Error(e)}});
   $('composeBox').append(rc.voiceButton);window.actions={send:0,expand:0};$('send').disabled=false;$('send').onclick=()=>actions.send++;$('expand').onclick=()=>actions.expand++;
   window.chrome=PablicusComposerR2.create({root:$('composeBox'),body:$('editor'),input:$('input'),attach:$('attach'),voice:rc.voiceButton,send:$('send'),expand:$('expand'),capture:()=>rc.capture(),recording:()=>false,getScope:()=>({user:'fixture',chat:'fixture'}),onGeometry:()=>{},onChange:()=>{},pick:()=>{}});chrome.sync();
   window.originalInput=$('input');window.originalSend=$('send');
  }''')
  page.add_script_tag(content=(r/'glass-ui.js').read_text());page.wait_for_timeout(180)
  def clear(label):
   detail=page.locator('#composeBox').evaluate('''n=>{const s=getComputedStyle(n),before=getComputedStyle(n,'::before'),after=getComputedStyle(n,'::after');return {background:s.backgroundColor,shadow:s.boxShadow,border:s.borderTopColor,before:before.content,after:after.content,footer:getComputedStyle(n.parentNode).backgroundColor}}''')
   check(label+' no white field, frame or backdrop',detail['background']=='rgba(0, 0, 0, 0)' and detail['shadow']=='none' and detail['border']=='rgba(0, 0, 0, 0)' and detail['before']=='none' and detail['after']=='none' and detail['footer']=='rgba(0, 0, 0, 0)',detail)
  for width in [320,390,768]:
   page.set_viewport_size({'width':width,'height':844});page.evaluate('document.activeElement.blur();chrome.sync()');page.wait_for_timeout(60);clear(str(width)+' idle')
   check(str(width)+' compact input position preserved',page.locator('#editor').evaluate('n=>getComputedStyle(n).position==="absolute"'))
   page.locator('#input').focus();page.evaluate('chrome.sync()');page.wait_for_timeout(70);clear(str(width)+' focused')
   check(str(width)+' input and send do not overlap',page.locator('#input').evaluate('n=>{const r=n.getBoundingClientRect(),s=document.querySelector("#send").getBoundingClientRect();return r.width>20&&(r.bottom<=s.top+1||r.right<=s.left+1)}'))
   page.locator('#input').fill('Сохранённый тестовый черновик. '*6);page.evaluate('chrome.sync()');clear(str(width)+' multiline')
   page.locator('#input').fill('');page.locator('#input').blur();page.evaluate('chrome.sync()')
  page.set_viewport_size({'width':390,'height':844})
  page.evaluate('''async()=>{const c=document.createElement('canvas');c.width=80;c.height=100;const x=c.getContext('2d');x.fillStyle='#087aa0';x.fillRect(0,0,80,100);const blob=await new Promise(resolve=>c.toBlob(resolve));await rc.addFiles([new File([blob],'fixture.png',{type:'image/png'})]);chrome.sync();}''');page.wait_for_timeout(150);clear('draft photo')
  check('draft attachment keeps local boundary without white panel',page.locator('#editor .richMedia').evaluate('n=>{const s=getComputedStyle(n);return s.outlineStyle==="solid"&&s.outlineWidth==="1px"&&s.backgroundColor==="rgba(0, 0, 0, 0)"}'))
  check('draft thumbnail stays bounded and rounded',page.locator('#editor .richMedia img').evaluate('n=>{const r=n.getBoundingClientRect();return r.width===32&&r.height===32&&getComputedStyle(n).borderRadius==="8px"}'))
  check('history still clips at measured composer boundary',page.locator('#app').evaluate('n=>{n.style.setProperty("--chat-bottom-inset","100px");return getComputedStyle(document.querySelector("#vp")).clipPath.includes("100px")}'))
  check('input and send use original live DOM',page.evaluate('originalInput===document.getElementById("input")&&originalSend===document.getElementById("send")'))
  page.locator('#send').click();check('send still calls original handler exactly once',page.evaluate('actions.send===1'))
  page.locator('#expand').click();check('expand still calls original handler exactly once',page.evaluate('actions.expand===1'))
  page.screenshot(path=str(out/('transparent-'+a.engine+'.png')))
  page.evaluate('chrome.sync({expanded:true});document.querySelector("#app").classList.add("composer-fullscreen")');page.locator('#input').focus();
  check('dedicated fullscreen writing remains readable',page.locator('#composeBox').evaluate('n=>getComputedStyle(n).backgroundColor==="rgb(255, 255, 255)"'))
  page.evaluate('document.activeElement.blur();chrome.sync({expanded:false});document.querySelector("#app").classList.remove("composer-fullscreen")');clear('return from fullscreen')
  for cls in ['workspaceEditor','botComposer']:
   page.evaluate('(cls)=>{const n=document.createElement("div");n.id="other";n.className=cls+" r2Composer";const c=document.createElement("div");c.className="r2ComposerBody";c.append(document.createElement("textarea"));n.append(c);document.body.append(n)}',cls)
   check(cls+' keeps its own glass surface',page.locator('#other').evaluate('n=>getComputedStyle(n,"::before").backdropFilter.includes("blur(16px)")'))
   page.locator('#other textarea').focus();check(cls+' white writing mode preserved',page.locator('#other').evaluate('n=>getComputedStyle(n).backgroundColor==="rgb(255, 255, 255)"'));page.locator('#other').evaluate('n=>n.remove()')
  check('no update action required in shipped HTML','id="applyUpdate"' not in raw and 'id="updateNotice"' not in raw)
  check('no JavaScript exceptions',not errors,errors)
 except Exception as e:
  checks.append(dict(name='suite completion',passed=False,detail=str(e),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/('transparent-'+a.engine+'-failure.png')))
 finally:
  result=dict(engine=a.engine,passed=sum(x['passed'] for x in checks),failed=sum(not x['passed'] for x in checks),checks=checks,source_sha256={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['glass-ui.css','writing-surface.css','index.html','composer-r2.js','rich-composer.js']})
  (out/('transparent-'+a.engine+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
if result['failed']:raise SystemExit(1)

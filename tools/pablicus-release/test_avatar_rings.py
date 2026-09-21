"""Active ring paint across diameters, real shelf motion, and profile expansion.
All runtime styles are loaded; identities/media/services are isolated fixtures.
No authenticated calls or user data. Desktop WebKit is not physical iPhone QA.
"""
import argparse, hashlib, io, json, pathlib, re, traceback
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',default='vision-talk/pablicus');p.add_argument('--engine',choices=['chromium','webkit'],required=True);p.add_argument('--executable');a=p.parse_args()
r=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True)
styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',(r/'index.html').read_text())
photo='data:image/svg+xml;base64,'+__import__('base64').b64encode(b'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#d018b8"/><circle cx="100" cy="100" r="40" fill="#fabd30"/></svg>').decode()
checks=[];errors=[]
def check(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),details=detail));print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
def load(page,html):
 page.set_content(html)
 for name in styles:page.add_style_tag(content=(r/name).read_text())
def band(page,selector,label):
 loc=page.locator(selector);box=loc.bounding_box();assert box
 # Sample inside each band, not at fractional antialiased boundary pixels.
 im=Image.open(io.BytesIO(page.screenshot())).convert('RGB');dpr=page.evaluate('devicePixelRatio')
 def px(inset):return im.getpixel((round((box['x']+box['width']-inset)*dpr),round((box['y']+box['height']/2)*dpr)))
 colored=lambda c:c[2]>130 and c[0]<160 and c[1]>60
 white=lambda c:min(c)>238
 magenta=lambda c:c[0]>150 and c[1]<80 and c[2]>130
 samples={str(d):px(d) for d in [1.5,3,5.25,7]}
 check(label+' 4px colored band / 2px white gap',colored(px(1.5)) and colored(px(3)) and white(px(5.25)) and magenta(px(7)),dict(box=box,dpr=dpr,image=im.size,samples=samples,style=loc.evaluate('n=>({before:getComputedStyle(n,"::before").backgroundImage,after:getComputedStyle(n,"::after").maskImage})')))
 check(label+' overlays never intercept taps',loc.evaluate('n=>["::before","::after"].every(p=>getComputedStyle(n,p).pointerEvents==="none")'))
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 browser=getattr(pw,a.engine).launch(**opts);ctx=browser.new_context(viewport={'width':820,'height':844},device_scale_factor=2,has_touch=True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda q:q.continue_() if q.request.url.startswith(('data:','blob:')) else q.abort())
 try:
  load(page,'<main id="samples"></main>')
  page.add_style_tag(content='#samples{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:space-around;padding:100px 12px;background:white}.sample{display:flex;flex-direction:column;align-items:center;gap:16px}.ringSample{display:block;flex:none}.sample label{font:14px sans-serif;color:#111}')
  page.evaluate('''src=>{for(const d of [38,48,60,72,118.8,140.8]){const parent=document.createElement('section');parent.className='sample';const n=document.createElement('span');n.id='ring-'+String(d).replace('.','-');n.className='pablicusStoryAvatar ringSample';n.style.width=d+'px';n.style.height=d+'px';n.dataset.pablicusStoryRing='active';const i=new Image();i.src=src;n.append(i);const label=document.createElement('label');label.textContent=d+' px';parent.append(n,label);samples.append(parent);}window.images=[...samples.querySelectorAll('img')];window.before=images.map(i=>[i,i.src]);}''',photo)
  page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)');page.wait_for_timeout(100)
  for d in [38,48,60,72,118.8,140.8]:band(page,'#ring-'+str(d).replace('.','-'),str(d)+'px avatar')
  page.screenshot(path=str(out/f'rings-{a.engine}-standard.png'))
  check('existing images and their source URLs preserved',page.evaluate('before.every(([i,src],j)=>i===images[j]&&i.src===src)'))
  # No-story appearance stays exactly the prior neutral ring. Only active color thickens.
  page.evaluate('document.querySelectorAll(".ringSample").forEach(n=>n.dataset.pablicusStoryRing="none")');page.wait_for_timeout(60)
  idle=page.locator('#ring-60').screenshot();boxes=page.locator('.ringSample').evaluate_all('ns=>ns.map(n=>n.getBoundingClientRect().toJSON())')
  baseline=pathlib.Path('ring-baseline/vision-talk/pablicus/avatar-ring-system.css')
  if not baseline.exists():baseline=pathlib.Path('baseline-ring.css')
  style=page.add_style_tag(content=baseline.read_text());page.wait_for_timeout(60)
  check('idle avatar pixel-identical to released baseline',idle==page.locator('#ring-60').screenshot())
  check('ring paint changes no avatar layout boxes',boxes==page.locator('.ringSample').evaluate_all('ns=>ns.map(n=>n.getBoundingClientRect().toJSON())'))
  style.evaluate('n=>n.remove()');page.evaluate('document.querySelectorAll(".ringSample").forEach(n=>n.dataset.pablicusStoryRing="active")')
  page.evaluate('()=>{window.clicks=0;document.querySelector("#ring-60").onclick=()=>clicks++;}');page.locator('#ring-60').click(position={'x':57,'y':30});check('tap on band reaches existing avatar action',page.evaluate('clicks')==1,page.evaluate('clicks'))
  # Real production shelf class, paint and keyed identity; only services are fixtures.
  page=ctx.new_page();page.set_viewport_size({'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda q:q.abort())
  load(page,'<div id="home"><section id="workspace"><div id="screenContent"></div></section><nav id="mainNav"><button data-page="profile" class="profileAvatarNav"><span class="profileNavAvatar" data-pablicus-story-ring="active"></span></button></nav></div>')
  page.add_style_tag(content='#home{height:844px!important;width:390px!important;position:relative!important;display:flex!important;flex-direction:column!important}#screenContent{height:1500px!important}#mainNav{position:fixed!important;left:15px!important;bottom:20px!important;width:360px!important}#workspace{display:block!important}.profileNavAvatar img{width:100%;height:100%}')
  page.evaluate('''src=>{window.owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.st={sessionUserId:owner,sessionGeneration:1,screen:'home',section:'chats'};window.opened=[];window.profile={id:owner,display_name:'Тестовая история',avatar_url:src};window.PablicusController={state:()=>st,getServices:()=>({getProfile:()=>profile}),subscribe:()=>()=>{}};window.PablicusAvatarStoriesUI={snapshot:()=>({people:[{id:owner,name:'Тестовая история',url:src}],stories:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',owner_id:owner,expires_at:new Date(Date.now()+3600000).toISOString()}],now:Date.now()}),imageFor:url=>{const i=new Image();i.src=url;return i;}};window.PablicusStoriesViewer={open:(...args)=>opened.push(args),close:()=>{}};document.querySelector('.profileNavAvatar').append(PablicusAvatarStoriesUI.imageFor(src));}''',photo)
  page.add_script_tag(content=(r/'stories-v3-core.js').read_text());page.wait_for_function('document.querySelector(".storyShelfAvatar img")?.complete');page.wait_for_timeout(100)
  page.evaluate('window.shelfImage=document.querySelector(".storyShelfAvatar img")')
  band(page,'.storyShelfAvatar','real expanded shelf');band(page,'.profileNavAvatar','real navigation avatar')
  page.locator('.storyShelfItem').click();check('real shelf tap opens its original story action once',page.evaluate('opened.length')==1)
  for top,label in [(81,'transition'),(162,'compact'),(0,'expanded')]:
   page.evaluate('(v)=>document.querySelector("#workspace").scrollTop=v',top);page.wait_for_timeout(160)
   check('real shelf '+label+' state reached',page.locator('.storyShelfV3').get_attribute('data-presentation')==label)
   band(page,'.storyShelfAvatar','real '+label+' shelf')
   check(label+' preserves original photo node',page.evaluate('document.querySelector(".storyShelfAvatar img")===shelfImage'))
  page.screenshot(path=str(out/f'rings-{a.engine}-shelf.png'))
  page.evaluate('PablicusStoriesCore.destroy()');check('real shelf teardown still disconnects',page.locator('.storyShelfV3').count()==0)
  # Real profile motion: portrait circle uses shared ring; album stays unmasked.
  page=ctx.new_page();page.set_viewport_size({'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda q:q.abort())
  load(page,'<div id="home"><div id="screenContent"><section class="contactPage youMotionPage"><header class="contactTop"><button>Назад</button></header><section class="contactHero"><div class="contactPhotoButton pablicusStoryProfile" data-pablicus-story-ring="active"><div class="profilePhotoPlane"><div class="profilePhotoTrack"><div class="profilePhotoSlide"><img></div></div></div></div><h1 class="contactName">Тестовый профиль</h1><p class="contactHandle">@fixture</p><nav class="contactActions"><button>Изменить</button></nav></section><div class="contactBody" style="height:1200px"></div></section></div></div>')
  page.add_style_tag(content='#home{width:390px!important;height:844px!important}#screenContent{height:844px!important}.contactPage{width:390px!important;height:844px!important;overflow:auto!important}.profilePhotoTrack,.profilePhotoSlide{position:absolute;inset:0;width:100%;height:100%}')
  page.evaluate('src=>document.querySelector(".profilePhotoSlide img").src=src',photo);page.add_script_tag(content=(r/'contact-motion.js').read_text())
  page.evaluate('''()=>{window.pp=document.querySelector('.contactPage');window.pi=pp.querySelector('img');window.pm=PablicusContactMotion.mount(pp,pp.querySelector('.contactTop'),pp.querySelector('.contactHero'),{isOpen:()=>true,profile:{avatar_url:'fixture'}})}''');page.wait_for_timeout(120)
  band(page,'.pablicusStoryProfile','real own-profile portrait')
  page.screenshot(path=str(out/f'rings-{a.engine}-profile.png'))
  page.evaluate('pm.expand()');page.wait_for_timeout(450)
  check('profile expansion retains album mode',page.locator('.contactPage').get_attribute('data-profile-presentation')=='album')
  check('album has no circle overlays',page.locator('.pablicusStoryProfile').evaluate('n=>["::before","::after"].every(p=>getComputedStyle(n,p).content==="none")'))
  check('profile expansion retains same image node and URL',page.evaluate('pp.querySelector("img")===pi&&pi.src.startsWith("data:image/")'))
  page.evaluate('pm.collapse()');page.wait_for_timeout(450);band(page,'.pablicusStoryProfile','collapsed back to profile portrait')
  page.evaluate('pm.destroy()');check('profile motion teardown preserved',not page.locator('.contactPage').get_attribute('class').count('contactGestureMotion'))
  check('no JavaScript or observer errors',not errors,errors)
 except Exception as e:
  checks.append(dict(name='suite completion',passed=False,details=str(e),traceback=traceback.format_exc()));print(traceback.format_exc(),flush=True);page.screenshot(path=str(out/f'rings-{a.engine}-failure.png'))
 finally:
  result=dict(engine=a.engine,passed=sum(c['passed'] for c in checks),failed=sum(not c['passed'] for c in checks),checks=checks,source_sha256={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['avatar-ring-system.css','stories-v3-core.js','contact-motion.js']},boundary='Real runtime CSS, native browser pixels, actual story shelf and profile motion; isolated synthetic media and services. Not physical iPhone acceptance.')
  (out/f'rings-{a.engine}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
if result['failed']:raise SystemExit(1)

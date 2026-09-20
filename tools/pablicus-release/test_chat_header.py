"""Actual header module and complete shipped CSS; isolated navigation fixtures."""
import argparse,json,pathlib,re
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--engine',required=True);a=p.parse_args()
root=pathlib.Path('vision-talk/pablicus');out=pathlib.Path('results');out.mkdir(exist_ok=True)
html=(root/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
html=re.sub(r'<link\b[^>]*>', '', html)
styles=re.findall(r'<link[^>]*href="([^"]+\.css)[^"]*"', (root/'index.html').read_text())
checks=[]
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch();page=browser.new_page(viewport={'width':390,'height':844});page.set_default_timeout(10000)
 page.route('**/*',lambda r:r.abort())
 page.set_content(html)
 for name in styles:page.add_style_tag(content=(root/name).read_text())
 page.evaluate("""()=>{window.PablicusAvatarStoriesUI={};window.visits=[];window.routeState={conversationId:'fixture-a'};window.PablicusController={state:()=>routeState};window.PablicusContacts={open:id=>visits.push(id)};document.querySelector('#home').hidden=true;document.querySelector('#app').hidden=false;const rail=document.createElement('div');rail.className='r2FunctionRail';document.querySelector('#composeBox').append(rail);const title=document.querySelector('#chatTitle');title.textContent='Катюша ❤️❤️❤️';title.onclick=()=>PablicusContacts.open(routeState.conversationId);}""")
 page.add_script_tag(content=(root/'glass-ui.js').read_text())
 page.locator('.chatAvatarDock>#chatTitle').wait_for()
 def check(name,ok):
  assert ok,name
  checks.append(name)
 for width,safe in [(390,59),(320,0),(768,24)]:
  page.set_viewport_size({'width':width,'height':844});page.evaluate('(v)=>document.documentElement.style.setProperty("--safe-area-top",v+"px")',safe)
  page.wait_for_timeout(80)
  box=page.locator('#conversationAvatar').bounding_box();title=page.locator('#chatTitle').bounding_box();app=page.locator('#app').bounding_box();stage=page.locator('#app>.stage').bounding_box()
  check(f'{width}: centered round avatar',abs(box['x']+box['width']/2-app['x']-app['width']/2)<2 and abs(box['width']-box['height'])<1)
  check(f'{width}: name below avatar',title['y']>=box['y']+box['height'])
  check(f'{width}: safe area and separate history',box['y']>=app['y']+safe and stage['y']>=title['y']+title['height'])
  check(f'{width}: avatar is hit target',page.locator('#conversationAvatar').evaluate('(n)=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'))
 page.locator('#chatTitle').click();check('name retains profile handler',page.evaluate("visits.at(-1)==='fixture-a'"))
 page.evaluate("routeState.conversationId='fixture-b';document.querySelector('#chatTitle').textContent='Новое личное имя'")
 page.locator('#chatTitle').click();check('new conversation uses current identity',page.evaluate("visits.at(-1)==='fixture-b'"))
 check('one live title',page.locator('#chatTitle').count()==1)
 page.locator('#conversationAvatar').click();check('no-story avatar preserves profile fallback',page.evaluate('visits.length===3'))
 page.evaluate("""document.addEventListener('click',e=>{if(e.target.closest('#conversationAvatar')){e.preventDefault();e.stopImmediatePropagation();window.storyOpened=true}},{capture:true,once:true})""")
 page.locator('#conversationAvatar').click();check('story capture can intercept without opening profile',page.evaluate('storyOpened&&visits.length===3'))
 page.evaluate("document.querySelector('#app').classList.add('composer-fullscreen')")
 check('fullscreen composer hides identity',not page.locator('.chatAvatarDock').is_visible())
 page.evaluate("document.querySelector('#app').classList.remove('composer-fullscreen')")
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/f'header-{a.engine}.png'))
 browser.close()
(out/f'header-{a.engine}.json').write_text(json.dumps({'engine':a.engine,'checks':checks,'passed':len(checks)},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))

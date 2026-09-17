"""Complete public runtime with synthetic services only. No physical iPhone claim."""
import asyncio,json,sys
from pathlib import Path
from playwright.async_api import async_playwright
from harness import Boundary,A,B,CID,ROOT
OUT=ROOT/'results';OUT.mkdir(exist_ok=True)
RECT="n=>{let r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}}"
async def settle(p):await p.wait_for_timeout(80)
async def run(engine,pw):
 results={'engine':engine,'checks':[],'errors':[],'scope':'Complete runtime, synthetic network. Not physical iPhone.'}
 def check(name,value,actual=None):
  results['checks'].append({'name':name,'pass':bool(value),'actual':actual})
  if not value:print('FAIL '+engine+' '+name+' '+str(actual),flush=True)
 b=await getattr(pw,engine).launch();ctx=p=None
 try:
  n=Boundary(ROOT/'candidate');ctx,p=await n.boot(b)
  await p.wait_for_function('document.querySelectorAll(".storyShelfItem").length===2 && document.querySelector(".chatCard")')
  await p.wait_for_function('Array.from(document.querySelectorAll(".storyShelfItem img")).length===2 && Array.from(document.querySelectorAll(".storyShelfItem img")).every(i=>i.complete&&i.naturalWidth>0)')
  print('BOOT '+engine+' '+json.dumps(await p.evaluate('PablicusController.state()')),flush=True)
  results['errors']=p.errors
  await p.evaluate('window.__nodes=[...document.querySelectorAll(".storyShelfItem")];window.__imgs=__nodes.map(n=>n.querySelector("img"))')
  for w,h in [(320,720),(390,844),(430,932),(768,1024),(844,390)]:
   await p.set_viewport_size({'width':w,'height':h});await settle(p)
   nav=await p.locator('#mainNav').evaluate(RECT);rects=[]
   for y in [0,40,81,122,162,9999,81,0]:
    await p.locator('#workspace').evaluate('(n,y)=>n.scrollTop=y',y);await settle(p)
    r=await p.locator('.storyShelfAvatar').first.evaluate(RECT);rects.append(r)
    identity=await p.evaluate('__nodes.every((n,i)=>n===document.querySelectorAll(".storyShelfItem")[i]&&__imgs[i]===n.querySelector("img"))')
    check(f'same-avatar-image-{w}-{y}',identity)
    panel=await p.locator('.storyShelfV3').evaluate(RECT);check(f'avatar-contained-{w}-{y}',r['y']>=panel['y']-.5 and r['bottom']<=panel['bottom']+.5,[r,panel])
    cur=await p.locator('#mainNav').evaluate(RECT);check(f'nav-fixed-{w}-{y}',abs(cur['y']-nav['y'])<.5)
    check(f'no-document-scroll-{w}-{y}',await p.evaluate('scrollX===0&&scrollY===0'))
   check(f'continuous-shrink-reverse-{w}',rects[0]['w']>rects[1]['w']>rects[2]['w']>rects[3]['w']>rects[4]['w'] and abs(rects[-1]['w']-72)<.5,[r['w'] for r in rects])
   check(f'short-list-bounded-{w}',abs(await p.locator('#workspace').evaluate('n=>n.scrollHeight-n.clientHeight')-162)<2)
   check(f'no-duplicate-mini-{w}',await p.locator('#storyShelfCompact,.storyCompactItem,.storyMorphAnchor').count()==0)
  await p.set_viewport_size({'width':390,'height':844});await settle(p)
  await p.screenshot(path=str(OUT/(engine+'-expanded.png')))
  await p.locator('#workspace').evaluate('n=>n.scrollTop=162');await settle(p);await p.screenshot(path=str(OUT/(engine+'-compact.png')))
  await p.locator('#workspace').evaluate('n=>n.scrollTop=0');await settle(p)
  await p.evaluate('window.__extra=[];const first=document.querySelector(".chatCard");for(let i=0;i<25;i++){const n=first.cloneNode(true);n.removeAttribute("data-conversation-id");first.parentNode.append(n);__extra.push(n)}')
  await p.locator('#workspace').evaluate('n=>n.scrollTop=550');await settle(p)
  check('long-list-native-scroll',await p.locator('#workspace').evaluate('n=>n.scrollTop')>=549)
  check('long-list-same-pinned-avatar',abs((await p.locator('.storyShelfAvatar').first.evaluate(RECT))['w']-36)<.5)
  await p.evaluate('__extra.forEach(n=>n.remove());document.querySelector("#workspace").scrollTop=0');await settle(p)
  if engine=='chromium':
   cdp=await ctx.new_cdp_session(p)
   for method,points in [('touchStart',[{'x':200,'y':540}]),('touchMove',[{'x':200,'y':490}]),('touchMove',[{'x':200,'y':430}]),('touchMove',[{'x':200,'y':360}]),('touchEnd',[])]:
    await cdp.send('Input.dispatchTouchEvent',{'type':method,'touchPoints':points});await p.wait_for_timeout(45)
   await p.wait_for_timeout(300)
   check('native-single-touch-collapses',await p.locator('#workspace').evaluate('n=>n.scrollTop')>150)
   await cdp.detach()
  await p.locator('#workspace').evaluate('n=>n.scrollTop=0');await settle(p)
  await p.locator('.storyShelfItem').nth(1).click()
  await p.locator('dialog.storyViewerV3 .media').wait_for()
  await p.wait_for_function('document.querySelector("dialog.storyViewerV3").firstElementChild.shadowRoot.querySelector("img.media")?.naturalWidth>0')
  check('fullscreen-native-dialog',await p.locator('dialog.storyViewerV3').evaluate('n=>n.open&&n.getBoundingClientRect().width===innerWidth'))
  author=await p.locator('dialog.storyViewerV3 .who .avatar').evaluate(RECT);check('small-author-avatar',author['w']==38 and author['h']==38,author)
  controls=await p.locator('dialog.storyViewerV3 .tools button').evaluate_all('ns=>ns.map(n=>{let r=n.getBoundingClientRect();return [r.width,r.height]})')
  check('uniform-player-controls',len(controls)==3 and all(x==[44,44] for x in controls),controls)
  await p.screenshot(path=str(OUT/(engine+'-viewer.png')))
  await p.locator('dialog.storyViewerV3 input').fill('Тестовый ответ без реального получателя')
  await p.locator('dialog.storyViewerV3 button[aria-label="Отправить ответ"]').click();await p.wait_for_timeout(160)
  check('reply-acknowledged',len(n.sent)==1 and await p.locator('dialog.storyViewerV3 input').input_value()=='')
  await p.locator('dialog.storyViewerV3 button[aria-label="Закрыть сторис"]').focus();await p.keyboard.press('ArrowRight')
  await p.locator('dialog.storyViewerV3 video').wait_for();await p.wait_for_function('document.querySelector("dialog.storyViewerV3").firstElementChild.shadowRoot.querySelector("video")?.readyState>=2')
  check('video-loaded',await p.locator('dialog.storyViewerV3 video').evaluate('v=>v.playsInline&&v.videoWidth>0'))
  await p.locator('dialog.storyViewerV3 button[aria-label="Закрыть сторис"]').click()
  await p.locator('#mainNav [data-page=profile]').click();await p.locator('.pablicusStoryProfile').wait_for();await p.wait_for_timeout(500)
  face=p.locator('.pablicusStoryProfile').first;before=await face.evaluate(RECT)
  check('portrait-geometry-preserved',abs(before['w']-before['h'])<1 and 100<=before['w']<=150,before)
  pseudo=await face.evaluate('n=>({a:getComputedStyle(n,"::after").content,b:getComputedStyle(n,"::after").backgroundImage,padding:getComputedStyle(n).padding})')
  check('own-story-ring-present',pseudo['a']!='none' and 'gradient' in pseudo['b'],pseudo)
  await p.screenshot(path=str(OUT/(engine+'-profile.png')))
  await face.click();await p.locator('dialog.storyViewerV3').wait_for();await p.locator('dialog.storyViewerV3 .media').wait_for()
  check('own-avatar-opens-story-not-album',await p.locator('.youMotionPage').get_attribute('data-profile-presentation')=='portrait')
  await p.locator('dialog.storyViewerV3 button[aria-label="Закрыть сторис"]').click()
  check('profile-size-restored',(await face.evaluate(RECT))==before)
  await p.locator('#mainNav [data-page=chats]').click();await p.locator('.storyShelfItem').first.wait_for()
  await p.locator('.chatCard .chatMain').first.click();await p.wait_for_function('window.PablicusChat?.list && !document.querySelector("#app").inert');await p.wait_for_timeout(300)
  app=p.locator('#app');before=await app.evaluate(RECT)
  await p.locator('#input').fill('Сохранность черновика при обновлении интерфейса');await p.wait_for_timeout(600)
  pinch=await p.evaluate('''()=>{const n=document.querySelector('#vp');const e=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientX:50,clientY:200},{clientX:160,clientY:250}]});n.dispatchEvent(e);return e.defaultPrevented}''')
  check('two-touch-default-prevented',pinch)
  stable=await p.evaluate('''()=>{const a=document.querySelector('#app'),before=a.style.cssText,v=visualViewport,desc=Object.getOwnPropertyDescriptor(v,'scale');Object.defineProperty(v,'scale',{configurable:true,get:()=>1.5});v.dispatchEvent(new Event('resize'));return new Promise(r=>setTimeout(()=>{r(before===a.style.cssText);if(desc)Object.defineProperty(v,'scale',desc);else delete v.scale;v.dispatchEvent(new Event('resize'));},120))}''')
  check('zoom-cannot-shrink-app-layout',stable)
  await p.locator('#input').blur();await p.wait_for_timeout(160)
  if engine=='chromium':
   cdp=await ctx.new_cdp_session(p);orig=await app.evaluate(RECT)
   for typ,pts in [('touchStart',[(120,350),(240,350)]),('touchMove',[(105,340),(255,365)]),('touchMove',[(70,310),(290,390)]),('touchEnd',[])]:
    await cdp.send('Input.dispatchTouchEvent',{'type':typ,'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in enumerate(pts)]});await p.wait_for_timeout(50)
   await p.wait_for_timeout(180);now=await app.evaluate(RECT)
   check('native-two-finger-chat-stable',orig==now and await p.evaluate('visualViewport.scale')==1,[orig,now]);await cdp.detach()
  check('draft-survives-gestures',await p.locator('#input').input_value()=='Сохранность черновика при обновлении интерфейса')
  await p.locator('#chatBack').click();await p.locator('.chatMain').first.click();await p.wait_for_timeout(300)
  check('draft-survives-return',await p.locator('#input').input_value()=='Сохранность черновика при обновлении интерфейса')
  check('no-javascript-errors',not p.errors,p.errors)
  results['unknown_requests']=list(set(n.unknown))
 except Exception as e:
  results['fatal']=str(e);print('FATAL '+engine+' '+str(e),flush=True)
  if p:
   print('ERRORS',p.errors,'NETWORK',n.unknown,flush=True)
   print('STATE',await p.evaluate('window.PablicusController?.state()'),flush=True)
   await p.screenshot(path=str(OUT/(engine+'-failure.png')))
 finally:
  if ctx:await ctx.close()
  await b.close()
 (OUT/(engine+'.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2))
 print('RESULT '+engine+' '+str(sum(c['pass'] for c in results['checks']))+'/'+str(len(results['checks'])),flush=True)
 return not results.get('fatal') and all(c['pass'] for c in results['checks'])
async def main():
 async with async_playwright() as pw:ok=[await run(e,pw) for e in ['chromium','webkit']]
 sys.exit(0 if all(ok) else 1)
if __name__=='__main__':asyncio.run(main())

"""Current media renderer/CSS, generated real decoded raster fixtures, no accounts.
Border trim is display-only; exact original image URL/bytes stay available.
"""
import argparse,pathlib,re,json,hashlib,traceback
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',default='chromium');p.add_argument('--executable');a=p.parse_args();root=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True);checks=[]
html=(root/'index.html').read_text();styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S);html=re.sub(r'<link\b[^>]*>','',html)
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'details':detail});print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 browser=getattr(pw,a.engine).launch(**opts);page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(6000);page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('blob:') else r.abort());
 try:
  page.set_content(html)
  for f in styles:page.add_style_tag(content=(root/f).read_text())
  for f in ['component-registry.js','rich-message.js']:page.add_script_tag(content=(root/f).read_text())
  page.evaluate('''()=>{document.querySelector('#home').hidden=true;document.querySelector('#app').hidden=false;document.querySelector('#startPanel').hidden=true;
  window.picture=(w,h,t=0,b=t,dark=false)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='black';x.fillRect(0,0,w,h);x.fillStyle=dark?'#101010':'#69a9d0';x.fillRect(0,t,w,h-t-b);x.fillStyle=dark?'#181818':'#e99428';x.fillRect(w*.2,t+(h-t-b)*.2,w*.6,(h-t-b)*.6);return URL.createObjectURL(new Blob([Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'}));};
  window.mount=(url,mime='image/png',album=false)=>{PablicusRichMessage.stopAll();const row=document.createElement('article'),bubble=document.createElement('div');row.className='row mine';row.style.cssText='position:relative;transform:none';bubble.className='bubble';const block={id:'photo',type:'image',path:'fixture',mime,width:800,height:200};const content={v:1,blocks:album?[block,{...block,id:'second'}]:[block]};bubble.append(PablicusRichMessage.render(content,{resolveUrl:async()=>url,inlineVideo:true}));PablicusRichMessage.prepareChatBubble(bubble);row.append(bubble);document.querySelector('#canvas').replaceChildren(row);document.querySelector('#canvas').style.height='700px';window.original=url;};
  window.measure=()=>{const frame=document.querySelector('#canvas .richMedia-image'),im=frame.querySelector('img'),b=frame.getBoundingClientRect();return {width:b.width,height:b.height,crop:frame.dataset.borderTrim||null,source:im.src,natural:[im.naturalWidth,im.naturalHeight],radius:getComputedStyle(frame).borderRadius,img:im.getBoundingClientRect().toJSON(),frame:b.toJSON()};};
  }''')
  for w,h in [(900,1600),(1600,900),(800,800),(707,1536)]:
   page.evaluate('([w,h])=>mount(picture(w,h))',[w,h]);page.wait_for_function('document.querySelector("#canvas img")?.naturalWidth>0');page.wait_for_timeout(120);m=page.evaluate('measure()')
   check(f'{w}x{h} actual ratio retained',abs(m['width']/m['height']-w/h)<.005,m)
   check(f'{w}x{h} no crop on unframed original',m['crop'] is None and m['source']==page.evaluate('original'))
   check(f'{w}x{h} rounded corners retained',m['radius']=='16px')
   if h/w>1.7:check(f'{w}x{h} portrait larger than rejected 320px cap',m['height']>375 and m['height']<=421)
  page.evaluate('mount(picture(600,1200,100))');page.wait_for_function('document.querySelector("#canvas img")?.naturalHeight===1200');page.wait_for_timeout(150);m=page.evaluate('measure()');crop=json.loads(m['crop'] or '{}')
  check('uniform paired encoded black borders detected',.075<crop.get('top',0)<.085 and .075<crop.get('bottom',0)<.085,m)
  check('content rectangle uses uncropped visible-photo ratio',abs(m['width']/m['height']-.6)<.007,m)
  check('original URL and all original pixels retained for original viewer',m['source']==page.evaluate('original') and m['natural']==[600,1200])
  check('display-only image offset removes border without distortion',m['img']['y']<m['frame']['y'] and abs(m['img']['width']/m['img']['height']-.5)<.003,m)
  page.screenshot(path=str(out/('media-v5-'+a.engine+'-borderless.png')))
  for name,args,mime,album in [('one-sided black area',[600,1200,100,0],'image/png',False),('dark photograph',[600,1200,100,100,True],'image/png',False),('animated media',[600,1200,100,100],'image/gif',False),('joined album',[600,1200,100,100],'image/png',True)]:
   page.evaluate('([args,mime,album])=>mount(picture(...args),mime,album)',[args,mime,album]);page.wait_for_function('document.querySelector("#canvas img")?.naturalWidth>0');page.wait_for_timeout(100);check(name+' is not auto-cropped',page.evaluate('measure().crop') is None)
  check('no renderer exceptions',not errors,errors)
 except Exception as e:
  checks.append({'name':'suite completion','passed':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc());page.screenshot(path=str(out/('media-v5-'+a.engine+'-failure.png')))
 finally:
  result={'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'source_sha256':{n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['rich-message.js','public-ui-foundation.css']},'boundary':'Actual media renderer/styles; generated raster images; no physical iPhone or provided original child-photo test.'}
  (out/('media-v5-'+a.engine+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
if result['failed']:raise SystemExit(1)

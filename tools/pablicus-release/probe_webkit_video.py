"""Isolate WebKit video fixture transport from application code. No runtime writes."""
import argparse, pathlib, re
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('mode',choices=['all','http','none']);a=p.parse_args()
with sync_playwright() as pw:
 b=pw.webkit.launch();page=b.new_page();page.set_default_timeout(10000)
 if a.mode=='all':page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('blob:','data:')) else r.abort())
 elif a.mode=='http':page.route(re.compile(r'^https?://'),lambda r:r.abort())
 page.on('console',lambda m:print('CONSOLE',m.text,flush=True))
 page.on('pageerror',lambda e:print('ERROR',e,flush=True))
 page.set_content('<body><video id="v" muted playsinline preload="metadata"></video></body>')
 print('READY',a.mode,flush=True)
 encoded=pathlib.Path(__file__).with_name('media_geometry_portrait.b64').read_text().strip()
 print('SUPPORT',page.evaluate('document.querySelector("video").canPlayType(\'video/mp4; codecs="avc1.42E01E"\')'),flush=True)
 page.evaluate("""encoded=>{const v=document.querySelector('video');v.addEventListener('loadedmetadata',()=>console.log('METADATA',v.videoWidth,v.videoHeight));v.addEventListener('error',()=>console.log('MEDIAERROR',v.error?.code));v.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'video/mp4'}));v.load();}""",encoded)
 print('INSERTED',flush=True)
 page.wait_for_function('document.querySelector("video").videoHeight===320',polling=100,timeout=10000)
 print('DECODE PASS',page.evaluate('({w:v.videoWidth,h:v.videoHeight,ready:v.readyState})'),flush=True)
 b.close()

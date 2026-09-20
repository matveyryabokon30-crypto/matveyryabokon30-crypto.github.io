"""Bounded native mock-capture capability probe. No application or external calls."""
import argparse,http.server,json,pathlib,platform,threading
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--output',default='results/f06-capture-probe.json');a=p.parse_args()
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<!doctype html><button>Capture probe</button>')
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
with sync_playwright() as pw:
 for channel in [None,'chromium']:
  browser=None
  try:
   options={'args':['--use-fake-device-for-media-stream']}
   if channel:options['channel']=channel
   browser=pw.chromium.launch(**options);ctx=browser.new_context();ctx.grant_permissions(['microphone','camera'],origin=origin)
   for label,constraints in [('audio',{'audio':True}),('video',{'video':{'facingMode':'user'}}),('both',{'audio':True,'video':{'facingMode':'user'}})]:
    page=ctx.new_page();page.goto(origin);result=page.evaluate('''async constraints=>{try{const stream=await Promise.race([navigator.mediaDevices.getUserMedia(constraints),new Promise((_,reject)=>setTimeout(()=>reject(Error('probe-timeout')),8000))]);const tracks=stream.getTracks().map(t=>({kind:t.kind,state:t.readyState}));stream.getTracks().forEach(t=>t.stop());return{ok:true,tracks};}catch(e){return{ok:false,error:e.name,message:e.message};}}''',constraints);row={'platform':platform.platform(),'channel':channel or 'headless-shell','version':browser.version,'capture':label,**result};results.append(row);print(json.dumps(row),flush=True);page.close()
   ctx.close()
  except Exception as error:
   row={'platform':platform.platform(),'channel':channel or 'headless-shell','error':str(error)[:1000]};results.append(row);print(json.dumps(row),flush=True)
  finally:
   if browser:browser.close()
server.shutdown();path=pathlib.Path(a.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(results,indent=2))

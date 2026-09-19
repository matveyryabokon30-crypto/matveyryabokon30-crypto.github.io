"""Real browser WebRTC paired media and call controller gates. Synthetic tracks/accounts only."""
import argparse,http.server,json,pathlib,threading,faulthandler
from playwright.sync_api import sync_playwright
faulthandler.dump_traceback_later(55,repeat=True)
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',choices=['chromium','webkit'],required=True);p.add_argument('--output');a=p.parse_args();root=pathlib.Path(a.root).resolve()
if (root/'vision-talk/pablicus').is_dir():root=root/'vision-talk/pablicus'
checks=[]
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(root),**kw)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/f06-probe.html':
   data=b'<!doctype html><html><head><script src="calls-client.js"></script><script src="calls-webrtc.js"></script></head><body><button id="begin">Begin fixture</button><video id="remote" autoplay playsinline muted></video></body></html>';self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(data);return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def check(name,value):
 assert value,name
 checks.append(name);print('PASS '+name,flush=True)
with sync_playwright() as pw:
 browser=getattr(pw,a.engine).launch();ctx=browser.new_context(service_workers='block');page=ctx.new_page();page.set_default_timeout(20000)
 try:
  page.goto(origin+'/f06-probe.html?call=dddddddd-dddd-4ddd-8ddd-dddddddddddd&recipient=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  check('call click scrubbed before authentication',page.evaluate("location.search===''"))
  page.evaluate("""window.asked=0;window.tracks=[];window.contexts=[];window.errors=[];window.connected={a:false,b:false};window.streams={};window.animation=[];window.prepared=[];window.fixtureGeneration=1;
  window.makeFixture=async function(){const audio=new AudioContext();contexts.push(audio);await audio.resume();const oscillator=audio.createOscillator(),destination=audio.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();const stream=new MediaStream(destination.stream.getTracks());{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const c=canvas.getContext('2d');let count=0;const paint=()=>{c.fillStyle=count++%2?'#0B3D91':'#7FE7D6';c.fillRect(0,0,160,120);};paint();animation.push(setInterval(paint,50));for(const t of canvas.captureStream(10).getTracks())stream.addTrack(t);}tracks.push(...stream.getTracks());return stream;};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async function(){asked++;if(!prepared.length)throw Error('fixture-stream-exhausted');return prepared.shift();}});
  const relay=(target,s)=>{setTimeout(()=>void window[target].accept({...s,generation:fixtureGeneration},{video:true}).catch(e=>errors.push(String(e))),0);};
  window.a=PablicusCalls.create({onSignal:s=>relay('b',s),onState:s=>{connected.a=s==='connected';},onRemoteStream:s=>streams.a=s});
  window.b=PablicusCalls.create({onSignal:s=>relay('a',s),onState:s=>{connected.b=s==='connected';},onRemoteStream:s=>{streams.b=s;document.getElementById('remote').srcObject=s;}});
  document.getElementById('begin').onclick=()=>{const first=makeFixture(),second=makeFixture();void Promise.all([first,second]).then(values=>{prepared=values;return a.start({video:true});}).catch(e=>errors.push(String(e)));};void 0;""")
  page.locator('#begin').click();page.wait_for_function('connected.a&&connected.b',timeout=30000)
  print('RTC diagnostics '+json.dumps(page.evaluate('({asked,errors,connected,trackKinds:tracks.map(t=>t.kind)})')),flush=True)
  check('actual paired RTCPeerConnection connects with synthetic audio/video',page.evaluate('asked===2&&errors.length===0'))
  page.wait_for_function("streams.a?.getAudioTracks().length===1&&streams.a?.getVideoTracks().length===1&&streams.b?.getAudioTracks().length===1&&streams.b?.getVideoTracks().length===1")
  check('both peers receive real remote audio and video tracks',True)
  page.wait_for_function("async()=>{const stats=await b.stats();return [...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='video'&&s.bytesReceived>0)&&[...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0)}",timeout=20000)
  check('RTP audio/video bytes reach receiver',True)
  page.evaluate('a.setMuted(true)');check('mute disables local audio track',page.evaluate('a.localStream.getAudioTracks().every(t=>!t.enabled)'))
  page.evaluate('a.setVideo(false)');check('camera toggle disables local video track',page.evaluate('a.localStream.getVideoTracks().every(t=>!t.enabled)'))
  page.evaluate('a.setVideo(true);a.setMuted(false)');check('caller ICE restart requested',page.evaluate('fixtureGeneration=2;a.restart()'))
  page.wait_for_function('connected.a&&connected.b&&errors.length===0',timeout=20000)
  check('receiver cannot initiate competing ICE restart',page.evaluate('b.restart()') is False)
  page.evaluate('a.hangup();b.hangup();animation.forEach(clearInterval);contexts.forEach(c=>c.close())')
  check('hangup stops every synthetic media track',page.evaluate("tracks.every(t=>t.readyState==='ended')&&!a.active&&!b.active"))
  page.evaluate("""window.user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};window.rpc=[];window.available=false;window.incoming=false;window.api=PablicusCallClient.create({getUser:()=>user,client:{rpc:async(n,args)=>{rpc.push(args);return {data:{ok:true,available,calls:incoming?[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',caller_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',callee_id:user.id,status:'ringing',media:'audio',expires_at:new Date(Date.now()+45000).toISOString()}]:[]}};}}});api.ready({access_token:'fixture'});""")
  page.wait_for_function("rpc.length>0");before=page.evaluate('asked');page.evaluate("api.start('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')")
  check('disabled foundation does not request microphone or create server call',page.evaluate("!rpc.some(r=>r.p_action==='create')&&asked==="+str(before)))
  page.evaluate('available=true;incoming=true;api.reconcile()');page.wait_for_function("api.snapshot().phase==='incoming'")
  check('incoming call waits for explicit acceptance without media',page.evaluate('asked==='+str(before)))
  page.evaluate("user=null;api.clear()")
  check('logout removes incoming call and availability',page.evaluate('!api.snapshot().call&&!api.snapshot().available'))
  print(json.dumps({'engine':a.engine,'checks':checks,'count':len(checks),'result':'PASS','limits':'Loopback synthetic media; no production TURN or physical iPhone/background evidence.'},ensure_ascii=False),flush=True)
  if not a.output:
   pathlib.Path('results').mkdir(exist_ok=True);a.output='results/f06-'+a.engine+'.json'
  if a.output:pathlib.Path(a.output).write_text(json.dumps({'engine':a.engine,'checks':checks,'count':len(checks),'result':'PASS','limits':'Loopback synthetic media; no production TURN or physical iPhone/background evidence.'},ensure_ascii=False,indent=2))
 except Exception as error:
  diagnostic={}
  try:diagnostic=page.evaluate('({asked:window.asked,errors:window.errors,connected:window.connected})');print('RTC failure diagnostics '+json.dumps(diagnostic),flush=True)
  except Exception:pass
  output=pathlib.Path(a.output or ('results/f06-'+a.engine+'.json'));output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps({'result':'FAIL','engine':a.engine,'checks':checks,'diagnostic':diagnostic,'error':str(error)[:1000]},ensure_ascii=False,indent=2))
  raise
 finally:ctx.close();browser.close();server.shutdown()

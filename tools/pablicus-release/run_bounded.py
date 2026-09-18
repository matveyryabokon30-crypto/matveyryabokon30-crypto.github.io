"""Bound each real browser test and retain stack/output on a stuck browser. No retries."""
import argparse,json,os,pathlib,signal,subprocess,sys,time
p=argparse.ArgumentParser()
p.add_argument('--engine',choices=['chromium','webkit'],required=True)
p.add_argument('--seconds',type=int,default=150)
a=p.parse_args()
out=pathlib.Path('results');out.mkdir(exist_ok=True)
tests=[
 ('release', ['tools/pablicus-release/test_browser_release.py','--root','vision-talk/pablicus','--baseline','baseline/vision-talk/pablicus','--engine',a.engine]),
 ('media', ['tools/pablicus-p01r2/browser.py','--root','vision-talk/pablicus','--engine',a.engine]),
 ('media_extended', ['tools/pablicus-p01r2/extended.py','--root','vision-talk/pablicus','--engine',a.engine])
]
results=[]
for name,args in tests:
 start=time.monotonic();log=out/(a.engine+'-'+name+'.log')
 bootstrap='import faulthandler,runpy,sys;faulthandler.enable();faulthandler.dump_traceback_later('+str(a.seconds)+',exit=True);path=sys.argv.pop(1);runpy.run_path(path,run_name="__main__")'
 with log.open('w') as stream:
  proc=subprocess.Popen([sys.executable,'-u','-c',bootstrap,*args],stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
  timed_out=False
  try:code=proc.wait(timeout=a.seconds+20)
  except subprocess.TimeoutExpired:timed_out=True;os.killpg(proc.pid,signal.SIGKILL);code=proc.wait()
  finally:
   # Test children use this isolated process group, never a production/browser profile.
   try:os.killpg(proc.pid,signal.SIGKILL)
   except ProcessLookupError:pass
 item={'name':name,'engine':a.engine,'exit_code':code,'passed':code==0,'elapsed_seconds':round(time.monotonic()-start,3),'wrapper_timeout':timed_out,'log':log.name}
 results.append(item)
 print(json.dumps(item),flush=True);print(log.read_text()[-24000:],flush=True)
 (out/(a.engine+'-bounded.json')).write_text(json.dumps(results,indent=2))
if not all(x['passed'] for x in results):raise SystemExit(1)

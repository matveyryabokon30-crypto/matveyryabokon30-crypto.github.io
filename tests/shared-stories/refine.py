"""Corrections established by integrated browser regression, before re-running tests."""
from pathlib import Path
import json,hashlib
R=Path(__file__).parent;O=R/'candidate'
p=O/'stories-v3-core.js';s=p.read_text()
s=s.replace('lastScroll=0,linkHandled=false;','lastScroll=0,linkHandled=false,measureFrame=0,tapStart=null,tapIgnoreUntil=0;')
s=s.replace("ui.ws.style.setProperty('--story-min-list',Math.max(0,ui.ws.clientHeight-G.compact-pad)+'px');paint();", "const value=Math.max(0,ui.ws.clientHeight-G.compact-pad)+'px';if(ui.ws.style.getPropertyValue('--story-min-list')!==value)ui.ws.style.setProperty('--story-min-list',value);paint();")
s=s.replace('const ro=new ResizeObserver(measure);','const ro=new ResizeObserver(()=>{if(!measureFrame)measureFrame=requestAnimationFrame(()=>{measureFrame=0;measure();});});')
s=s.replace('Array.from(nodes.values()).forEach((n,i)=>','Array.from(rail.querySelectorAll(\':scope > .storyShelfItem\')).forEach((n,i)=>')
s=s.replace('ui.ro.disconnect();ui.anchor.remove();','ui.ro.disconnect();cancelAnimationFrame(measureFrame);measureFrame=0;ui.anchor.remove();')
s=s.replace("if(!t||ui?.ignoreClick>performance.now())return;","if(!t||ui?.ignoreClick>performance.now()||tapIgnoreUntil>performance.now())return;")
tracking="""
 // A profile pull is not a story tap; retain the existing photo/album drag contract.
 g.addEventListener('pointerdown',e=>{tapStart=e.target.closest?.('.pablicusStoryProfile')?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;},{capture:true,passive:true,signal:life.signal});
 g.addEventListener('pointermove',e=>{if(tapStart?.id===e.pointerId&&Math.hypot(e.clientX-tapStart.x,e.clientY-tapStart.y)>7)tapIgnoreUntil=performance.now()+450;},{capture:true,passive:true,signal:life.signal});
 g.addEventListener('pointerup',()=>{tapStart=null;},{capture:true,passive:true,signal:life.signal});
"""
s=s.replace("g.addEventListener('click',intercept,",tracking+"g.addEventListener('click',intercept,")
p.write_text(s)
p=O/'stories-v3-viewer.js';s=p.read_text();s=s.replace('.meta{display:flex;',".avatar::after{content:'';position:absolute;inset:0;border-radius:50%;background:#fff;mask:radial-gradient(closest-side,transparent 94%,#000 94%);-webkit-mask:radial-gradient(closest-side,transparent 94%,#000 94%)}.avatar[data-pablicus-story-ring=active]::after{background:linear-gradient(135deg,#3ba7f2,#7fe7d6)}.meta{display:flex;")
p.write_text(s)
m=json.loads((R/'manifest.json').read_text());m={n:hashlib.sha256((O/n).read_bytes()).hexdigest() for n in m};(R/'manifest.json').write_text(json.dumps(m,indent=2));print('REFINED_MANIFEST '+json.dumps(m),flush=True)

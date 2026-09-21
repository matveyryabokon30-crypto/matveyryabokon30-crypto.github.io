// The vendored Vanta/p5 files are byte-for-byte upstream builds.
// This wrapper adds speech color/speed, lifecycle guards and safe resize only.
export function voiceStyle(user,agent){
 const clamp=n=>Number.isFinite(n)?Math.min(1,Math.max(0,n)):0;
 user=clamp(user);agent=clamp(agent);
 const r=Math.round(137+user*65+agent*25),g=Math.round(150+user*35+agent*65),b=Math.round(78+agent*80);
 return {color:(Math.min(255,r)<<16)|(Math.min(255,g)<<8)|Math.min(255,b),speed:1+Math.max(user,agent)*.7};
}
export function installOriginal(win,doc){
 let effect=null,p=null,disposed=false,ready=false,resizeTimer=0,extra=0,last=0;
 let state={active:false,motion:true,user:0,agent:0},levels={user:0,agent:0};
 function pause(){p?.noLoop?.();}
 function apply(){if(!ready)return;if(state.active&&state.motion&&!doc.hidden)p.loop();else pause();}
 function destroyEffect(){ready=false;pause();if(effect){win.cancelAnimationFrame(effect.req);effect.destroy();}effect=null;p=null;}
 function start(){
  if(disposed)return;
  try{
   destroyEffect();
   effect=win.VANTA.TOPOLOGY({el:doc.querySelector('#topology'),p5:win.p5,color:0x89964e,backgroundColor:0x002222,mouseControls:false,touchControls:false,gyroControls:false});
   p=effect.p5;if(!p||typeof p.draw!=='function')throw Error('Topology not ready');
   const resizeCanvas=p.resizeCanvas.bind(p);
   p.resizeCanvas=(w,h)=>{if(w!==p.width||h!==p.height)resizeCanvas(w,h);};
   // Upstream's generic RAF does not render p5; p5 owns the actual loop.
   win.cancelAnimationFrame(effect.req);effect.animationLoop=()=>{};
   // Upstream resize only resizes canvas, leaving its fixed flow grid stale.
   win.removeEventListener('resize',effect.resize);
   p.noLoop();p.redraw(24); // Original simulation's first 24 frames, also a reduced-motion still.
   const originalDraw=p.draw;extra=0;last=0;
   p.draw=function(){
    if(disposed||!state.active||!state.motion||doc.hidden){pause();return;}
    try{
     const now=win.performance.now(),dt=last?Math.min(.1,(now-last)/1000):1/60;last=now;
     for(const k of ['user','agent'])levels[k]+=(state[k]-levels[k])*(1-Math.exp(-dt*(state[k]>levels[k]?12:3)));
     const style=voiceStyle(levels.user,levels.agent);effect.setOptions({color:style.color});
     extra+=style.speed-1;const steps=1+Math.floor(extra);extra%=1;
     for(let i=0;i<steps;i++){p.push();try{originalDraw.call(p);}finally{p.pop();}}
    }catch{destroyEffect();}
   };
   p.frameRate(60);ready=true;apply();
   win.parent.postMessage({type:'sekkes-topology-ready'},win.location.origin);
  }catch{destroyEffect();}
 }
 function message(e){
  if(e.source!==win.parent||e.origin!==win.location.origin||e.data?.type!=='sekkes-topology-state')return;
  const bound=n=>Number.isFinite(n)?Math.min(1,Math.max(0,n)):0;
  state={active:e.data.active===true,motion:e.data.motion===true,user:bound(e.data.user),agent:bound(e.data.agent)};
  if(!state.active){levels={user:0,agent:0};last=0;}apply();
 }
 function resize(){win.clearTimeout(resizeTimer);resizeTimer=win.setTimeout(start,250);}
 function dispose(){if(disposed)return;disposed=true;win.clearTimeout(resizeTimer);destroyEffect();win.removeEventListener('message',message);win.removeEventListener('resize',resize);win.removeEventListener('load',start);win.removeEventListener('pagehide',dispose);doc.removeEventListener('visibilitychange',apply);}
 win.addEventListener('message',message);win.addEventListener('resize',resize);win.addEventListener('pagehide',dispose);doc.addEventListener('visibilitychange',apply);
 if(doc.readyState==='complete')start();else win.addEventListener('load',start,{once:true});
 return {dispose};
}
if(typeof window!=='undefined')installOriginal(window,document);

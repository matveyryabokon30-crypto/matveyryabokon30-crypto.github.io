// Shared evolving scene: mounted once outside the route host; audio is read-only.
import {applyTopologyChrome,mountTopologyChrome} from './topology-chrome.mjs';
import {readLevels} from './lake-visual.mjs';
const scenes=new WeakMap();
const bounded=n=>Number.isFinite(n)?Math.min(1,Math.max(0,n)):0;
export function mountTopology(scene,doc=document){
 const win=doc.defaultView,frame=doc.createElement('iframe');
 frame.className='topology-evolving';frame.title='Анимированный фон Topology';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
 frame.src=new URL('/sekkes-v2/assets/topology-evolving.html',import.meta.url).href;
 const chrome=mountTopologyChrome(doc);
 let disposed=false,levels={user:0,agent:0};
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 function refresh(){
  if(disposed)return;
  const active=!doc.hidden&&scene.isConnected;
  const motion=doc.documentElement.dataset.motion!=='reduced'&&!reduced.matches&&doc.documentElement.dataset.interacting!=='true';
  try{frame.contentWindow?.postMessage({type:'sekkes-topology-state',active,motion,user:active?levels.user:0,agent:active?levels.agent:0},win.location.origin);}catch{/* Decoration never blocks input. */}
 }
 function message(e){
  if(e.source!==frame.contentWindow||e.origin!==win.location.origin)return;
  if(e.data?.type==='sekkes-topology-ready')refresh();
  if(e.data?.type==='sekkes-topology-palette')applyTopologyChrome(doc,e.data.rgb);
 }
 const observer=new win.MutationObserver(refresh);
 observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-motion','data-interacting']});

 win.addEventListener('message',message);doc.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);
 frame.addEventListener('load',refresh);scene.append(frame);
 const controller={setLevels(value){levels={user:bounded(value.user),agent:bounded(value.agent)};refresh();},dispose(){
  if(disposed)return;disposed=true;observer.disconnect();win.removeEventListener('message',message);doc.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);frame.removeEventListener('load',refresh);frame.remove();chrome.dispose();scenes.delete(scene);
 }};
 scenes.set(scene,controller);refresh();return controller;
}
export function startTopologyAudio(pc,doc=document){
 const win=doc.defaultView;let disposed=false,pending=false,previous=new Map(),epoch=0;
 const sink=()=>scenes.get(doc.querySelector('#appTopology'));
 const clear=()=>sink()?.setLevels({user:0,agent:0});
 const active=()=>!disposed&&!doc.hidden;
 async function sample(){
  if(!active()){clear();return;}if(pending||!pc?.getStats)return;
  pending=true;const own=++epoch;let expired=false;
  const timeout=win.setTimeout(()=>{expired=true;clear();},600);
  try{const report=await pc.getStats();if(expired||!active()||own!==epoch)return;
   const data=readLevels(report,previous);previous=data.previous;
   sink()?.setLevels({user:bounded(Math.sqrt(data.user)*2.2-.1),agent:bounded(Math.sqrt(data.agent)*2.2-.1)});
  }catch{if(!disposed)clear();}finally{win.clearTimeout(timeout);pending=false;}
 }
 const timer=win.setInterval(sample,100);sample();
 return {dispose(){if(disposed)return;disposed=true;epoch++;win.clearInterval(timer);previous.clear();clear();}};
}


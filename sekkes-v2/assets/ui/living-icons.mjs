import {iconFrame,iconSeed} from './living-icon-core.mjs';
const selector='.living-icon[data-living-icon]';
const important=new Set(['stop','close','back','arrow','send','mic','menu','plus','check','play']);
// One clock and renderer for the entire app; no effect owns a button action.
export function mountLivingIcons(doc=document){
 const win=doc.defaultView,records=new Map(),samples=new Map(),media=win.matchMedia('(prefers-reduced-motion: reduce)');
 let disposed=false,raf=0,previous=null,seconds=0,lastPaint=-Infinity,pending=false,serial=0;
 const reduced=()=>media.matches||doc.documentElement.dataset.motion==='reduced';
 function size(record){
  const rect=record.node.getBoundingClientRect(),dpr=Math.min(3,Math.max(2,win.devicePixelRatio||1));
  record.width=rect.width;record.height=rect.height;record.dpr=dpr;record.laidOut=record.node.getClientRects().length>0;
  if(!intersection)record.visible=rect.bottom>0&&rect.right>0&&rect.top<win.innerHeight&&rect.left<win.innerWidth;
  record.color=win.getComputedStyle(record.node).color||'#f2f6ff';
  const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
  if(record.canvas.width!==width)record.canvas.width=width;if(record.canvas.height!==height)record.canvas.height=height;
 }
 function paint(record,still=false){
  if(!record.width||!record.height)return;
  const {cx,width,height,dpr,anchors,name}=record,control=record.node.closest('button,a');
  const disabled=Boolean(control?.disabled),staticFrame=still||disabled;
  const pulse=staticFrame?0:record.impulse*Math.exp(-Math.max(0,seconds-record.pressedAt)*4.6);
  const freedom=important.has(name)?.27:control?.classList.contains('rail-item')?.46:control?.textContent.trim()?.78:.42;
  iconFrame(anchors,seconds,{name,phase:record.phase,freedom,impulse:pulse,reduced:staticFrame},record.points);
  cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,record.canvas.width,record.canvas.height);
  const scale=Math.min(width,height)/24;cx.setTransform(scale*dpr,0,0,scale*dpr,(width-24*scale)/2*dpr,(height-24*scale)/2*dpr);
  cx.fillStyle=record.color;
  for(let band=0;band<5;band++){
   cx.beginPath();let dots=0;
   for(let at=0;at<record.points.length;at+=4){
    const alpha=record.points[at+3];if(Math.min(4,Math.floor(alpha*5))!==band)continue;
    const x=record.points[at],y=record.points[at+1],r=record.points[at+2];cx.moveTo(x+r,y);cx.arc(x,y,r,0,Math.PI*2);dots++;
   }
   if(dots){cx.globalAlpha=(band+.8)/5;cx.fill();}
  }
  cx.globalAlpha=1;record.node.classList.add('is-live');
 }
 function eligible(r){return !r.failed&&r.visible&&r.laidOut&&r.node.isConnected&&r.width>0&&r.height>0;}
 function stop(){if(raf)win.cancelAnimationFrame(raf);raf=0;previous=null;}
 function schedule(){if(disposed||doc.hidden||reduced()||raf||![...records.values()].some(eligible))return;raf=win.requestAnimationFrame(tick);}
 function tick(now){
  raf=0;if(disposed||doc.hidden||reduced()){previous=null;return;}
  if(previous!==null)seconds+=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
  if(now-lastPaint>=1000/24){
   lastPaint=now;for(const record of records.values())if(eligible(record)){
    try{paint(record)}catch{record.node.classList.remove('is-live');record.failed=true;}
   }
  }
  schedule();
 }
 function register(node){
  if(records.has(node))return;const canvas=node.querySelector('canvas'),path=node.querySelector('path');
  if(!canvas||!path)return;
  try{
   const cx=canvas.getContext('2d');if(!cx)return;
   const name=node.dataset.livingIcon,key=path.getAttribute('d');let anchors=samples.get(key);
   if(!anchors){const length=path.getTotalLength(),count=Math.max(28,Math.min(88,Math.round(length/1.05)));anchors=new Float32Array(count*2);for(let i=0;i<count;i++){const p=path.getPointAtLength((i+.5)*length/count);anchors[i*2]=p.x;anchors[i*2+1]=p.y;}samples.set(key,anchors);}
   const record={node,canvas,cx,name,anchors,points:new Float32Array(anchors.length*2),phase:serial++*.67+iconSeed(name)*9,visible:node.getClientRects().length>0,pressedAt:-100,impulse:0};
   records.set(node,record);size(record);paint(record,reduced());intersection?.observe(node);resize?.observe(node);
  }catch{/* Keep the recognizable vector fallback if Canvas/path APIs fail. */}
 }
 function sync(){
  pending=false;if(disposed)return;
  for(const [node] of records)if(!node.isConnected){intersection?.unobserve(node);resize?.unobserve(node);records.delete(node);}
  for(const node of doc.querySelectorAll(selector))register(node);
  for(const record of records.values()){size(record);if(eligible(record)){try{paint(record,reduced())}catch{record.node.classList.remove('is-live');record.failed=true;}}}
  if(reduced()||doc.hidden||![...records.values()].some(eligible))stop();else schedule();
 }
 function queue(){if(pending||disposed)return;pending=true;win.queueMicrotask(sync);}
 const intersection=win.IntersectionObserver?new win.IntersectionObserver(entries=>{for(const entry of entries){const r=records.get(entry.target);if(r)r.visible=entry.isIntersecting;}if(![...records.values()].some(eligible))stop();else schedule();}):null;
 const resize=win.ResizeObserver?new win.ResizeObserver(entries=>{for(const entry of entries){const r=records.get(entry.target);if(r&&!r.failed){size(r);try{paint(r,reduced())}catch{r.node.classList.remove('is-live');r.failed=true;}}}schedule();}):null;
 const observer=new win.MutationObserver(queue);
 observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','aria-pressed','aria-expanded']});
 observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-motion','data-theme']});
 function visibility(){if(doc.hidden)stop();else{previous=null;queue();}}
 function react(event){
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
  const control=event.target.closest?.('button,a');if(!control||control.disabled||reduced())return;
  for(const node of control.querySelectorAll(selector)){const record=records.get(node);if(record){record.pressedAt=seconds;record.impulse=event.type==='focusin'?.42:1;}}
  schedule();
 }
 doc.addEventListener('visibilitychange',visibility);media.addEventListener('change',queue);
 for(const type of ['pointerdown','keydown','focusin'])doc.addEventListener(type,react,{capture:true,passive:true});
 sync();
 return {dispose(){if(disposed)return;disposed=true;stop();observer.disconnect();intersection?.disconnect();resize?.disconnect();media.removeEventListener('change',queue);doc.removeEventListener('visibilitychange',visibility);for(const type of ['pointerdown','keydown','focusin'])doc.removeEventListener(type,react,true);for(const r of records.values())r.node.classList.remove('is-live');records.clear();samples.clear();}};
}

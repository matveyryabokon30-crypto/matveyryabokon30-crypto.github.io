// The only owner of conversation scroll position. Resize and data changes retain
// intent; only user gestures, an explicit jump or sending change that intent.
export function createTimeline(list,{button,onEarlier}={}){
 const life=new AbortController(),signal=life.signal;
 let following=true,anchor=null,frame=0,disposed=false,gesture=false,lastTop=0,loading=false;
 const gap=()=>Math.max(0,list.scrollHeight-list.clientHeight-list.scrollTop);
 const key=n=>n.dataset.messageId||n.dataset.messageKey||n;
 function capture(){
  const top=list.getBoundingClientRect().top;
  const n=[...list.children].find(n=>!n.hidden&&n.getBoundingClientRect().bottom>top+1);
  anchor=n?{key:key(n),node:n,offset:n.getBoundingClientRect().top-top}:null;
 }
 function paint(){if(button)button.hidden=following||gap()<3;}
 function reconcile(){
  frame=0;if(disposed||!list.isConnected||!list.clientHeight)return;
  if(following){const target=Math.max(0,list.scrollHeight-list.clientHeight);if(Math.abs(list.scrollTop-target)>.5)list.scrollTop=target;}
  else if(anchor){const n=anchor.node.isConnected?anchor.node:[...list.children].find(n=>key(n)===anchor.key);if(n){const delta=n.getBoundingClientRect().top-list.getBoundingClientRect().top-anchor.offset;if(Math.abs(delta)>.5)list.scrollTop+=delta;}}
  lastTop=list.scrollTop;capture();paint();
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(reconcile);}
 const resize=new ResizeObserver(schedule);resize.observe(list);
 const observed=new Set();function observe(){for(const n of observed)if(n.parentNode!==list){resize.unobserve(n);observed.delete(n)}for(const n of list.children)if(!observed.has(n)){resize.observe(n);observed.add(n)}schedule();}
 const mutations=new MutationObserver(observe);mutations.observe(list,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
 list.addEventListener('load',schedule,{capture:true,signal});list.addEventListener('loadedmetadata',schedule,{capture:true,signal});
 const begin=()=>{gesture=true;};
 list.addEventListener('touchstart',begin,{passive:true,signal});list.addEventListener('pointerdown',begin,{passive:true,signal});list.addEventListener('wheel',begin,{passive:true,signal});list.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))begin()},{signal});
 list.addEventListener('scroll',()=>{
  if(disposed)return;
  // Native focus/viewport adjustments can scroll AFTER resize observers.
  // Preserve follow intent and reconcile that delayed movement once.
  if(!gesture&&following&&gap()>1){schedule();return;}
  // Our writes end at lastTop; browser resize/layout events must not disable follow.
  if(gesture&&Math.abs(list.scrollTop-lastTop)>.5){following=gap()<3;capture();lastTop=list.scrollTop;paint();
   if(!following&&list.scrollTop<40&&onEarlier&&!loading){loading=true;Promise.resolve(onEarlier()).catch(()=>{}).finally(()=>{loading=false})}
  }
 },{passive:true,signal});
 // Safari momentum continues after touchend, so intent stays until a layout/data transaction.
 function jump(){gesture=false;following=true;anchor=null;schedule();}
 button?.addEventListener('pointerdown',e=>e.preventDefault(),{signal});
 button?.addEventListener('click',jump,{signal});
 observe();
 const controller={get following(){return following},jump,layout(){gesture=false;schedule()},
  change(fn,{toEnd=false}={}){gesture=false;if(!following)capture();if(toEnd)following=true;fn();observe();},
  reveal(node){gesture=false;following=false;list.scrollTop+=node.getBoundingClientRect().top-list.getBoundingClientRect().top-(list.clientHeight-node.getBoundingClientRect().height)/2;lastTop=list.scrollTop;capture();paint();},
  snapshot(){capture();return {following,anchor}},restore(state){if(state){following=state.following;anchor=state.anchor}schedule()},
  dispose(){disposed=true;life.abort();resize.disconnect();mutations.disconnect();cancelAnimationFrame(frame);observed.clear();delete list.timelineController}};list.timelineController=controller;return controller;
}

// Document tabs scroll only on explicit input. Never follow updates or change window/keyboard geometry.
export function documentJump(list,button,{enabled=()=>true}={}){
 const life=new AbortController();let frame=0,disposed=false;
 const update=()=>{frame=0;if(!disposed)button.hidden=!enabled()||list.scrollHeight-list.clientHeight-list.scrollTop<4;};
 const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(update);};
 const resize=new ResizeObserver(schedule),observed=new Set();resize.observe(list);
 const watch=()=>{for(const n of observed)if(n.parentNode!==list){resize.unobserve(n);observed.delete(n);}for(const n of list.children)if(!observed.has(n)){resize.observe(n);observed.add(n);}schedule();};
 const changes=new MutationObserver(watch);changes.observe(list,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['open','hidden']});
 list.addEventListener('scroll',schedule,{passive:true,signal:life.signal});
 list.addEventListener('load',schedule,{capture:true,signal:life.signal});
 button.addEventListener('pointerdown',e=>e.preventDefault(),{signal:life.signal});
 button.addEventListener('click',()=>{if(!enabled())return;list.scrollTo({top:list.scrollHeight,behavior:'instant'});schedule();},{signal:life.signal});
 watch();return {update:schedule,dispose(){disposed=true;life.abort();resize.disconnect();changes.disconnect();observed.clear();cancelAnimationFrame(frame);button.hidden=true;}};
}

// Native scrolling owns the frame; resume decoration only after the gesture settles.
export function interactionPriority(doc,signal){
 const win=doc.defaultView,root=doc.documentElement;let timer=0,active=false,gesture=null;const sheets=new Set();
 const owners='.messages,.owner-messages,.owner-content,.screen,.owner-tabs,.profile-body,.pe-content,.profile-dialog,.pm-feed-scroll,.pm-gallery';
 const release=()=>{if(sheets.size)return;active=false;root.dataset.interacting='false'};
 const hold=()=>{if(signal.aborted)return;if(!active){active=true;root.dataset.interacting='true'}win.clearTimeout(timer);timer=win.setTimeout(release,180)};
 const scroll=e=>{if(e.target?.matches?.(owners))hold()};
 // A tap still animates its icon. Only an actual profile drag takes priority.
 const down=e=>{if(e.isPrimary!==false&&e.target?.closest?.('.profile-body,.pe-content,.pm-feed-scroll,.pm-sequence-stage'))gesture={id:e.pointerId,x:e.clientX,y:e.clientY};};
 const move=e=>{if(gesture&&e.pointerId===gesture.id&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>4)hold()};
 const end=e=>{if(gesture&&e.pointerId===gesture.id)gesture=null;};
 doc.addEventListener('scroll',scroll,{capture:true,passive:true,signal});
 doc.addEventListener('pointerdown',down,{capture:true,passive:true,signal});
 doc.addEventListener('pointermove',move,{capture:true,passive:true,signal});
 for(const type of ['pointerup','pointercancel'])doc.addEventListener(type,end,{capture:true,passive:true,signal});
 doc.addEventListener('sekkes-viewport-change',()=>{if(doc.querySelector('.profile-dialog[open]'))hold()},{signal});
 doc.addEventListener('sekkes-sheet-motion',e=>{const {owner,active:running}=e.detail||{};if(!owner?.matches?.('.profile-dialog,.se-editor'))return;if(running){sheets.add(owner);hold();}else{sheets.delete(owner);if(!sheets.size)hold();}},{signal});
 win.addEventListener('resize',hold,{passive:true,signal});win.addEventListener('orientationchange',hold,{passive:true,signal});
 signal.addEventListener('abort',()=>{win.clearTimeout(timer);gesture=null;sheets.clear();if(active)release()},{once:true});
}

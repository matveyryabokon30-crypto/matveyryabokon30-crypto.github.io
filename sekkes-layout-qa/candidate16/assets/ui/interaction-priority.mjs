// Keep the current decorative frame while native scrolling/rotation owns the screen.
export function interactionPriority(doc,signal){
 const win=doc.defaultView,root=doc.documentElement;let timer=0,active=false;
 const release=()=>{active=false;root.dataset.interacting='false'};
 const hold=()=>{if(!active){active=true;root.dataset.interacting='true'}win.clearTimeout(timer);timer=win.setTimeout(release,180)};
 const scroll=e=>{if(e.target?.matches?.('.messages,.owner-messages,.owner-content,.screen,.owner-tabs'))hold()};
 doc.addEventListener('scroll',scroll,{capture:true,passive:true,signal});
 win.addEventListener('resize',hold,{passive:true,signal});win.addEventListener('orientationchange',hold,{passive:true,signal});
 signal.addEventListener('abort',()=>{win.clearTimeout(timer);if(active)release()},{once:true});
}

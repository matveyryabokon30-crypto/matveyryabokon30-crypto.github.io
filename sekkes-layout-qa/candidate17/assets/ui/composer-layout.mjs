const measured=new WeakMap();
// Shared by the user and owner composers. Measure after choosing full-width layout.
export function resizeComposer(input, surface, {attachments=false, limit}={}) {
 const expanded=document.activeElement===input || input.value.length>0 || attachments;
 if(surface.dataset.expanded!==String(expanded))surface.dataset.expanded=String(expanded);
 const cap=limit ?? Math.max(62,Math.floor((input.closest?.('#shell')?.clientHeight||innerHeight)*.45));
 const key=JSON.stringify([input.value,input.clientWidth,expanded,cap]);
 if(measured.get(input)===key)return;measured.set(input,key);
 input.style.height='0px';
 const needed=Math.max(32,input.scrollHeight);
 input.style.height=Math.min(cap,needed)+'px';
 input.style.overflowY=needed>cap?'auto':'hidden';
}

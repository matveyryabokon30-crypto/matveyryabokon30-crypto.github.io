// Shared by the user and owner composers. Measure after choosing full-width layout.
export function resizeComposer(input, surface, {attachments=false, limit}={}) {
 const expanded=document.activeElement===input || input.value.length>0 || attachments;
 surface.dataset.expanded=String(expanded);
 const cap=limit ?? Math.max(62,Math.floor((window.visualViewport?.height||innerHeight)*.45));
 input.style.height='0px';
 const needed=Math.max(32,input.scrollHeight);
 input.style.height=Math.min(cap,needed)+'px';
 input.style.overflowY=needed>cap?'auto':'hidden';
}

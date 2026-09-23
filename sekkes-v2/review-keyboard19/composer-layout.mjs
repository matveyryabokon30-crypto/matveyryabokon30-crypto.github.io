const measured=new WeakMap();
// Shared by the user and owner composers. Measure after choosing full-width layout.
export function resizeComposer(input, surface, {attachments=false, limit}={}) {
 const expanded=document.activeElement===input || input.value.length>0 || attachments;
 if(surface.dataset.expanded!==String(expanded))surface.dataset.expanded=String(expanded);
 const cap=limit ?? Math.max(62,Math.floor((input.closest?.('#shell')?.clientHeight||innerHeight)*.45));
 const key=JSON.stringify([input.value,input.clientWidth,expanded,cap]);
 if(measured.get(input)===key)return;measured.set(input,key);
 // Never collapse a focused textarea: iOS can pan to its temporary caret box.
 const mirror=document.createElement('textarea'),style=getComputedStyle(input);
 mirror.tabIndex=-1;mirror.setAttribute('aria-hidden','true');
 for(const property of ['font','letterSpacing','lineHeight','padding','boxSizing','wordBreak','overflowWrap','whiteSpace'])mirror.style[property]=style[property];
 Object.assign(mirror.style,{position:'absolute',left:'-10000px',top:'0',width:input.clientWidth+'px',height:'0px',minHeight:'0',maxHeight:'none',border:'0',visibility:'hidden',pointerEvents:'none',overflow:'hidden'});
 mirror.value=input.value||input.placeholder||' ';
 document.body.append(mirror);
 const needed=Math.max(32,mirror.scrollHeight);mirror.remove();
 input.style.height=Math.min(cap,needed)+'px';
 input.style.overflowY=needed>cap?'auto':'hidden';
}

// Root layout never follows visualViewport.offsetTop. That value may outlive an
// iOS keyboard/rotation transition and move the entire UI outside the hit area.
export function keyboardInset({height,visualHeight,offsetTop=0,scale=1,editing=false}){
 return editing&&Math.abs(scale-1)<.02?Math.max(0,Math.round(height-visualHeight-offsetTop)):0;
}
export function viewportGeometry({height,width,visualHeight,visualWidth=width,scale=1,editing=false}){
 const consistent=Number.isFinite(visualWidth)&&Math.abs(visualWidth-width)<3;
 const keyboard=editing&&Math.abs(scale-1)<.02&&consistent&&Number.isFinite(visualHeight)&&visualHeight>0&&visualHeight<height-80;
 return {height:Math.round(keyboard?visualHeight:height),top:0,width};
}
export function lockViewport(signal){
 const root=document.documentElement,probe=document.createElement('div');
 probe.setAttribute('aria-hidden','true');probe.className='viewport-measure';document.body.append(probe);
 let frame=0,settle=0,resetFrame=0,lastWidth=0,lastHeight=0;
 const set=(key,value)=>{if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value)};
 const editing=()=>!!document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
 function resetRoot(){
  resetFrame=0;if(signal.aborted)return;
  // Only the document is reset. Conversation scroll positions and drafts stay intact.
  if(document.scrollingElement)document.scrollingElement.scrollTop=0;
  root.scrollTop=0;document.body.scrollTop=0;
  window.scrollTo({left:0,top:0,behavior:'instant'});
 }
 function recover(){if(!resetFrame)resetFrame=requestAnimationFrame(resetRoot);}
 function update(){
  frame=0;if(signal.aborted)return;const v=window.visualViewport;
  const height=probe.clientHeight||innerHeight,width=root.clientWidth||innerWidth;
  const box=viewportGeometry({height,width,visualHeight:v?.height,visualWidth:v?.width??width,scale:v?.scale||1,editing:editing()});
  set('--app-height',box.height+'px');set('--viewport-top','0px');
  set('--keyboard-inset','0px');set('--home-bottom-inset','0px');set('--owner-visible-height','100%');
  const open=String(box.height<height-80);if(root.dataset.keyboardOpen!==open)root.dataset.keyboardOpen=open;
  if(lastWidth!==width||lastHeight!==box.height){lastWidth=width;lastHeight=box.height;document.dispatchEvent(new Event('sekkes-viewport-change'));document.dispatchEvent(new Event('sekkes-composer-resize'));}
 }
 const schedule=()=>{if(!frame&&!signal.aborted)frame=requestAnimationFrame(update)};
 function settleLayout(){schedule();clearTimeout(settle);settle=setTimeout(()=>{schedule();if(!editing())recover()},350)}
 function rotate(){const field=document.activeElement;if(editing())field.blur();document.dispatchEvent(new Event('sekkes-orientation-reset'));recover();settleLayout()}
 window.visualViewport?.addEventListener('resize',settleLayout,{passive:true,signal});
 window.visualViewport?.addEventListener('scroll',()=>{if(editing())schedule()},{passive:true,signal});
 addEventListener('resize',settleLayout,{passive:true,signal});addEventListener('orientationchange',rotate,{passive:true,signal});
 screen.orientation?.addEventListener('change',rotate,{signal});addEventListener('pageshow',()=>{recover();settleLayout()},{signal});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){recover();settleLayout()}},{signal});
 document.addEventListener('focusin',settleLayout,{signal});document.addEventListener('focusout',()=>{recover();settleLayout()},{signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);cancelAnimationFrame(resetFrame);clearTimeout(settle);probe.remove()},{once:true});update();
}

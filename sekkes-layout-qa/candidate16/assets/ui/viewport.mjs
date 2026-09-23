// The shell occupies the visual viewport once; children never subtract a keyboard twice.
export function keyboardInset({height,visualHeight,offsetTop=0,scale=1,editing=false}){
 return editing&&Math.abs(scale-1)<.02?Math.max(0,Math.round(height-visualHeight-offsetTop)):0;
}
export function viewportGeometry({height,width,visualHeight,visualTop=0,scale=1}){
 const unzoomed=Math.abs(scale-1)<.02;
 return {height:Math.round(unzoomed&&visualHeight>0?Math.min(height,visualHeight):height),top:Math.round(unzoomed?Math.max(0,visualTop):0),width};
}
export function lockViewport(signal){
 const root=document.documentElement;let frame=0,settle=0,lastWidth=innerWidth,lastHeight=0;
 const set=(key,value)=>{if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value)};
 function update(){
  frame=0;if(signal.aborted)return;const v=window.visualViewport;
  const box=viewportGeometry({height:innerHeight,width:innerWidth,visualHeight:v?.height,visualTop:v?.offsetTop,scale:v?.scale||1});
  set('--app-height',box.height+'px');set('--viewport-top',box.top+'px');
  set('--keyboard-inset','0px');set('--home-bottom-inset','0px');set('--owner-visible-height','100%');
  const editing=!!document.activeElement?.matches('input,textarea,select');
  const open=String(editing&&innerHeight-box.height>80);if(root.dataset.keyboardOpen!==open)root.dataset.keyboardOpen=open;
  if(lastWidth!==box.width||lastHeight!==box.height){lastWidth=box.width;lastHeight=box.height;document.dispatchEvent(new Event('sekkes-viewport-change'));}
  document.dispatchEvent(new Event('sekkes-composer-resize'));
 }
 const schedule=()=>{if(!frame&&!signal.aborted)frame=requestAnimationFrame(update)};
 const settleLayout=()=>{schedule();clearTimeout(settle);settle=setTimeout(schedule,300)};
 const rotate=()=>{const field=document.activeElement;if(field?.matches('input,textarea,select'))field.blur();document.dispatchEvent(new Event('sekkes-orientation-reset'));settleLayout()};
 window.visualViewport?.addEventListener('resize',settleLayout,{passive:true,signal});
 window.visualViewport?.addEventListener('scroll',schedule,{passive:true,signal});
 addEventListener('resize',settleLayout,{passive:true,signal});addEventListener('orientationchange',rotate,{passive:true,signal});
 screen.orientation?.addEventListener('change',rotate,{signal});addEventListener('pageshow',settleLayout,{signal});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)settleLayout()},{signal});
 document.addEventListener('focusin',settleLayout,{signal});document.addEventListener('focusout',settleLayout,{signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);clearTimeout(settle)},{once:true});update();
}

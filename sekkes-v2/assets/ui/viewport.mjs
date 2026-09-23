// Layout viewport is authoritative; visual viewport only measures an active keyboard.
export function keyboardInset({height,visualHeight,offsetTop=0,scale=1,editing=false}){
 if(!editing||Math.abs(scale-1)>.02)return 0;
 return Math.max(0,Math.round(height-visualHeight-offsetTop));
}
export function lockViewport(signal){
 const root=document.documentElement;
 let frame=0,settle=0,lastWidth=innerWidth,lastHeight=innerHeight;
 const set=(name,value)=>{if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value)};
 const update=()=>{
  frame=0;if(signal.aborted)return;
  const v=window.visualViewport,editing=!!document.activeElement?.matches('input,textarea,select');
  const height=innerHeight,width=innerWidth;
  const inset=keyboardInset({height,visualHeight:v?.height||height,offsetTop:v?.offsetTop||0,scale:v?.scale||1,editing});
  set('--app-height',height+'px');set('--keyboard-inset',inset+'px');set('--home-bottom-inset',inset+'px');
  const open=String(inset>80);if(root.dataset.keyboardOpen!==open)root.dataset.keyboardOpen=open;
  set('--owner-visible-height',Math.max(0,height-inset)+'px');
  if(width!==lastWidth||height!==lastHeight){lastWidth=width;lastHeight=height;document.dispatchEvent(new Event('sekkes-viewport-change'));}
  document.dispatchEvent(new Event('sekkes-composer-resize'));
 };
 const schedule=()=>{if(!frame&&!signal.aborted)frame=requestAnimationFrame(update)};
 const settleLayout=()=>{schedule();clearTimeout(settle);settle=setTimeout(schedule,250)};
 window.visualViewport?.addEventListener('resize',settleLayout,{signal});
 window.visualViewport?.addEventListener('scroll',schedule,{signal});
 addEventListener('resize',settleLayout,{signal});addEventListener('orientationchange',settleLayout,{signal});
 screen.orientation?.addEventListener('change',settleLayout,{signal});
 addEventListener('pageshow',settleLayout,{signal});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)settleLayout()},{signal});
 document.addEventListener('focusin',settleLayout,{signal});document.addEventListener('focusout',settleLayout,{signal});
 for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,e=>e.preventDefault(),{passive:false,signal});
 document.addEventListener('touchstart',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false,signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);clearTimeout(settle)},{once:true});
 update();
}

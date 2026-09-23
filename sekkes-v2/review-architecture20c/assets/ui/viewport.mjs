// One visual rectangle owns the application. No scroll-event -> scrollTo loop.
export function viewportGeometry({height,width,visualHeight,visualWidth=width,offsetTop=0,scale=1,editing=false}){
 const valid=Math.abs(scale-1)<.02&&Math.abs(visualWidth-width)<3&&visualHeight>0&&visualHeight<=height;
 const keyboard=valid&&editing&&visualHeight<height-80;
 return {height:Math.round(keyboard?visualHeight:height),top:keyboard?Math.round(Math.max(0,Math.min(offsetTop,height-visualHeight))):0,width};
}
export function lockViewport(signal){
 const root=document.documentElement,probe=document.createElement('div');probe.className='viewport-measure';probe.setAttribute('aria-hidden','true');document.body.append(probe);
 let frame=0,timer=0,closing=false,last='';
 const editing=()=>!!document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
 function update(){frame=0;if(signal.aborted)return;const v=window.visualViewport,height=probe.clientHeight||innerHeight,width=root.clientWidth||innerWidth;
  if(closing&&(!v||v.height>=height-80))closing=false;
  const box=viewportGeometry({height,width,visualHeight:v?.height,visualWidth:v?.width??width,offsetTop:v?.offsetTop||0,scale:v?.scale||1,editing:editing()||closing});
  const stamp=JSON.stringify(box);if(stamp===last)return;last=stamp;
  root.style.setProperty('--app-height',box.height+'px');root.style.setProperty('--viewport-top',box.top+'px');root.style.setProperty('--keyboard-inset','0px');root.style.setProperty('--home-bottom-inset','0px');root.style.setProperty('--owner-visible-height','100%');root.dataset.keyboardOpen=String(box.height<height-80);
  document.dispatchEvent(new Event('sekkes-viewport-change'));
 }
 const schedule=()=>{if(!frame&&!signal.aborted)frame=requestAnimationFrame(update)};
 function settle(){schedule();clearTimeout(timer);timer=setTimeout(schedule,400)}
 function rotate(){document.activeElement?.matches('input,textarea,select')&&document.activeElement.blur();closing=false;document.dispatchEvent(new Event('sekkes-orientation-reset'));settle()}
 window.visualViewport?.addEventListener('resize',settle,{passive:true,signal});window.visualViewport?.addEventListener('scroll',schedule,{passive:true,signal});
 addEventListener('resize',settle,{passive:true,signal});addEventListener('orientationchange',rotate,{signal});screen.orientation?.addEventListener('change',rotate,{signal});addEventListener('pageshow',settle,{signal});
 document.addEventListener('focusin',()=>{closing=false;settle()},{signal});document.addEventListener('focusout',()=>{closing=root.dataset.keyboardOpen==='true';settle()},{signal});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)settle()},{signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);clearTimeout(timer);probe.remove()},{once:true});update();
}

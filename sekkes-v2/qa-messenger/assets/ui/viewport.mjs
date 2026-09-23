// The app stays in layout viewport coordinates. Only the dock avoids the keyboard.
export function keyboardInset({height,visualHeight,offsetTop=0,scale=1,editing=false}){
 if(!editing||Math.abs(scale-1)>.02)return 0;
 return Math.max(0,Math.round(height-visualHeight-offsetTop));
}
export function lockViewport(signal){
 const root=document.documentElement;
 const update=()=>{const v=window.visualViewport;const inset=keyboardInset({height:innerHeight,visualHeight:v?.height||innerHeight,offsetTop:v?.offsetTop||0,scale:v?.scale||1,editing:!!document.activeElement?.matches('input,textarea,select')});root.style.setProperty('--keyboard-inset',inset+'px');root.dataset.keyboardOpen=String(inset>80);const host=document.getElementById('routeHost');if(host&&v){const available=Math.max(0,Math.min(host.clientHeight,v.height+v.offsetTop-host.getBoundingClientRect().top));root.style.setProperty('--owner-visible-height',available+'px')}};
 window.visualViewport?.addEventListener('resize',update,{signal});
 window.visualViewport?.addEventListener('scroll',update,{signal});
 addEventListener('resize',update,{signal});document.addEventListener('focusin',update,{signal});document.addEventListener('focusout',update,{signal});
 // Owner requested a fixed app canvas including two-finger gestures. Text size is
 // still adjustable independently in Appearance; content scroll remains native.
 for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,e=>e.preventDefault(),{passive:false,signal});
 document.addEventListener('touchstart',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false,signal});
 update();
}


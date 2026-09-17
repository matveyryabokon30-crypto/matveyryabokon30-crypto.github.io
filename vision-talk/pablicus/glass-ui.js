/* Presentation only: relocate existing conversation controls, preserving their
   handlers, draft ownership, accessible names and consent flows. */
(function (global) {
 'use strict';
 if (global.PablicusGlassUI) return;
 const app=document.getElementById('app'), root=document.getElementById('composeBox');
 if (!app || !root) return;
 const life=new AbortController(); let frame=0, stopped=false;
 function value(node,name,next){if(node.style.getPropertyValue(name)!==next)node.style.setProperty(name,next);}
 function layout(){
  frame=0;if(stopped)return;
  const rail=root.querySelector(':scope>.r2FunctionRail');if(!rail)return;
  rail.classList.add('r2SideDock');
  const ai=root.querySelector('.r2Toolbar>.r2AI');
  if(ai){ai.dataset.r2Function='ai';ai.classList.add('r2DockedAI');ai.setAttribute('aria-haspopup','dialog');rail.append(ai);}
  for(const b of rail.querySelectorAll(':scope>button'))if(!b.title)b.title=b.getAttribute('aria-label')||'';
  if(app.hidden||app.classList.contains('canvas-active'))return;
  const r=root.getBoundingClientRect(),a=app.getBoundingClientRect(),head=app.querySelector(':scope>header');
  if(!r.width||!r.height)return;
  const safe=parseFloat(getComputedStyle(app).paddingTop)||0;
  const edge=Math.max(12,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-right'))||0);
  const top=Math.max(a.top+safe+60,head?.getBoundingClientRect().bottom||a.top);
  const room=Math.floor(r.top-top-24),inside=app.classList.contains('composer-fullscreen')||room<44;
  rail.dataset.inside=String(inside);
  value(root,'--glass-rail-right',Math.round(r.right-a.right+edge-(parseFloat(getComputedStyle(root).borderRightWidth)||0))+'px');
  value(root,'--glass-rail-room',Math.max(44,inside?r.height-80:room)+'px');
 }
 function schedule(){if(!stopped&&!frame)frame=requestAnimationFrame(layout);}
 const mutation=new MutationObserver(schedule);mutation.observe(root,{childList:true,subtree:true});
 const mode=new MutationObserver(schedule);mode.observe(app,{attributes:true,attributeFilter:['class','hidden']});
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 resize?.observe(root);resize?.observe(app);
 global.addEventListener('resize',schedule,{signal:life.signal});
 global.visualViewport?.addEventListener('resize',schedule,{signal:life.signal});
 global.visualViewport?.addEventListener('scroll',schedule,{signal:life.signal});
 global.addEventListener('pageshow',schedule,{signal:life.signal});
 global.PablicusGlassUI=Object.freeze({refresh:schedule,destroy(){stopped=true;cancelAnimationFrame(frame);mutation.disconnect();mode.disconnect();resize?.disconnect();life.abort();}});
 schedule();
})(window);

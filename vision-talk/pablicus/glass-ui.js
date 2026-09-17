/* Presentation-only relocation. Existing buttons retain their handlers and IDs. */
(function(global){
 'use strict';
 if(global.PablicusGlassUI)return;
 const app=document.getElementById('app'),root=document.getElementById('composeBox'),home=document.getElementById('home');
 if(!app||!root)return;
 const life=new AbortController();let frame=0,stopped=false;
 const origins=new Map();
 function move(node,parent,before=null){if(!node||node.parentElement===parent)return;if(!origins.has(node))origins.set(node,{parent:node.parentElement,next:node.nextSibling});parent.insertBefore(node,before);}
 function value(node,name,next){if(node.style.getPropertyValue(name)!==next)node.style.setProperty(name,next);}
 const homeDock=document.createElement('nav');homeDock.className='cleanHomeActions';homeDock.setAttribute('aria-label','Действия раздела');home?.append(homeDock);
 function layout(){
  frame=0;if(stopped)return;
  // These are decoration nodes only. Never remove the profile hero or photographs.
  document.querySelectorAll('.chatEdgeFade,.contactEdgeFade').forEach(n=>n.remove());
  for(const id of ['profileBack','profileSettings','newChat'])move(document.getElementById(id),homeDock);
  const rail=root.querySelector(':scope>.r2FunctionRail');if(!rail)return;
  rail.classList.add('r2SideDock');rail.setAttribute('aria-label','Навигация и действия разговора');
  const ai=root.querySelector('.r2Toolbar>.r2AI');if(ai){ai.dataset.r2Function='ai';ai.classList.add('r2DockedAI');ai.setAttribute('aria-haspopup','dialog');move(ai,rail);}
  // Keep the contact card reachable after removing the name capsule.
  const title=document.getElementById('chatTitle');
  if(title&&!title.querySelector('[data-clean-contact-icon]')&&global.PablicusIcons){
   const name=title.textContent.trim()||title.dataset.contactName||'Собеседник';title.dataset.contactName=name;
   const icon=global.PablicusIcons.icon('profile');icon.dataset.cleanContactIcon='true';
   title.replaceChildren(icon);title.setAttribute('aria-label','Карточка собеседника: '+name);title.title='Карточка собеседника: '+name;
  }
  const first=rail.querySelector('[data-r2-function="agent"]');
  for(const id of ['chatBack','chatTitle','chatLibraryOpen','reportBtn'])move(document.getElementById(id),rail,first);
  for(const b of rail.querySelectorAll(':scope>button'))if(!b.title)b.title=b.getAttribute('aria-label')||'';
  if(app.hidden)return;
  const r=root.getBoundingClientRect(),a=app.getBoundingClientRect();if(!r.width||!r.height)return;
  const safe=parseFloat(getComputedStyle(app).paddingTop)||0;
  const edge=Math.max(12,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-right'))||0);
  const room=Math.floor(r.top-a.top-safe-24),inside=app.classList.contains('composer-fullscreen')||room<44;
  rail.dataset.inside=String(inside);
  value(root,'--glass-rail-right',(r.right-a.right+edge-(parseFloat(getComputedStyle(root).borderRightWidth)||0))+'px');
  value(root,'--glass-rail-room',Math.max(44,inside?r.height-80:room)+'px');
 }
 function schedule(){if(!stopped&&!frame)frame=requestAnimationFrame(layout);}
 const mutation=new MutationObserver(schedule);mutation.observe(root,{childList:true,subtree:true});
 const top=app.querySelector(':scope>header');if(top)mutation.observe(top,{childList:true,subtree:true});
 const mode=new MutationObserver(schedule);mode.observe(app,{attributes:true,attributeFilter:['class','hidden']});
 const pages=new MutationObserver(schedule);if(home)pages.observe(home,{childList:true,subtree:true});
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;resize?.observe(root);resize?.observe(app);
 global.addEventListener('resize',schedule,{signal:life.signal});global.visualViewport?.addEventListener('resize',schedule,{signal:life.signal});global.visualViewport?.addEventListener('scroll',schedule,{signal:life.signal});global.addEventListener('pageshow',schedule,{signal:life.signal});
 global.PablicusGlassUI=Object.freeze({refresh:schedule,destroy(){stopped=true;cancelAnimationFrame(frame);mutation.disconnect();mode.disconnect();pages.disconnect();resize?.disconnect();life.abort();for(const [node,at]of origins)if(at.parent?.isConnected)at.parent.insertBefore(node,at.next?.parentNode===at.parent?at.next:null);homeDock.remove();}});
 schedule();
})(window);

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
 const chatAvatarDock=document.createElement('div');chatAvatarDock.className='chatAvatarDock';chatAvatarDock.setAttribute('aria-label','Собеседник');app.append(chatAvatarDock);
 const menuToggle=document.createElement('button');menuToggle.id='chatActionsToggle';menuToggle.type='button';menuToggle.setAttribute('aria-label','Открыть меню разговора');menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-controls','chatActionsMenu');menuToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';app.append(menuToggle);
 let menuOpen=false;
 function setMenu(open,focus=false){menuOpen=open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Закрыть меню разговора':'Открыть меню разговора');const rail=root.querySelector(':scope>.r2FunctionRail');if(rail){rail.dataset.menuOpen=String(open);rail.inert=!open;rail.setAttribute('aria-hidden',String(!open));}if(focus)menuToggle.focus();}
 menuToggle.addEventListener('click',()=>setMenu(!menuOpen),{signal:life.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuOpen){setMenu(false,true);}},{signal:life.signal});
 document.addEventListener('pointerdown',e=>{if(menuOpen&&!menuToggle.contains(e.target)&&!root.querySelector(':scope>.r2FunctionRail')?.contains(e.target))setMenu(false);},{signal:life.signal});
 function layout(){
  frame=0;if(stopped)return;
  document.querySelectorAll('.chatEdgeFade,.contactEdgeFade').forEach(n=>n.remove());
  for(const id of ['profileBack','profileSettings','newChat'])move(document.getElementById(id),homeDock);
  const rail=root.querySelector(':scope>.r2FunctionRail');if(!rail)return;
  rail.classList.add('r2SideDock');rail.id='chatActionsMenu';setMenu(menuOpen);rail.setAttribute('aria-label','Навигация и действия разговора');
  const ai=root.querySelector('.r2Toolbar>.r2AI');if(ai){ai.dataset.r2Function='ai';ai.classList.add('r2DockedAI');ai.setAttribute('aria-haspopup','dialog');move(ai,rail);}
  // The logical title is refreshed every 15s. Never use that node as the photo surface.
  if(!document.getElementById('conversationAvatar')){const avatar=document.createElement('button');avatar.id='conversationAvatar';avatar.type='button';avatar.className='pablicusStoryAvatar';avatar.setAttribute('aria-label','Профиль и сторис собеседника');avatar.addEventListener('click',()=>{const id=global.PablicusController?.state().conversationId;if(id)global.PablicusContacts?.open(id);},{signal:life.signal});chatAvatarDock.append(avatar);}
  move(document.getElementById('chatTitle'),chatAvatarDock);
  const first=rail.querySelector('[data-r2-function="agent"]');
  for(const id of ['chatBack','chatLibraryOpen','reportBtn'])move(document.getElementById(id),rail,first);
  for(const b of rail.querySelectorAll(':scope>button'))if(!b.title)b.title=b.getAttribute('aria-label')||'';
  if(app.hidden){setMenu(false);return;}
  const r=root.getBoundingClientRect(),a=app.getBoundingClientRect();if(!r.width||!r.height)return;
  const safe=parseFloat(getComputedStyle(app).paddingTop)||0;
  const edge=Math.max(12,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-right'))||0);
  const menuTop=menuToggle.getBoundingClientRect().bottom+8;
  const room=Math.floor(Math.min(r.top-12,a.bottom-12)-menuTop),inside=false;
  value(root,'--glass-menu-top',(menuTop-r.top-(parseFloat(getComputedStyle(root).borderTopWidth)||0))+'px');
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
 global.PablicusGlassUI=Object.freeze({refresh:schedule,destroy(){stopped=true;cancelAnimationFrame(frame);mutation.disconnect();mode.disconnect();pages.disconnect();resize?.disconnect();life.abort();for(const [node,at]of origins)if(at.parent?.isConnected)at.parent.insertBefore(node,at.next?.parentNode===at.parent?at.next:null);const rail=root.querySelector(':scope>.r2FunctionRail');if(rail){rail.inert=false;rail.removeAttribute('aria-hidden');delete rail.dataset.menuOpen;}homeDock.remove();chatAvatarDock.remove();menuToggle.remove();}});
 schedule();
})(window);

/* The real story module needs the authenticated app services created by app.js.
   Load it after the page has finished executing all parser scripts. */
(function(global){
 'use strict';
 function boot(){
  if(global.PablicusAvatarStoriesUI||document.querySelector('script[data-pablicus-real-stories]'))return;
  const controller=global.PablicusController,services=controller?.getServices?.();
  if(!controller||!services?.client){setTimeout(boot,100);return;}
  if(typeof services.getProfile!=='function')services.getProfile=()=>{try{const id=controller.state().sessionUserId;if(!id)return null;return JSON.parse(localStorage.getItem('pablicus:'+id+':profile')||'null');}catch{return null;}};
  if(typeof services.notify!=='function')services.notify=text=>{const toast=document.getElementById('toast');if(!toast)return;toast.textContent=String(text||'');toast.hidden=false;clearTimeout(boot.toastTimer);boot.toastTimer=setTimeout(()=>{toast.hidden=true;},5000);};
  const script=document.createElement('script');script.src='avatar-stories.js';script.async=false;script.dataset.pablicusRealStories='1';script.onerror=()=>services.notify('Не удалось загрузить сторис. Обновите Pablicus.');document.body.append(script);
 }
 if(document.readyState==='complete')boot();else global.addEventListener('load',boot,{once:true});
})(window);

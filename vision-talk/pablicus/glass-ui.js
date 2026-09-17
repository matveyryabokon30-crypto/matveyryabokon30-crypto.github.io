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
 function layout(){
  frame=0;if(stopped)return;
  document.querySelectorAll('.chatEdgeFade,.contactEdgeFade').forEach(n=>n.remove());
  for(const id of ['profileBack','profileSettings','newChat'])move(document.getElementById(id),homeDock);
  const rail=root.querySelector(':scope>.r2FunctionRail');if(!rail)return;
  rail.classList.add('r2SideDock');rail.setAttribute('aria-label','Навигация и действия разговора');
  const ai=root.querySelector('.r2Toolbar>.r2AI');if(ai){ai.dataset.r2Function='ai';ai.classList.add('r2DockedAI');ai.setAttribute('aria-haspopup','dialog');move(ai,rail);}
  // The logical title is refreshed every 15s. Never use that node as the photo surface.
  if(!document.getElementById('conversationAvatar')){const avatar=document.createElement('button');avatar.id='conversationAvatar';avatar.type='button';avatar.className='pablicusStoryAvatar';avatar.setAttribute('aria-label','Профиль и сторис собеседника');avatar.addEventListener('click',()=>{const id=global.PablicusController?.state().conversationId;if(id)global.PablicusContacts?.open(id);},{signal:life.signal});chatAvatarDock.append(avatar);}
  if(!document.getElementById('conversationCallDock')){const calls=document.createElement('div');calls.id='conversationCallDock';calls.className='conversationCallDock';const make=(id,label,path)=>{const b=document.createElement('button');b.id=id;b.type='button';b.setAttribute('aria-label',label);b.title=label;b.innerHTML='<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">'+path+'</svg>';b.addEventListener('click',()=>{global.dispatchEvent(new CustomEvent('pablicus:call-request',{detail:{kind:id==='audioCallAction'?'audio':'video',conversationId:global.PablicusController?.state().conversationId}}));const t=document.getElementById('toast');if(t){t.textContent='Звонки будут подключены на следующем этапе.';t.hidden=false;setTimeout(()=>t.hidden=true,2600);}},{signal:life.signal});return b;};calls.append(make('audioCallAction','Аудиозвонок','<path d=\"M7 4l3 4-2 2c1.6 3 3 4.4 6 6l2-2 4 3-1 3c-.3 1-1.2 1.5-2.2 1.3C9.8 20 4 14.2 2.7 7.2 2.5 6.2 3 5.3 4 5z\"/>'),make('videoCallAction','Видеозвонок','<rect x=\"3\" y=\"6\" width=\"12\" height=\"12\" rx=\"3\"/><path d=\"M15 10l6-3v10l-6-3z\"/>'));chatAvatarDock.append(calls);}
  const first=rail.querySelector('[data-r2-function="agent"]');
  for(const id of ['chatBack','chatLibraryOpen','reportBtn'])move(document.getElementById(id),rail,first);
  for(const b of rail.querySelectorAll(':scope>button'))if(!b.title)b.title=b.getAttribute('aria-label')||'';
  if(app.hidden)return;
  const r=root.getBoundingClientRect(),a=app.getBoundingClientRect();if(!r.width||!r.height)return;
  const safe=parseFloat(getComputedStyle(app).paddingTop)||0;
  const edge=Math.max(12,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-right'))||0);
  const avatarBottom=chatAvatarDock.getBoundingClientRect().bottom;
  const room=Math.floor(r.top-Math.max(a.top+safe,avatarBottom)-24),inside=app.classList.contains('composer-fullscreen')||room<44;
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
 global.PablicusGlassUI=Object.freeze({refresh:schedule,destroy(){stopped=true;cancelAnimationFrame(frame);mutation.disconnect();mode.disconnect();pages.disconnect();resize?.disconnect();life.abort();for(const [node,at]of origins)if(at.parent?.isConnected)at.parent.insertBefore(node,at.next?.parentNode===at.parent?at.next:null);homeDock.remove();chatAvatarDock.remove();}});
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

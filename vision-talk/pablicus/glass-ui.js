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
  const title=document.getElementById('chatTitle');if(title)move(title,chatAvatarDock);
  const first=rail.querySelector('[data-r2-function="agent"]');
  for(const id of ['chatBack','chatLibraryOpen','reportBtn'])move(document.getElementById(id),rail,first);
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
 global.PablicusGlassUI=Object.freeze({refresh:schedule,destroy(){stopped=true;cancelAnimationFrame(frame);mutation.disconnect();mode.disconnect();pages.disconnect();resize?.disconnect();life.abort();for(const [node,at]of origins)if(at.parent?.isConnected)at.parent.insertBefore(node,at.next?.parentNode===at.parent?at.next:null);homeDock.remove();chatAvatarDock.remove();}});
 schedule();
})(window);

/* Avatar rings + story entry points. Presentation/state reads only; no story state is invented. */
(function bootAvatarStories(scope){
 'use strict';
 if(scope.PablicusAvatarStoriesUI)return;
 const controller=scope.PablicusController,services=controller?.getServices?.(),client=services?.client;
 if(!controller||!client){setTimeout(()=>bootAvatarStories(scope),50);return;}
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const cache=new Map(),life=new AbortController();let serial=0,frame=0;
 const icon=name=>scope.PablicusMessageMenu?.icon?.(name)||scope.PablicusIcons?.icon?.(name)||document.createTextNode('+');
 const current=()=>controller.state();
 function same(a,b=current()){return a.sessionUserId===b.sessionUserId&&a.sessionGeneration===b.sessionGeneration&&a.conversationId===b.conversationId;}
 function ring(node,state='none'){node.classList.add('pablicusStoryAvatar');node.dataset.pablicusStoryRing=state==='unread'?'unread':'read';}
 async function signed(path,person,snapshot){
  if(!path)return'';if(/^https:\/\//i.test(path))return path;
  if(!UUID.test(person||'')||!path.startsWith(person+'/')||path.includes('..'))return'';
  const r=await client.storage.from('profile-media').createSignedUrl(path,300);if(r.error||current().sessionGeneration!==snapshot.sessionGeneration||current().sessionUserId!==snapshot.sessionUserId)return'';return r.data?.signedUrl||'';
 }
 async function card(id,snapshot){
  const hit=cache.get(id);if(hit&&hit.until>Date.now())return hit.data;
  const r=await client.rpc('pablicus_contact_card',{p_conversation_id:id});if(r.error||current().sessionGeneration!==snapshot.sessionGeneration||current().sessionUserId!==snapshot.sessionUserId)return null;
  if(r.data?.kind!=='contact')return null;cache.set(id,{data:r.data,until:Date.now()+60000});return r.data;
 }
 function paint(node,data,url){
  if(!node?.isConnected||!data?.profile)return;ring(node,'none');node.dataset.profileId=data.profile.id;
  node.setAttribute('aria-label','Карточка собеседника: '+(data.personal?.first_name||data.profile.display_name||data.profile.username||'Собеседник'));
  if(url){const img=document.createElement('img');img.alt='Фотография собеседника';img.src=url;img.referrerPolicy='no-referrer';img.draggable=false;node.replaceChildren(img);}else if(!node.querySelector('img'))node.textContent=Array.from(String(data.profile.display_name||data.profile.username||'?'))[0]?.toUpperCase()||'?';
 }
 async function hydrateConversation(){
  const snapshot=current(),id=snapshot.conversationId,title=document.getElementById('chatTitle');if(!title||!UUID.test(id||'')||!['conversation','canvas'].includes(snapshot.screen))return;
  if(title.dataset.avatarHydratingFor===id)return;if(title.dataset.avatarHydratedFor===id&&(title.querySelector('img')||title.dataset.avatarNoPhoto==='1'))return;
  title.dataset.avatarHydratingFor=id;ring(title,'none');const ticket=++serial;try{const data=await card(id,snapshot);if(ticket!==serial||!data||!same(snapshot))return;const url=await signed(data.profile.avatar_url,data.profile.id,snapshot);if(ticket!==serial||!same(snapshot))return;paint(title,data,url);title.dataset.avatarHydratedFor=id;title.dataset.avatarNoPhoto=url?'0':'1';}finally{if(title.dataset.avatarHydratingFor===id)delete title.dataset.avatarHydratingFor;}
 }
 async function hydrateRow(row){
  if(!row?.isConnected||row.dataset.avatarHydrating)return;const id=row.dataset.conversationId,avatar=row.querySelector('.avatar');if(!UUID.test(id||'')||!avatar)return;row.dataset.avatarHydrating='1';ring(avatar,'none');const snapshot=current();try{const data=await card(id,snapshot);if(!data||!row.isConnected)return;const url=await signed(data.profile.avatar_url,data.profile.id,snapshot);if(row.isConnected)paint(avatar,data,url);}finally{if(row.isConnected)row.dataset.avatarHydrating='done';}
 }
 function storyUnavailable(){
  const d=document.getElementById('productDialog'),title=document.getElementById('dialogTitle'),body=document.getElementById('dialogContent');
  if(d&&title&&body){title.textContent='Сторис';body.replaceChildren();const p=document.createElement('p');p.textContent='Кнопка публикации сторис подготовлена. Серверный формат сторис и срок показа ещё не подключены, поэтому Pablicus не будет выдавать обычную публикацию за сторис.';body.append(p);if(!d.open)d.showModal();}
 }
 function makeStoryButton(id,cls){const b=document.createElement('button');b.id=id;b.type='button';b.className=cls;b.setAttribute('aria-label','Опубликовать сторис');b.title='Опубликовать сторис';b.append(icon('plus'));b.addEventListener('click',storyUnavailable);return b;}
 function ensureStoryButtons(){
  const toolbar=document.querySelector('#composeBox.r2Composer .r2Toolbar');if(toolbar&&!document.getElementById('storyChatAction')){const b=makeStoryButton('storyChatAction','storyAction storyChatAction');const attach=toolbar.querySelector('#attach,.r2Attach');attach?.after(b);}
  const nav=document.getElementById('mainNav');if(nav&&!document.getElementById('storyHomeAction')){const b=makeStoryButton('storyHomeAction','storyAction storyHomeAction');const label=document.createElement('span');label.className='storyNavLabel';label.textContent='Сторис';b.append(label);nav.querySelector('[data-page="chats"]')?.after(b);}
 }
 function decoratePersonal(){document.querySelectorAll('.youAvatarButton .youAvatar,.profileAvatar').forEach(n=>ring(n,'none'));}
 function normalizePencil(){const b=document.getElementById('newChat');if(b){b.classList.add('standardComposeAction');if(!b.querySelector('svg'))b.replaceChildren(icon('compose'));}}
 function layout(){frame=0;ensureStoryButtons();normalizePencil();decoratePersonal();document.querySelectorAll('.chatCard[data-conversation-id]').forEach(hydrateRow);void hydrateConversation();}
 function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
 const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
 controller.subscribe(()=>schedule());window.addEventListener('pageshow',schedule,{signal:life.signal});window.addEventListener('online',()=>{cache.clear();schedule();},{signal:life.signal});
 scope.PablicusAvatarStoriesUI=Object.freeze({refresh:schedule,destroy(){life.abort();observer.disconnect();cancelAnimationFrame(frame);}});schedule();
})(window);

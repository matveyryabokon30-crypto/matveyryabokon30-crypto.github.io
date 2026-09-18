/* Real story state, session-scoped avatars and two explicit publication entry points. */
(function(global){
 'use strict';
 if(global.PablicusAvatarStoriesUI)return;
 const ctrl=global.PablicusController,services=()=>ctrl?.getServices?.(),client=services()?.client;
 if(!ctrl||!client)return;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const state=()=>ctrl.state(),key=s=>s.sessionUserId+':'+s.sessionGeneration,live=s=>key(s)===key(state())&&!!state().sessionUserId;
 const mimeExt={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
 const life=new AbortController(),cards=new Map(),signed=new Map(),rowTickets=new WeakMap(),owners=new Set(),feeds=new Map();
 let account=key(state()),frame=0,timer=0,feedTimer=0,feedFlight=false,feedDirty=false,lastFeed=0,serverOffset=0,modal=null,stopped=false;
 const storyNow=()=>Date.now()+serverOffset;
 const people=new Map();let emitted=false;
 function emitStories(){if(emitted||stopped)return;emitted=true;queueMicrotask(()=>{emitted=false;if(!stopped)global.dispatchEvent(new Event('pablicus:stories-changed'));});}
 function remember(p,url,conversationId=null,name=null){if(!UUID.test(p?.id||''))return;const old=people.get(p.id);const next={id:p.id,name:name||old?.name||p.display_name||p.username||'Собеседник',url:url||old?.url||'',conversationId:conversationId||old?.conversationId||null};if(!old||JSON.stringify(old)!==JSON.stringify(next)){people.set(p.id,next);emitStories();}}
 function snapshot(){return {userId:state().sessionUserId,now:storyNow(),people:[...people.values()].map(p=>({...p})),stories:[...feeds.values()].flat().filter(s=>Date.parse(s.expires_at)>storyNow()).map(s=>({...s,media:s.media?{...s.media}:null}))};}

 function icon(name){return global.PablicusIcons.icon(name);}
 function storyIcon(){const s=icon('add'),ns=s.namespaceURI,c=document.createElementNS(ns,'circle');c.setAttribute('cx','12');c.setAttribute('cy','12');c.setAttribute('r','10');s.prepend(c);s.dataset.pablicusIcon='story-add';return s;}
 function btn(label,run,name='close'){const b=el('button','storyButton');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.append(name==='story-add'?storyIcon():icon(name));b.addEventListener('click',run);return b;}
 function notify(text){services()?.notify?.(text);}
 function activeStories(id){return (feeds.get(id)||[]).filter(s=>Date.parse(s.expires_at)>storyNow());}
 function ring(n,id){if(!UUID.test(id||''))return;if(n.dataset.storyOwner!==id)n.dataset.storyOwner=id;owners.add(id);const value=activeStories(id).length?'active':'none';if(n.dataset.pablicusStoryRing!==value)n.dataset.pablicusStoryRing=value;}
 function refreshRings(){document.querySelectorAll('[data-story-owner]').forEach(n=>{const v=activeStories(n.dataset.storyOwner).length?'active':'none';if(n.dataset.pablicusStoryRing!==v)n.dataset.pablicusStoryRing=v;});}
 async function feed(force=false){
  if(stopped||document.hidden||!state().sessionUserId||!owners.size)return;
  if(feedFlight){feedDirty=true;return;}
  if(!force&&Date.now()-lastFeed<10000&&[...owners].every(id=>feeds.has(id)))return;
  const snapshot=state(),ids=[...owners];feedFlight=true;feedDirty=false;lastFeed=Date.now();
  try{for(let i=0;i<ids.length;i+=100){const chunk=ids.slice(i,i+100),r=global.PablicusHomeData?{data:await global.PablicusHomeData.feed(chunk,force)}:await client.rpc('pablicus_story_feed',{p_owners:chunk});if(!live(snapshot))return;if(r.error)throw r.error;
   const data=r.data;if(!data||!Array.isArray(data.stories)||!Number.isFinite(Date.parse(data.server_now)))throw Error('Invalid story feed');
   serverOffset=Date.parse(data.server_now)-Date.now();for(const id of chunk)feeds.set(id,[]);
   for(const s of data.stories)if(chunk.includes(s.owner_id)&&UUID.test(s.id)&&Date.parse(s.expires_at)>storyNow())feeds.get(s.owner_id).push(s);
  }refreshRings();emitStories();
  }catch{if(live(snapshot))refreshRings();}finally{feedFlight=false;if(feedDirty){feedDirty=false;queueFeed();}}
 }
 function queueFeed(){clearTimeout(feedTimer);feedTimer=setTimeout(()=>void feed(false),24);}
 async function avatarUrl(p,snapshot){
  const path=p?.avatar_url;if(typeof path!=='string'||!path)return '';
  if(/^https:\/\//i.test(path)){try{const u=new URL(path);return !u.username&&!u.password?u.href:'';}catch{return '';}}
  if(!UUID.test(p.id||'')||!path.startsWith(p.id+'/')||path.includes('..'))return '';
  try{const url=await global.PablicusMediaCache.resolve('profile-media',path,{type:'image',width:192});return live(snapshot)?url:'';}catch{return '';}
 }
 async function card(id,snapshot){
  if(global.PablicusHomeData){const data=await global.PablicusHomeData.card(id,snapshot).catch(()=>null);if(!live(snapshot))return null;if(data?.kind==='self'){const p=services()?.getProfile?.();return p?{profile:p,personal:{}}:null;}return data?.kind==='contact'?data:null;}
  const k=key(snapshot)+':'+id,hit=cards.get(k);if(hit&&hit.until>Date.now())return hit.promise;
  const promise=Promise.resolve(client.rpc('pablicus_contact_card',{p_conversation_id:id})).then(r=>{
   if(!live(snapshot)||r.error)return null;
   if(r.data?.kind==='self'){const p=services()?.getProfile?.();return p?{profile:p,personal:{}}:null;}
   return r.data?.kind==='contact'&&UUID.test(r.data.profile?.id)?r.data:null;
  }).catch(()=>null);cards.set(k,{until:Date.now()+45000,promise});return promise;
 }
 function paint(n,p,url){
  if(!n?.isConnected)return;
  n.classList.add('pablicusStoryAvatar');ring(n,p.id);
  const stamp=p.id+'|'+(url||''),name=p.display_name||p.username||'Собеседник';
  if(n.dataset.avatarStamp===stamp&&(n.querySelector('img')||!url||n.dataset.avatarLoading===stamp||n.dataset.avatarFailed===stamp))return;
  const retained=n.querySelector('img');const keep=retained&&n.dataset.avatarPerson===p.id;n.dataset.avatarPerson=p.id;n.dataset.avatarStamp=stamp;if(!keep)n.replaceChildren();
  const fallback=()=>{if(!keep)n.textContent=Array.from(name)[0]?.toUpperCase()||'?';};if(!keep)fallback();
  if(url){n.dataset.avatarLoading=stamp;const img=el('img');img.alt='Фотография профиля';img.referrerPolicy='no-referrer';img.draggable=false;
   img.onload=()=>{if(n.isConnected&&n.dataset.avatarStamp===stamp){delete n.dataset.avatarLoading;n.replaceChildren(img);}};
   img.onerror=()=>{if(n.dataset.avatarStamp===stamp){delete n.dataset.avatarLoading;n.dataset.avatarFailed=stamp;fallback();}};img.src=url;
  }
 }
 async function hydrateRow(row){
  const id=row.dataset.conversationId,n=row.querySelector('.avatar'),snapshot=state();if(!n||!UUID.test(id||'')||!snapshot.sessionUserId)return;
  const k=key(snapshot)+':'+id;if(rowTickets.get(row)===k)return;rowTickets.set(row,k);
  n.classList.add('pablicusStoryAvatar');n.dataset.pablicusStoryRing='none';
  const d=await card(id,snapshot);if(!live(snapshot)||!row.isConnected||!d)return;
  const name=d.personal?.first_name||row.querySelector('.chatText strong')?.textContent;remember(d.profile,'',id,name);ring(n,d.profile.id);queueFeed();
  const url=await avatarUrl(d.profile,snapshot);if(!live(snapshot)||!row.isConnected)return;remember(d.profile,url,id,name);paint(n,d.profile,url);
 }
 let topTicket=0,topId=null,topData=null,topUrl='',topPending=null;
 async function hydrateTop(){
  const snapshot=state(),id=snapshot.conversationId,n=document.getElementById('conversationAvatar');if(!n)return;
  if(!snapshot.sessionUserId||!UUID.test(id||'')||!['conversation','canvas'].includes(snapshot.screen))return;
  if(topPending===key(snapshot)+':'+id)return;
  if(topId===id&&topData){paint(n,topData.profile,topUrl);return;}
  topPending=key(snapshot)+':'+id;const ticket=++topTicket;topId=id;topData=null;topUrl='';n.dataset.avatarStamp='';n.replaceChildren(icon('profile'));n.dataset.pablicusStoryRing='none';delete n.dataset.storyOwner;
  const d=await card(id,snapshot);if(ticket!==topTicket||!live(snapshot)||state().conversationId!==id)return;
  if(!d){topPending=key(snapshot)+':'+id;return;}const url=await avatarUrl(d.profile,snapshot);if(ticket!==topTicket||!live(snapshot)||state().conversationId!==id)return;
  topPending=null;topData=d;topUrl=url;remember(d.profile,url,id,d.personal?.first_name);paint(n,d.profile,url);const name=d.personal?.first_name||d.profile.display_name||d.profile.username;n.setAttribute('aria-label','Профиль и сторис: '+name);n.title='Профиль и сторис: '+name;queueFeed();
 }
 function closeModal(force=false){
  const m=modal;if(!m)return true;
  if(!force&&m.busy){notify('Дождитесь завершения публикации.');return false;}
  if(!force&&m.dirty&&!global.confirm('Закрыть сторис без публикации?'))return false;
  modal=null;m.urls.forEach(URL.revokeObjectURL);m.dialog.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});m.dialog.close();m.dialog.remove();
  if(m.returnFocus?.isConnected)m.returnFocus.focus({preventScroll:true});return true;
 }
 function dialog(label){
  if(!closeModal())return null;const d=el('dialog','pablicusStoryDialog'),m={dialog:d,urls:[],returnFocus:document.activeElement,snapshot:state(),busy:false,dirty:false};modal=m;
  d.setAttribute('aria-label',label);d.tabIndex=-1;const head=el('header','storyHead');head.append(el('h2','',label),btn('Закрыть',()=>closeModal()));d.append(head);document.body.append(d);
  d.addEventListener('cancel',e=>{e.preventDefault();closeModal();});d.showModal();d.focus({preventScroll:true});return m;
 }
 const valid=m=>modal===m&&live(m.snapshot)&&m.dialog.isConnected;
 async function view(owner,conversationId=null){
  if(global.PablicusStoriesViewer){if(!closeModal())return;return global.PablicusStoriesViewer.open(owner,conversationId,document.activeElement);}
  const m=dialog('Сторис');if(!m)return;
  const status=el('p','storyStatus','Загружаем сторис…'),stage=el('div','storyViewerStage'),actions=el('div','storyViewerActions');m.dialog.append(status,stage,actions);owners.add(owner);
  await feed(true);if(!valid(m))return;let items=activeStories(owner),index=0,serial=0;
  if(!items.length){status.textContent='Нет доступных активных сторис.';if(owner===m.snapshot.sessionUserId)actions.append(btn('Создать сторис',()=>{closeModal(true);compose();},'story-add'));return;}
  const previous=btn('Предыдущая сторис',()=>{index=(index+items.length-1)%items.length;void show();},'back'),next=btn('Следующая сторис',()=>{index=(index+1)%items.length;void show();},'chevron-down');next.classList.add('storyNext');actions.append(previous,next);
  if(conversationId)actions.append(btn('Открыть профиль',()=>{closeModal(true);global.PablicusContacts?.open(conversationId);},'profile'));
  let del=null;if(owner===m.snapshot.sessionUserId){del=el('button','storyDelete','Удалить сторис');del.type='button';actions.append(del);del.onclick=async()=>{
   if(m.busy||!confirm('Удалить эту сторис?'))return;m.busy=true;del.disabled=true;const s=items[index];
   try{const r=await client.from('pablicus_stories').delete().eq('id',s.id).eq('owner_id',m.snapshot.sessionUserId);if(!valid(m))return;if(r.error)throw r.error;
    if(s.media?.path)await client.storage.from('pablicus-story-media').remove([s.media.path]);await feed(true);if(!valid(m))return;items=activeStories(owner);if(!items.length){closeModal(true);return;}index=Math.min(index,items.length-1);await show();
   }catch{if(valid(m))status.textContent='Не удалось удалить сторис. Повторите.';}finally{m.busy=false;del.disabled=false;}
  };}
  async function show(){
   const ticket=++serial,s=items[index];stage.querySelectorAll('video').forEach(v=>v.pause());stage.replaceChildren();m.urls.forEach(URL.revokeObjectURL);m.urls=[];
   status.textContent=(index+1)+' / '+items.length;previous.hidden=next.hidden=items.length<2;
   if(Date.parse(s.expires_at)<=storyNow()){status.textContent='Срок показа этой сторис истёк.';return;}
   if(s.body)stage.append(el('p','storyText',s.body));
   if(s.media?.path){const waiting=el('p','storyStatus','Загружаем медиа…');stage.prepend(waiting);
    try{const r=await client.storage.from('pablicus-story-media').download(s.media.path);if(!valid(m)||ticket!==serial)return;if(r.error)throw r.error;
     const url=URL.createObjectURL(r.data);m.urls.push(url);const media=el(s.media.type==='video'?'video':'img');media.src=url;
     if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true;media.preload='metadata';}else media.alt=s.body||'Фото сторис';
     waiting.replaceWith(media);
    }catch{if(valid(m)&&ticket===serial)waiting.textContent='Медиа недоступно. Откройте сторис повторно.';}
   }
  }await show();
 }
 function compose(){
  const s=state();if(!s.sessionUserId||!services()?.getProfile?.()?.is_approved){notify('Войдите в аккаунт, чтобы опубликовать сторис.');return;}
  const m=dialog('Новая сторис');if(!m)return;let id=crypto.randomUUID(),file=null,uploaded=null,frozen=null;
  const form=el('form','storyForm'),text=el('textarea'),pick=el('input'),preview=el('div','storyPreview'),status=el('p','storyStatus'),publish=el('button','storyPublish','Опубликовать'),mine=el('button','storyMine','Мои сторис');
  text.maxLength=2000;text.rows=3;text.placeholder='Текст сторис…';text.setAttribute('aria-label','Текст сторис');
  pick.type='file';pick.accept=Object.keys(mimeExt).join(',');pick.setAttribute('aria-label','Фото или видео сторис');publish.type='submit';mine.type='button';
  pick.hidden=true;pick.id='storyMediaPicker';const choose=el('button','storyChooseMedia','Фото или видео');choose.type='button';choose.prepend(icon('photo'));choose.onclick=()=>pick.click();form.append(text,choose,pick,preview,el('p','storyAudience','На 24 часа. Видно вашим собеседникам в личных чатах Pablicus. В переписку сообщение не отправляется.'),status,publish,mine);m.dialog.append(form);
  mine.onclick=()=>{if(closeModal())void view(s.sessionUserId);};
  text.oninput=()=>{m.dirty=!!text.value.trim()||!!file;};
  pick.onchange=()=>{const f=pick.files?.[0];if(f&&(!mimeExt[f.type]||f.size>52428800||f.size===0)){status.textContent='Выберите фото или видео до 50 МБ (JPEG, PNG, WebP, GIF, MP4, MOV, WebM).';pick.value='';file=null;uploaded=null;m.urls.forEach(URL.revokeObjectURL);m.urls=[];preview.replaceChildren();m.dirty=!!text.value.trim();return;}
   file=f||null;m.urls.forEach(URL.revokeObjectURL);m.urls=[];preview.replaceChildren();uploaded=null;id=crypto.randomUUID();m.dirty=!!text.value.trim()||!!file;status.textContent='';
   if(file){const url=URL.createObjectURL(file);m.urls.push(url);const media=el(file.type.startsWith('video/')?'video':'img');media.src=url;if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true;}else media.alt='Предпросмотр сторис';preview.append(media);}
  };
  form.onsubmit=async e=>{e.preventDefault();if(m.busy||!valid(m))return;const body=text.value.trim();if(!body&&!file){status.textContent='Добавьте текст, фото или видео.';return;}
   m.busy=true;publish.disabled=pick.disabled=mine.disabled=choose.disabled=true;text.readOnly=true;status.textContent=file&&!uploaded?'Загружаем медиа…':'Публикуем…';
   try{
    if(file&&!uploaded){const path=m.snapshot.sessionUserId+'/'+id+'.'+mimeExt[file.type],r=await client.storage.from('pablicus-story-media').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'0'});if(!valid(m))return;
     if(r.error&&String(r.error.statusCode)!=='409')throw r.error;if(file.type.startsWith('image/'))await global.PablicusMediaCache.prepare('pablicus-story-media',path);if(!valid(m))return;uploaded={path,type:file.type.startsWith('video/')?'video':'image'};
    }
    if(!valid(m))return;frozen=frozen||{p_id:id,p_expected_owner:m.snapshot.sessionUserId,p_body:body,p_media:uploaded};
    const r=await client.rpc('pablicus_publish_story',frozen);if(!valid(m))return;if(r.error)throw r.error;
    const row=Array.isArray(r.data)?r.data[0]:r.data;if(!row||row.id!==id||row.owner_id!==m.snapshot.sessionUserId)throw Error('Invalid story receipt');
    owners.add(row.owner_id);feeds.set(row.owner_id,[...(feeds.get(row.owner_id)||[]).filter(x=>x.id!==id),row]);refreshRings();m.dirty=false;closeModal(true);notify('Сторис опубликована на 24 часа.');await feed(true);
   }catch(err){if(valid(m)){status.textContent=String(err?.message||'').includes('STORY_LIMIT_30')?'Можно опубликовать до 30 активных сторис.':'Не удалось подтвердить публикацию. Повторите — дубликат не появится.';publish.textContent='Повторить публикацию';}}
   finally{m.busy=false;publish.disabled=false;if(!frozen){pick.disabled=mine.disabled=choose.disabled=false;text.readOnly=false;}}
  };
 }
 function buttons(){
  const nav=document.getElementById('mainNav'),app=document.getElementById('app'),authorized=!!state().sessionUserId&&!!services()?.getProfile?.()?.is_approved;
  const dock=document.querySelector('#home>.cleanHomeActions');if(dock&&!document.getElementById('storyHomeAction')){const b=btn('Опубликовать сторис',compose,'story-add');b.id='storyHomeAction';b.className='storyHomeAction';dock.append(b);}
  document.querySelector('.storyChatActions')?.remove();document.getElementById('storyChatAction')?.remove();
  const b=document.getElementById('storyHomeAction');if(b)b.hidden=!authorized||state().section!=='chats'||state().screen!=='home';
  const pencil=document.getElementById('newChat');if(pencil)pencil.classList.add('standardComposeAction');
 }
 let ownNavFlight=null;
 async function hydrateOwnNav(){
  const own=services()?.getProfile?.(),nav=document.querySelector('#mainNav>[data-page="profile"]');if(!own||!nav||!UUID.test(own.id||''))return;
  owners.add(own.id);nav.classList.add('profileAvatarNav');let a=nav.querySelector('.profileNavAvatar');if(!a){a=el('span','profileNavAvatar');nav.replaceChildren(a,el('span','profileNavLabel','Вы'));}
  ring(a,own.id);remember(own,'');const snapshot=state(),ticket=key(snapshot)+'|'+own.id+'|'+own.avatar_url;
  if(a.dataset.sourceTicket===ticket&&(a.querySelector('img')||!own.avatar_url))return;if(ownNavFlight===ticket)return;ownNavFlight=ticket;queueFeed();
  let url;try{url=await avatarUrl(own,snapshot);}finally{if(ownNavFlight===ticket)ownNavFlight=null;}if(!live(snapshot)||!a.isConnected)return;a.dataset.sourceTicket=ticket;remember(own,url);
  const stamp=own.id+'|'+(url||'');if(a.dataset.avatarStamp===stamp)return;a.dataset.avatarStamp=stamp;
  if(url){const img=el('img');img.alt='Ваш профиль';img.src=url;img.onload=()=>{if(a.isConnected&&a.dataset.avatarStamp===stamp)a.replaceChildren(img);};}else a.textContent=Array.from(own.display_name||own.username||'Я')[0]?.toUpperCase()||'Я';ring(a,own.id);
 }
 function layout(){
  frame=0;if(stopped)return;buttons();if(!state().sessionUserId)return;
  const own=services()?.getProfile?.();void hydrateOwnNav();if(own){owners.add(own.id);document.querySelectorAll('.youMotionPage .contactPhotoButton,.youAvatarButton:not(.contactPhotoButton)').forEach(n=>{n.classList.add('pablicusStoryProfile');ring(n,own.id);});}
  document.querySelectorAll('.chatCard[data-conversation-id]').forEach(row=>void hydrateRow(row));void hydrateTop();refreshRings();
 }
 function schedule(){if(!stopped&&!frame)frame=requestAnimationFrame(layout);}
 const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.storyShelfV3,.storyViewerV3,[data-story-owner]')))schedule();});observer.observe(document.body,{childList:true,subtree:true});
 const unsubscribe=ctrl.subscribe(next=>{
  if(key(next)!==account){const av=document.getElementById('conversationAvatar');if(av){av.replaceChildren();delete av.dataset.avatarPerson;}account=key(next);closeModal(true);people.clear();emitStories();cards.clear();signed.clear();owners.clear();feeds.clear();topData=null;topId=null;topPending=null;topTicket++;lastFeed=0;feedDirty=false;document.querySelectorAll('[data-story-owner]').forEach(n=>{delete n.dataset.storyOwner;n.dataset.pablicusStoryRing='none';delete n.dataset.avatarStamp;});}
  if(next.conversationId!==topId){topId=null;topData=null;topPending=null;topTicket++;}schedule();
 });
 document.addEventListener('click',e=>{const trigger=e.target.closest?.('#conversationAvatar,.contactAvatarTrigger');if(!trigger)return;const n=trigger.matches('#conversationAvatar')?trigger:trigger.querySelector('[data-story-owner]'),owner=n?.dataset.storyOwner;if(!owner||!activeStories(owner).length)return;e.preventDefault();e.stopImmediatePropagation();void view(owner,trigger.closest('.chatCard')?.dataset.conversationId||state().conversationId);},{capture:true,signal:life.signal});
 global.addEventListener('pablicus:home-feed',e=>{const d=e.detail;if(!live(d)||!Array.isArray(d.owners)||!Array.isArray(d.feed?.stories))return;const now=Date.parse(d.feed.server_now);if(!Number.isFinite(now))return;serverOffset=now-Date.now();for(const id of d.owners){owners.add(id);feeds.set(id,d.feed.stories.filter(s=>s.owner_id===id&&UUID.test(s.id)&&Date.parse(s.expires_at)>now));}lastFeed=Date.now();refreshRings();emitStories();},{signal:life.signal});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule();void feed(true);}},{signal:life.signal});
 global.addEventListener('online',()=>{cards.clear();schedule();void feed(true);},{signal:life.signal});
 timer=setInterval(()=>{if(!document.hidden){refreshRings();void feed();}},30000);
 global.PablicusAvatarStoriesUI=Object.freeze({snapshot,refresh:schedule,compose,view,refreshStories:()=>feed(true),destroy(){stopped=true;life.abort();unsubscribe();observer.disconnect();clearInterval(timer);clearTimeout(feedTimer);cancelAnimationFrame(frame);closeModal(true);cards.clear();signed.clear();feeds.clear();}});schedule();
})(window);

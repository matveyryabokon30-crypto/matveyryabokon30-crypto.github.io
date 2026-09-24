import {normalizeStory} from '../story-composition.mjs';
import {activeStories,markStoryAvatar,smallStoryAvatar} from '../story-avatar.mjs';
import {createPostFeed,createSequence,feedPosts} from '../profile-media.mjs';
import {profileEditor} from '../profile-editor.mjs';
import {profileCreate} from '../profile-create.mjs';
import {el,icon,row} from '../components.mjs';
import {openProfileStore,mediaTypes,validatePostText} from '../profile-store.mjs';
export function create(ctx){
 const node=el('section','screen profile-screen');node.setAttribute('aria-label','Профиль');
 const body=el('div','profile-body'),nav=el('nav','profile-bottom');nav.setAttribute('aria-label','Разделы профиля');
 node.append(body,nav);
 const store=openProfileStore(),urls=new Set();let data=null,uid=null,epoch=0,view='profile',filter='all',feedSaved=false,disposed=false,busy=false,loaded=false,loading=false,accountSeen=false;
 const ownDialog=el('dialog','profile-dialog');ownDialog.setAttribute('aria-label','Редактирование профиля');node.append(ownDialog);
 const dialogUrls=new Set();let inlineFeed=null,viewer=null,storyModal=null,storyViewer=null,storyFocus=null;
 const routeHost=document.querySelector('#routeHost');
 const routeObserver=new MutationObserver(()=>{if(!node.isConnected)closeDialog();inlineFeed?.setActive(node.isConnected&&!ownDialog.open);});
 if(routeHost)routeObserver.observe(routeHost,{childList:true});
 const url=(blob,set=urls)=>{const u=URL.createObjectURL(blob);set.add(u);return u;};
 const release=set=>{for(const u of set)URL.revokeObjectURL(u);set.clear();};
 function closeDialog(){closeStories(false);const old=viewer;viewer=null;old?.dispose();ownDialog.classList.remove('profile-editor','profile-media-dialog');ownDialog.querySelectorAll('video').forEach(v=>v.pause());ownDialog.close();ownDialog.replaceChildren();release(dialogUrls);inlineFeed?.setActive(node.isConnected);}
 ownDialog.addEventListener('cancel',e=>{e.preventDefault();if(viewer?.requestClose)viewer.requestClose();else closeDialog();});
 ownDialog.addEventListener('close',()=>{if(!ownDialog.open)closeDialog();});
 function button(label,symbol,action,cls='profile-action'){const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);if(symbol)b.innerHTML=icon(symbol);b.append(el('span','',label));b.onclick=action;return b;}
 function header(title){const head=el('div','profile-page-heading');head.append(button('Профиль','back',()=>setView('profile'),'profile-back'),el('h1','',title));body.append(head);}
 function empty(title,text){const n=el('div','profile-empty');n.append(el('h2','',title),el('p','',text));body.append(n);}
 function requireAccount(){if(!ctx.account){ctx.runtime()?.accountAction();return false;}if(!loaded){ctx.notify('Профиль ещё загружается.');return false;}return true;}
 function dialog(title){closeDialog();inlineFeed?.setActive(false);ownDialog.setAttribute('aria-label',title);ownDialog.append(button('Закрыть','close',closeDialog,'profile-dialog-close'),el('h2','',title));ownDialog.showModal();}
 async function persist(next,owner,token){if(busy)return false;busy=true;try{await store.save(owner,next);if(token!==epoch||disposed)return false;data=next;return true;}finally{busy=false;}}
 function errorText(error){return error?.name==='QuotaExceededError'?'На устройстве недостаточно места. Удали ненужные материалы.':error.message||'Не удалось сохранить. Попробуй ещё раз.';}
 function closeStories(resume=true){
  if(!storyModal)return;const modal=storyModal,session=storyViewer,target=storyFocus;storyModal=null;storyViewer=null;storyFocus=null;session?.dispose();if(modal.open)modal.close();modal.remove();
  if(resume&&node.isConnected){viewer?.setActive?.(true);inlineFeed?.setActive(!ownDialog.open);if(target?.isConnected)target.focus({preventScroll:true});}
 }
 function openStories(startId){
  if(!requireAccount())return;const stories=activeStories(data.posts);if(!stories.length)return;closeStories(false);storyFocus=document.activeElement;inlineFeed?.setActive(false);viewer?.setActive?.(false);
  const modal=el('dialog','profile-dialog profile-media-dialog profile-story-dialog');storyModal=modal;modal.setAttribute('aria-label','Сторис');node.append(modal);
  storyViewer=createSequence({posts:data.posts,startId:typeof startId==='string'?startId:stories[0].id,profile:data,account:ctx.account,mode:'story',close:()=>closeStories(),onRemove:removePost});modal.append(storyViewer.node);
  modal.addEventListener('cancel',e=>{e.preventDefault();closeStories();});modal.addEventListener('close',()=>{if(storyModal===modal)closeStories();});modal.showModal();storyViewer.setActive(true);modal.querySelector('.profile-dialog-close')?.focus({preventScroll:true});
 }
 function edit(){
  if(!requireAccount())return;const owner=uid,token=epoch;
  closeDialog();inlineFeed?.setActive(false);ownDialog.setAttribute('aria-label','Редактировать профиль');
  profileEditor({dialog:ownDialog,data,account:ctx.account,close:closeDialog,assetUrl:blob=>url(blob,dialogUrls),errorText,openStory:openStories,
   save:async next=>{if(await persist(next,owner,token)){closeDialog();render();}}});
  ownDialog.showModal();ownDialog.querySelector('.pe-bar button')?.focus({preventScroll:true});
 }
 function addMedia(initialKind=null){
  if(!requireAccount())return;const owner=uid,token=epoch;
  closeDialog();inlineFeed?.setActive(false);
  const current=()=>!disposed&&owner===uid&&token===epoch;
  const creator=profileCreate({dialog:ownDialog,close:closeDialog,current,errorText,initialKind:typeof initialKind==='string'?initialKind:null,
   save:async ({kind,files,caption,story})=>{
    if(!current())return false;
    if(kind==='post')validatePostText(caption);
    if(data.posts.length>=60)throw Error('В медиатеке уже 60 материалов. Удали ненужные, чтобы добавить новые.');
    const post={id:crypto.randomUUID(),kind,caption,at:new Date().toISOString(),files};if(kind==='story')post.story=normalizeStory(story);
    if(!await persist({...data,posts:[post,...data.posts]},owner,token))return false;
    if(viewer===creator){closeDialog();filter='all';if(kind==='story'||view!=='feed')view='profile';}
    render();return true;
   }});
  viewer=creator;ownDialog.showModal();creator.focus();
 }
 async function changePost(post,field,value){
  if(!requireAccount()||busy||!['liked','saved'].includes(field))return false;
  const owner=uid,token=epoch;const saved=await persist({...data,posts:data.posts.map(p=>p.id===post.id?{...p,[field]:value}:p)},owner,token);if(saved&&field==='saved'&&!value&&feedSaved&&view==='feed'&&!ownDialog.open)render();return saved;
 }
 async function removePost(post){
  if(!requireAccount()||busy)return;const owner=uid,token=epoch;
  if(!confirm('Удалить этот материал с устройства?'))return;
  try{if(await persist({...data,posts:data.posts.filter(p=>p.id!==post.id)},owner,token)){closeDialog();render();}}catch(e){ctx.notify(errorText(e));}
 }
 function openPost(post,back=null){
  if(!requireAccount())return;closeDialog();inlineFeed?.setActive(false);
  ownDialog.classList.add('profile-media-dialog');
  const mode=post.kind==='story'?'story':post.kind==='video'?'video':'feed';
  ownDialog.setAttribute('aria-label',mode==='story'?'Сторис':mode==='video'?'Видео':'Публикации');
  if(mode==='feed'){
   const bar=el('header','pm-viewer-bar');bar.append(button('Закрыть','back',closeDialog,'pm-control profile-dialog-close'),el('h2','','Публикации'));
   const scroller=el('div','pm-feed-scroll');ownDialog.append(bar,scroller);
   viewer=createPostFeed({posts:data.posts,profile:data,account:ctx.account,scrollRoot:scroller,onVideo:video=>{const top=scroller.scrollTop,owner=uid,token=epoch;openPost(video,()=>{if(owner!==uid||token!==epoch)return;openPost(post);const previous=ownDialog.querySelector('.pm-feed-scroll');if(previous)previous.scrollTop=top;});},onRemove:removePost,onStory:openStories,onChange:changePost,notify:ctx.notify});scroller.append(viewer.node);
   ownDialog.showModal();viewer.jump(post.id);
  }else{
   viewer=createSequence({posts:data.posts,startId:post.id,profile:data,account:ctx.account,mode,close:()=>{closeDialog();back?.();},onRemove:removePost});
   ownDialog.append(viewer.node);ownDialog.showModal();viewer.setActive(true);
  }
  ownDialog.querySelector('.profile-dialog-close')?.focus({preventScroll:true});
 }
 function feed(){
  const bar=el('header','pm-feed-bar');bar.append(button('Добавить','plus',addMedia,'pm-control pm-feed-add'),el('h1','',feedSaved?'Сохранённое':'Лента'));
  body.append(bar);
  if(!loaded){empty(ctx.account?'Загружаем публикации':'Твоя лента','Посты, фото, видео и карусели из твоего профиля.');if(!ctx.account)body.append(button('Войти в SEKKES','profile',()=>ctx.runtime()?.accountAction()));return;}
  const strip=el('nav','profile-story-strip');strip.setAttribute('aria-label','Сторис');
  const add=el('div','profile-story-entry'),addButton=button('Добавить сторис','plus',()=>addMedia('story'),'pm-story-add');add.append(addButton,el('span','','Добавить'));strip.append(add);
  for(const [i,story] of activeStories(data.posts).entries()){const entry=el('div','profile-story-entry'),avatar=smallStoryAvatar({profile:data,account:ctx.account,url,onOpen:()=>openStories(story.id)});avatar.setAttribute('aria-label',`Открыть сторис ${i+1}`);entry.append(avatar,el('span','',`История ${i+1}`));strip.append(entry);}body.append(strip);
  inlineFeed=createPostFeed({posts:feedPosts(data.posts).filter(p=>!feedSaved||p.saved===true),profile:data,account:ctx.account,scrollRoot:body,onVideo:openPost,onRemove:removePost,onStory:openStories,onChange:changePost,notify:ctx.notify});body.append(inlineFeed.node);
 }
 function grid(){
  const toolbar=el('div','profile-grid-heading');toolbar.append(button('Добавить','plus',addMedia));body.append(toolbar);
  const filters=el('div','profile-filters');filters.setAttribute('aria-label','Формат материалов');for(const [key,label,symbol] of [['all','Все','feed'],...Object.entries(mediaTypes).map(([k,v])=>[k,v,k])]){const b=button(label,symbol,()=>{filter=key;render();},'profile-filter');b.setAttribute('aria-pressed',String(filter===key));filters.append(b);}body.append(filters);
  if(!loaded){empty(ctx.account?'Загружаем профиль':'Твой профиль','Аватар, анкета и личные материалы.');if(!ctx.account)body.append(button('Войти в SEKKES','profile',()=>ctx.runtime()?.accountAction()));return;}
  const posts=(data?.posts||[]).filter(p=>filter==='all'||p.kind===filter);if(!posts.length){empty('Пока нет материалов','Добавь пост, фото, видео, карусель или сторис.');return;}
  const list=el('div','profile-media-grid');
  for(const post of posts){const b=el('button','profile-tile');b.type='button';b.setAttribute('aria-label',mediaTypes[post.kind]+(post.caption?': '+post.caption:''));b.onclick=()=>openPost(post);
   const file=post.files[0];if(post.kind==='post'){b.classList.add('profile-text-tile');b.append(el('span','profile-post-excerpt',post.caption));}else if(file?.type.startsWith('image/')){const img=el('img');img.src=url(file);img.alt=post.caption||mediaTypes[post.kind];img.loading='lazy';b.append(img);}else{const cover=el('span','profile-video-cover');cover.innerHTML=icon('video');b.append(cover);}
   const badge=el('span','profile-type');badge.innerHTML=icon(post.kind);badge.setAttribute('aria-hidden','true');b.append(badge);list.append(b);
  }body.append(list);
 }
 function settings(){header('Настройки профиля');const group=el('div','settings-group');
  group.append(row({title:'Мой прогресс',description:'Личный путь',iconName:'progress',action:()=>setView('progress')}),row({title:'Сохранённые разговоры',description:'Твоя переписка с SEKKES',iconName:'chat',action:()=>ctx.showConversation()}),row({title:'Любимые пространства',iconName:'heart',action:()=>setView('favorites')}),row({title:'Достижения',iconName:'spark',action:()=>setView('achievements')}),row({title:'Личные настройки',description:'Анкета, вход и голос помощника',iconName:'profile',action:()=>setView('personal')}));body.append(group);
 }
 function personal(){header('Личные настройки');const group=el('div','settings-group');group.append(row({title:'Редактировать анкету и аватар',iconName:'edit',action:edit}),row({title:'Face ID / ключ доступа',iconName:'shield',action:()=>ctx.runtime()?.faceIdSettings()}),row({title:'Голос помощника',iconName:'sound',action:()=>ctx.runtime()?.voiceSettings()}),row({title:'Оформление приложения',iconName:'settings',action:()=>ctx.navigate('settings')}),row({title:ctx.account?'Выйти из аккаунта':'Войти в SEKKES',iconName:'profile',action:()=>ctx.runtime()?.accountAction()}));body.append(group);}
 function setView(next){if(next==='feed'&&view==='feed'&&!feedSaved){body.scrollTo({top:0,behavior:'instant'});return;}closeDialog();if(next==='feed')feedSaved=false;view=next;body.scrollTop=0;render();}
 function render(){
  if(disposed)return;inlineFeed?.dispose();inlineFeed=null;body.dataset.profileView=view;body.querySelectorAll('video').forEach(v=>v.pause());release(urls);body.replaceChildren();
  const profileTab=nav.querySelector('[data-view=profile]');if(profileTab){const pict=el('span','profile-nav-avatar');if(data?.avatar){const image=el('img');image.src=url(data.avatar);image.alt='';pict.append(image);}else pict.innerHTML=icon('profile');profileTab.replaceChildren(pict);}
  for(const b of nav.children){const current=b.dataset.view===view||(b.dataset.view==='profile'&&['settings','personal','progress','favorites','achievements'].includes(view));if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  if(view==='settings')return settings();if(view==='personal')return personal();
  if(['progress','favorites','achievements','channels','community'].includes(view)){
   const labels={progress:['Мой прогресс','Пока без оценок','Отслеживание прогресса ещё не доступно.'],favorites:['Любимые пространства','Твои пространства','Перейти к играм и живому миру можно ниже.'],achievements:['Достижения','Твой путь продолжается','Система достижений ещё не доступна.'],channels:['Каналы','Скоро здесь','Каналы пока недоступны.'],community:['Сообщество','Скоро здесь','Общение с участниками пока недоступно.']}[view];header(labels[0]);empty(labels[1],labels[2]);if(view==='favorites'){body.append(button('Игры','games',()=>ctx.navigate('games')),button('Живой мир','world',()=>ctx.navigate('world')));}return;
  }
  if(view==='feed'){feed();return;}
  const top=el('div','profile-identity'),avatarWrap=el('div','profile-avatar-wrap');const active=activeStories(data?.posts).length>0;const avatar=button(active?'Открыть сторис':'Изменить фото профиля','profile',active?openStories:edit,'profile-avatar');avatar.replaceChildren();markStoryAvatar(avatar,data?.posts);
  if(data?.avatar){const img=el('img');img.src=url(data.avatar);img.alt='Фото профиля';avatar.append(img);}else{const initials=(data?.name||ctx.account?.user_metadata?.full_name||ctx.account?.user_metadata?.name||'').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('');if(initials)avatar.append(el('span','profile-initials',initials));else avatar.innerHTML=icon('profile');}
  const pencil=button('Редактировать профиль','edit',edit,'profile-avatar-edit');avatarWrap.append(avatar,pencil);
  const name=data?.name||ctx.account?.user_metadata?.full_name||ctx.account?.user_metadata?.name||'Твой профиль';top.append(avatarWrap,el('h1','profile-display-name',name));
  if(data?.bio)top.append(el('p','profile-bio',data.bio));else top.append(button('Добавить описание','edit',edit,'profile-edit-link'));
  const details=[data?.city,data?.interests].filter(Boolean).join(' · ');if(details)top.append(el('p','profile-details',details));body.append(top);const links=el('div','profile-library-links');links.append(button('Сохранённые публикации','bookmark',()=>{feedSaved=true;view='feed';body.scrollTop=0;render();}),button('Настройки профиля','settings',()=>setView('settings')));body.append(links);grid();
 }
 for(const [id,label,symbol] of [['feed','Лента','feed'],['channels','Каналы','channels'],['community','Сообщество','community'],['profile','Профиль','profile']]){const b=button(label,symbol,()=>setView(id),'profile-nav-item');b.dataset.view=id;nav.append(b);}
 async function update(){
  if(disposed)return;const nextUid=ctx.account?.id||null;
  // Auth refresh/route resume is not an account change. Keep the same DOM,
  // media URLs, scroll position and open draft, including an in-flight load.
  if(accountSeen&&nextUid===uid&&(loaded||loading||!uid))return;
  const token=++epoch;accountSeen=true;uid=nextUid;feedSaved=false;loaded=false;loading=Boolean(uid);data=null;
  closeDialog();render();if(!uid)return;
  try{const result=await store.load(uid);if(token!==epoch||disposed)return;data=result;loaded=true;render();}
  catch(e){if(token===epoch&&!disposed){empty('Не удалось открыть профиль',errorText(e));}}
  finally{if(token===epoch)loading=false;}
 }
 ctx.profileUpdate=update;update();
 return {node,dispose(){disposed=true;epoch++;routeObserver.disconnect();inlineFeed?.dispose();inlineFeed=null;closeDialog();release(urls);store.close();ctx.profileUpdate=null;}};
}

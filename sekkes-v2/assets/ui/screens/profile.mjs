import {el,icon,row} from '../components.mjs';
import {openProfileStore,validateMedia,mediaTypes} from '../profile-store.mjs';
export function create(ctx){
 const node=el('section','screen profile-screen');node.setAttribute('aria-label','Профиль');
 const body=el('div','profile-body'),nav=el('nav','profile-bottom');nav.setAttribute('aria-label','Разделы профиля');
 node.append(body,nav);
 const store=openProfileStore(),urls=new Set();let data=null,uid=null,epoch=0,view='profile',filter='all',disposed=false,busy=false,loaded=false;
 const ownDialog=el('dialog','profile-dialog');ownDialog.setAttribute('aria-label','Редактирование профиля');node.append(ownDialog);
 const dialogUrls=new Set();
 const url=(blob,set=urls)=>{const u=URL.createObjectURL(blob);set.add(u);return u;};
 const release=set=>{for(const u of set)URL.revokeObjectURL(u);set.clear();};
 function closeDialog(){ownDialog.querySelectorAll('video').forEach(v=>v.pause());ownDialog.close();ownDialog.replaceChildren();release(dialogUrls);}
 ownDialog.addEventListener('close',()=>{if(ownDialog.open)return;ownDialog.querySelectorAll('video').forEach(v=>v.pause());release(dialogUrls);});
 function button(label,symbol,action,cls='profile-action'){const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);if(symbol)b.innerHTML=icon(symbol);b.append(el('span','',label));b.onclick=action;return b;}
 function header(title){const head=el('div','profile-page-heading');head.append(button('Профиль','back',()=>setView('profile'),'profile-back'),el('h1','',title));body.append(head);}
 function empty(title,text){const n=el('div','profile-empty');n.append(el('h2','',title),el('p','',text));body.append(n);}
 function requireAccount(){if(!ctx.account){ctx.runtime()?.accountAction();return false;}if(!loaded){ctx.notify('Профиль ещё загружается.');return false;}return true;}
 function dialog(title){closeDialog();ownDialog.setAttribute('aria-label',title);ownDialog.append(button('Закрыть','close',closeDialog,'profile-dialog-close'),el('h2','',title));ownDialog.showModal();}
 async function persist(next,owner,token){if(busy)return false;busy=true;try{await store.save(owner,next);if(token!==epoch||disposed)return false;data=next;return true;}finally{busy=false;}}
 function errorText(error){return error?.name==='QuotaExceededError'?'На устройстве недостаточно места. Удали ненужные материалы.':error.message||'Не удалось сохранить. Попробуй ещё раз.';}
 function edit(){
  if(!requireAccount())return;const owner=uid,token=epoch;dialog('Редактировать профиль');
  const form=el('form','profile-form'),fields={};
  for(const [key,label,max] of [['name','Имя',60],['bio','О себе',280],['city','Город',80],['interests','Интересы',160]]){const wrap=el('label','',label),input=el(key==='bio'?'textarea':'input');input.value=data[key]|| (key==='name'?(ctx.account.user_metadata?.full_name||ctx.account.user_metadata?.name||''):'');input.maxLength=max;if(key==='name')input.required=true;wrap.append(input);fields[key]=input;form.append(wrap);}
  const wrap=el('label','','Фото профиля'),file=el('input');file.type='file';file.accept='image/jpeg,image/png,image/webp,image/avif';wrap.append(file);form.append(wrap);
  const notice=el('p','profile-note','Сохраняется в этом аккаунте на этом устройстве. Другие люди пока не видят профиль.');const error=el('p','profile-error');error.setAttribute('role','alert');
  const save=button('Сохранить',null,null);save.type='submit';
  form.append(notice,error,save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;error.textContent='';try{
   let avatar=data.avatar;if(file.files.length){validateMedia('photo',[file.files[0]]);avatar=file.files[0];}
   const next={...data,avatar};for(const key in fields)next[key]=fields[key].value.trim();if(!next.name)throw Error('Введи имя.');
   if(await persist(next,owner,token)){closeDialog();render();}
  }catch(e){error.textContent=errorText(e);}finally{save.disabled=false;}};ownDialog.append(form);
 }
 function addMedia(){
  if(!requireAccount())return;const owner=uid,token=epoch;dialog('Добавить материал');const form=el('form','profile-form');
  const format=el('label','','Формат'),select=el('select');for(const [k,v] of Object.entries(mediaTypes)){const o=el('option','',v);o.value=k;select.append(o);}format.append(select);
  const upload=el('label','','Файл'),input=el('input');input.type='file';input.required=true;
  const change=()=>{input.value='';input.multiple=select.value==='carousel';input.accept=select.value==='video'?'video/mp4,video/webm,video/quicktime':select.value==='story'?'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime':'image/jpeg,image/png,image/webp,image/avif';};change();select.onchange=change;upload.append(input);
  const caption=el('label','','Подпись'),text=el('textarea');text.maxLength=500;caption.append(text);
  const error=el('p','profile-error');error.setAttribute('role','alert');const save=button('Добавить в профиль',null,null);save.type='submit';
  form.append(format,upload,caption,el('p','profile-note','Личная медиатека на этом устройстве. Добавление не публикует материал в интернете.'),error,save);
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;error.textContent='';try{const files=[...input.files];validateMedia(select.value,files);if(data.posts.length>=60)throw Error('В медиатеке уже 60 материалов. Удали ненужные, чтобы добавить новые.');const post={id:crypto.randomUUID(),kind:select.value,caption:text.value.trim(),at:new Date().toISOString(),files};if(await persist({...data,posts:[post,...data.posts]},owner,token)){closeDialog();filter='all';view='profile';render();}}catch(e){error.textContent=errorText(e);}finally{save.disabled=false;}};
  ownDialog.append(form);
 }
 function media(blob,set,cls=''){const type=blob.type.startsWith('video/')?'video':'img';const m=el(type,cls);m.src=url(blob,set);if(type==='video'){m.controls=true;m.playsInline=true;m.preload='metadata';}else m.alt='Материал профиля';return m;}
 function openPost(post){
  const owner=uid,token=epoch;dialog(mediaTypes[post.kind]);ownDialog.setAttribute('aria-label',mediaTypes[post.kind]);const stage=el('div','profile-viewer');let index=0;
  const count=el('span','profile-count'),bar=el('div','profile-viewer-controls');
  const show=()=>{stage.querySelectorAll('video').forEach(v=>v.pause());stage.replaceChildren();release(dialogUrls);stage.append(media(post.files[index],dialogUrls));count.textContent=`${index+1} / ${post.files.length}`;previous.disabled=index===0;next.disabled=index===post.files.length-1;};
  const previous=button('Назад','back',()=>{index--;show();}),next=button('Далее','arrow',()=>{index++;show();});bar.append(previous,count,next);bar.hidden=post.files.length===1;
  const del=button('Удалить материал',null,async()=>{if(!confirm('Удалить этот материал с устройства?'))return;del.disabled=true;try{if(await persist({...data,posts:data.posts.filter(p=>p.id!==post.id)},owner,token)){closeDialog();render();}}catch(e){ctx.notify(errorText(e));}finally{del.disabled=false;}});
  ownDialog.append(stage,bar,el('p','profile-caption',post.caption),del);show();
 }
 function grid(){
  const toolbar=el('div','profile-grid-heading');toolbar.append(el('h2','','Материалы'),button('Добавить','plus',addMedia));body.append(toolbar);
  const filters=el('div','profile-filters');filters.setAttribute('aria-label','Формат материалов');for(const [key,label,symbol] of [['all','Все','feed'],...Object.entries(mediaTypes).map(([k,v])=>[k,v,k])]){const b=button(label,symbol,()=>{filter=key;render();},'profile-filter');b.setAttribute('aria-pressed',String(filter===key));filters.append(b);}body.append(filters);
  if(!loaded){empty(ctx.account?'Загружаем профиль':'Твой профиль','Аватар, анкета и личные материалы.');if(!ctx.account)body.append(button('Войти в SEKKES','profile',()=>ctx.runtime()?.accountAction()));return;}
  const posts=(data?.posts||[]).filter(p=>filter==='all'||p.kind===filter);if(!posts.length){empty('Пока нет материалов','Добавь фото, видео, карусель или сторис.');return;}
  const list=el('div','profile-media-grid');
  for(const post of posts){const b=el('button','profile-tile');b.type='button';b.setAttribute('aria-label',mediaTypes[post.kind]+(post.caption?': '+post.caption:''));b.onclick=()=>openPost(post);
   const file=post.files[0];if(file.type.startsWith('image/')){const img=el('img');img.src=url(file);img.alt=post.caption||mediaTypes[post.kind];img.loading='lazy';b.append(img);}else{const cover=el('span','profile-video-cover');cover.innerHTML=icon('video');b.append(cover);}
   const badge=el('span','profile-type');badge.innerHTML=icon(post.kind);badge.append(el('span','',post.kind==='carousel'?String(post.files.length):mediaTypes[post.kind]));b.append(badge);list.append(b);
  }body.append(list);
 }
 function settings(){header('Настройки профиля');const group=el('div','settings-group');
  group.append(row({title:'Мой прогресс',description:'Личный путь',iconName:'progress',action:()=>setView('progress')}),row({title:'Сохранённые разговоры',description:'Твоя переписка с SEKKES',iconName:'chat',action:()=>ctx.showConversation()}),row({title:'Любимые пространства',iconName:'heart',action:()=>setView('favorites')}),row({title:'Достижения',iconName:'spark',action:()=>setView('achievements')}),row({title:'Личные настройки',description:'Анкета, вход и голос помощника',iconName:'profile',action:()=>setView('personal')}));body.append(group);
 }
 function personal(){header('Личные настройки');const group=el('div','settings-group');group.append(row({title:'Редактировать анкету и аватар',iconName:'edit',action:edit}),row({title:'Face ID / ключ доступа',iconName:'shield',action:()=>ctx.runtime()?.faceIdSettings()}),row({title:'Голос помощника',iconName:'sound',action:()=>ctx.runtime()?.voiceSettings()}),row({title:'Оформление приложения',iconName:'settings',action:()=>ctx.navigate('settings')}),row({title:ctx.account?'Выйти из аккаунта':'Войти в SEKKES',iconName:'profile',action:()=>ctx.runtime()?.accountAction()}));body.append(group);}
 function setView(next){closeDialog();view=next;body.scrollTop=0;render();}
 function render(){
  if(disposed)return;body.querySelectorAll('video').forEach(v=>v.pause());release(urls);body.replaceChildren();
  for(const b of nav.children){const current=b.dataset.view===view||(b.dataset.view==='settings'&&['personal','progress','favorites','achievements'].includes(view));if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  if(view==='settings')return settings();if(view==='personal')return personal();
  if(['progress','favorites','achievements','channels','community'].includes(view)){
   const labels={progress:['Мой прогресс','Пока без оценок','Отслеживание прогресса ещё не доступно.'],favorites:['Любимые пространства','Твои пространства','Перейти к играм и живому миру можно ниже.'],achievements:['Достижения','Твой путь продолжается','Система достижений ещё не доступна.'],channels:['Каналы','Скоро здесь','Каналы пока недоступны.'],community:['Сообщество','Скоро здесь','Общение с участниками пока недоступно.']}[view];header(labels[0]);empty(labels[1],labels[2]);if(view==='favorites'){body.append(button('Игры','games',()=>ctx.navigate('games')),button('Живой мир','world',()=>ctx.navigate('world')));}return;
  }
  if(view==='feed'){header('Лента');body.append(el('p','profile-note','Твои материалы на этом устройстве.'));grid();return;}
  const top=el('div','profile-identity');const avatar=button('Изменить фото','profile',edit,'profile-avatar');avatar.setAttribute('aria-label','Изменить фото профиля');avatar.replaceChildren();
  if(data?.avatar){const img=el('img');img.src=url(data.avatar);img.alt='Фото профиля';avatar.append(img);}else{const initials=(data?.name||ctx.account?.user_metadata?.full_name||ctx.account?.user_metadata?.name||'').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('');if(initials)avatar.append(el('span','profile-initials',initials));else avatar.innerHTML=icon('profile');}
  const pencil=el('span','profile-avatar-edit');pencil.innerHTML=icon('edit');avatar.append(pencil);
  const name=data?.name||ctx.account?.user_metadata?.full_name||ctx.account?.user_metadata?.name||'Твой профиль';top.append(avatar,el('h1','profile-display-name',name));
  if(data?.bio)top.append(el('p','profile-bio',data.bio));else top.append(button('Добавить описание','edit',edit,'profile-edit-link'));
  const details=[data?.city,data?.interests].filter(Boolean).join(' · ');if(details)top.append(el('p','profile-details',details));body.append(top);grid();
 }
 for(const [id,label,symbol] of [['settings','Настройки профиля','settings'],['feed','Лента','feed'],['channels','Каналы','channels'],['community','Сообщество','community']]){const b=button(label,symbol,()=>setView(id),'profile-nav-item');b.dataset.view=id;nav.append(b);}
 async function update(){const token=++epoch;uid=ctx.account?.id||null;loaded=false;data=null;closeDialog();render();if(!uid)return;try{const result=await store.load(uid);if(token!==epoch||disposed)return;data=result;loaded=true;render();}catch(e){if(token===epoch&&!disposed){empty('Не удалось открыть профиль',errorText(e));}}}
 ctx.profileUpdate=update;update();
 return {node,dispose(){disposed=true;epoch++;closeDialog();release(urls);store.close();ctx.profileUpdate=null;}};
}

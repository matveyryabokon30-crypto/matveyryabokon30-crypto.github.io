/* Personal invitations. Capability fragments never enter routing, logs, or service-worker messages. */
(function(root){
 'use strict';
 const KEY='pablicus:pending-invite',TTL=30*60*1000,TOKEN=/^[a-f0-9]{64}$/;
 let pending=null;
 function forget(){pending=null;try{root.sessionStorage.removeItem(KEY);}catch{}}
 function persist(){try{if(pending)root.sessionStorage.setItem(KEY,JSON.stringify(pending));else root.sessionStorage.removeItem(KEY);}catch{}}
 function capture(){
  const hash=root.location.hash||'';
  if(/^#invite(?:=|&|$)/.test(hash)){
   forget();const match=/^#invite=([a-f0-9]{64})$/.exec(hash);
   try{root.history.replaceState(root.history.state,'',root.location.pathname+root.location.search);}catch{return false;}
   if(match){pending={token:match[1],until:Date.now()+TTL,owner:null};persist();}return true;
  }
  if(!pending){try{const value=JSON.parse(root.sessionStorage.getItem(KEY));if(value&&TOKEN.test(value.token)&&value.until>Date.now()&&value.until<=Date.now()+TTL&&(!value.owner||typeof value.owner==='string'))pending=value;else forget();}catch{forget();}}
  return false;
 }
 capture();
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function create(options={}){
  const panel=el('dialog','peoplePicker personalInvites');panel.setAttribute('aria-label','Приглашения');
  const head=el('header','peopleHeader'),title=el('h2','','Приглашения'),exit=el('button','peopleClose','×');exit.type='button';exit.setAttribute('aria-label','Закрыть приглашения');head.append(title,exit);
  const help=el('p','peopleHint'),status=el('p','peopleStatus'),actions=el('div','inviteActions'),list=el('div','inviteList');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(head,help,status,actions,list);
  let owner=null,generation=0,busy=false,focus=null,generated=null,person=null,mode='manage',seen=null;
  const account=()=>options.getUser?.()?.id||null;
  const current=(g,u)=>panel.open&&generation===g&&owner===u&&account()===u;
  function button(text,handler){const b=el('button','discoveryAction',text);b.type='button';b.onclick=handler;return b;}
  function controls(){for(const b of panel.querySelectorAll('button'))if(b!==exit)b.disabled=busy;}
  function close({keepPending=false}={}){generation++;busy=false;owner=null;generated=null;person=null;actions.replaceChildren();list.replaceChildren();status.textContent='';if(!keepPending)forget();if(panel.open)panel.close();if(focus?.isConnected)focus.focus({preventScroll:true});}
  function clear({preserveUnbound=false}={}){const keep=preserveUnbound&&pending&&!pending.owner;seen=null;close({keepPending:keep});}
  function begin(next){generation++;busy=false;generated=null;person=null;owner=account();if(!owner)return false;mode=next;focus=document.activeElement;actions.replaceChildren();list.replaceChildren();status.textContent='';if(!panel.isConnected)document.body.append(panel);if(!panel.open)panel.showModal();return true;}
  function failure(error,action){if(error==='self_invite')return 'Это ваше приглашение. Отправьте его другому человеку.';if(error==='rate_limited'||error==='limit_reached')return 'Достигнут лимит приглашений. Отзовите ненужные ссылки или попробуйте позже.';if(error==='not_allowed')return 'Для приглашения нужно войти в одобренный аккаунт Pablicus.';if(error==='unavailable')return 'Приглашение недоступно: оно могло истечь, быть отозвано или уже использовано.';return action==='create'?'Ответ не получен. Проверьте список приглашений перед повторным созданием.':'Не удалось выполнить запрос. Проверьте соединение и попробуйте снова.';}
  async function run(action,input,done){
   if(busy||!owner)return;if(account()!==owner){clear();return;}const g=++generation,u=owner;busy=true;controls();status.textContent='Подождите…';let timer;
   try{const response=await Promise.race([Promise.resolve(options.client.rpc('pablicus_invites',{p_action:action,p_input:input})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000);})]);if(!current(g,u))return;const data=response?.data;if(response.error||!data||data.ok!==true){const e=Error('request');e.code=data?.error;throw e;}done(data);}
   catch(e){if(current(g,u))status.textContent=failure(e.code,action);}
   finally{clearTimeout(timer);if(current(g,u)){busy=false;controls();}else if(panel.open&&account()!==owner)clear();}
  }
  async function shareGenerated(copyOnly=false){
   if(busy||!generated)return;if(account()!==owner){clear();return;}const g=generation,u=owner,url=generated;
   try{if(!copyOnly&&root.navigator.share){try{await root.navigator.share({title:'Pablicus',text:'Приглашаю тебя в Pablicus. Эта ссылка для одного человека и действует 7 дней.',url});if(current(g,u))status.textContent='Приглашение передано в выбранное приложение.';return;}catch(e){if(e?.name==='AbortError'){if(current(g,u))status.textContent='Отправка отменена. Ссылка остаётся доступна до закрытия окна.';return;}}}
    if(!current(g,u))return;await root.navigator.clipboard.writeText(url);if(current(g,u))status.textContent='Ссылка скопирована. Отправьте её одному человеку.';
   }catch{if(current(g,u))status.textContent='Не удалось скопировать ссылку. Используйте поле ссылки ниже.';}
  }
  function manager(){
   title.textContent='Приглашения';help.textContent='Создайте ссылку для одного человека. Она действует 7 дней; её можно отозвать. Принять сможет первый получатель ссылки. Ссылка не открывает доступ к закрытым аккаунтам и чатам.';actions.replaceChildren();
   actions.append(button('Создать приглашение',()=>run('create',{},data=>{if(!TOKEN.test(data.token))throw Error('response');const url=new root.URL(root.PablicusInvite?.canonical?.()||'https://matveyryabokon30-crypto.github.io/vision-talk/pablicus/');url.search='';url.hash='invite='+data.token;generated=url.href;actions.replaceChildren();const field=el('input','inviteLink');field.type='text';field.readOnly=true;field.value=generated;field.setAttribute('aria-label','Ссылка приглашения');actions.append(button('Отправить приглашение',()=>shareGenerated()),button('Копировать ссылку',()=>shareGenerated(true)),field,button('Вернуться к списку',()=>{generated=null;manager();refresh();}));status.textContent='Ссылка готова. Выберите «Отправить приглашение» или скопируйте её. После закрытия окна ссылку нельзя восстановить; приглашение можно отозвать в списке.';})),button('Обновить список',()=>refresh()),button('Поделиться обычной ссылкой Pablicus',async()=>{if(busy||account()!==owner)return;const g=generation,u=owner;try{const sent=await (options.onGenericShare?options.onGenericShare():root.PablicusInvite?.share?.());if(current(g,u))status.textContent=sent?'Ссылка передана или скопирована.':'Отправка отменена или недоступна.';}catch{if(current(g,u))status.textContent='Не удалось поделиться ссылкой.';}}));
  }
  function paintList(data,append=false){if(!append)list.replaceChildren();for(const b of list.querySelectorAll('button'))if(b.dataset?.inviteMore)b.remove();const statuses={active:'Действует',accepted:'Принято',revoked:'Отозвано',expired:'Срок истёк'};for(const item of (data.invites||[]).slice(0,50)){const row=el('div','inviteRow'),date=new Date(item.created_at),label=el('p','peopleHint',(statuses[item.status]||'Недоступно')+(Number.isNaN(date.getTime())?'':' · '+date.toLocaleString('ru-RU')));row.append(label);if(['active','accepted'].includes(item.status))row.append(button('Отозвать',()=>run('revoke',{id:item.id},()=>{generated=null;row.replaceChildren(el('p','peopleHint','Отозвано'));status.textContent='Приглашение отозвано. Уже начатые разговоры сохраняются.';})));list.append(row);}if(data.next_cursor){const more=button('Показать ещё',()=>run('list',{before_id:data.next_cursor},value=>paintList(value,true)));more.dataset.inviteMore='true';list.append(more);}status.textContent=data.feature_enabled===false?'Приглашения временно недоступны. Ранее созданные ссылки можно отозвать.':list.children.length?'Ссылки не сохраняются в списке. Здесь можно проверить состояние и отозвать приглашение.':'У вас пока нет приглашений.';}
  function refresh(){return run('list',{},paintList);}
  async function open(){if(!begin('manage'))return;manager();await refresh();}
  function accepted(who){person=who;forget();actions.replaceChildren();help.textContent='Приглашение принято. Сообщения не отправлялись.';status.textContent=String(person?.display_name||person?.username||'Пользователь');actions.append(button('Открыть чат',async()=>{if(busy||!person||account()!==owner)return;const g=++generation,u=owner;busy=true;controls();try{await options.onOpen?.(person,{isCurrent:()=>current(g,u)});if(current(g,u))close();}catch{if(current(g,u))status.textContent='Не удалось открыть чат. Попробуйте снова.';}finally{if(current(g,u)){busy=false;controls();}else if(panel.open&&account()!==owner)clear();}}));}
  async function ready(){
   if(!pending)return;if(pending.until<=Date.now()){forget();return;}const u=account();if(!u)return;if(pending.owner&&pending.owner!==u){clear();return;}if(seen===pending.token&&panel.open)return;
   pending.owner=u;persist();seen=pending.token;if(!begin('receive'))return;title.textContent='Вас приглашают в Pablicus';help.textContent='Приглашение не отправляет сообщений и не добавляет вас в чаты автоматически.';
   const token=pending.token;
   const inspect=()=>run('inspect',{token},data=>{const invite=data.invite;if(invite.status==='accepted'){accepted(invite.inviter);return;}person=invite.inviter;status.textContent='Приглашает: '+String(person?.display_name||person?.username||'Пользователь');actions.replaceChildren(button('Принять приглашение',()=>run('accept',{token},value=>accepted(value.inviter))),button('Не сейчас',()=>close()));});
   actions.append(button('Проверить приглашение',inspect),button('Не сейчас',()=>close()));await inspect();
  }
  exit.onclick=()=>close();panel.addEventListener('cancel',event=>{event.preventDefault();close();});
  const changed=()=>{if(capture()){if(pending)void ready();else close();}};root.addEventListener?.('hashchange',changed);
  return{open,ready,clear,close,mount(parent=document.body){const launch=button('Личные приглашения',open);parent.append(launch);return launch;}};
 }
 function guestNotice(){if(!pending)return;const host=document.getElementById?.('loginForm');if(host&&!document.getElementById('personalInviteLoginHint')){const note=el('p','muted','Войдите в Pablicus, чтобы просмотреть и принять приглашение. После регистрации при необходимости откройте приглашение ещё раз.');note.id='personalInviteLoginHint';host.prepend(note);}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',guestNotice,{once:true});else guestNotice();
 root.PablicusPersonalInvites=Object.freeze({create,capture});
})(typeof window!=='undefined'?window:globalThis);

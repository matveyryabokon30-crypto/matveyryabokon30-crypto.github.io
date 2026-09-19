/* Explicit, recipient-consented contact discovery. Selected identifiers live only in this dialog. */
(function(root){
 'use strict';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function create(options={}){
  const panel=el('dialog','peoplePicker discoveryPicker');panel.setAttribute('aria-label','Контакты');
  const header=el('header','peopleHeader'),title=el('h2','','Контакты'),exit=el('button','peopleClose','×');exit.type='button';exit.setAttribute('aria-label','Закрыть контакты');header.append(title,exit);
  const help=el('p','peopleHint','Поиск по контактам работает только с отдельного согласия обеих сторон. Вы выбираете контакты сами.');
  const form=el('form','discoveryPreferences'),checks={};
  const labels={search_enabled:'Разрешаю искать выбранные мной контакты',discoverable_email:'Меня можно найти по подтверждённой почте',discoverable_phone:'Меня можно найти по подтверждённому телефону'};
  for(const [key,text] of Object.entries(labels)){const label=el('label','discoveryChoice'),input=el('input');input.type='checkbox';input.name=key;checks[key]=input;label.append(input,el('span','',text));form.append(label);}
  const save=el('button','discoveryAction','Сохранить согласия');save.type='submit';form.append(save);
  const picker=el('button','discoveryAction','Выбрать контакты'),review=el('div','discoveryReview'),reviewText=el('p','peopleHint'),confirm=el('button','discoveryAction','Найти выбранные контакты'),cancel=el('button','discoveryAction','Отменить выбор');picker.type=confirm.type=cancel.type='button';review.append(reviewText,confirm,cancel);review.hidden=true;
  const support=el('p','peopleHint'),status=el('p','peopleStatus'),results=el('div','peopleResults');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const hidden=el('div','discoveryHidden');
  const fallback=el('div','discoveryFallback'),search=el('button','discoveryAction','Поиск по имени'),share=el('button','discoveryAction','Поделиться моим профилем');search.type=share.type='button';fallback.append(search,share);
  panel.append(header,help,form,picker,review,support,status,results,hidden,fallback);
  let epoch=0,generation=0,owner=null,state=null,selected=[],properties=[],busy=false,previousFocus=null;
  const account=()=>options.getUser?.()?.id||null;
  const current=(token,user)=>panel.open&&token===generation&&account()===user&&owner===user;
  function clearSelection(){selected=[];review.hidden=true;reviewText.textContent='';}
  function controls(){save.disabled=busy||!state;picker.disabled=busy||(!state?.search_enabled||state?.feature_enabled===false)||!properties.length;confirm.disabled=busy||!selected.length;for(const key of Object.keys(checks))checks[key].disabled=busy||!state||(key==='discoverable_email'&&!state.verified_email)||(key==='discoverable_phone'&&!state.verified_phone);}
  function reset(){epoch++;generation++;owner=null;state=null;busy=false;clearSelection();results.replaceChildren();hidden.replaceChildren();status.textContent='';for(const input of Object.values(checks))input.checked=false;controls();}
  function close(){reset();if(panel.open)panel.close();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
  function paint(value){state=value;help.textContent='Поиск по контактам работает только с отдельного согласия обеих сторон. Вы выбираете контакты сами.'+(!value.verified_email?' Чтобы вас находили по почте, она должна быть подтверждена.':'')+(!value.verified_phone?' Поиск вас по телефону доступен только после подтверждения номера. Номер в профиле сам по себе не подтверждён.':'');hidden.replaceChildren();if(Array.isArray(value.hidden)&&value.hidden.length){hidden.append(el('p','peopleHint','Скрыты только из поиска контактов. Это не блокировка сообщений.'));for(const person of value.hidden){const row=el('div','discoveryHiddenRow'),name=el('span','',String(person.display_name||person.username||'Пользователь')),restore=el('button','discoveryAction','Вернуть в поиск');restore.type='button';restore.onclick=()=>run('unhide',{target_id:person.id},data=>{paint(data);status.textContent='Контакт возвращён в поиск.';});row.append(name,restore);hidden.append(row);}}for(const key of Object.keys(checks))checks[key].checked=Boolean(value[key])&&(key!=='discoverable_email'||Boolean(value.verified_email))&&(key!=='discoverable_phone'||Boolean(value.verified_phone));controls();}
  async function rpc(action,input,token,user){
   let timer;try{const response=await Promise.race([Promise.resolve(options.client.rpc('pablicus_discovery',{p_action:action,p_input:input})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000);})]);if(!current(token,user))return null;if(response.error||!response.data||typeof response.data!=='object')throw Error('rpc');if(response.data.ok===false||response.data.error){const error=Error('rpc');error.code=response.data.error||response.data.reason;throw error;}return response.data;}finally{clearTimeout(timer);}
  }
  async function run(action,input,done){
   if(busy||!owner||account()!==owner){if(account()!==owner)close();return;}const token=++generation,user=owner;busy=true;controls();status.textContent='Подождите…';
   try{const data=await rpc(action,input,token,user);if(data&&current(token,user))done(data);}
   catch(error){if(current(token,user)){if(['conflict','revision_conflict'].includes(error.code)){try{const fresh=await rpc('state',{},token,user);if(fresh&&current(token,user))paint(fresh);}catch{}if(current(token,user))status.textContent='Согласия изменились. Проверьте актуальные настройки и сохраните снова.';}else status.textContent=error.code==='rate_limited'?'Слишком много запросов. Попробуйте позже.':['disabled','unavailable'].includes(error.code)?'Поиск по контактам временно недоступен.':error.code==='verification_required'?'Сначала подтвердите почту или номер в аккаунте.':'Не удалось выполнить запрос. Проверьте соединение и попробуйте ещё раз.';}}
   finally{if(current(token,user)){busy=false;controls();}else if(panel.open&&account()!==owner)close();}
  }
  async function open(){
   reset();owner=account();if(!owner)return;previousFocus=document.activeElement;if(!panel.isConnected)document.body.append(panel);if(!panel.open)panel.showModal();properties=[];support.textContent='';
   const token=generation,user=owner,openedEpoch=epoch;
   const contactAPI=root.navigator?.contacts;
   if(contactAPI&&typeof contactAPI.select==='function'&&typeof contactAPI.getProperties==='function'){
    Promise.resolve().then(()=>contactAPI.getProperties()).then(supported=>{if(panel.open&&epoch===openedEpoch&&owner===user&&account()===user){properties=['tel','email'].filter(key=>supported.includes(key));support.textContent=properties.length?'Перед поиском вы увидите количество выбранных адресов и номеров. Номера — с кодом страны, например +7…':'Выбор контактов недоступен. Используйте поиск по имени или ссылку профиля.';controls();}}).catch(()=>{if(panel.open&&epoch===openedEpoch&&owner===user&&account()===user){support.textContent='Выбор контактов недоступен. Используйте поиск по имени или ссылку профиля.';}});
   }else support.textContent='Этот браузер не предоставляет выбор контактов. Используйте поиск по имени или ссылку профиля.';
   await run('state',{},data=>{paint(data);status.textContent='Согласия можно изменить в любой момент.';});
  }
  form.onsubmit=event=>{event.preventDefault();clearSelection();results.replaceChildren();const input={expected_revision:state?.revision};for(const key of Object.keys(checks))input[key]=checks[key].checked;run('preferences',input,data=>{paint(data);status.textContent='Согласия сохранены.';});};
  picker.onclick=async()=>{
   if(busy||(!state?.search_enabled||state?.feature_enabled===false)||!properties.length)return;if(account()!==owner){close();return;}clearSelection();results.replaceChildren();const token=++generation,user=owner;busy=true;controls();
   try{const contacts=await root.navigator.contacts.select(properties,{multiple:true});if(!current(token,user))return;const values=[],seen=new Set();selection: for(const contact of contacts){for(const key of properties){for(const raw of contact[key]||[]){const value=String(raw).trim();const kind=key==='tel'?'phone':'email';const unique=kind+':'+value.toLowerCase();if(value&&value.length<=320&&!seen.has(unique)){seen.add(unique);values.push({kind,value});if(values.length>20)break selection;}}}}if(values.length>20){status.textContent='Выберите меньше контактов: за один поиск можно проверить до 20 адресов и номеров.';return;}selected=values;review.hidden=!selected.length;reviewText.textContent=selected.length?`Будет отправлено адресов и номеров: ${selected.length}. Они используются для этого поиска; адресная книга не сохраняется. Продолжить?`:'';status.textContent=selected.length?'Подтвердите поиск выбранных контактов.':'В выбранных контактах нет адресов или номеров.';}
   catch{if(current(token,user))status.textContent='Выбор контактов отменён или недоступен.';}
   finally{if(current(token,user)){busy=false;controls();}else if(panel.open&&account()!==owner)close();}
  };
  confirm.onclick=()=>{if(busy||!selected.length)return;const identifiers=selected;clearSelection();run('match',{identifiers},data=>{results.replaceChildren();const people=Array.isArray(data.matches)?data.matches:[];for(const person of people.slice(0,20)){if(!person?.id)continue;const button=el('button','peoplePerson',String(person.display_name||person.username||'Пользователь'));button.type='button';button.onclick=async()=>{if(busy)return;if(account()!==owner){close();return;}const token=++generation,user=owner;busy=true;controls();try{await options.onOpen?.(person,{isCurrent:()=>current(token,user)});if(current(token,user))close();}catch{if(current(token,user))status.textContent='Не удалось открыть контакт. Попробуйте ещё раз.';}finally{if(current(token,user)){busy=false;controls();}}};const row=el('div','discoveryResult'),hide=el('button','discoveryAction','Скрыть из поиска');hide.type='button';hide.onclick=()=>run('hide',{target_id:person.id},data=>{row.remove();paint(data);status.textContent='Контакт скрыт из поиска. Сообщения не заблокированы.';});row.append(button,hide);results.append(row);}status.textContent=results.children.length?`Найдено: ${results.children.length}`:'Совпадений нет. Поиск показывает только людей, разрешивших находить себя.';});};
  cancel.onclick=()=>{clearSelection();controls();status.textContent='Выбор отменён.';};exit.onclick=close;panel.addEventListener('cancel',event=>{event.preventDefault();close();});
  search.onclick=()=>{close();options.onSearch?.();};share.onclick=async()=>{try{await options.onShare?.();close();}catch{if(panel.open)status.textContent='Не удалось поделиться профилем. Попробуйте ещё раз.';}};
  return{open,close,clear:close,mount(parent=document.body){if(!panel.isConnected)document.body.append(panel);const launch=el('button','discoveryAction','Поиск по контактам');launch.type='button';launch.onclick=open;parent.append(launch);return launch;},get opened(){return panel.open;}};
 }
 root.PablicusContactDiscovery={create};
})(typeof window!=='undefined'?window:globalThis);

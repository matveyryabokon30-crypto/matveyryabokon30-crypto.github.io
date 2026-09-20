import {sections,routeId} from './registry.mjs';
import {icon,el} from './components.mjs';
import {message} from './rich-message.mjs';
import {watchPreferences} from './preferences.mjs';
const $=s=>document.querySelector(s);
let mounted=false;
export function initialize(){
 if(mounted)return;mounted=true;
 const lifetime=new AbortController(),signal=lifetime.signal,cache=new Map(),pendingMessages=[];
 let generation=0,current=null,voice='idle',previousFocus=null;
 const app=$('#shell'),host=$('#routeHost'),menu=$('#sideMenu'),trigger=$('#navigationTrigger'),dialog=$('#dialog'),composer=$('#composer'),stop=$('#micTestLink'),status=$('#aiStateLabel');
 const ctx={account:null,messages:null,profileUpdate:null,runtime:()=>window.SekkesS2,
 navigate(id){if(routeId('#'+id)!==id)return;location.hash=id},
 info(title,text){$('#dialogContent').replaceChildren(el('h2','',title),el('p','',text));$('#dialogContent').firstChild.id='dialogTitle';if(!dialog.open)dialog.showModal()},
 flushMessages(){if(!ctx.messages)return;for(const item of pendingMessages.splice(0))appendMessage(...item)},
 refresh(){if(ctx.runtime()?.busy){notify('Сначала заверши разговор или дождись ответа.');return}if(ctx.runtime()?.dirty&&!confirm('Обновить приложение? Текущий текст на экране будет сброшен.'))return;location.reload()}
 };
 function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').hidden=true,6500)}
 function showImage(url,alt){const img=el('img','viewer-image');img.src=url;img.alt=alt;$('#dialogContent').replaceChildren(el('h2','',alt),img);$('#dialogContent').firstChild.id='dialogTitle';dialog.showModal()}
 function appendMessage(role,text){if(!ctx.messages){pendingMessages.push([role,text]);return}const list=ctx.messages;const atEnd=list.scrollHeight-list.scrollTop-list.clientHeight<100;$('#chatEmpty')?.remove();list.append(message(role,text,{showImage}));if(atEnd)list.scrollTop=list.scrollHeight;$('#chatAnnouncement').textContent=role==='ai'?'Получен ответ SEKKES':'';}
 function updateVoice(state){voice=state;app.dataset.voice=state;const active=['connecting','live','listening','speaking'].includes(state),waiting=['closing','recovering','finalizing'].includes(state);stop.hidden=!(active||waiting||state==='recovery');stop.disabled=waiting;stop.textContent=state==='recovery'?'Завершить прошлый разговор':waiting?'Разговор остановлен · завершение…':state==='connecting'?'Отменить подключение':'Завершить разговор';$('#micButton').hidden=active||waiting||state==='recovery';const start=$('.scene-start');if(start)start.disabled=active||waiting||state==='recovery';}
 window.SekkesUI={status(text){status.textContent=text},voice:updateVoice,render:appendMessage,beforeText(){ctx.navigate('chat')},textBusy(busy){$('#sendButton').disabled=busy;composer.setAttribute('aria-busy',String(busy))},account(user){ctx.account=user;ctx.profileUpdate?.()},reset(){pendingMessages.length=0;ctx.messages?.replaceChildren(el('p','empty-state','Диалог пуст.'));ctx.account=null;ctx.profileUpdate?.()},voiceEvent(event){if(event.type==='response.audio.delta'||event.type==='response.output_audio.delta')updateVoice('speaking');if(event.type==='response.audio.done'||event.type==='response.output_audio.done'||event.type==='input_audio_buffer.speech_started')updateVoice('listening')}};
 const nav=$('#menuItems');for(const s of sections){const a=el('a','menu-item');a.href=s.route;a.innerHTML=icon(s.icon);a.append(el('span','',s.title));a.dataset.route=s.id;nav.append(a)}
 trigger.innerHTML=icon('menu');
 function openMenu(){previousFocus=document.activeElement;menu.hidden=false;menu.append(trigger);app.inert=true;trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-label','Закрыть меню');trigger.innerHTML=icon('close');trigger.focus();}
 function closeMenu(returnFocus=true){if(menu.hidden)return;document.body.append(trigger);menu.hidden=true;app.inert=false;trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Открыть меню');trigger.innerHTML=icon('menu');if(returnFocus)(previousFocus?.isConnected?previousFocus:trigger).focus();}
 trigger.addEventListener('click',()=>menu.hidden?openMenu():closeMenu(),{signal});
 $('#menuBackdrop').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeMenu()},{signal});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu(false)},{signal});
 document.addEventListener('keydown',e=>{if(menu.hidden)return;if(e.key==='Escape'){e.preventDefault();closeMenu()}if(e.key==='Tab'){const focus=[trigger,...nav.querySelectorAll('a')],i=focus.indexOf(document.activeElement),next=e.shiftKey?(i<=0?focus.length-1:i-1):(i+1)%focus.length;e.preventDefault();focus[next].focus()}},{signal});
 $('#dialogClose').innerHTML=icon('close');$('#dialogClose').addEventListener('click',()=>dialog.close(),{signal});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()},{signal});
 composer.addEventListener('submit',e=>{e.preventDefault();ctx.navigate('chat');ctx.runtime()?.sendText()},{signal});
 $('#draft').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();composer.requestSubmit()}},{signal});
 $('#micButton').innerHTML=icon('mic');$('#sendButton').innerHTML=icon('send');stop.addEventListener('click',()=>ctx.runtime()?.toggleMic(),{signal});
 async function route(){const id=routeId(location.hash),ticket=++generation;const descriptor=sections.find(s=>s.id===id);closeMenu(false);try{if(!cache.has(id)){const module=await descriptor.loadModule();if(!cache.has(id))cache.set(id,module.create(ctx))}if(ticket!==generation)return;current=id;host.replaceChildren(cache.get(id).node);app.dataset.route=id;$('#headerTitle').textContent=id==='home'?'sekkes':id==='chat'?'Чат':'sekkes';composer.hidden=!['home','chat'].includes(id);status.hidden=!['home','chat'].includes(id)&&voice==='idle';for(const a of nav.children){if(a.dataset.route===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}updateVoice(voice);document.title=descriptor.title+' · SEKKES';host.focus({preventScroll:true})}catch{notify('Не удалось загрузить раздел. Проверь подключение.')}}
 addEventListener('hashchange',route,{signal});
 function geometry(){const v=window.visualViewport;document.documentElement.style.setProperty('--viewport-height',(v?.height||innerHeight)+'px');document.documentElement.style.setProperty('--viewport-top',(v?.offsetTop||0)+'px')}
 visualViewport?.addEventListener('resize',geometry,{signal});visualViewport?.addEventListener('scroll',geometry,{signal});addEventListener('resize',geometry,{signal});
 document.addEventListener('visibilitychange',()=>app.classList.toggle('document-hidden',document.hidden),{signal});
 addEventListener('offline',()=>notify('Нет сети. Черновик сохранён на экране.'),{signal});
 watchPreferences(signal);geometry();route();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{});
 return {dispose(){lifetime.abort();clearTimeout(notify.timer);for(const screen of cache.values())screen.dispose();cache.clear();window.SekkesUI=null;mounted=false}};
}

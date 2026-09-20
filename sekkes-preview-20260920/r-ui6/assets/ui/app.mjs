import {sections,routeId} from './registry.mjs';
import {icon,el} from './components.mjs';
import {message} from './rich-message.mjs';
import {watchPreferences} from './preferences.mjs';
import {lockViewport} from './viewport.mjs';
import {recordingControl} from './recording-control.mjs';
import {navigation} from './navigation.mjs';
import {dictationControl} from './dictation-control.mjs';
const $=s=>document.querySelector(s);
let mounted=false;
export function initialize({recorderOptions={},dictationOptions={}}={}){
 if(mounted)return;mounted=true;
 const lifetime=new AbortController(),signal=lifetime.signal,cache=new Map(),pendingMessages=[],attachmentURLs=new Set();
 let generation=0,current=null,voice='idle',swRegistration=null,recording,dictation,menu,textPending=false;
 const app=$('#shell'),host=$('#routeHost'),dialog=$('#dialog'),composer=$('#composer'),stop=$('#micTestLink'),status=$('#aiStateLabel'),nav=$('#menuItems');
 const ctx={account:null,messages:null,profileUpdate:null,runtime:()=>window.SekkesS2,
  navigate(id){const target=routeId('#'+id);if(target!==current)location.hash=target},
  showConversation(){ctx.navigate('home');const home=cache.get('home');if(home)home.showConversation()},
  captureChanged(){const busy=Boolean(dictation?.busy);$('#sendButton').disabled=textPending||busy;$('#recordButton').disabled=busy;},
  otherCaptureBusy(){return Boolean(recording?.busy)},dictationBusy(){return Boolean(dictation?.busy)},
  startVoice(){if(recording?.busy||dictation?.busy)return notify('Сначала заверши голосовой ввод.');if(voice==='idle'){ctx.pauseMedia();ctx.runtime()?.toggleMic()}},
  pauseMedia(){document.querySelectorAll('audio').forEach(a=>a.pause())},notify,info(title,text){$('#dialogContent').replaceChildren(el('h2','',title),el('p','',text));$('#dialogContent').firstChild.id='dialogTitle';if(!dialog.open)dialog.showModal()},
  flushMessages(){if(!ctx.messages)return;for(const item of pendingMessages.splice(0))appendMessage(...item)},
  renderVoice(response,clip){appendMessage('user',response.text,clip);appendMessage('ai',response.reply)},
  refresh(){if(ctx.runtime()?.busy||recording?.busy||dictation?.busy){notify('Сначала заверши разговор или дождись ответа.');return}if(ctx.runtime()?.dirty&&!confirm('Обновить приложение? Текущий текст на экране будет сброшен.'))return;if(swRegistration?.waiting){notify('Обновление готово. Закрой вкладки SEKKES Preview и открой приложение снова.');return}swRegistration?.update().catch(()=>{});location.reload()}
 };
 function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').hidden=true,6500)}
 function showImage(url,alt){const img=el('img','viewer-image');img.src=url;img.alt=alt;$('#dialogContent').replaceChildren(el('h2','',alt),img);$('#dialogContent').firstChild.id='dialogTitle';dialog.showModal()}
 function appendMessage(role,text,clip){
  if(!ctx.messages){pendingMessages.push([role,text,clip]);return}const list=ctx.messages,atEnd=list.scrollHeight-list.scrollTop-list.clientHeight<100;$('#chatEmpty')?.remove();const node=message(role,text,{showImage});
  if(clip){const url=URL.createObjectURL(new Blob([clip.bytes],{type:'audio/wav'}));attachmentURLs.add(url);const audio=el('audio');audio.controls=true;audio.src=url;audio.preload='metadata';audio.setAttribute('aria-label','Голосовое сообщение');node.prepend(audio,el('small','','Расшифровка'));}
  list.append(node);const home=cache.get('home');home?.messageAdded();if(atEnd)list.scrollTop=list.scrollHeight;$('#chatAnnouncement').textContent=role==='ai'?'Получен ответ SEKKES':'';
 }
 function updateVoice(state){
  voice=state;app.dataset.voice=state;const active=['connecting','live','listening','speaking'].includes(state),waiting=['closing','recovering','finalizing'].includes(state),busy=active||waiting||state==='recovery';
  stop.hidden=!busy;stop.disabled=waiting;stop.textContent=state==='recovery'?'Завершить прошлый разговор':waiting?'Разговор остановлен · завершение…':state==='connecting'?'Отменить подключение':'Завершить разговор';
  $('#micButton').hidden=busy;$('#recordButton').hidden=busy;const start=$('#voiceSphere');if(start){start.disabled=busy;start.setAttribute('aria-label',busy?'Голосовой разговор активен':'Начать голосовой разговор')}
  const hint=$('#sphereHint');if(hint)hint.textContent=state==='speaking'?'SEKKES отвечает':active?'Я слушаю':waiting?'Разговор остановлен':'Нажми, чтобы говорить';
  status.hidden=current!=='home'&&!busy;
 }
 window.SekkesUI={status(text){status.textContent=text},voice:updateVoice,render:appendMessage,beforeText(){ctx.showConversation()},
  get captureBusy(){return Boolean(recording?.busy||dictation?.busy)},sendRecording(){recording?.send()},
  textBusy(busy){textPending=busy;ctx.captureChanged();composer.setAttribute('aria-busy',String(busy))},account(user){ctx.account=user;ctx.profileUpdate?.()},
  reset(){ctx.pauseMedia();dictation?.cancel();recording?.reset();for(const url of attachmentURLs)URL.revokeObjectURL(url);attachmentURLs.clear();pendingMessages.length=0;ctx.messages?.replaceChildren(el('p','empty-state','Диалог пуст.'));cache.get('home')?.reset();ctx.account=null;ctx.profileUpdate?.()},
  voiceEvent(event){if(event.type==='response.audio.delta'||event.type==='response.output_audio.delta')updateVoice('speaking');if(event.type==='response.audio.done'||event.type==='response.output_audio.done'||event.type==='input_audio_buffer.speech_started')updateVoice('listening')}
 };
 for(const s of sections){const a=el('a','rail-item');a.href=s.route;a.innerHTML=icon(s.icon);a.append(el('span','rail-label',s.title));a.dataset.route=s.id;a.title=s.title;nav.append(a)}
 $('#dialogClose').innerHTML=icon('close');$('#dialogClose').addEventListener('click',()=>dialog.close(),{signal});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()},{signal});
 composer.addEventListener('submit',e=>{e.preventDefault();if(recording.busy||dictation.busy)return;ctx.runtime()?.sendText()},{signal});
 $('#draft').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();composer.requestSubmit()}},{signal});
 $('#recordButton').innerHTML=icon('record');$('#micButton').innerHTML=icon('mic');$('#sendButton').innerHTML=icon('send');stop.addEventListener('click',()=>ctx.runtime()?.toggleMic(),{signal});
 recording=recordingControl(ctx,$('#recordingPanel'),$('#recordButton'),signal,recorderOptions);
 dictation=dictationControl({ctx,button:$('#micButton'),draft:$('#draft'),status:$('#dictationStatus'),signal,options:dictationOptions});
 menu=navigation({root:$('#navigationLayer'),button:$('#menuTrigger'),panel:$('#navigationPanel'),backdrop:$('#menuBackdrop'),app,signal});
 async function route(){
  const id=routeId(location.hash),ticket=++generation,descriptor=sections.find(s=>s.id===id);if(id!=='home'){recording.beforeRoute();dictation.cancel()}menu.close({restoreFocus:false});if(/^#\/?chat$/.test(location.hash))history.replaceState(null,'','#home');if(id!==current)ctx.pauseMedia();
  try{if(!cache.has(id)){const module=await descriptor.loadModule();if(!cache.has(id))cache.set(id,module.create(ctx))}if(ticket!==generation)return;
   const previous=cache.get(current);if(previous)previous.scrollTop=previous.node.querySelector('.messages')?.scrollTop??previous.node.scrollTop;
   current=id;const screen=cache.get(id);host.replaceChildren(screen.node);const scroller=screen.node.querySelector('.messages')||screen.node;scroller.scrollTop=screen.scrollTop||0;
   app.dataset.route=id;$('#headerTitle').textContent='sekkes';composer.hidden=id!=='home';
   for(const a of nav.children){if(a.dataset.route===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}
   updateVoice(voice);document.title=descriptor.title+' · SEKKES';host.focus({preventScroll:true});
  }catch{notify('Не удалось загрузить раздел. Проверь подключение.')}
 }
 addEventListener('hashchange',route,{signal});lockViewport(signal);
 const dockObserver=new ResizeObserver(()=>app.style.setProperty('--dock-height',$('#sessionDock').getBoundingClientRect().height+'px'));dockObserver.observe($('#sessionDock'));
 document.addEventListener('visibilitychange',()=>app.classList.toggle('document-hidden',document.hidden),{signal});
 addEventListener('offline',()=>notify('Нет сети. Черновик сохранён на экране.'),{signal});
 watchPreferences(signal);route();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{swRegistration=reg}).catch(()=>{});
 return {dispose(){lifetime.abort();menu.dispose();dictation.dispose();recording.dispose();dockObserver.disconnect();clearTimeout(notify.timer);for(const url of attachmentURLs)URL.revokeObjectURL(url);for(const screen of cache.values())screen.dispose();cache.clear();window.SekkesUI=null;mounted=false}};
}

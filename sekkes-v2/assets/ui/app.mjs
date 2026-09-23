import {messageTime} from './message-time.mjs';
import {autoUpdate} from './auto-update.mjs';
import {messagePosition,compareMessages} from './message-order.mjs';
import {mountLivingIcons} from './living-icons.mjs';
import {mountTopology} from '../topology-global.mjs';
import {sections,routeId} from './registry.mjs';
import {icon,el} from './components.mjs';
import {message} from './rich-message.mjs';
import {watchPreferences} from './preferences.mjs';
import {lockViewport} from './viewport.mjs';
import {recordingControl} from './recording-control.mjs';
import {navigation} from './navigation.mjs';
import {bindLiveControl,paintLiveIcon} from './live-control.mjs';
const $=s=>document.querySelector(s);
let mounted=false;
export function initialize({recorderOptions={},dictationOptions={}}={}){
 if(mounted)return;mounted=true;
 const lifetime=new AbortController(),signal=lifetime.signal,cache=new Map(),pendingMessages=[],attachmentURLs=new Set();
 const messageRecords=new Map(),resumeKey='sekkes:update-resume:'+location.pathname;
 let resume=null;try{resume=JSON.parse(sessionStorage.getItem(resumeKey)||'null');sessionStorage.removeItem(resumeKey);if(!resume||Date.now()-resume.savedAt>900000)resume=null}catch{}
 let visual;const background=el('div','global-topology');background.id='appTopology';background.setAttribute('aria-hidden','true');document.body.prepend(background);try{visual=mountTopology(background)}catch{/* Decoration cannot block the application. */}
 let generation=0,current=null,voice='idle',swRegistration=null,recording,dictation,menu,textPending=false;
 const app=$('#shell'),host=$('#routeHost'),dialog=$('#dialog'),composer=$('#composer'),stop=$('#micTestLink'),status=$('#aiStateLabel'),nav=$('#menuItems'),recordButton=$('#micButton'),draft=$('#draft'),controls=$('#conversationControls');
 let ownerAllowed=false;
 const modeSwitch=el('div','owner-mode');modeSwitch.hidden=true;nav.after(modeSwitch);
 for(const [id,label]of [['home','Пользователь'],['admin','Админ']]){const b=el('button','owner-button',label);b.type='button';b.addEventListener('click',()=>ctx.navigate(id));modeSwitch.append(b)}
 async function probeOwner(){const uid=ctx.account?.id;ownerAllowed=false;modeSwitch.hidden=true;if(!uid){cache.get('admin')?.reset();return}try{const result=await ctx.runtime()?.ownerRequest?.('status');if(ctx.account?.id!==uid)return;ownerAllowed=result?.owner===true;modeSwitch.hidden=!ownerAllowed;if(ownerAllowed&&location.hash==='#admin')route()}catch{/* Ordinary chat remains available if the admin service is unavailable. */}}
 const ctx={recordButton,account:null,messages:null,profileUpdate:null,runtime:()=>window.SekkesS2,
  navigate(id){const target=routeId('#'+id);if(target!==current)location.hash=target},
  showConversation(){ctx.navigate('home');const home=cache.get('home');if(home)home.showConversation()},
  captureChanged(){updateSend();updateVoice(voice);},
  otherCaptureBusy(){return Boolean(recording?.busy)},dictationBusy(){return Boolean(dictation?.busy)},
  startVoice(){if(recording?.busy||dictation?.busy)return notify('Сначала заверши голосовой ввод.');if(voice==='idle'||voice==='error'){ctx.pauseMedia();ctx.runtime()?.toggleMic()}},
  pauseMedia(){document.querySelectorAll('audio').forEach(a=>a.pause())},notify,info(title,text){$('#dialogContent').replaceChildren(el('h2','',title),el('p','',text));$('#dialogContent').firstChild.id='dialogTitle';if(!dialog.open)dialog.showModal()},
  flushMessages(){if(!ctx.messages)return;for(const item of pendingMessages.splice(0))appendMessage(...item)},
  sendError,
  renderVoice(response){appendMessage('user',response.text);appendMessage('ai',response.reply)},
  refresh(){/* Updates are applied automatically. */}
 };
 function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').hidden=true,6500)}
 function showImage(url,alt){const img=el('img','viewer-image');img.src=url;img.alt=alt;$('#dialogContent').replaceChildren(el('h2','',alt),img);$('#dialogContent').firstChild.id='dialogTitle';dialog.showModal()}
 function appendMessage(role,text,meta={}){
  if(!ctx.messages){pendingMessages.push([role,text,meta]);return;}
  const list=ctx.messages,atEnd=list.scrollHeight-list.scrollTop-list.clientHeight<100;
  const previous=meta.id?[...list.children].find(n=>n.dataset.messageId===meta.id):null;
  const node=message(role,text,{showImage});if(meta.id)node.dataset.messageId=meta.id;node.dataset.at=messagePosition(previous?.dataset.at,meta.at);
  const state=meta.state||((previous?.dataset.delivery==='failed'||previous?.dataset.delivery==='pending')&&meta.at?'sent':previous?.dataset.delivery)||'';
  const stampAt=meta.stampAt||meta.at||(state==='sent'&&previous?.dataset.delivery!=='sent'?new Date().toISOString():previous?.dataset.stampAt)||node.dataset.at;
  node.dataset.stampAt=stampAt;const stamp=messageTime(stampAt,state,role);if(stamp){const time=el('time','message-time',stamp.text);time.dateTime=stamp.iso;time.title=stamp.title;time.setAttribute('aria-label',stamp.title);node.append(time)}
  if(meta.id)messageRecords.set(meta.id,{role,text,meta:{...meta,state,at:node.dataset.at,stampAt}});
  if(state)node.dataset.delivery=state;if(previous)previous.replaceWith(node);else list.append(node);
  cache.get('home')?.messageAdded();if(atEnd)list.scrollTop=list.scrollHeight;
 }
 function sendError(code){
  composer.dataset.error=code||'';
  const labels={BUDGET_STOP:'Достигнут лимит запросов',JOURNAL_SAVE_FAILED:'Не удалось сохранить сообщение',NotAllowedError:'Нет доступа к микрофону',MIC_DENIED:'Нет доступа к микрофону'};
  const label=code?(labels[code]||'Не удалось отправить. Повторить отправку'):'Отправить сообщение';
  $('#sendButton').setAttribute('aria-label',label);$('#sendButton').title=label;if(code)notify(label);
 }
 function updateSend(){
  const hasText=draft.value.trim().length>0,hasAudio=Boolean(recording?.hasAudio);
  $('#sendButton').hidden=!hasText&&!hasAudio;
  $('#sendButton').disabled=textPending||(hasAudio?!recording.canSend:!hasText||Boolean(recording?.busy));
  draft.disabled=Boolean(recording?.capturing||hasAudio);composer.dataset.recording=String(Boolean(recording?.busy||hasAudio));
 }
 function updateVoice(state){
  if(['connecting','live','listening','speaking'].includes(state))cache.get('home')?.hideConversation();
  voice=state;app.dataset.voice=state;const active=['connecting','live','listening','speaking'].includes(state),waiting=['closing','recovering','finalizing'].includes(state),busy=active||waiting||state==='recovery';
  stop.hidden=current!=='home'&&!busy;controls.hidden=current!=='home'&&!busy;
  stop.disabled=waiting||(!busy&&(textPending||Boolean(recording?.busy||dictation?.busy)));
  const label=state==='recovery'?'Завершить прошлый разговор':waiting?'Разговор остановлен · завершение…':state==='connecting'?'Отменить подключение':busy?'Завершить разговор':'Начать голосовой разговор';
  stop.setAttribute('aria-label',label);stop.title=label;stop.setAttribute('aria-pressed',String(active));
  paintLiveIcon(stop,active||waiting||state==='recovery'?'stop':'record',icon);
  $('#micButton').hidden=busy;recordButton.hidden=busy;
  status.hidden=!status.textContent||(current!=='home'&&!busy);
 }
 window.SekkesUI={sendError,history(items,older=false){
   if(!ctx.messages){for(const row of items)pendingMessages.push([row.speaker==='user'?'user':'ai',row.text,{id:row.id,at:row.at}]);return;}const list=ctx.messages,oldHeight=list.scrollHeight,oldTop=list.scrollTop;const oldIds=new Set([...list.children].map(n=>n.dataset.messageId));
   for(const row of items){appendMessage(row.speaker==='user'?'user':'ai',row.text,{id:row.id,at:row.at});const node=[...list.children].find(n=>n.dataset.messageId===row.id);if(node&&!node.dataset.at)node.dataset.at=row.at;}
   [...list.children].sort((a,b)=>compareMessages(a.dataset,b.dataset)).forEach(n=>list.append(n));
   if(older)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else if(oldHeight-oldTop-list.clientHeight<100||!oldIds.size)requestAnimationFrame(()=>{list.scrollTop=list.scrollHeight});
  },status(text){status.textContent=text;status.hidden=!text},voice:updateVoice,render(role,text,meta){ctx.showConversation();appendMessage(role,text,meta);requestAnimationFrame(()=>{if(ctx.messages)ctx.messages.scrollTop=ctx.messages.scrollHeight})},beforeText(){ctx.showConversation()},
  get captureBusy(){return Boolean(recording?.busy||dictation?.busy)},sendRecording(){recording?.send()},
  textBusy(busy){textPending=busy;ctx.captureChanged();composer.setAttribute('aria-busy',String(busy))},account(user){const changed=ctx.account?.id!==user?.id;ctx.account=user;if(changed||!ownerAllowed)void probeOwner();ctx.profileUpdate?.();if(resume&&user?.id===resume.uid){const saved=resume;resume=null;draft.value=saved.draft||'';for(const row of saved.messages||[])appendMessage(row.role,row.text,row.meta);ctx.runtime()?.saveDraft?.();updateSend();if(saved.open)ctx.showConversation();requestAnimationFrame(()=>{if(ctx.messages)ctx.messages.scrollTop=saved.scrollTop||0})}},
  reset(){resume=null;messageRecords.clear();try{sessionStorage.removeItem(resumeKey)}catch{}ctx.pauseMedia();dictation?.cancel();recording?.reset();for(const url of attachmentURLs)URL.revokeObjectURL(url);attachmentURLs.clear();pendingMessages.length=0;ctx.messages?.replaceChildren(el('p','empty-state','Диалог пуст.'));cache.get('home')?.reset();ctx.account=null;void probeOwner();ctx.profileUpdate?.();if(current==='admin')ctx.navigate('home')},
  voiceEvent(event){if(event.type==='response.audio.delta'||event.type==='response.output_audio.delta')updateVoice('speaking');if(event.type==='response.audio.done'||event.type==='response.output_audio.done'||event.type==='input_audio_buffer.speech_started')updateVoice('listening')}
 };
 for(const s of sections.filter(s=>!s.ownerOnly)){const a=el('a','rail-item');a.href=s.route;a.innerHTML=icon(s.icon);a.append(el('span','rail-label',s.title));a.dataset.route=s.id;a.title=s.title;nav.append(a)}
 $('#dialogClose').innerHTML=icon('close');$('#dialogClose').addEventListener('click',()=>dialog.close(),{signal});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()},{signal});
 composer.addEventListener('submit',async e=>{e.preventDefault();if(textPending)return;try{if(recording.hasAudio)await recording.send();else if(draft.value.trim()&&!recording.busy)await ctx.runtime()?.sendText();}finally{updateSend()}},{signal});
 draft.addEventListener('focus',()=>{if(!ctx.runtime()?.voiceActive)ctx.showConversation()},{signal});
 draft.addEventListener('input',()=>{if(!ctx.runtime()?.voiceActive)ctx.showConversation();sendError('');ctx.runtime()?.saveDraft?.();updateSend();},{signal});
 $('#draft').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();composer.requestSubmit()}},{signal});
 recordButton.innerHTML=icon('record');$('#micButton').innerHTML=icon('mic');$('#sendButton').innerHTML=icon('send');bindLiveControl(stop,{signal,state:()=>ctx.runtime()?.voiceActive?'live':voice,start:()=>ctx.startVoice(),stop:()=>{const runtime=ctx.runtime();if(runtime?.stopVoice)runtime.stopVoice();else runtime?.toggleMic()}});
 recording=recordingControl(ctx,$('#recordingPanel'),recordButton,signal,recorderOptions);
 dictation={busy:false,cancel(){},dispose(){}};
 menu=navigation({root:$('#navigationLayer'),button:$('#menuTrigger'),panel:$('#navigationPanel'),backdrop:$('#menuBackdrop'),app,signal});
 async function route(){
  const id=routeId(location.hash);if(id==='admin'&&!ownerAllowed){notify('Админ-кабинет доступен после проверки аккаунта владельца.');if(ctx.account)void probeOwner();if(!current)history.replaceState(null,'','#home');if(!current)void route();return}if(id==='admin'&&(ctx.runtime()?.busy||recording?.busy||dictation?.busy)){notify('Сначала заверши текущий разговор.');return}const ticket=++generation,descriptor=sections.find(s=>s.id===id);if(id!=='home'){recording.beforeRoute();dictation.cancel()}menu.close({restoreFocus:false});if(/^#\/?chat$/.test(location.hash))history.replaceState(null,'','#home');if(id!==current){ctx.pauseMedia();if(current==='admin')cache.get('admin')?.beforeRoute?.();}
  try{if(!cache.has(id)){const module=await descriptor.loadModule();if(!cache.has(id))cache.set(id,module.create(ctx))}if(ticket!==generation)return;
   const previous=cache.get(current);if(previous)previous.scrollTop=previous.node.querySelector('.messages')?.scrollTop??previous.node.scrollTop;
   current=id;const screen=cache.get(id);host.replaceChildren(screen.node);if(id==='admin')void screen.refresh();for(const [i,b]of [...modeSwitch.children].entries())b.setAttribute('aria-pressed',String((i===1)===(id==='admin')));const scroller=screen.node.querySelector('.messages')||screen.node;scroller.scrollTop=screen.scrollTop||0;
   app.dataset.route=id;$('#headerTitle').textContent='sekkes';composer.hidden=id!=='home';
   for(const a of nav.children){a.hidden=a.dataset.route==='home'&&id==='home';if(a.dataset.route===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}
   updateVoice(voice);updateSend();document.title=descriptor.title+' · SEKKES';host.focus({preventScroll:true});
  }catch{notify('Не удалось загрузить раздел. Проверь подключение.')}
 }
 addEventListener('hashchange',route,{signal});lockViewport(signal);
 const dockObserver=new ResizeObserver(()=>app.style.setProperty('--dock-height',$('#sessionDock').getBoundingClientRect().height+'px'));dockObserver.observe($('#sessionDock'));
 document.addEventListener('visibilitychange',()=>app.classList.toggle('document-hidden',document.hidden),{signal});
 addEventListener('offline',()=>notify('Нет сети. Черновик сохранён на экране.'),{signal});
 watchPreferences(signal);let livingIcons;try{livingIcons=mountLivingIcons(document)}catch{/* Vector icons remain usable if the decorative renderer is unavailable. */}route();
 const stopUpdates='serviceWorker' in navigator?autoUpdate({
  canReload:()=>!cache.get('admin')?.busy&&!cache.get('admin')?.dirty&&Boolean(ctx.runtime()?.updateReady)&&!ctx.runtime().busy&&!textPending&&!recording?.busy&&!recording?.hasAudio&&!dictation?.busy&&!dialog.open,
  preserve:()=>{ctx.runtime()?.saveDraft?.();sessionStorage.setItem(resumeKey,JSON.stringify({uid:ctx.account?.id,savedAt:Date.now(),draft:draft.value,messages:[...messageRecords.values()],open:Boolean(ctx.messages&&!ctx.messages.closest('[hidden]')),scrollTop:ctx.messages?.scrollTop||0}))}
 }):()=>{};
 return {dispose(){modeSwitch.remove();stopUpdates();livingIcons?.dispose();visual?.dispose();background.remove();lifetime.abort();menu.dispose();dictation.dispose();recording.dispose();dockObserver.disconnect();clearTimeout(notify.timer);for(const url of attachmentURLs)URL.revokeObjectURL(url);for(const screen of cache.values())screen.dispose();cache.clear();window.SekkesUI=null;mounted=false}};
}


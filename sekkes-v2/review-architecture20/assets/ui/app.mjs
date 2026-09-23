import {createMessageStore} from '/sekkes-v2/review-architecture20/assets/ui/chat/model.mjs';
import {messageActions,deliveryMark,messageKey} from '/sekkes-v2/review-architecture20/assets/ui/message-actions.mjs';
import {interactionPriority} from '/sekkes-v2/assets/ui/interaction-priority.mjs';
import {resizeComposer} from '/sekkes-v2/assets/ui/composer-layout.mjs';
import {chatAttachments} from '/sekkes-v2/assets/ui/chat-attachments.mjs';
import {messageTime} from '/sekkes-v2/assets/ui/message-time.mjs';
import {autoUpdate} from '/sekkes-v2/assets/ui/auto-update.mjs';
import {messagePosition,compareMessages} from '/sekkes-v2/assets/ui/message-order.mjs';
import {mountLivingIcons} from '/sekkes-v2/assets/ui/living-icons.mjs';
import {mountTopology} from '/sekkes-v2/assets/topology-global.mjs';
import {sections,routeId} from '/sekkes-v2/review-architecture20/assets/ui/registry.mjs';
import {icon,el} from '/sekkes-v2/assets/ui/components.mjs';
import {message} from '/sekkes-v2/assets/ui/rich-message.mjs';
import {watchPreferences} from '/sekkes-v2/assets/ui/preferences.mjs';
import {lockViewport} from '/sekkes-v2/review-architecture20/assets/ui/viewport.mjs';
import {recordingControl} from '/sekkes-v2/assets/ui/recording-control.mjs';
import {navigation} from '/sekkes-v2/assets/ui/navigation.mjs';
import {bindLiveControl,paintLiveIcon} from '/sekkes-v2/assets/ui/live-control.mjs';
const $=s=>document.querySelector(s);
let mounted=false;
export function initialize({recorderOptions={},dictationOptions={}}={}){
 if(mounted)return;mounted=true;
 const lifetime=new AbortController(),signal=lifetime.signal,cache=new Map(),pendingMessages=[],attachmentURLs=new Set();
 const messageRecords=createMessageStore('home'),resumeKey='sekkes:update-resume:'+location.pathname;
 let resume=null;try{resume=JSON.parse(sessionStorage.getItem(resumeKey)||'null');sessionStorage.removeItem(resumeKey);if(!resume||Date.now()-resume.savedAt>900000)resume=null}catch{}
 let visual;const background=el('div','global-topology');background.id='appTopology';background.setAttribute('aria-hidden','true');document.body.prepend(background);try{visual=mountTopology(background)}catch{/* Decoration cannot block the application. */}
 let actions,pendingCompose=null;let generation=0,current=null,voice='idle',swRegistration=null,recording,dictation,menu,textPending=false;
 const app=$('#shell'),host=$('#routeHost'),dialog=$('#dialog'),composer=$('#composer'),stop=$('#micTestLink'),status=$('#aiStateLabel'),nav=$('#menuItems'),recordButton=$('#micButton'),draft=$('#draft'),controls=$('#conversationControls');
 interactionPriority(document,signal);let ownerAllowed=false;const files=chatAttachments({composer,request:body=>ctx.runtime().chatMedia(body),changed:()=>updateSend(),notify});
 const modeSwitch=el('div','owner-mode');modeSwitch.hidden=true;app.append(modeSwitch);
 for(const [id,label]of [['home','Пользователь'],['admin','Админ']]){const b=el('button','owner-button');b.innerHTML=id==='admin'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';b.setAttribute('aria-label',label);b.title=label;b.type='button';b.addEventListener('click',()=>ctx.navigate(id));modeSwitch.append(b)}
 async function probeOwner(){const uid=ctx.account?.id;ownerAllowed=false;modeSwitch.hidden=true;if(!uid){cache.get('admin')?.reset();return}try{const result=await ctx.runtime()?.ownerRequest?.('status');if(ctx.account?.id!==uid)return;ownerAllowed=result?.owner===true;modeSwitch.hidden=!ownerAllowed;requestAnimationFrame(positionChatControls);if(ownerAllowed&&location.hash==='#admin')route()}catch{/* Ordinary chat remains available if the admin service is unavailable. */}}
 const ctx={bindMessage:(node,data)=>actions?.bind(node,data),recordButton,account:null,messages:null,profileUpdate:null,runtime:()=>window.SekkesS2,
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
  const list=ctx.messages;
  const previous=meta.id?[...list.children].find(n=>n.dataset.messageId===meta.id):null;
  const fingerprint=JSON.stringify([role,text,meta.state||'',meta.at||'']);if(previous?.dataset.renderKey===fingerprint)return;
  const node=message(role,text,{showImage});node.dataset.renderKey=fingerprint;if(meta.id)node.dataset.messageId=meta.id;node.dataset.at=messagePosition(previous?.dataset.at,meta.at);
  const state=meta.state||((previous?.dataset.delivery==='failed'||previous?.dataset.delivery==='pending')&&meta.at?'sent':previous?.dataset.delivery)||'';
  const stampAt=meta.stampAt||meta.at||(state==='sent'&&previous?.dataset.delivery!=='sent'?new Date().toISOString():previous?.dataset.stampAt)||node.dataset.at;
  node.dataset.stampAt=stampAt;const stamp=messageTime(stampAt,state,role);if(stamp){const time=el('time','message-time',stamp.text);time.dateTime=stamp.iso;time.title=stamp.title;time.setAttribute('aria-label',stamp.title);if(role==='user')time.append(deliveryMark(state||'sent'));node.append(time)}
  actions?.bind(node,{scope:'home',id:meta.id||messageKey('live',null,role+':'+node.dataset.at+':'+JSON.stringify(text)),text:typeof text==='string'?text:node.querySelector('.rich-message')?.textContent||''});
  if(meta.id)messageRecords.set(meta.id,{role,text,meta:{...meta,state,at:node.dataset.at,stampAt}});
  if(state)node.dataset.delivery=state;if(previous)previous.replaceWith(node);else list.append(node);
  cache.get('home')?.messageAdded();
 }
 function sendError(code){
  composer.dataset.error=code||'';
  const labels={BUDGET_STOP:'Достигнут лимит запросов',JOURNAL_SAVE_FAILED:'Не удалось сохранить сообщение',NotAllowedError:'Нет доступа к микрофону',MIC_DENIED:'Нет доступа к микрофону'};
  const label=code?(labels[code]||'Не удалось отправить. Повторить отправку'):'Отправить сообщение';
  $('#sendButton').setAttribute('aria-label',label);$('#sendButton').title=label;if(code)notify(label);
 }
 function resizeDraft(){
  if(composer.hidden||!draft.clientWidth)return;
  resizeComposer(draft,composer,{attachments:files.hasFiles});requestAnimationFrame(positionChatControls);
 }
 function updateSend(){
  resizeDraft();
  const hasText=draft.value.trim().length>0||files.hasFiles,hasAudio=Boolean(recording?.hasAudio);
  $('#sendButton').hidden=!hasText&&!hasAudio;
  files.lock(textPending||Boolean(recording?.busy)||Boolean(ctx.runtime()?.voiceActive));$('#sendButton').disabled=textPending||files.busy||(hasAudio?!recording.canSend:!hasText||Boolean(recording?.busy));
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
 window.SekkesUI={attachments:files,sendError,history(items,older=false){
   if(!ctx.messages){for(const row of items)pendingMessages.push([row.speaker==='user'?'user':'ai',row.text,{id:row.id,at:row.at}]);return;}const list=ctx.messages;ctx.timeline?.change(()=>{
   for(const row of items){appendMessage(row.speaker==='user'?'user':'ai',row.text,{id:row.id,at:row.at});const node=[...list.children].find(n=>n.dataset.messageId===row.id);if(node&&!node.dataset.at)node.dataset.at=row.at;}
   [...list.children].sort((a,b)=>compareMessages(a.dataset,b.dataset)).forEach(n=>list.append(n));
   });
  },status(text){status.textContent=text;status.hidden=!text},voice:updateVoice,render(role,text,meta){ctx.showConversation();appendMessage(role,text,meta);if(role==='user')ctx.timeline?.jump()},beforeText(){ctx.showConversation()},
  get captureBusy(){return Boolean(recording?.busy||dictation?.busy)},sendRecording(){recording?.send()},
  textBusy(busy){textPending=busy;ctx.captureChanged();composer.setAttribute('aria-busy',String(busy))},account(user){const changed=ctx.account?.id!==user?.id;ctx.account=user;if(changed)files.reset();if(changed||!ownerAllowed)void probeOwner();ctx.profileUpdate?.();if(resume&&user?.id===resume.uid){const saved=resume;resume=null;draft.value=saved.draft||'';for(const row of saved.messages||[])appendMessage(row.role,row.text,row.meta);ctx.runtime()?.saveDraft?.();updateSend();if(saved.open)ctx.showConversation();ctx.timeline?.jump()}},
  reset(){files.reset();resume=null;messageRecords.clear();try{sessionStorage.removeItem(resumeKey)}catch{}ctx.pauseMedia();dictation?.cancel();recording?.reset();for(const url of attachmentURLs)URL.revokeObjectURL(url);attachmentURLs.clear();pendingMessages.length=0;ctx.messages?.replaceChildren(el('p','empty-state','Диалог пуст.'));cache.get('home')?.reset();ctx.account=null;void probeOwner();ctx.profileUpdate?.();if(current==='admin')ctx.navigate('home')},
  voiceEvent(event){if(event.type==='response.audio.delta'||event.type==='response.output_audio.delta')updateVoice('speaking');if(event.type==='response.audio.done'||event.type==='response.output_audio.done'||event.type==='input_audio_buffer.speech_started')updateVoice('listening')}
 };
 for(const s of sections.filter(s=>!s.ownerOnly)){const a=el('a','rail-item');a.href=s.route;a.innerHTML=icon(s.icon);a.append(el('span','rail-label',s.title));a.dataset.route=s.id;a.title=s.title;nav.append(a)}
 $('#dialogClose').innerHTML=icon('close');$('#dialogClose').addEventListener('click',()=>dialog.close(),{signal});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()},{signal});
 composer.addEventListener('submit',async e=>{e.preventDefault();if(textPending)return;try{if(recording.hasAudio)await recording.send();else if((draft.value.trim()||files.hasFiles)&&!recording.busy&&!files.busy)await ctx.runtime()?.sendText();}finally{updateSend()}},{signal});
 draft.addEventListener('focus',()=>{if(!ctx.runtime()?.voiceActive)ctx.showConversation();resizeDraft()},{signal});
 draft.addEventListener('input',()=>{if(!ctx.runtime()?.voiceActive)ctx.showConversation();sendError('');ctx.runtime()?.saveDraft?.();updateSend();},{signal});
 draft.addEventListener('blur',resizeDraft,{signal});draft.enterKeyHint='enter'; // Enter always inserts a newline; sending uses the arrow button.
 recordButton.innerHTML=icon('record');$('#micButton').innerHTML=icon('mic');$('#sendButton').innerHTML=icon('send');bindLiveControl(stop,{signal,state:()=>ctx.runtime()?.voiceActive?'live':voice,start:()=>ctx.startVoice(),stop:()=>{const runtime=ctx.runtime();if(runtime?.stopVoice)runtime.stopVoice();else runtime?.toggleMic()}});
 recording=recordingControl(ctx,$('#recordingPanel'),recordButton,signal,recorderOptions);
 const composerTools=el('div','composer-tools');for(const b of [...composer.children].filter(n=>n.matches('button.icon-button')))composerTools.append(b);composer.append(composerTools);
 dictation={busy:false,cancel(){},dispose(){}};
 menu=navigation({root:$('#navigationLayer'),button:$('#menuTrigger'),panel:$('#navigationPanel'),backdrop:$('#menuBackdrop'),app,signal});
 async function route(){
  const id=routeId(location.hash);if(id==='admin'&&!ownerAllowed){notify('Админ-кабинет доступен после проверки аккаунта владельца.');if(ctx.account)void probeOwner();if(!current)history.replaceState(null,'','#home');if(!current)void route();return}if(id==='admin'&&(ctx.runtime()?.busy||recording?.busy||dictation?.busy)){notify('Сначала заверши текущий разговор.');return}const ticket=++generation,descriptor=sections.find(s=>s.id===id);if(id!=='home'){recording.beforeRoute();dictation.cancel()}menu.close({restoreFocus:false});if(/^#\/?chat$/.test(location.hash))history.replaceState(null,'','#home');if(id!==current){ctx.pauseMedia();if(current==='admin')cache.get('admin')?.beforeRoute?.();}
  try{if(!cache.has(id)){const module=await descriptor.loadModule();if(!cache.has(id))cache.set(id,module.create(ctx))}if(ticket!==generation)return;
   const previous=cache.get(current);if(previous)previous.scrollTop=previous.node.querySelector('.messages')?.scrollTop??previous.node.scrollTop;
   current=id;const screen=cache.get(id);host.replaceChildren(screen.node);if(id==='admin')await screen.refresh();for(const [i,b]of [...modeSwitch.children].entries())b.setAttribute('aria-pressed',String((i===1)===(id==='admin')));if(id==='home'){screen.node.append($('#sessionDock'));screen.timeline.layout();}else{app.append($('#sessionDock'));screen.node.scrollTop=screen.scrollTop||0;}
   app.dataset.route=id;$('#headerTitle').textContent='sekkes';composer.hidden=id!=='home';
   for(const a of nav.children){a.hidden=a.dataset.route==='home'&&id==='home';if(a.dataset.route===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}
   updateVoice(voice);updateSend();document.title=descriptor.title+' · SEKKES';if(!document.activeElement?.matches('textarea,input'))host.focus({preventScroll:true});actions?.refresh();if(pendingCompose&&pendingCompose.scope===id){const item=pendingCompose;pendingCompose=null;writeDraft(item.scope,item.text);}
  }catch{notify('Не удалось загрузить раздел. Проверь подключение.')}
 }
 document.addEventListener('sekkes-orientation-reset',()=>{menu.close({restoreFocus:false});actions?.refresh();},{signal});
 addEventListener('hashchange',route,{signal});document.addEventListener('sekkes-viewport-change',()=>{menu.close({restoreFocus:false});resizeDraft();requestAnimationFrame(positionChatControls)},{signal});lockViewport(signal);
 const draftObserver=new ResizeObserver(resizeDraft);draftObserver.observe(app);window.visualViewport?.addEventListener('resize',resizeDraft,{signal});
 function positionChatControls(){
  app.dataset.ownerAllowed=String(ownerAllowed);
  if(modeSwitch.hidden===ownerAllowed)modeSwitch.hidden=!ownerAllowed;
  const admin=current==='admin',form=admin?host.querySelector('.owner-composer'):composer;
  const chat=(current==='home'||admin)&&form&&!form.hidden;
  if(chat){
   const liveButton=admin?form.querySelector('.owner-live'):stop;
   if(!liveButton)return;
   let side=liveButton.closest('.conversation-side');
   if(!side){side=el('div','conversation-side');liveButton.before(side);side.append(liveButton);}
   if(modeSwitch.parentNode!==side)side.prepend(modeSwitch);
   const down=host.querySelector(admin?'.owner-down':'.chat-bottom')||form.querySelector(admin?'.owner-down':'.chat-bottom');
   if(down&&down.parentNode!==form)form.append(down);
   
  }else{
   const target=admin?host.querySelector('.owner-screen'):app;
   if(target&&modeSwitch.parentNode!==target)target.append(modeSwitch);
  }
 }

 const dockObserver=new ResizeObserver(()=>{ctx.timeline?.layout();positionChatControls()});dockObserver.observe($('#sessionDock'));
 let controlsFrame=0;const layoutObserver=new MutationObserver(()=>{if(!controlsFrame)controlsFrame=requestAnimationFrame(()=>{controlsFrame=0;positionChatControls()})});layoutObserver.observe(host,{childList:true,subtree:true});
 document.addEventListener('sekkes-composer-resize',positionChatControls,{signal});window.visualViewport?.addEventListener('resize',positionChatControls,{signal});
 document.addEventListener('visibilitychange',()=>app.classList.toggle('document-hidden',document.hidden),{signal});
 addEventListener('offline',()=>notify('Нет сети. Черновик сохранён на экране.'),{signal});
 function writeDraft(scope,text){if(scope==='admin'){cache.get('admin')?.compose?.(text);return}cache.get('home')?.showConversation();draft.value=text+(draft.value?'\n'+draft.value:'');ctx.runtime()?.saveDraft?.();updateSend();draft.focus({preventScroll:true});}
 actions=messageActions({signal,account:()=>ctx.account,notify,currentScope:()=>current==='home'||current==='admin'?current:null,ownerAllowed:()=>ownerAllowed,compose(scope,text){if(current===scope)writeDraft(scope,text);else{pendingCompose={scope,text};ctx.navigate(scope)}}});
 watchPreferences(signal);let livingIcons;try{livingIcons=mountLivingIcons(document)}catch{/* Vector icons remain usable if the decorative renderer is unavailable. */}route();
 const stopUpdates='serviceWorker' in navigator?autoUpdate({
  canReload:()=>!files.hasFiles&&!files.busy&&!cache.get('admin')?.busy&&!cache.get('admin')?.dirty&&Boolean(ctx.runtime()?.updateReady)&&!ctx.runtime().busy&&!textPending&&!recording?.busy&&!recording?.hasAudio&&!dictation?.busy&&!dialog.open&&!document.querySelector('.message-menu-overlay'),
  preserve:()=>{ctx.runtime()?.saveDraft?.();sessionStorage.setItem(resumeKey,JSON.stringify({uid:ctx.account?.id,savedAt:Date.now(),draft:draft.value,messages:[...messageRecords.values()],open:Boolean(ctx.messages&&!ctx.messages.closest('[hidden]')),scrollTop:ctx.messages?.scrollTop||0}))}
 }):()=>{};
 return {dispose(){files.reset();modeSwitch.remove();stopUpdates();livingIcons?.dispose();visual?.dispose();background.remove();lifetime.abort();menu.dispose();dictation.dispose();recording.dispose();dockObserver.disconnect();draftObserver.disconnect();layoutObserver.disconnect();cancelAnimationFrame(controlsFrame);clearTimeout(notify.timer);for(const url of attachmentURLs)URL.revokeObjectURL(url);for(const screen of cache.values())screen.dispose();cache.clear();window.SekkesUI=null;mounted=false}};
}



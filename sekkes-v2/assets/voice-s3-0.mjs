import {ownerRequest,ownerCode} from './owner-api.mjs';
import {submitChatTurn} from './chat-turn.mjs';
import {AccountSession} from './account-session.mjs';
import {openAccountPanel} from './account-panel.mjs';
import {voiceTrace} from './voice-trace.mjs';
import {sessionCues} from './session-cues.mjs';
import {startTopologyAudio as startLakeVisual} from './topology-global.mjs';
import {VoiceEndCommand} from './voice-end-command.mjs';
import {runtimeConfig,voiceCatalog} from './runtime-config.mjs';
import {restoreConversation} from './ui/chat-session.mjs';
import {LiveTranscript} from './live-transcript.mjs';
import {prepareFinalization} from './voice-finalize.mjs?v=2026.09.20-s3.28';
import {VoiceIdentityHandshake} from './voice-identity.mjs?v=2026.09.21-ui.9.20';
import {VoicePreferences,supabaseVoiceProfile} from './preferences.mjs?v=2026.09.20-s3.28';
import {VoicePicker} from './voice-picker.mjs?v=2026.09.20-s3.28';
import{S3Api,S3Error}from'./s3-api.mjs?v=2026.09.21-ui.9.20';
const $=s=>document.querySelector(s),CONSENT='sekkes-s2-openai-20260918';
const msg={VOICE_PROFILE_CHANGED:'Голос изменён в аккаунте. Настройка обновлена — начни разговор ещё раз.',PROFILE_UNAVAILABLE:'Не удалось загрузить голос из аккаунта. Попробуй ещё раз.',SETUP_REQUIRED:'Сервер SEKKES недоступен.',AUTH_REQUIRED:'Войди в SEKKES.',LOGIN_FAILED:'Почта или пароль не подошли.',LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подожди немного.',OWNER_ONLY:'Этот тест доступен только владельцу.',BUDGET_STOP:'Лимит теста остановил новый запрос.',LIVE_BUSY:'Голосовая сессия уже активна.',PROVIDER_QUOTA:'OpenAI сообщил об ограничении баланса или квоты.',PROVIDER_AUTH_ERROR:'OpenAI отклонил серверный ключ.',model_not_found:'Текущая голосовая модель недоступна для этого API-проекта.',unsupported_model:'Текущая голосовая модель не поддерживает этот режим.',invalid_request_error:'Голосовая сессия отклонена из-за конфигурации.',LIVE_PROVIDER_UNAVAILABLE:'Голосовой сервис сейчас недоступен.',LIVE_UNAVAILABLE:'Не удалось открыть голосовой разговор.',DUPLICATE_TURN:'Этот запрос уже принят сервером. Не отправляй его повторно. Ответ можно проверить после повторного входа.',SERVICE_UNAVAILABLE:'Сервис сейчас недоступен.'};
let account=null,accountPanel=null,accountRestore=null;
let journalId=null,textBusy=false,retryTurn=null;
let transcript=null,historyCursor=null,historyLoading=false,hasMoreHistory=false;
function saveDraft(){if(!api?.user?.id)return;try{const key='sekkes:chat-draft:'+api.user.id;if(draft.value.trim())localStorage.setItem(key,JSON.stringify({text:draft.value,id:retryTurn?.text===draft.value.trim()?retryTurn.id:null}));else localStorage.removeItem(key);}catch{}}
async function syncHistory(older=false){
 if(!logged()||historyLoading)return;historyLoading=true;
 try{const data=await restoreConversation(api,older?historyCursor:null);if(!data)return;
  globalThis.window?.SekkesUI?.history(data.items,older);
  try{const items=await api.request('media');globalThis.window?.SekkesUI?.attachments?.decorate(document.querySelector('#messages'),items)}catch{}
  if(older||!historyCursor){historyCursor=data.items[0]||historyCursor;hasMoreHistory=data.hasMore;}
 }finally{historyLoading=false;}
}
let startup=null,recoveryNeeded=false,recovering=false;
let starting=false,closing=null,unclosedId=null,api=null,config=null,accepted=false,pending=null,live=null,textHistory=[],loginBusy=false,selectedVoice='bossa',preferences=null,picker=null,voiceManifest=null;
const draft=$('#draft'),dialog=$('#dialog'),body=$('#dialogContent');
const status=t=>{if(globalThis.window?.SekkesUI)globalThis.window?.SekkesUI.status(t);else $('#aiStateLabel').textContent=t};
function note(t){const x=$('#toast');x.textContent=t;x.hidden=false;clearTimeout(note.t);note.t=setTimeout(()=>x.hidden=true,6500)}
function fail(e){note(msg[e?.code]||msg.SERVICE_UNAVAILABLE)}
function title(t){return'<div class="kicker">SEKKES</div><h2 id="dialogTitle">'+t+'</h2>'}
function view(html){body.innerHTML=html;dialog.dataset.s3='true';if(!dialog.open)dialog.showModal()}
function logged(){return api?.token&&(Date.now()<api.expiresAt||account?.allowed)}
async function ensure(action){pending=action;if(!api){fail(new S3Error('SETUP_REQUIRED'));return false}if(!logged()&&accountRestore)await accountRestore;if(!logged()){login();return false}try{await account?.ensureFresh();return true}catch(e){fail(e);return false}}
function login(){accountPanel?.dispose();accountPanel=openAccountPanel({account,root:body,show:view,onAuthenticated:()=>{accepted=true;globalThis.window?.SekkesUI?.account(api.user);status('');},onSuccess:()=>finishAccountLogin(),onBusy:value=>{loginBusy=value;}})}
async function finishAccountLogin(){
 if(!logged())return;const epoch=api.authEpoch;
 globalThis.window?.SekkesUI?.account(api.user);accepted=true;status('');
 try{await preferences.load();}catch{note('Настройку голоса загрузим при начале разговора.');}
 if(epoch!==api.authEpoch)return;
 if(transcript?.uid!==api.user.id){transcript?.dispose();transcript=new LiveTranscript({api,uid:api.user.id});}
 // Keep old drafts stored for recovery, but do not insert stale text into a fresh launch.
 try{await transcript.flush();await syncHistory();}catch{/* Saved outbox retries on network recovery. */}
 globalThis.window?.SekkesUI?.textBusy(false);
 if(epoch===api.authEpoch)resumeAfterLogin();
}
function faceIdSettings(){if(!logged())return login();accountPanel?.dispose();accountPanel=openAccountPanel({account,root:body,show:view,enroll:true,onSuccess:()=>dialog.close(),onBusy:value=>{loginBusy=value;}})}
function resumeAfterLogin(){globalThis.window?.SekkesUI?.account(api.user);accepted=true;dialog.close();const action=pending;pending=null;if(action==='live')startLive();if(action==='text')sendText();if(action==='voice-message')globalThis.window?.SekkesUI?.sendRecording();if(action==='settings')voicePicker();}
function render(role,text,meta){if(globalThis.window?.SekkesUI)return globalThis.window?.SekkesUI.render(role,text,meta);let box=$('#s3Transcript');if(!box){box=document.createElement('div');box.id='s3Transcript';box.className='s3-transcript';$('#aiFull').append(box)}const p=document.createElement('p');p.className='s3-line '+role;const who=document.createElement('small');who.textContent=role==='user'?'Ты':'AI';const span=document.createElement('span');span.textContent=text;p.append(who,span);box.append(p);box.scrollTop=box.scrollHeight}
async function sendMessage(turn){
 if(textBusy)return null;
 textBusy=true;globalThis.window?.SekkesUI?.textBusy(true);const epoch=api.authEpoch;let acknowledgedText=null;status('');
 try{
  if(live||starting||closing)await endLive(undefined,'text');
  const r=await submitChatTurn(api,turn,{flush:()=>transcript?.flush(),onUser:r=>{if(epoch===api.authEpoch&&r.id===turn.id){acknowledgedText=r.text;render('user',r.text,{id:'j:'+turn.id+':user',state:'sent'})}}});
  if(epoch!==api.authEpoch)return null;
  render('user',r.text,{id:'j:'+r.id+':user',state:'sent'});render('ai',r.reply,{id:'j:'+r.id+':assistant'});
  globalThis.window?.SekkesUI?.sendError('');syncHistory().catch(()=>{});return r;
 }catch(e){
  if(turn.kind==='voice'&&epoch===api.authEpoch)render('user',acknowledgedText||'Не отправлено',{id:'j:'+turn.id+':user',state:'failed'});
  if(epoch===api.authEpoch){globalThis.window?.SekkesUI?.sendError(e.code||'SERVICE_UNAVAILABLE');await syncHistory().catch(()=>{});}
  throw e;
 }finally{textBusy=false;globalThis.window?.SekkesUI?.textBusy(false);status('');}
}
async function sendText(){
 const attachments=globalThis.window?.SekkesUI?.attachments;if(textBusy||(!draft.value.trim()&&!attachments?.hasFiles))return;
 if(!logged()&&!await ensure('text'))return;
 const entered=draft.value,text=entered.trim()||'Посмотри прикреплённые материалы.';if(text.length>2000)return;
 globalThis.window?.SekkesUI?.beforeText();
 let ids;try{globalThis.window?.SekkesUI?.textBusy(true);ids=await attachments?.upload()||[]}catch{note('Вложения не загрузились. Повтори отправку.');return}finally{globalThis.window?.SekkesUI?.textBusy(false)}
 if(!retryTurn||retryTurn.text!==text||JSON.stringify(retryTurn.attachments)!==JSON.stringify(ids))retryTurn={text,id:crypto.randomUUID(),attachments:ids};
 render('user',text,{id:'j:'+retryTurn.id+':user',state:'pending'});if(draft.value===entered)draft.value='';saveDraft();
 try{
  const r=await sendMessage({...retryTurn,kind:'text'});if(!r)return;
  retryTurn=null;attachments?.clear();saveDraft();
 }catch(e){render('user',text,{id:'j:'+retryTurn.id+':user',state:'failed'});if(!draft.value)draft.value=text;saveDraft();if(!['TURN_INTERRUPTED','SERVICE_UNAVAILABLE','DUPLICATE_TURN'].includes(e.code))retryTurn=null;/* Preserve visible text; a definitive failed response may be retried with a fresh ID. */}
}
async function sendVoice({id,audio}){
 if(textBusy)throw new S3Error('TURN_BUSY');
 if(!await ensure('voice-message'))return null;
 globalThis.window?.SekkesUI?.beforeText();const files=globalThis.window?.SekkesUI?.attachments,attachments=await files?.upload()||[];const result=await sendMessage({id,kind:'voice',audio,attachments});if(result)files?.clear();return result;
}
function voicePicker(){
 if(live)return note('Сначала заверши голосовой разговор.');
 if(!voiceManifest||!preferences)return note('Каталог голосов загружается. Попробуй ещё раз.');
 picker?.close();view(title('Выбери голос'));
 picker=new VoicePicker({root:body,voices:voiceManifest.voices,preferences,isLive:()=>Boolean(live),notify:note});picker.open();if(!logged()){const signIn=document.createElement('button');signIn.className='rounded-action primary';signIn.textContent='Войти и сохранить выбор';signIn.onclick=()=>{pending='settings';picker.close();login();};body.append(signIn);}
}
dialog.addEventListener('close',()=>{if(dialog.open)return;picker?.close();});

document.addEventListener('visibilitychange',()=>{if(document.hidden)picker?.stopPreview();});
function voiceControls(state){
 if(globalThis.window?.SekkesUI){globalThis.window?.SekkesUI.voice(state);return;}
 const active=state==='connecting'||state==='live';
 const waiting=state==='closing'||state==='recovering';
 const button=$('#micTestLink');
 button.textContent=state==='recovery'?'Завершить прошлый разговор':state==='recovering'?'Завершаю прошлый разговор…':state==='closing'?'Завершаю разговор…':active?'Завершить разговор':'Начать голосовой разговор';
 button.disabled=waiting;
 $('#micButton').hidden=active||waiting||state==='recovery';
 $('#s3LoginButton').textContent=logged()?'Выйти из аккаунта':'Войти в SEKKES';
 document.body.classList.toggle('s3-live',state==='live');
}
function silenceTransport(x){
 try{x.lake?.dispose()}catch{}
 const enableAudio=$('#voiceEnableAudio');if(enableAudio&&(live===x||startup===x||(!live&&!startup))){enableAudio.hidden=true;enableAudio.onclick=null;}
 // Stop every media resource even if another cleanup hook throws.
 try{if(x.retryAudio)document.removeEventListener('click',x.retryAudio)}catch{}
 for(const t of x.stream?.getTracks()||[]){try{t.enabled=false;t.stop()}catch{}}
 if(x.audio){try{x.audio.muted=true;x.audio.pause?.();x.audio.srcObject=null}catch{}}
}
function disposeTransport(x){
 clearTimeout(x.flowTimer);silenceTransport(x);
 try{x.dc?.close?.()}catch{}
 try{x.pc?.close()}catch{}
}
function setupDeadline(promise,ms,stage='CONNECT'){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Object.assign(new S3Error(stage+'_TIMEOUT'),{stage})),ms);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});});
}
// Follow GPT-Live's documented WebRTC sequence. Media playback is not a
// prerequisite for sending microphone tracks or processing session.started.
async function waitForIce(pc){
 if(pc.iceGatheringState==='complete')return;
 await new Promise((resolve,reject)=>{
  const finish=e=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);e?reject(e):resolve();};
  const changed=()=>{if(pc.iceGatheringState==='complete')finish();};
  const timer=setTimeout(()=>finish(new S3Error('ICE_TIMEOUT')),10000);
  pc.addEventListener('icegatheringstatechange',changed);changed();
 });
}
async function startLive(){
 if(starting||closing||recovering||live)return;
 if(globalThis.window?.SekkesUI?.captureBusy)return note('Сначала заверши запись в чате.');
 if(recoveryNeeded)return recoverPrevious();
 if(!logged()){if(await ensure('live'))return startLive();return;}
 starting=true;const x={cancelled:false,id:null,stream:null,pc:null,audio:null,stage:'MIC',introDone:false,outputReady:false,channelReady:false};startup=x;
 x.settled=new Promise(resolve=>{x.resolveSettled=resolve;});
 voiceTrace('begin');voiceControls('connecting');status('');picker?.close();
 const active=()=>!x.cancelled&&(startup===x||live===x);
 const check=()=>{if(!active())throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});};
 const markReady=()=>{
  if(live!==x||x.cancelled||x.ready||!x.startedEvent||!x.channelReady||!x.outputReady||!x.micAttached)return;
  x.ready=true;clearTimeout(x.connectTimer);voiceTrace('ready');voiceControls('live');status('');
  try{x.lake=startLakeVisual(x.pc)}catch{/* The call remains usable without animation. */}
  // Start the entrance only after transport + remote playback have settled.
  // Neither an unavailable cue nor a rejected cue may strand the live connection.
  Promise.resolve(sessionCues?.play('start')).then(result=>{
   if(!active())return;
   x.introDone=result==='ended';voiceTrace(x.introDone?'intro.done':'intro.failed',result||'unavailable');
   if(!x.introDone&&result!=='cancel')note('Разговор подключён, но сигнал начала не воспроизвёлся.');
  }).catch(e=>{if(active()){voiceTrace('intro.failed',e.name);note('Разговор подключён, но сигнал начала не воспроизвёлся.');}});
 };
 try{
  sessionCues?.begin?.();voiceTrace('mic.request');
  const capture=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}).then(stream=>{
   if(x.cancelled){for(const t of stream.getTracks())t.stop();throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});}x.stream=stream;return stream;
  });
  // Independent profile I/O overlaps capture and SDP/ICE preparation. Attach
  // a rejection handler immediately, including cancellation during mic permission.
  const profileReady=Promise.resolve().then(()=>preferences.load()).then(
   ()=>{if(active())voiceTrace('profile.ready');return {ok:true};},
   error=>({ok:false,error})
  );
  x.stream=await setupDeadline(capture,30000,'MIC');check();voiceTrace('mic.ready');
  x.stage='PROFILE';if(unclosedId)await closeSession(unclosedId);check();
  const pc=x.pc=new RTCPeerConnection();
  for(const track of x.stream.getTracks())pc.addTrack(track,x.stream);
  x.micAttached=true;voiceTrace('mic.attached');
  const audio=x.audio=new Audio();audio.autoplay=true;audio.playsInline=true;
  x.playRemote=async()=>{
   if(!active()||!audio.srcObject||x.playPending)return;
   x.playPending=true;
   try{await setupDeadline(audio.play(),10000,'PLAY');if(!active())return;x.outputReady=true;x.outputBlocked=false;voiceTrace('remote.play');const button=$('#voiceEnableAudio');if(button)button.hidden=true;markReady();}
   catch(e){if(active()){voiceTrace('error',e.code||'PLAY_'+e.name);x.outputBlocked=true;const button=$('#voiceEnableAudio');if(button)button.hidden=false;note('Нажми «Включить звук», чтобы услышать разговор.');}}
   finally{x.playPending=false;}
  };
  const enableAudio=$('#voiceEnableAudio');if(enableAudio){enableAudio.hidden=true;enableAudio.onclick=()=>{if(active())x.playRemote();};}
  pc.ontrack=e=>{if(!active())return;voiceTrace('remote.track');audio.srcObject=typeof MediaStream!=='undefined'?new MediaStream([e.track]):e.streams[0];x.playRemote();};
  const dc=x.dc=pc.createDataChannel('oai-events');
  // Register every transport handler before the offer, as in the provider example.
  dc.onopen=()=>{if(!active()||x.channelReady)return;x.channelReady=true;voiceTrace('channel.open');markReady();};
  dc.onmessage=e=>{
   let event;try{event=JSON.parse(e.data)}catch{return}
   x.finalization?.receive(event);
   x.transcript?.receive(x.id,event);
   if(event.type==='session.closed')voiceTrace('session.closed');
   if(!active()||live!==x)return;
   if(event.type==='session.started'){x.startedEvent=event;voiceTrace('session.started');}
   x.commands?.receive(event);if(!active())return;
   try{x.identity?.receive(event)}catch{voiceTrace('error','IDENTITY_HANDLER');}
   markReady();globalThis.window?.SekkesUI?.voiceEvent(event);
   if(event.type==='session.closed')endLive(undefined,'provider');
   if(event.type==='error'){voiceTrace('error',event.error?.code||'PROVIDER_EVENT');if(![x.commands?.id,x.commands?.id+'_prompt'].includes(event.client_event_id||event.error?.client_event_id||event.error?.event_id))note('Голосовой сервис сообщил об ошибке.');}
  };
  dc.onclose=()=>{if(active()&&live===x)endLive('Соединение завершено.','channel');};
  pc.onconnectionstatechange=()=>{if(!active())return;voiceTrace('connection',pc.connectionState);if(live===x&&['failed','closed'].includes(pc.connectionState))endLive('Связь завершена.','connection');};
  x.stage='OFFER';const offer=await setupDeadline(pc.createOffer(),15000,'OFFER');check();await setupDeadline(pc.setLocalDescription(offer),15000,'LOCAL_SDP');check();
  x.stage='ICE';await waitForIce(pc);check();voiceTrace('offer.ready');
  const sdp=pc.localDescription?.sdp;if(!sdp)throw new S3Error('LOCAL_SDP_INVALID');
  x.stage='PROFILE';const profileResult=await profileReady;check();if(!profileResult.ok)throw profileResult.error;
  x.id=crypto.randomUUID();x.stage='PROVIDER';voiceTrace('provider.request');
  const answer=await api.createLive(sdp,selectedVoice,undefined,'conversation',x.id);check();voiceTrace('provider.ready');x.id=answer.id;
  x.identity=new VoiceIdentityHandshake({send:e=>dc.send(JSON.stringify(e)),instruction:answer.startupInstruction,onReady:()=>voiceTrace('identity.ready'),onError:()=>{voiceTrace('error','IDENTITY');if(live===x)note('Не удалось подтвердить настройки голоса. Заверши разговор и начни заново.')}});
  x.finalization=prepareFinalization(x);
  x.commands=new VoiceEndCommand({send:event=>dc.send(JSON.stringify(event)),stop:()=>{if(live===x)endLive(undefined,'voice');},onError:()=>{voiceTrace('error','END_COMMAND');if(live===x)note('Голосовая команда завершения недоступна. Используй кнопку завершения.');}});
  x.transcript=transcript;live=x;
  x.timer=setTimeout(()=>{if(live===x)endLive('45 минут завершены','duration');},45*60*1000);
  x.connectTimer=setTimeout(()=>{if(live===x){voiceTrace('error',x.startedEvent?'AUDIO_TIMEOUT':'SESSION_TIMEOUT');endLive('Подключение не завершилось. Попробуй начать заново.','timeout');}},30000);
  // Counts only: no audio, text, addresses, SDP or identifiers in diagnostics.
  const sampleFlow=async()=>{
   if(!active()||!pc.getStats)return;
   try{let sent=0,received=0;const stats=await pc.getStats();if(!active())return;stats.forEach(r=>{if((r.kind||r.mediaType)!=='audio')return;if(r.type==='outbound-rtp')sent+=r.packetsSent||0;if(r.type==='inbound-rtp')received+=r.packetsReceived||0;});voiceTrace('media.flow','tx_'+sent+'_rx_'+received);}catch{if(active())voiceTrace('error','STATS_UNAVAILABLE');}
   x.flowSamples=(x.flowSamples||0)+1;if(active()&&x.flowSamples<3)x.flowTimer=setTimeout(sampleFlow,5000);
  };
  x.flowTimer=setTimeout(sampleFlow,5000);
  x.stage='REMOTE_SDP';await setupDeadline(pc.setRemoteDescription({type:'answer',sdp:answer.sdp}),20000,'REMOTE_SDP');check();voiceTrace('remote.sdp');markReady();
 }catch(e){
  if(x.cancelled)e=Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  x.cancelled=true;if(startup===x||live===x){voiceTrace('error',e.code||x.stage+'_'+e.name);if(e.code!=='CANCELLED'){sessionCues?.cancel();sessionCues?.resetRoute?.();}}
  const wasLive=live===x;if(wasLive)await endLive(undefined,'setup_error');else disposeTransport(x);
  if(!wasLive&&x.id&&e.code!=='LIVE_BUSY'&&e.code!=='DUPLICATE_TURN'){try{await closeSession(x.id)}catch{recoveryNeeded=true;}}
  if(e.code==='LIVE_BUSY')recoveryNeeded=true;
  if(e.code!=='CANCELLED'){const errors={NotAllowedError:'Разреши доступ к микрофону в настройках браузера.',NotFoundError:'Браузер не нашёл микрофон.',NotReadableError:'Микрофон занят или недоступен. Закрой другой голосовой звонок.'};note(errors[e.name]||msg[e.code]||'Не удалось подключить разговор. Код: '+(e.code||x.stage+'_'+e.name));}
 }finally{
  if(startup===x){startup=null;starting=false;}
  x.resolveSettled();
  if(!live&&!closing&&!starting&&!restartPending){voiceControls(recoveryNeeded?'recovery':'idle');status('');}
 }
}
async function closeSession(id){unclosedId=id;await api.closeLive(id);if(unclosedId===id)unclosedId=null;}
async function recoverPrevious(){
 if(starting||live||closing||recovering)return;
 recovering=true;voiceControls('recovering');status('Завершаю прошлый разговор…');
 try{await api.recoverLive();recoveryNeeded=false;unclosedId=null;status('Прошлый разговор завершён. Можно начать новый.');}
 catch(e){recoveryNeeded=true;status('Не удалось завершить прошлый разговор. Можно повторить.');fail(e);}
 finally{recovering=false;voiceControls(recoveryNeeded?'recovery':'idle');}
}
function endLive(message,reason='button'){
 voiceTrace('stop',reason);
 if(restartPending){restartPending=false;voiceControls('idle');status('');}
 if(closing)return closing;
 if(startup){startup.cancelled=true;silenceTransport(startup);}
 const x=live;
 if(!x){if(startup&&reason==='button')sessionCues?.play('end');else {sessionCues?.cancel();sessionCues?.resetRoute?.();}if(startup){disposeTransport(startup);if(!startup.id){startup=null;starting=false;}voiceControls('idle');status('');}return Promise.resolve();}
 live=null;x.cancelled=true;
 silenceTransport(x);
 if(reason==='button'||reason==='voice'||x.channelReady||x.ready)sessionCues?.play('end');else {sessionCues?.cancel();sessionCues?.resetRoute?.();}
 clearTimeout(x.timer);clearTimeout(x.connectTimer);clearTimeout(x.flowTimer);
 try{x.identity?.dispose()}catch{}
 let final;try{final=x.finalization?.finish()}catch{final=Promise.resolve(false)}
 voiceControls('idle');status('');if(message)note(message);
 const release=Promise.resolve(final).then(confirmed=>{voiceTrace('finalization',confirmed?'confirmed':'unconfirmed');}).finally(()=>disposeTransport(x));
 closing=(async()=>{
  try{
   try{await closeSession(x.id)}catch(e){
    if(e.code==='AUTH_REQUIRED')throw e;
    // One bounded retry after transport finalization, for this session only.
    await release.catch(()=>{});await closeSession(x.id);
   }
   await release;recoveryNeeded=false;
  }
  catch{recoveryNeeded=true;status('Разговор остановлен. Нужно завершить соединение на сервере.');}
  finally{await release.catch(()=>{});await transcript?.flush().catch(()=>{});syncHistory().catch(()=>{});closing=null;voiceTrace('closed');voiceControls(recoveryNeeded?'recovery':'idle');}
 })();return closing;
}
let restartPending=false;
async function toggleVoice(){
 sessionCues?.unlock();
 if((starting&&!startup?.cancelled)||live)return endLive();
 if(recovering)return;
 const wait=closing||(startup?.cancelled?startup.settled:null);
 if(wait){
  if(restartPending)return;restartPending=true;voiceControls('connecting');status('');
  await wait;if(!restartPending)return;restartPending=false;
  if(recoveryNeeded||!logged()){voiceControls(recoveryNeeded?'recovery':'idle');return;}
 }
 return startLive();
}

function logout(){transcript?.dispose();transcript=null;historyCursor=null;hasMoreHistory=false;accountPanel?.cancel();pending=null;retryTurn=null;globalThis.window?.SekkesUI?.reset();journalId=null;dialog.close();picker?.close();preferences?.reset();endLive(undefined,'logout');api?.logout();accepted=false;textHistory=[];draft.value='';$('#s3Transcript')?.remove();status('Войди в SEKKES')}
function mount(){if(globalThis.window?.SekkesUI)return;const tools=document.createElement('div');tools.className='s3-tools';tools.innerHTML='<button id="s3LoginButton" class="s3-login">Войти в SEKKES</button>';$('#aiFull').append(tools);$('#s3LoginButton').onclick=()=>logged()?logout():login();}
mount();
window.SekkesS2={loadProfile:()=>api.syncProfile(),saveProfile:(uid,value)=>api.saveProfile(uid,value),chatMedia:body=>api.request('media',body?{method:'POST',body}:{}),ownerRequest:(path,body)=>ownerRequest(api,path,body),ownerCode:code=>ownerCode(account,api,code),ownerPasskey:async()=>{const keys=account.passkeys(()=>{});try{if(!await keys.signIn())throw Error('RECENT_PROOF_REQUIRED');return await ownerRequest(api,'activate',{});}finally{keys.destroy();}},voiceFailed:id=>render('user','Не отправлено',{id:'j:'+id+':user',state:'failed'}),recordingStarted:()=>globalThis.window?.SekkesUI?.beforeText(),voicePending:id=>render('user','…',{id:'j:'+id+':user',state:'pending'}),saveDraft,loadEarlier:()=>hasMoreHistory?syncHistory(true):Promise.resolve(),get voiceActive(){return Boolean(restartPending||(starting&&!startup?.cancelled)||live||recovering||recoveryNeeded)},stopVoice:()=>recoveryNeeded&&!live&&!starting?recoverPrevious():endLive(),toggleMic:toggleVoice,sendText,sendVoice,interrupt:()=>endLive(undefined,'interrupt'),end:logout,login,faceIdSettings,voiceSettings:voicePicker,accountAction:()=>logged()?logout():login(),get updateReady(){return !accountRestore&&!loginBusy&&!historyLoading},get busy(){return Boolean(live||starting||closing||recovering||textBusy)},get dirty(){return Boolean(live||starting||closing||draft.value.trim()||textHistory.length||loginBusy||textBusy)}};
addEventListener('sekkes:route',e=>{if(!globalThis.window?.SekkesUI&&!['ai','text'].includes(e.detail.route)&&live)endLive()});
document.addEventListener('visibilitychange',()=>{if(!globalThis.window?.SekkesUI&&document.hidden&&live)endLive('Голосовой разговор остановлен при уходе из приложения.')});
addEventListener('pagehide',()=>{endLive(undefined,'pagehide');accountPanel?.cancel();});
dialog.addEventListener('close',()=>accountPanel?.cancel());
// Runtime configuration. Generated alongside this exact release; no startup JSON timeout.
try{config=runtimeConfig;api=new S3Api(config);voiceManifest=voiceCatalog;preferences=new VoicePreferences({profile:supabaseVoiceProfile(api),enabledIds:voiceManifest.voices.filter(v=>v.enabled).map(v=>v.id),defaultVoice:'bossa',storage:{setItem:(k,v)=>localStorage.setItem(k,v)},onChange:id=>{selectedVoice=id;}});status('Войди в SEKKES для разговора')}catch{status('Не удалось загрузить настройки приложения. Обнови SEKKES.')}

if(api){
 account=new AccountSession(api,{onLost:()=>{transcript?.dispose();transcript=null;historyCursor=null;hasMoreHistory=false;endLive(undefined,'logout');accepted=false;textHistory=[];journalId=null;globalThis.window?.SekkesUI?.reset();status('Войди в SEKKES');}});
 accountRestore=account.restore().then(async restored=>{if(restored)await finishAccountLogin();}).catch(()=>{status('Войди в SEKKES для разговора');}).finally(()=>{accountRestore=null;});
}

addEventListener('online',()=>{transcript?.flush().then(()=>syncHistory()).catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){transcript?.flush().then(()=>syncHistory()).catch(()=>{});}});


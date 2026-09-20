import {voiceTrace} from './voice-trace.mjs';
import {sessionCues} from './session-cues.mjs';
import {VoiceEndCommand} from './voice-end-command.mjs';
import {runtimeConfig,voiceCatalog} from './runtime-config.mjs';
import {restoreLatestThread} from './ui/chat-session.mjs';
import {prepareFinalization} from './voice-finalize.mjs?v=2026.09.20-s3.28';
import {VoiceIdentityHandshake} from './voice-identity.mjs?v=2026.09.20-ui.8.11';
import {VoicePreferences,supabaseVoiceProfile} from './preferences.mjs?v=2026.09.20-s3.28';
import {VoicePicker} from './voice-picker.mjs?v=2026.09.20-s3.28';
import{S3Api,S3Error}from'./s3-api.mjs?v=2026.09.20-s3.28';
const $=s=>document.querySelector(s),CONSENT='sekkes-s2-openai-20260918';
const msg={VOICE_PROFILE_CHANGED:'Голос изменён в аккаунте. Настройка обновлена — начни разговор ещё раз.',PROFILE_UNAVAILABLE:'Не удалось загрузить голос из аккаунта. Попробуй ещё раз.',SETUP_REQUIRED:'Сервер SEKKES недоступен.',AUTH_REQUIRED:'Войди в SEKKES.',LOGIN_FAILED:'Почта или пароль не подошли.',LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подожди немного.',OWNER_ONLY:'Этот тест доступен только владельцу.',BUDGET_STOP:'Лимит теста остановил новый запрос.',LIVE_BUSY:'Голосовая сессия уже активна.',PROVIDER_QUOTA:'OpenAI сообщил об ограничении баланса или квоты.',PROVIDER_AUTH_ERROR:'OpenAI отклонил серверный ключ.',model_not_found:'Текущая голосовая модель недоступна для этого API-проекта.',unsupported_model:'Текущая голосовая модель не поддерживает этот режим.',invalid_request_error:'Голосовая сессия отклонена из-за конфигурации.',LIVE_PROVIDER_UNAVAILABLE:'Голосовой сервис сейчас недоступен.',LIVE_UNAVAILABLE:'Не удалось открыть голосовой разговор.',DUPLICATE_TURN:'Этот запрос уже принят сервером. Не отправляй его повторно. Ответ можно проверить после повторного входа.',SERVICE_UNAVAILABLE:'Сервис сейчас недоступен.'};
let journalId=null,textBusy=false,retryTurn=null;
let startup=null,recoveryNeeded=false,recovering=false;
let starting=false,closing=null,unclosedId=null,api=null,config=null,accepted=false,pending=null,live=null,textHistory=[],loginBusy=false,selectedVoice='bossa',preferences=null,picker=null,voiceManifest=null;
const draft=$('#draft'),dialog=$('#dialog'),body=$('#dialogContent');
const status=t=>{if(globalThis.window?.SekkesUI)globalThis.window?.SekkesUI.status(t);else $('#aiStateLabel').textContent=t};
function note(t){const x=$('#toast');x.textContent=t;x.hidden=false;clearTimeout(note.t);note.t=setTimeout(()=>x.hidden=true,6500)}
function fail(e){note(msg[e?.code]||msg.SERVICE_UNAVAILABLE)}
function title(t){return'<div class="kicker">SEKKES</div><h2 id="dialogTitle">'+t+'</h2>'}
function view(html){body.innerHTML=html;dialog.dataset.s3='true';if(!dialog.open)dialog.showModal()}
function logged(){return api?.token&&Date.now()<api.expiresAt}
async function ensure(action){pending=action;if(!api){fail(new S3Error('SETUP_REQUIRED'));return false}if(!logged()){login();return false}return true}
function login(){view(title('Войти в SEKKES')+'<p>Введи почту и отдельный пароль SEKKES.</p><form id="s3Login"><label class="s2-label">Почта<input id="s3Email" type="email" autocomplete="username" autocapitalize="none" required></label><label class="s2-label">Пароль<input id="s3Password" type="password" autocomplete="current-password" required></label><button class="rounded-action primary">Войти</button><p id="s3Error" role="status"></p></form>');$('#s3Login').onsubmit=async e=>{e.preventDefault();if(loginBusy)return;loginBusy=true;const b=e.target.querySelector('button');b.disabled=true;try{await api.login($('#s3Email').value.trim(),$('#s3Password').value);journalId=null;textHistory=[];$('#s3Transcript')?.remove();$('#s3Password').value='';await api.request('memory');await preferences.load();if(globalThis.window?.SekkesUI){try{const restored=await restoreLatestThread(api);if(restored){journalId=restored.id;for(const turn of restored.turns)render(turn.speaker==='user'?'user':'ai',turn.text);textHistory=restored.turns.slice(-8).map(t=>({role:t.speaker,content:t.text}));}}catch{note('Историю загрузить не удалось. Можно продолжить новый диалог.');}}resumeAfterLogin()}catch(err){api.logout();$('#s3Error').textContent=msg[err.code]||msg.SERVICE_UNAVAILABLE}finally{loginBusy=false;b.disabled=false}}}
function resumeAfterLogin(){globalThis.window?.SekkesUI?.account(api.user);accepted=true;dialog.close();const action=pending;pending=null;if(action==='live')startLive();if(action==='text')sendText();if(action==='voice-message')globalThis.window?.SekkesUI?.sendRecording();if(action==='settings')voicePicker();}
function render(role,text){if(globalThis.window?.SekkesUI)return globalThis.window?.SekkesUI.render(role,text);let box=$('#s3Transcript');if(!box){box=document.createElement('div');box.id='s3Transcript';box.className='s3-transcript';$('#aiFull').append(box)}const p=document.createElement('p');p.className='s3-line '+role;const who=document.createElement('small');who.textContent=role==='user'?'Ты':'AI';const span=document.createElement('span');span.textContent=text;p.append(who,span);box.append(p);box.scrollTop=box.scrollHeight}
async function sendText(){
 if(textBusy)return;globalThis.window?.SekkesUI?.beforeText();if(!await ensure('text'))return;if(textBusy)return;
 const text=draft.value.trim();if(!text)return note('Напиши сообщение.');if(text.length>2000)return note('Сообщение слишком длинное.');
 textBusy=true;globalThis.window?.SekkesUI?.textBusy(true);const epoch=api.authEpoch;status('Думаю…');
 try{
  journalId ||= crypto.randomUUID();
  const saving=true;
  if(!retryTurn||retryTurn.text!==text)retryTurn={text,id:crypto.randomUUID()};
  const r=await api.request('turn',{method:'POST',body:{id:retryTurn.id,kind:'text',mode:'explore',text,useMemory:false,speak:false,history:textHistory.slice(-8),adult:true,consent:CONSENT,...(saving?{journalSession:journalId}:{})}});
  if(epoch!==api.authEpoch)return;
  retryTurn=null;render('user',r.text);render('ai',r.reply);textHistory.push({role:'user',content:r.text},{role:'assistant',content:r.reply});textHistory=textHistory.slice(-8);
  if(draft.value.trim()===text)draft.value='';status('Можно говорить');
  if(saving&&!r.journalSaved)note('Ответ получен, но сохранить его в журнале не удалось. Не отправляй сообщение повторно ради сохранения.');
 }catch(e){if(epoch!==api.authEpoch&&api.token)return;if(e.code==='AUTH_REQUIRED'){accepted=false;journalId=null;}status('Не удалось ответить');fail(e)}finally{textBusy=false;globalThis.window?.SekkesUI?.textBusy(false)}
}
// Existing voice turn contract: WAV mono/16 kHz, 45 seconds, same owner and budget gates.
async function sendVoice({id,audio}){
 if(textBusy||live||starting||closing||recovering)throw new S3Error('LIVE_BUSY');
 if(!await ensure('voice-message'))return null;
 if(textBusy||live||starting||closing)throw new S3Error('LIVE_BUSY');
 textBusy=true;globalThis.window?.SekkesUI?.textBusy(true);const epoch=api.authEpoch;status('Расшифровываю сообщение…');
 try{
  const r=await api.request('turn',{method:'POST',body:{id,kind:'voice',mode:'explore',audio,useMemory:false,speak:false,history:textHistory.slice(-8),adult:true,consent:CONSENT}});
  if(epoch!==api.authEpoch)return null;
  textHistory.push({role:'user',content:r.text},{role:'assistant',content:r.reply});textHistory=textHistory.slice(-8);
  status('Сообщение расшифровано');if(!r.journalSaved)note('Расшифровка и ответ доступны в этом чате. Серверная память голосовых сообщений ещё не подключена.');return r;
 }catch(e){if(epoch===api.authEpoch){status('Не удалось расшифровать сообщение');fail(e)}throw e}
 finally{textBusy=false;globalThis.window?.SekkesUI?.textBusy(false)}
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
 // Stop every media resource even if another cleanup hook throws.
 try{if(x.retryAudio)document.removeEventListener('click',x.retryAudio)}catch{}
 for(const t of x.stream?.getTracks()||[]){try{t.enabled=false;t.stop()}catch{}}
 if(x.audio){try{x.audio.muted=true;x.audio.pause?.();x.audio.srcObject=null}catch{}}
}
function disposeTransport(x){
 silenceTransport(x);
 try{x.dc?.close?.()}catch{}
 try{x.pc?.close()}catch{}
}
function setupDeadline(promise,ms,stage='CONNECT'){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Object.assign(new S3Error(stage+'_TIMEOUT'),{stage})),ms);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});});
}
async function startLive(){
 if(starting||closing||recovering||live)return;
 if(globalThis.window?.SekkesUI?.captureBusy)return note('Сначала заверши запись в чате.');
 if(recoveryNeeded)return recoverPrevious();
 if(!logged()){await ensure('live');return;}
 starting=true;const x={cancelled:false,id:null,stream:null,pc:null,audio:null,stage:'MIC',introDone:false,outputReady:false,channelReady:false};startup=x;
 voiceTrace('begin');voiceControls('connecting');status('');picker?.close();
 const check=()=>{if(x.cancelled||startup!==x)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});};
 const markReady=()=>{
  if(live!==x||x.cancelled||x.ready||!x.introDone||!x.channelReady||!x.outputReady||!x.micAttached)return;
  x.ready=true;clearTimeout(x.connectTimer);voiceTrace('ready');voiceControls('live');status('');
  if(x.startedEvent)x.identity.receive(x.startedEvent);
 };
 try{
  // Both APIs are invoked in the original gesture, before auth/profile/network awaits.
  sessionCues?.begin?.();voiceTrace('mic.request');
  const capture=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}).then(stream=>{
   if(x.cancelled){for(const t of stream.getTracks())t.stop();throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});}x.stream=stream;return stream;
  });
  x.stream=await setupDeadline(capture,30000,'MIC');check();voiceTrace('mic.ready');
  const entrance=Promise.resolve(sessionCues?.play('start')).then(()=>{x.introDone=true;voiceTrace('intro.done');markReady();});
  // Keep hardware capture enabled: disabling all tracks may relinquish the device.
  // The sender has no track until the entrance finishes, so no speech is transmitted.
  x.stage='PROFILE';if(unclosedId)await closeSession(unclosedId);check();
  await preferences.load();check();voiceTrace('profile.ready');
  const pc=x.pc=new RTCPeerConnection();
  x.sender=pc.addTransceiver('audio',{direction:'sendrecv',streams:[x.stream]}).sender;
  const audio=x.audio=new Audio();audio.autoplay=false;audio.playsInline=true;
  x.playRemote=async()=>{
   if(live!==x||x.cancelled||!audio.srcObject)return;
   try{await audio.play();if(live!==x||x.cancelled)return;x.outputReady=true;voiceTrace('remote.play');markReady();}
   catch(e){voiceTrace('error','PLAY_'+e.name);if(live===x){x.outputBlocked=true;note('Коснись экрана, чтобы включить звук разговора.');}}
  };
  x.retryAudio=()=>{if(x.outputBlocked&&live===x){x.outputBlocked=false;x.playRemote();}};
  document.addEventListener('click',x.retryAudio);
  pc.ontrack=e=>{if(x.cancelled||live!==x)return;voiceTrace('remote.track');audio.srcObject=e.streams[0]||(typeof MediaStream!=='undefined'?new MediaStream([e.track]):null);entrance.then(()=>x.playRemote());};
  const dc=x.dc=pc.createDataChannel('oai-events');
  x.stage='OFFER';const offer=await setupDeadline(pc.createOffer(),15000,'OFFER');check();await setupDeadline(pc.setLocalDescription(offer),15000,'LOCAL_SDP');check();
  await new Promise(resolve=>{if(pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(resolve,3500);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve()}})});check();voiceTrace('offer.ready');
  const sdp=pc.localDescription?.sdp;if(!sdp)throw new S3Error('LOCAL_SDP_INVALID');
  x.id=crypto.randomUUID();x.stage='PROVIDER';voiceTrace('provider.request');
  const answer=await api.createLive(sdp,selectedVoice,undefined,'conversation',x.id);check();voiceTrace('provider.ready');x.id=answer.id;
  x.identity=new VoiceIdentityHandshake({send:e=>dc.send(JSON.stringify(e)),instruction:answer.startupInstruction,onReady:()=>{},onError:()=>{voiceTrace('error','IDENTITY');if(live===x)note('Не удалось подтвердить настройки голоса. Заверши разговор и начни заново.')}});
  x.finalization=prepareFinalization(x);
  x.commands=new VoiceEndCommand({send:event=>dc.send(JSON.stringify(event)),stop:()=>{if(live===x)endLive();},onError:()=>{voiceTrace('error','END_COMMAND');if(live===x)note('Голосовая команда завершения недоступна. Используй кнопку завершения.');}});
  live=x;
  x.timer=setTimeout(()=>{if(live===x)endLive('45 минут завершены')},45*60*1000);
  x.connectTimer=setTimeout(()=>{if(live===x){voiceTrace('error','CHANNEL_TIMEOUT');endLive('Соединение не установлено. Попробуй начать заново.');}},30000);
  dc.onopen=()=>{if(live!==x||x.channelReady)return;x.channelReady=true;voiceTrace('channel.open');markReady();};
  dc.onmessage=e=>{let event;try{event=JSON.parse(e.data)}catch{return}x.finalization.receive(event);if(live!==x)return;x.commands.receive(event);if(live!==x)return;
   if(event.type==='session.started'){x.startedEvent=event;if(x.ready)x.identity.receive(event);}else try{x.identity.receive(event)}catch(err){voiceTrace('error','IDENTITY_HANDLER');}
   globalThis.window?.SekkesUI?.voiceEvent(event);if(event.type==='session.closed')endLive();
   if(event.type==='error'){voiceTrace('error',event.error?.code||'PROVIDER_EVENT');if(![x.commands.id,x.commands.id+'_prompt'].includes(event.client_event_id||event.error?.client_event_id||event.error?.event_id))note('Голосовой сервис сообщил об ошибке.');}
  };
  dc.onclose=()=>{if(live===x)endLive()};
  pc.onconnectionstatechange=()=>{if(live===x&&['failed','closed'].includes(pc.connectionState))endLive('Связь завершена')};
  x.stage='REMOTE_SDP';await setupDeadline(pc.setRemoteDescription({type:'answer',sdp:answer.sdp}),20000,'REMOTE_SDP');check();voiceTrace('remote.sdp');
  await entrance;check();if(live!==x)return;x.stage='MIC_ATTACH';await setupDeadline(x.sender.replaceTrack(x.stream.getTracks()[0]),10000,'MIC_ATTACH');check();x.micAttached=true;voiceTrace('mic.attached');markReady();
 }catch(e){
  if(x.cancelled)e=Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
  x.cancelled=true;if(startup===x||live===x){voiceTrace('error',e.code||x.stage+'_'+e.name);sessionCues?.cancel();sessionCues?.resetRoute?.();}
  const wasLive=live===x;if(wasLive)await endLive();else disposeTransport(x);
  if(!wasLive&&x.id&&e.code!=='LIVE_BUSY'&&e.code!=='DUPLICATE_TURN'){try{await closeSession(x.id)}catch{recoveryNeeded=true;}}
  if(e.code==='LIVE_BUSY')recoveryNeeded=true;
  if(e.code!=='CANCELLED'){const errors={NotAllowedError:'Разреши доступ к микрофону в настройках браузера.',NotFoundError:'Браузер не нашёл микрофон.',NotReadableError:'Микрофон занят или недоступен. Закрой другой голосовой звонок.'};note(errors[e.name]||msg[e.code]||'Не удалось подключить разговор. Код: '+(e.code||x.stage+'_'+e.name));}
 }finally{
  if(startup===x){startup=null;starting=false;}
  if(!live&&!closing&&!starting){voiceControls(recoveryNeeded?'recovery':'idle');status('');}
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
function endLive(message){
 voiceTrace('stop');
 if(restartPending){restartPending=false;voiceControls('idle');status('');}
 if(closing)return closing;
 if(startup){startup.cancelled=true;silenceTransport(startup);}
 const x=live;
 if(!x){sessionCues?.cancel();sessionCues?.resetRoute?.();if(startup){disposeTransport(startup);if(!startup.id){startup=null;starting=false;}voiceControls('idle');status('');}return Promise.resolve();}
 live=null;x.cancelled=true;
 silenceTransport(x);
 if(x.channelReady||x.ready)sessionCues?.play('end');else {sessionCues?.cancel();sessionCues?.resetRoute?.();}
 clearTimeout(x.timer);clearTimeout(x.connectTimer);
 try{x.identity?.dispose()}catch{}
 let final;try{final=x.finalization?.finish()}catch{final=Promise.resolve(false)}
 voiceControls('idle');status('');if(message)note(message);
 const release=Promise.resolve(final).finally(()=>disposeTransport(x));
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
  finally{await release.catch(()=>{});closing=null;voiceTrace('closed');voiceControls(recoveryNeeded?'recovery':'idle');}
 })();return closing;
}
let restartPending=false;
async function toggleVoice(){
 sessionCues?.unlock();
 if((starting&&!startup?.cancelled)||live)return endLive();
 if(recovering)return;
 if(closing){
  if(restartPending)return;restartPending=true;voiceControls('connecting');status('');
  await closing;if(!restartPending)return;restartPending=false;
  if(recoveryNeeded||!logged()){voiceControls(recoveryNeeded?'recovery':'idle');return;}
 }
 return startLive();
}

function logout(){retryTurn=null;globalThis.window?.SekkesUI?.reset();journalId=null;dialog.close();picker?.close();preferences?.reset();endLive();api?.logout();accepted=false;textHistory=[];draft.value='';$('#s3Transcript')?.remove();status('Войди в SEKKES')}
function mount(){if(globalThis.window?.SekkesUI)return;const tools=document.createElement('div');tools.className='s3-tools';tools.innerHTML='<button id="s3LoginButton" class="s3-login">Войти в SEKKES</button>';$('#aiFull').append(tools);$('#s3LoginButton').onclick=()=>logged()?logout():login();}
mount();
window.SekkesS2={get voiceActive(){return Boolean(restartPending||(starting&&!startup?.cancelled)||live||recovering||recoveryNeeded)},stopVoice:()=>recoveryNeeded&&!live&&!starting?recoverPrevious():endLive(),toggleMic:toggleVoice,sendText,sendVoice,interrupt:()=>endLive(),end:logout,login,voiceSettings:voicePicker,accountAction:()=>logged()?logout():login(),get busy(){return Boolean(live||starting||closing||recovering||textBusy)},get dirty(){return Boolean(live||starting||closing||draft.value.trim()||textHistory.length||loginBusy||textBusy)}};
addEventListener('sekkes:route',e=>{if(!globalThis.window?.SekkesUI&&!['ai','text'].includes(e.detail.route)&&live)endLive()});
document.addEventListener('visibilitychange',()=>{if(!globalThis.window?.SekkesUI&&document.hidden&&live)endLive('Голосовой разговор остановлен при уходе из приложения.')});
addEventListener('pagehide',()=>{endLive();api?.logout();accepted=false});
// Runtime configuration. Generated alongside this exact release; no startup JSON timeout.
try{config=runtimeConfig;api=new S3Api(config);voiceManifest=voiceCatalog;preferences=new VoicePreferences({profile:supabaseVoiceProfile(api),enabledIds:voiceManifest.voices.filter(v=>v.enabled).map(v=>v.id),defaultVoice:'bossa',storage:{setItem:(k,v)=>localStorage.setItem(k,v)},onChange:id=>{selectedVoice=id;}});status('Войди в SEKKES для разговора')}catch{status('Не удалось загрузить настройки приложения. Обнови SEKKES.')}

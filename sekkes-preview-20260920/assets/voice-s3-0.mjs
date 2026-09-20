import {prepareFinalization} from './voice-finalize.mjs?v=2026.09.20-s3.28';
import {VoiceIdentityHandshake} from './voice-identity.mjs?v=2026.09.20-s3.28';
import {VoicePreferences,supabaseVoiceProfile} from './preferences.mjs?v=2026.09.20-s3.28';
import {VoicePicker} from './voice-picker.mjs?v=2026.09.20-s3.28';
import{S3Api,S3Error}from'./s3-api.mjs?v=2026.09.20-s3.28';
const $=s=>document.querySelector(s),CONSENT='sekkes-s2-openai-20260918';
const msg={VOICE_PROFILE_CHANGED:'Голос изменён в аккаунте. Настройка обновлена — начни разговор ещё раз.',PROFILE_UNAVAILABLE:'Не удалось загрузить голос из аккаунта. Попробуй ещё раз.',SETUP_REQUIRED:'Сервер SEKKES недоступен.',AUTH_REQUIRED:'Войди в SEKKES.',LOGIN_FAILED:'Почта или пароль не подошли.',LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подожди немного.',OWNER_ONLY:'Этот тест доступен только владельцу.',BUDGET_STOP:'Лимит теста остановил новый запрос.',LIVE_BUSY:'Голосовая сессия уже активна.',PROVIDER_QUOTA:'OpenAI сообщил об ограничении баланса или квоты.',PROVIDER_AUTH_ERROR:'OpenAI отклонил серверный ключ.',model_not_found:'Текущая голосовая модель недоступна для этого API-проекта.',unsupported_model:'Текущая голосовая модель не поддерживает этот режим.',invalid_request_error:'Голосовая сессия отклонена из-за конфигурации.',LIVE_PROVIDER_UNAVAILABLE:'Голосовой сервис сейчас недоступен.',LIVE_UNAVAILABLE:'Не удалось открыть голосовой разговор.',SERVICE_UNAVAILABLE:'Сервис сейчас недоступен.'};
let journalId=null,textBusy=false;
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
function login(){view(title('Войти в SEKKES')+'<p>Введи почту и отдельный пароль SEKKES.</p><form id="s3Login"><label class="s2-label">Почта<input id="s3Email" type="email" autocomplete="username" autocapitalize="none" required></label><label class="s2-label">Пароль<input id="s3Password" type="password" autocomplete="current-password" required></label><button class="rounded-action primary">Войти</button><p id="s3Error" role="status"></p></form>');$('#s3Login').onsubmit=async e=>{e.preventDefault();if(loginBusy)return;loginBusy=true;const b=e.target.querySelector('button');b.disabled=true;try{await api.login($('#s3Email').value.trim(),$('#s3Password').value);journalId=null;textHistory=[];$('#s3Transcript')?.remove();$('#s3Password').value='';await api.request('memory');await preferences.load();resumeAfterLogin()}catch(err){api.logout();$('#s3Error').textContent=msg[err.code]||msg.SERVICE_UNAVAILABLE}finally{loginBusy=false;b.disabled=false}}}
function resumeAfterLogin(){globalThis.window?.SekkesUI?.account(api.user);accepted=true;dialog.close();const action=pending;pending=null;if(action==='live')startLive();if(action==='text')sendText();if(action==='settings')voicePicker();}
function render(role,text){if(globalThis.window?.SekkesUI)return globalThis.window?.SekkesUI.render(role,text);let box=$('#s3Transcript');if(!box){box=document.createElement('div');box.id='s3Transcript';box.className='s3-transcript';$('#aiFull').append(box)}const p=document.createElement('p');p.className='s3-line '+role;const who=document.createElement('small');who.textContent=role==='user'?'Ты':'AI';const span=document.createElement('span');span.textContent=text;p.append(who,span);box.append(p);box.scrollTop=box.scrollHeight}
async function sendText(){
 if(textBusy)return;globalThis.window?.SekkesUI?.beforeText();if(!await ensure('text'))return;if(textBusy)return;
 const text=draft.value.trim();if(!text)return note('Напиши сообщение.');if(text.length>2000)return note('Сообщение слишком длинное.');
 textBusy=true;globalThis.window?.SekkesUI?.textBusy(true);const epoch=api.authEpoch;status('Думаю…');
 try{
  journalId ||= crypto.randomUUID();
  const saving=true;
  const r=await api.request('turn',{method:'POST',body:{id:crypto.randomUUID(),kind:'text',mode:'explore',text,useMemory:false,speak:false,history:textHistory.slice(-8),adult:true,consent:CONSENT,...(saving?{journalSession:journalId}:{})}});
  if(epoch!==api.authEpoch)return;
  render('user',r.text);render('ai',r.reply);textHistory.push({role:'user',content:r.text},{role:'assistant',content:r.reply});textHistory=textHistory.slice(-8);
  if(draft.value.trim()===text)draft.value='';status('Можно говорить');
  if(saving&&!r.journalSaved)note('Ответ получен, но сохранить его в журнале не удалось. Не отправляй сообщение повторно ради сохранения.');
 }catch(e){if(epoch!==api.authEpoch&&api.token)return;if(e.code==='AUTH_REQUIRED'){accepted=false;journalId=null;}status('Не удалось ответить');fail(e)}finally{textBusy=false;globalThis.window?.SekkesUI?.textBusy(false)}
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
function disposeTransport(x){
 x.stream?.getTracks().forEach(t=>t.stop());
 if(x.audio){x.audio.muted=true;x.audio.pause?.();x.audio.srcObject=null;}
 try{x.pc?.close()}catch{}
}
async function startLive(){
 if(starting||closing||recovering||live)return;
 if(recoveryNeeded)return recoverPrevious();
 // Acquire the startup lock before the first await, including Auth/profile work.
 starting=true;const x={cancelled:false,id:null,stream:null,pc:null,audio:null};startup=x;
 const check=()=>{if(x.cancelled||startup!==x)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});};
 try{
  if(!await ensure('live'))return;
  check();picker?.close();if(!preferences?.loaded)throw new S3Error('AUTH_REQUIRED');
  voiceControls('connecting');status('Подключаю голос…');
  if(unclosedId)await closeSession(unclosedId);
  await preferences.load();check();
  x.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});check();
  const pc=x.pc=new RTCPeerConnection();
  for(const t of x.stream.getTracks())pc.addTrack(t,x.stream);
  const audio=x.audio=new Audio();audio.autoplay=true;audio.playsInline=true;
  pc.ontrack=e=>{if(x.cancelled||live!==x)return;audio.srcObject=e.streams[0];audio.play().catch(()=>{if(live===x)note('Нажми экран один раз, если звук не включился автоматически.')})};
  const dc=x.dc=pc.createDataChannel('oai-events');
  const offer=await pc.createOffer();check();await pc.setLocalDescription(offer);check();
  await new Promise(resolve=>{if(pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(resolve,3500);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve()}})});check();
  const sdp=pc.localDescription?.sdp;if(!sdp)throw new S3Error('LIVE_UNAVAILABLE');
  x.id=crypto.randomUUID();
  const answer=await api.createLive(sdp,selectedVoice,undefined,'conversation',x.id);check();
  x.id=answer.id;
  x.identity=new VoiceIdentityHandshake({send:e=>dc.send(JSON.stringify(e)),instruction:answer.startupInstruction,onReady:()=>{if(live===x)status('Голосовой разговор')},onError:()=>{if(live===x)note('Не удалось подтвердить настройки голоса. Заверши разговор и начни заново.')}});
  x.finalization=prepareFinalization(x);
  live=x;
  x.timer=setTimeout(()=>{if(live===x)endLive('45 минут завершены')},45*60*1000);
  x.connectTimer=setTimeout(()=>{if(live===x)endLive('Подключение не установлено. Можно начать заново.')},20000);
  dc.onopen=()=>{if(live!==x)return;clearTimeout(x.connectTimer);voiceControls('live');status('Голосовой разговор')};
  dc.onmessage=e=>{let event;try{event=JSON.parse(e.data)}catch{return}x.finalization.receive(event);if(live!==x)return;x.identity.receive(event);globalThis.window?.SekkesUI?.voiceEvent(event);if(event.type==='session.closed')endLive();if(event.type==='error')note('Голосовой сервис сообщил об ошибке.')};
  dc.onclose=()=>{if(live===x)endLive()};
  pc.onconnectionstatechange=()=>{if(live===x&&['failed','disconnected','closed'].includes(pc.connectionState))endLive('Связь завершена')};
  await pc.setRemoteDescription({type:'answer',sdp:answer.sdp});
  check();if(live!==x)return;voiceControls('live');
 }catch(e){
  // Stop capture BEFORE any network cleanup or retries.
  const wasLive=live===x;if(wasLive)await endLive();else disposeTransport(x);
  if(!wasLive&&x.id&&e.code!=='LIVE_BUSY'&&e.code!=='DUPLICATE_TURN'){try{await closeSession(x.id)}catch{recoveryNeeded=true;}}
  if(e.code==='LIVE_BUSY')recoveryNeeded=true;
  if(e.code!=='CANCELLED'){fail(e);status(recoveryNeeded?'Прошлый разговор не завершён. Нажми кнопку завершения.':'Не удалось подключить голос');}
 }finally{
  if(startup===x)startup=null;starting=false;
  if(!live&&!closing){voiceControls(recoveryNeeded?'recovery':'idle');if(x.cancelled&&!recoveryNeeded)status('Разговор завершён');}
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
 if(closing)return closing;
 if(startup){startup.cancelled=true;startup.stream?.getTracks().forEach(t=>t.stop());}
 const x=live;
 if(!x){if(startup){disposeTransport(startup);voiceControls('closing');status('Подключение отменено');}return Promise.resolve();}
 live=null;x.cancelled=true;clearTimeout(x.timer);clearTimeout(x.connectTimer);x.identity?.dispose();
 const final=x.finalization?.finish()||Promise.resolve(false);
 x.stream?.getTracks().forEach(t=>t.stop());if(x.audio){x.audio.muted=true;x.audio.pause?.();}
 voiceControls('closing');status('Разговор остановлен. Завершаю соединение…');if(message)note(message);
 const release=Promise.resolve(final).finally(()=>disposeTransport(x));
 closing=(async()=>{
  try{await Promise.all([closeSession(x.id),release]);status('Разговор завершён');}
  catch{recoveryNeeded=true;status('Разговор остановлен. Нужно завершить соединение на сервере.');}
  finally{await release.catch(()=>{});closing=null;voiceControls(recoveryNeeded?'recovery':'idle');}
 })();return closing;
}
function toggleVoice(){if(starting||live)return endLive();if(closing||recovering)return;return startLive();}

function logout(){globalThis.window?.SekkesUI?.reset();journalId=null;dialog.close();picker?.close();preferences?.reset();endLive();api?.logout();accepted=false;textHistory=[];draft.value='';$('#s3Transcript')?.remove();status('Войди в SEKKES')}
function mount(){if(globalThis.window?.SekkesUI)return;const tools=document.createElement('div');tools.className='s3-tools';tools.innerHTML='<button id="s3LoginButton" class="s3-login">Войти в SEKKES</button>';$('#aiFull').append(tools);$('#s3LoginButton').onclick=()=>logged()?logout():login();}
mount();
window.SekkesS2={toggleMic:toggleVoice,sendText,interrupt:()=>endLive(),end:logout,login,voiceSettings:voicePicker,accountAction:()=>logged()?logout():login(),get busy(){return Boolean(live||starting||closing||textBusy)},get dirty(){return Boolean(live||starting||closing||draft.value.trim()||textHistory.length||loginBusy||textBusy)}};
addEventListener('sekkes:route',e=>{if(!globalThis.window?.SekkesUI&&!['ai','text'].includes(e.detail.route)&&live)endLive()});
document.addEventListener('visibilitychange',()=>{if(!globalThis.window?.SekkesUI&&document.hidden&&live)endLive('Голосовой разговор остановлен при уходе из приложения.')});
addEventListener('pagehide',()=>{endLive();api?.logout();accepted=false});
try{const r=await fetch(new URL('../s2-config.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});config=await r.json();api=new S3Api(config);const catalog=await fetch(new URL('../voices.json',import.meta.url),{cache:'no-store'});if(!catalog.ok)throw Error('VOICE_CATALOG_UNAVAILABLE');voiceManifest=await catalog.json();preferences=new VoicePreferences({profile:supabaseVoiceProfile(api),enabledIds:voiceManifest.voices.filter(v=>v.enabled).map(v=>v.id),defaultVoice:'bossa',storage:{setItem:(k,v)=>localStorage.setItem(k,v)},onChange:id=>{selectedVoice=id;}});status('Войди в SEKKES для разговора')}catch{status('Сервер SEKKES недоступен')}


// Isolated one-minute pilot. Server observes the same WebRTC session and persists usage.
import{S3Api,S3Error}from'./s3-api.mjs?v=2026.09.19-p23-stage.5';
import {VoicePreferences,supabaseVoiceProfile} from './preferences.mjs?v=2026.09.19-p23-stage.5';
import {VoicePicker} from './voice-picker.mjs?v=2026.09.19-p23-stage.5';
import {LiveSessionController} from './controller.mjs?v=2026.09.19-p23-stage.5';
import {WebRTCTransport} from './webrtc.mjs?v=2026.09.19-p23-stage.5';
import {StageBroker} from './stage-broker.mjs?v=2026.09.19-p23-stage.5';
let controller;
const $=s=>document.querySelector(s),CONSENT='sekkes-s2-openai-20260918';
const msg={SETUP_REQUIRED:'Сервер SEKKES недоступен.',AUTH_REQUIRED:'Войди в SEKKES.',LOGIN_FAILED:'Почта или пароль не подошли.',LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подожди немного.',OWNER_ONLY:'Этот тест доступен только владельцу.',BUDGET_STOP:'Лимит теста остановил новый запрос.',LIVE_BUSY:'Голосовая сессия уже активна.',PROVIDER_QUOTA:'OpenAI сообщил об ограничении баланса или квоты.',PROVIDER_AUTH_ERROR:'OpenAI отклонил серверный ключ.',model_not_found:'Текущая голосовая модель недоступна для этого API-проекта.',unsupported_model:'Текущая голосовая модель не поддерживает этот режим.',invalid_request_error:'Голосовая сессия отклонена из-за конфигурации.',LIVE_PROVIDER_UNAVAILABLE:'Голосовой сервис сейчас недоступен.',LIVE_UNAVAILABLE:'Не удалось открыть голосовой разговор.',SERVICE_UNAVAILABLE:'Сервис сейчас недоступен.',LIVE_BUSY:'Предыдущий разговор ещё завершается.',BUDGET_STOP:'Короткие проверки на сегодня завершены.',STAGING_DISABLED:'Время этой тестовой проверки истекло.',COST_RECONCILIATION_REQUIRED:'Нужно сверить расход перед следующим разговором.',VOICE_PROFILE_CHANGED:'Выбор голоса изменился. Открой настройки ещё раз.',SESSION_UNAVAILABLE:'Не удалось подключить разговор. Попробуй позже.'};
let api=null,config=null,accepted=false,pending=null,live=null,textHistory=[],loginBusy=false,selectedVoice='bossa',preferences=null,picker=null,voiceManifest=null;
const draft=$('#draft'),dialog=$('#dialog'),body=$('#dialogContent');
const status=t=>$('#aiStateLabel').textContent=t;
function note(t){const x=$('#toast');x.textContent=t;x.hidden=false;clearTimeout(note.t);note.t=setTimeout(()=>x.hidden=true,6500)}
function fail(e){note(msg[e?.code]||msg.SERVICE_UNAVAILABLE)}
function title(t){return'<div class="kicker">SEKKES</div><h2 id="dialogTitle">'+t+'</h2>'}
function view(html){body.innerHTML=html;dialog.dataset.s3='true';if(!dialog.open)dialog.showModal()}
function logged(){return api?.token&&Date.now()<api.expiresAt}
async function ensure(action){pending=action;if(!api){fail(new S3Error('SETUP_REQUIRED'));return false}if(!logged()){login();return false}if(!accepted){consent();return false}return true}
function login(){view(title('Войти в SEKKES')+'<p>Введи почту и отдельный пароль SEKKES.</p><form id="s3Login"><label class="s2-label">Почта<input id="s3Email" type="email" autocomplete="username" autocapitalize="none" required></label><label class="s2-label">Пароль<input id="s3Password" type="password" autocomplete="current-password" required></label><button class="rounded-action primary">Войти</button><p id="s3Error" role="status"></p></form>');$('#s3Login').onsubmit=async e=>{e.preventDefault();if(loginBusy)return;loginBusy=true;const b=e.target.querySelector('button');b.disabled=true;try{await api.login($('#s3Email').value.trim(),$('#s3Password').value);$('#s3Password').value='';await preferences.load();consent()}catch(err){api.logout();$('#s3Error').textContent=msg[err.code]||msg.SERVICE_UNAVAILABLE}finally{loginBusy=false;b.disabled=false}}}
function consent(){view(title('Перед разговором')+'<p>Это AI, не человек и не экстренная служба. Текст и голос передаются OpenAI для ответа. Голос синтетический. В голосовом режиме разговор идёт в реальном времени.</p><label class="settings-row"><span>Мне 18 лет, я согласен с обработкой для этого теста.</span><input id="s3Consent" type="checkbox"></label><div class="dialog-actions"><button id="s3Agree" class="rounded-action primary" disabled>Начать</button></div>');$('#s3Consent').onchange=e=>$('#s3Agree').disabled=!e.target.checked;$('#s3Agree').onclick=()=>{accepted=true;dialog.close();const a=pending;pending=null;if(a==='live')startLive();if(a==='text')sendText();if(a==='settings')voicePicker()}}
function render(role,text){let box=$('#s3Transcript');if(!box){box=document.createElement('div');box.id='s3Transcript';box.className='s3-transcript';$('#aiFull').append(box)}const p=document.createElement('p');p.className='s3-line '+role;const who=document.createElement('small');who.textContent=role==='user'?'Ты':'AI';const span=document.createElement('span');span.textContent=text;p.append(who,span);box.append(p);box.scrollTop=box.scrollHeight}
async function sendText(){if(!await ensure('text'))return;const text=draft.value.trim();if(!text)return note('Напиши сообщение.');if(text.length>2000)return note('Сообщение слишком длинное.');status('Думаю…');try{const r=await api.request('turn',{method:'POST',body:{id:crypto.randomUUID(),kind:'text',mode:'explore',text,useMemory:false,speak:false,history:textHistory.slice(-8),adult:true,consent:CONSENT}});render('user',r.text);render('ai',r.reply);textHistory.push({role:'user',content:r.text},{role:'assistant',content:r.reply});textHistory=textHistory.slice(-8);if(draft.value.trim()===text)draft.value='';status('Готов к разговору')}catch(e){if(e.code==='AUTH_REQUIRED'){accepted=false;api.logout()}status('Не удалось ответить');fail(e)}}

function voicePicker(){
 if(live)return note('Сначала заверши голосовой разговор.');
 if(!voiceManifest||!preferences)return note('Каталог голосов загружается. Попробуй ещё раз.');
 picker?.close();view(title('Выбери голос'));
 picker=new VoicePicker({root:body,voices:voiceManifest.voices,preferences,isLive:()=>Boolean(live),notify:note});picker.open();if(!logged()){const signIn=document.createElement('button');signIn.className='rounded-action primary';signIn.textContent='Войти и сохранить выбор';signIn.onclick=()=>{pending='settings';picker.close();login();};body.append(signIn);}
}
dialog.addEventListener('close',()=>picker?.close());
document.addEventListener('visibilitychange',()=>{if(document.hidden)picker?.stopPreview();});
async function startLive(){
 if(controller?.busy)return endLive();
 if(!await ensure('live'))return;
 picker?.close();if(!preferences?.loaded){note('Не удалось прочитать голос из профиля. Войди ещё раз.');return;}
 const ok=await controller.start(selectedVoice);
 if(!ok&&controller.lastError)fail({code:controller.lastError});
}
async function endLive(message){
 if(!controller)return;
 const result=await controller.stop('user');
 if(message)note(message);
 if(result&&!result.confirmed)note('Разговор остановлен. Подтверждение завершения ещё не получено.');
 return result;
}
async function logout(){picker?.close();await endLive();preferences?.reset();api?.logout();accepted=false;textHistory=[];draft.value='';$('#s3Transcript')?.remove();status('Войди в SEKKES')}
function liveState(s){
 live=controller.busy;
 document.body.classList.toggle('s3-live',live);$('#s3EndLive').hidden=!live;
 $('#micButton').setAttribute('aria-label',live?'Завершить голосовой разговор':'Начать голосовой разговор');
 const labels={requesting_permission:'Разреши доступ к микрофону',connecting:'Подключаю голос…',ready:'Голосовой разговор · до 1 минуты',reconnecting:'Восстанавливаю связь…',closing:'Завершаю разговор…',closed:'Разговор завершён · расход сохранён',uncertain:'Звук остановлен · завершение проверяется'};
 status(s.state==='closed'?(s.closeUncertain?'Звук остановлен · завершение проверяется':controller.context?.closeResult?.usageConfirmed?'Разговор завершён · расход сохранён':'Готов к разговору'):(labels[s.state]||(logged()?'Готов к разговору':'Войди в SEKKES')));
 if(s.audioBlocked)note('Нажми «Включить звук», чтобы услышать помощника.');
 $('#s3ResumeAudio').hidden=!controller.audioBlocked;
}

function mount(){const tools=document.createElement('div');tools.className='s3-tools';tools.innerHTML='<button id="s3LoginButton" class="s3-login">Войти в SEKKES</button><button id="s3VoiceButton" class="s3-login">Выбрать голос</button><button id="s3ResumeAudio" class="s3-login" hidden>Включить звук</button><button id="s3EndLive" class="s3-end" hidden>Завершить голосовой разговор</button>';$('#aiFull').append(tools);$('#s3LoginButton').onclick=()=>logged()?logout():login();$('#s3VoiceButton').onclick=voicePicker;$('#s3EndLive').onclick=()=>endLive();$('#s3ResumeAudio').onclick=async()=>{if(await controller.resumeAudio())$('#s3ResumeAudio').hidden=true;}}
mount();
window.SekkesS2={toggleMic:startLive,sendText,interrupt:()=>endLive(),end:logout,login,voiceSettings:voicePicker,get busy(){return Boolean(live)},get dirty(){return Boolean(live||draft.value.trim()||textHistory.length||loginBusy)}};
addEventListener('sekkes:route',e=>{if(!['ai','text'].includes(e.detail.route)){picker?.close();if(live)endLive()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&live)endLive('Голосовой разговор остановлен при уходе из приложения.')});
addEventListener('pagehide',()=>{picker?.close();endLive();});
try{const r=await fetch(new URL('../s2-config.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});config=await r.json();api=new S3Api(config);const catalog=await fetch(new URL('../voices.json',import.meta.url),{cache:'no-store'});if(!catalog.ok)throw Error('VOICE_CATALOG_UNAVAILABLE');voiceManifest=await catalog.json();preferences=new VoicePreferences({profile:supabaseVoiceProfile(api),enabledIds:voiceManifest.voices.filter(v=>v.enabled).map(v=>v.id),defaultVoice:voiceManifest.defaults.female,storage:{setItem:(k,v)=>localStorage.setItem(k,v)},onChange:id=>{selectedVoice=id;}});controller=new LiveSessionController({broker:new StageBroker(api),transportFactory:emit=>new WebRTCTransport(emit),mediaFactory:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}),onChange:liveState,closeMs:24000});status('Тест до 1 минуты · войди в SEKKES')}catch{status('Сервер SEKKES недоступен')}

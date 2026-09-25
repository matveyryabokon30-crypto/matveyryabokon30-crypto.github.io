import { S2Api, S2Error } from './s2-api-3.mjs';
import { VoiceCapture, base64 } from './voice-capture-3.mjs';
const $=s=>document.querySelector(s), CONSENT='sekkes-s2-openai-20260918';
const messages={SETUP_REQUIRED:'Сервер пока недоступен. Проверь соединение и попробуй позже.',INVALID_PROJECT:'Для AI Marius нужен отдельный сервер. Подключение к другому приложению запрещено.',AUTH_REQUIRED:'Войди в отдельную тестовую учётную запись AI Marius.',LOGIN_FAILED:'Почта или пароль не подошли. Нужен пароль, который ты создал для AI Marius, не пароль Gmail.',LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подожди немного перед следующей.',PROVIDER_UNAVAILABLE:'OpenAI не принял запрос. Баланс и доступ модели ещё требуют проверки. Автоматического повтора нет.',PROVIDER_CREDENTIALS:'OpenAI отклонил серверный ключ. Не вводи ключ в приложении.',PROVIDER_QUOTA:'OpenAI сообщил об исчерпанной квоте или балансе. Лимит AI Marius не пополняет баланс OpenAI.',MODEL_UNAVAILABLE:'Эта модель недоступна в проекте OpenAI. Нужна проверка серверной настройки.',INVALID_TEXT:'Одна фраза — до 2000 символов. Сократи сообщение.',API_KEY_REQUIRED:'На сервере отсутствует ключ OpenAI.',NETWORK_ERROR:'Нет связи с сервером. Сообщение осталось в поле.',OWNER_ONLY:'Этот тест доступен только приглашённому владельцу.',BUDGET_STOP:'Тестовый лимит остановил новые запросы. Дополнительные расходы автоматически не разрешаются.',TURN_BUSY:'Предыдущий запрос ещё завершается. Повтори позже.',DUPLICATE_TURN:'Этот запрос уже был принят. Повторная отправка не выполнена.',NO_SPEECH:'Не удалось выделить достаточно звука. Попробуй ещё раз.',TURN_INTERRUPTED:'Запрос остановлен. Уже отправленная часть могла быть обработана поставщиком.',REPLY_WITHHELD:'Ответ не прошёл проверку и не был показан. Попробуй уточнить запрос.',SAFETY_UNAVAILABLE:'Проверка ответа сейчас недоступна. Генерация остановлена.',MEMORY_LIMIT:'В этом тесте можно сохранить до десяти выбранных фактов.',SERVICE_UNAVAILABLE:'Сервис сейчас недоступен. Текст сохранён в поле; автоматического повтора нет.'};
let loginSerial=0, loginBusy=false, memoryBusy=false, dialogKind=null;
let api=null, config=null, state='disabled', controller=null, serial=0, accepted=false, history=[], playback=null, audioUrl=null, lastAudio=null, useMemory=false, mode='explore', transcript=[];
const draft=$('#draft'), dialog=$('#dialog'), body=$('#dialogContent');
const status=t=>{$('#aiStateLabel').textContent=t;};
function note(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(note.timer);note.timer=setTimeout(()=>$('#toast').hidden=true,6500);}
function failure(e){note(messages[e.code]||(['AbortError','TimeoutError'].includes(e.name)?'Запрос прерван или истекло время ожидания. Автоматического повтора нет.':messages.SERVICE_UNAVAILABLE));}
function busy(){return ['capturing','permission','sending','speaking'].includes(state);}
function setState(s){state=s;document.body.classList.toggle('mic-active',s==='capturing');const names={disabled:api?'Войди в AI Marius для разговора':'Подключение к серверу',signedout:'Войди в AI Marius для разговора',idle:'Готов к разговору',permission:'Ожидаем разрешение микрофона',capturing:'Слушаю · до 45 секунд',sending:'Готовлю ответ',speaking:'Говорит AI',paused:'Пауза',error:'Не удалось завершить запрос'};status(names[s]||s);const enter=$('#s2LoginButton');if(enter){enter.hidden=Boolean(api?.token);enter.disabled=!api;}const replay=$('#s2Playback');if(replay)replay.disabled=!lastAudio||busy();$('#micButton').setAttribute('aria-label',s==='capturing'?'Отправить голосовую фразу':s==='sending'||s==='speaking'?'Прервать ответ':'Говорить с AI');$('#micTestLink').textContent=s==='capturing'?'Отправить фразу':busy()?'Остановить':'Начать голосовой разговор';const end=$('#s2End');if(end)end.disabled=!api?.token&&!history.length;}
function view(html,kind='other'){dialogKind=kind;body.innerHTML=html;dialog.dataset.s2='true';if(!dialog.open)dialog.showModal();$('#dialogClose').focus({preventScroll:true});}
function title(t){return '<div class="kicker">AI Marius / ЗАКРЫТЫЙ ТЕСТ</div><h2 id="dialogTitle">'+t+'</h2>';}
async function ready(){
  if(!api){failure(new S2Error('SETUP_REQUIRED'));return false;}
  if(!api.token||Date.now()>=api.expiresAt){api.logout();accepted=false;history=[];transcript=[];lastAudio=null;renderTranscript();loginView();return false;}
  if(!accepted){consentView();return false;}
  return true;
}
function loginView(){
  if(!api){failure(new S2Error('SETUP_REQUIRED'));return;}
  view(title('Войти в AI Marius')+'<p>Введи почту и отдельный пароль, созданный в AI Marius AI. Не пароль от Gmail.</p><form id="s2Login"><label class="s2-label">Почта<input id="s2Email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" inputmode="email" required></label><label class="s2-label">Пароль<input id="s2Password" name="password" type="password" autocomplete="current-password" required></label><button class="rounded-action primary" type="submit">Войти</button><p id="s2LoginError" role="status"></p></form><p class="hint">Пароль не сохраняется приложением. Вход действует до закрытия этой страницы или выхода.</p>','login');
  const ticket=++loginSerial;
  $('#s2Login').addEventListener('submit',async e=>{
    e.preventDefault();if(loginBusy)return;loginBusy=true;
    const form=e.target,btn=form.querySelector('button'),password=form.querySelector('#s2Password');btn.disabled=true;
    try{
      await api.login(form.querySelector('#s2Email').value.trim(),password.value);
      if(ticket!==loginSerial||!dialog.open){api.logout();return;}
      password.value='';
      // Membership is verified without a paid model call. Nothing returned is logged.
      await api.request('memory');
      if(ticket!==loginSerial||!dialog.open){api.logout();return;}
      accepted=false;consentView();
    }catch(err){if(ticket===loginSerial&&dialog.open&&$('#s2LoginError')){$('#s2LoginError').textContent=messages[err.code]||messages.SERVICE_UNAVAILABLE;api.logout();}}
    finally{loginBusy=false;btn.disabled=false;}
  });
}
function consentView(){
  view(title('Перед началом')+'<p>Это AI, не человек и не экстренная служба. В первом тесте разговор идёт фразами: говоришь, отправляешь, слушаешь ответ. Озвучка создана искусственным интеллектом.</p><p>Текст, выбранная история и голосовая фраза передаются OpenAI. AI Marius не сохраняет аудио и историю разговора на сервере. У поставщика могут действовать собственные сроки хранения, включая журналы безопасности; режим полного отсутствия хранения сейчас не подтверждён.</p><label class="settings-row"><span>Мне 18 лет, я согласен с такой обработкой для теста.</span><input id="s2Consent" type="checkbox"></label><p class="hint">Долгосрочная память выключена. Сохраняются только факты, которые ты отдельно добавишь. Не вводи данные реальных клиентов.</p><div class="dialog-actions"><button class="rounded-action primary" id="s2Agree" disabled>Начать</button></div>','consent');
  $('#s2Consent').onchange=e=>$('#s2Agree').disabled=!e.target.checked;
  $('#s2Agree').onclick=()=>{accepted=true;dialogKind=null;dialog.close();setState('idle');note('Тест включён. Нажми микрофон или отправь текст.');};
}
function stopSound(){if(playback){playback.onended=null;playback.onerror=null;playback.pause();playback.removeAttribute('src');playback=null;}if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}}
function interrupt(){serial++;controller?.abort();controller=null;capture.cancel();stopSound();setState(api?.token?'paused':'disabled');}
const capture=new VoiceCapture(level=>{document.querySelectorAll('.wave i').forEach((bar,i)=>bar.style.transform=level?`scaleY(${1+Math.min(7,level*50)*(0.5+(i%4)/4)})`:'' );},()=>finishCapture());
async function toggleMic(){
  if(state==='capturing'){await finishCapture();return;}
  if(busy()){interrupt();return;}
  if(memoryBusy)return;
  if(!await ready())return;
  setState('permission');try{await capture.start();if(capture.running)setState('capturing');else setState('paused');}catch(e){setState('error');note(e.name==='NotAllowedError'?'Микрофон не разрешён. Можно писать текстом.':'Микрофон недоступен. Можно писать текстом.');}
}
async function finishCapture(){const bytes=capture.stop();if(!bytes){setState('paused');return;}await send({kind:'voice',audio:base64(bytes),speak:true});}
async function sendText(){if(memoryBusy)return;if(draft.value.length>2000){note(messages.INVALID_TEXT);return;}if(busy()){interrupt();return;}if(!draft.value.trim()){note('Напиши одну мысль, с которой начнём.');return;}if(!await ready())return;await send({kind:'text',text:draft.value.trim(),speak:false});}
function historyForRequest(){let total=0;const result=[];for(const item of [...history].reverse()){const content=item.content.slice(0,1200);if(total+content.length>6000||result.length>=8)break;result.unshift({role:item.role,content});total+=content.length;}return result;}
async function send(input){
  stopSound();lastAudio=null;const my=++serial;controller=new AbortController();setState('sending');
  try{
    const result=await api.request('turn',{method:'POST',signal:controller.signal,body:{...input,id:crypto.randomUUID(),mode,history:historyForRequest(),useMemory,adult:true,consent:CONSENT}});
    if(my!==serial)return;
    if(!['openai','safety_template'].includes(result.source)||typeof result.reply!=='string'||typeof result.text!=='string')throw new S2Error('SERVICE_UNAVAILABLE');
    history.push({role:'user',content:result.text},{role:'assistant',content:result.reply});history=history.slice(-8);
    transcript.push({role:'user',text:result.text},{role:result.source==='safety_template'?'help':'ai',text:result.reply});transcript=transcript.slice(-24);renderTranscript();
    if(input.kind==='text'&&draft.value.trim()===input.text)draft.value='';
    if(result.speech){lastAudio=result.speech;await play(result.speech,my);}else{setState('idle');if(result.speechError)note('Ответ есть в тексте. Озвучка временно недоступна.');}
  }catch(e){if(my!==serial)return;if(e.code==='AUTH_REQUIRED'||e.code==='OWNER_ONLY'){api.logout();accepted=false;history=[];transcript=[];lastAudio=null;renderTranscript();}setState('error');failure(e);}finally{if(my===serial)controller=null;}
}
async function play(speech,my=serial){
  if(speech.mime!=='audio/mpeg'||typeof speech.base64!=='string'||speech.base64.length>3400000)throw new S2Error('SERVICE_UNAVAILABLE');
  stopSound();const raw=atob(speech.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));audioUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));playback=new Audio(audioUrl);
  playback.onended=()=>{if(my===serial){stopSound();setState('idle');}};
  playback.onerror=()=>{if(my===serial){stopSound();setState('idle');note('Воспроизведение недоступно. Ответ остаётся в тексте.');}};
  try{await playback.play();if(my===serial)setState('speaking');else stopSound();}catch{if(my===serial){setState('idle');note('Нажми «Прослушать», чтобы включить звук.');}}
}
function renderTranscript(){const list=$('#s2Transcript');list.replaceChildren();for(const item of transcript){const p=document.createElement('p');p.className='s2-line '+item.role;const label=document.createElement('small');label.textContent=item.role==='user'?'Ты':item.role==='help'?'Проверенная справка':'AI';const text=document.createElement('span');text.textContent=item.text;p.append(label,text);list.append(p);}$('#s2TranscriptWrap').hidden=!transcript.length;if(transcript.length)$('#s2TranscriptWrap').open=true;}
async function memoryView(){
  if(busy()){note('Сначала останови текущую фразу или ответ.');return;}
  if(!await ready())return;
  try{const result=await api.request('memory');view(title('Моя память')+'<p>Только то, что ты сам добавил. Исправление или удаление очищает текущий контекст разговора на этом экране, чтобы старый факт не использовался из истории.</p><div id="s2MemoryList"></div><form id="s2MemoryForm"><label class="s2-label">Новый факт<textarea id="s2MemoryText" maxlength="400" required></textarea></label><button class="rounded-action primary" type="submit">Подтверждаю · сохранить</button></form><div class="dialog-actions"><button id="s2Export" class="rounded-action ghost">Экспортировать память</button></div>');
    for(const item of result.items){const row=document.createElement('div');row.className='s2-memory';const input=document.createElement('textarea');input.value=item.text;input.maxLength=400;input.setAttribute('aria-label','Сохранённый факт');const save=document.createElement('button');save.textContent='Изменить';const del=document.createElement('button');del.textContent='Забыть';row.append(input,save,del);$('#s2MemoryList').append(row);save.onclick=()=>mutateMemory({action:'update',id:item.id,text:input.value,confirm:true});del.onclick=()=>mutateMemory({id:item.id},'DELETE');}
    $('#s2MemoryForm').onsubmit=e=>{e.preventDefault();mutateMemory({action:'save',text:$('#s2MemoryText').value,confirm:true});};
    $('#s2Export').onclick=async()=>{try{const data=await api.request('export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sekkes-my-memory.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){failure(e);}};
  }catch(e){failure(e);}
}
async function mutateMemory(data,method='POST'){if(memoryBusy)return;memoryBusy=true;try{await api.request('memory',{method,body:{...data,consent:CONSENT}});history=[];transcript=[];lastAudio=null;renderTranscript();memoryBusy=false;await memoryView();note('Память обновлена. Старый контекст разговора очищен.');}catch(e){failure(e);}finally{memoryBusy=false;}}
function end(){loginSerial++;dialogKind=null;interrupt();api?.logout();accepted=false;history=[];transcript=[];lastAudio=null;draft.value='';useMemory=false;$('#s2UseMemory').checked=false;renderTranscript();if(dialog.open)dialog.close();setState('disabled');note('Разговор завершён. Локальный текст и вход очищены. Сохранённые тобой факты памяти можно удалить отдельно.');}
function mount(){
  const el=document.createElement('div');el.className='s2-tools';el.innerHTML='<button id="s2LoginButton" class="s2-enter">Войти в AI Marius</button><label>Как поговорим?<select id="s2Mode"><option value="explore">Разобраться</option><option value="listen">Выслушать</option><option value="rehearse">Подготовить разговор</option><option value="next_step">Следующий шаг</option></select></label><label class="s2-memory-toggle"><input id="s2UseMemory" type="checkbox"> Использовать мою память</label><div class="s2-actions"><button id="s2MemoryButton">Моя память</button><button id="s2Playback">Прослушать</button><button id="s2End">Завершить</button></div><details id="s2TranscriptWrap" hidden><summary>Текст разговора</summary><div id="s2Transcript" role="log" aria-live="polite"></div></details>';
  $('#aiFull').append(el);$('#s2LoginButton').onclick=()=>ready();$('#s2Mode').onchange=e=>mode=e.target.value;$('#s2UseMemory').onchange=e=>useMemory=e.target.checked;$('#s2MemoryButton').onclick=memoryView;$('#s2End').onclick=end;$('#s2Playback').onclick=()=>{if(lastAudio&&!busy())play(lastAudio).catch(failure);};
}
mount();
window.SekkesS2={toggleMic,sendText,interrupt,end,login:loginView,get busy(){return busy();},get dirty(){return Boolean(history.length||transcript.length||busy()||loginBusy||memoryBusy);}};
addEventListener('sekkes:route',e=>{if(!['ai','text'].includes(e.detail.route)&&busy())interrupt();if(!busy())setState(api?.token?'idle':'disabled');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&busy())interrupt();});addEventListener('pagehide',()=>{loginSerial++;dialogKind=null;interrupt();api?.logout();accepted=false;history=[];transcript=[];lastAudio=null;draft.value='';renderTranscript();});
dialog.addEventListener('close',()=>{if(dialogKind==='login'){loginSerial++;api?.logout();loginBusy=false;}dialogKind=null;const password=$('#s2Password');if(password)password.value='';});
try{
  const r=await fetch(new URL('../s2-config.json',import.meta.url),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new S2Error('SETUP_REQUIRED');config=await r.json();api=new S2Api(config);setState('disabled');
  const rstatus=await api.request('status');if(!rstatus.configured)note('Сервер доступен, но настройка AI ещё не завершена.');
}catch{setState('disabled');}

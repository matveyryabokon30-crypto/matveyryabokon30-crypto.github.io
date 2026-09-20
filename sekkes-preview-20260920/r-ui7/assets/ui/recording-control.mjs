import {ChatRecorder,audioBase64} from './chat-recorder.mjs';
import {el,icon} from './components.mjs';
const errors={MIC_DENIED:'Нет доступа к микрофону. Разреши его в настройках браузера.',AUDIO_UNSUPPORTED:'Этот браузер не поддерживает запись. Открой SEKKES в Safari или Chrome.',RECORDING_TOO_SHORT:'Запись слишком короткая. Попробуй ещё раз.',RECORDING_FAILED:'Запись прервана. Микрофон выключен.'};
export function recordingControl(ctx,panel,mic,signal,recorderOptions={}){
 let url=null,sending=false,requestId=null,pending=null,disposed=false,generation=0;
 const revoke=()=>{if(url){URL.revokeObjectURL(url);url=null}};
 const button=(text,action)=>{const b=el('button','record-action',text);b.type='button';b.onclick=action;return b};
 function render({state,seconds=0,clip,code}){
  panel.querySelectorAll('audio').forEach(a=>a.pause());panel.replaceChildren();panel.hidden=state==='idle';panel.dataset.state=state;
  mic.disabled=sending||state==='processing';mic.setAttribute('aria-label',state==='recording'?'Остановить запись':state==='permission'?'Отменить запрос микрофона':'Записать голосовое сообщение');mic.innerHTML=icon(state==='recording'||state==='permission'?'close':'record');
  if(state==='recording'||state==='permission'){panel.append(el('span','record-status',state==='recording'?`Запись ${seconds} / 45 сек.`:'Разреши доступ к микрофону'),button(state==='recording'?'Остановить запись':'Отменить',()=>recorder.finish()));}
  if(state==='processing')panel.append(el('span','','Микрофон выключен. Готовлю запись…'));
  if(state==='ready'){revoke();url=URL.createObjectURL(new Blob([clip.bytes],{type:'audio/wav'}));const audio=el('audio');audio.controls=true;audio.preload='metadata';audio.src=url;audio.setAttribute('aria-label','Прослушать запись');const row=el('div','record-actions');row.append(button('Удалить',()=>{pending=null;requestId=null;revoke();recorder.cancel()}),button('Отправить запись',send));panel.append(el('span','record-status',`Голосовое сообщение · ${clip.duration.toFixed(1)} сек.`),audio,el('small','','Расшифровка появится после отправки. Запись не сохраняется в серверную память.'),row);}
  if(state==='sending')panel.append(el('span','','Расшифровываю сообщение… Микрофон выключен.'));
  if(state==='error')panel.append(el('span','record-error',errors[code]||'Не удалось обработать запись. Микрофон выключен.'));
 }
 const recorder=new ChatRecorder({...recorderOptions,onState:render});
 async function send(){
  if(sending||!recorder.clip)return;if(ctx.dictationBusy?.())return ctx.notify('Сначала заверши голосовой набор.');if(ctx.runtime()?.busy)return ctx.notify('Сначала заверши разговор или дождись ответа.');
  const epoch=generation;sending=true;pending=recorder.clip;requestId ||= crypto.randomUUID();render({state:'sending'});
  try{const response=await ctx.runtime()?.sendVoice({id:requestId,audio:audioBase64(pending.bytes)});if(disposed||epoch!==generation)return;
   if(response){ctx.renderVoice(response,pending);pending=null;requestId=null;revoke();recorder.cancel()}else render({state:'ready',clip:pending});
  }catch(e){if(!disposed&&epoch===generation){render({state:'ready',clip:pending});ctx.notify(e?.code==='DUPLICATE_TURN'?'Сервер уже принял запись. Повторная отправка заблокирована.':'Не удалось получить расшифровку. Запись осталась на главной; можно повторить отправку.')}}
  finally{if(epoch===generation){sending=false;if(!disposed)mic.disabled=false}}
 }
 mic.addEventListener('click',()=>{if(recorder.capturing)return recorder.finish();if(ctx.dictationBusy?.())return ctx.notify('Сначала заверши голосовой набор.');if(ctx.runtime()?.busy)return ctx.notify('Сначала заверши голосовой разговор.');if(recorder.clip)return ctx.notify('Сначала отправь или удали текущую запись.');ctx.pauseMedia();recorder.start()},{signal});
 const hidden=()=>{if(document.hidden&&recorder.capturing)recorder.finish()};document.addEventListener('visibilitychange',hidden,{signal});
 return {get busy(){return recorder.capturing||sending},send,beforeRoute(){if(recorder.capturing)recorder.finish()},reset(){++generation;sending=false;pending=null;requestId=null;revoke();recorder.cancel()},dispose(){++generation;disposed=true;revoke();recorder.dispose()}};
}

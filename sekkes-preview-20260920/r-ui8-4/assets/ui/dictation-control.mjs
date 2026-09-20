import {Dictation} from './dictation.mjs';
import {icon} from './components.mjs';
export function dictationControl({ctx,button,draft,status,signal,options={}}){
 const errors={unsupported:'Голосовой набор браузера недоступен. Используй микрофон системной клавиатуры или запись сообщения.', 'not-allowed':'Разреши распознавание речи и микрофон в настройках браузера.', 'service-not-allowed':'Браузер не разрешил распознавание речи. Доступна диктовка системной клавиатуры.', 'audio-capture':'Микрофон недоступен.',network:'Распознавание браузера недоступно без подключения к его сервису.', 'no-speech':'Речь не распознана. Попробуй ещё раз.'};
 const dictation=new Dictation({...options,onText(text){draft.value=text;draft.dispatchEvent(new Event('input',{bubbles:true}))},onState({state,code}){
  const busy=['permission','listening','stopping'].includes(state);draft.readOnly=busy;
  button.setAttribute('aria-label',busy?'Остановить голосовой набор':'Голосовой набор');button.setAttribute('aria-pressed',String(busy));button.innerHTML=icon(busy?'close':'mic');
  status.hidden=!busy;status.textContent=state==='permission'?'Голосовой набор браузера · подключение…':state==='stopping'?'Завершаю распознавание…':'Говори. Текст можно исправить перед отправкой.';
  ctx.captureChanged();if(state==='error')ctx.notify(errors[code]||'Не удалось включить голосовой набор. Текст сохранён.');
 }});
 button.innerHTML=icon('mic');
 button.addEventListener('click',()=>{if(dictation.busy)return dictation.stop();if(ctx.otherCaptureBusy()||ctx.runtime()?.busy)return ctx.notify('Сначала заверши текущий разговор или запись.');ctx.pauseMedia();dictation.start(draft.value)},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dictation.busy)dictation.cancel()},{signal});
 return dictation;
}

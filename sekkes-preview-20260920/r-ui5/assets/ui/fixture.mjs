// EXPLICIT QA ONLY: fake transport/capture; no S3Api, Auth, WebRTC or provider call.
import {encodeWav} from './chat-recorder.mjs';
const wav=encodeWav([Float32Array.from({length:32000},(_,i)=>.1*Math.sin(i/15))],16000);
class FixtureRecorder{static isTypeSupported(){return true}constructor(){this.state='inactive';this.mimeType='audio/webm'}start(){this.state='recording'}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['QA fixture'])});this.onstop?.()})}}
export const options={recorderOptions:{Recorder:FixtureRecorder,mediaDevices:{async getUserMedia(){return{getTracks:()=>[{stop(){}}]}}},decode:async()=>wav}};
export function install(){
 let active=false;
 window.SekkesS2={toggleMic(){active=!active;window.SekkesUI.voice(active?'listening':'idle');window.SekkesUI.status(active?'QA fixture · голосовой интерфейс':'QA fixture · без сервиса');},
 sendText(){window.SekkesUI.beforeText();const d=document.querySelector('#draft');if(!d.value.trim())return;window.SekkesUI.render('user',d.value);window.SekkesUI.render('ai','## Проверка отображения\nЭто **тестовое сообщение**, не ответ сервиса.\n- Структура текста\n- Читаемые строки\n[Справка](https://www.w3.org/TR/WCAG22/)\n> Контент используется только для проверки интерфейса.');d.value=''},
 async sendVoice(){return{text:'Тестовая расшифровка: проверка голосового сообщения.',reply:'QA fixture · ответ для проверки интерфейса. Реальная расшифровка не выполнялась.',journalSaved:false}},
 get busy(){return active},get dirty(){return active||document.querySelector('#draft').value.length>0},voiceSettings(){},accountAction(){}};
 window.SekkesUI.status('QA fixture · без сервиса');
}

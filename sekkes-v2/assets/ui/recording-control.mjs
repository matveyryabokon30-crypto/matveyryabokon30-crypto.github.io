import {ChatRecorder,audioBase64} from './chat-recorder.mjs';
import {icon} from './components.mjs';
// One microphone and one send button, both inside the existing composer.
export function recordingControl(ctx,panel,mic,signal,recorderOptions={}){
 let sending=false,requestId=null,disposed=false,generation=0,sendWhenReady=false;
 const recorder=new ChatRecorder({...recorderOptions,onState:render});
 function render({state,code}){
  if(disposed)return;panel.hidden=true;panel.replaceChildren();
  mic.dataset.recording=state;mic.setAttribute('aria-pressed',String(state==='recording'));
  mic.disabled=sending||state==='processing';
  mic.setAttribute('aria-label',recorder.capturing||recorder.clip?'Отменить запись':'Записать сообщение');
  mic.innerHTML=icon(recorder.capturing||recorder.clip?'close':'mic');
  if(code)ctx.sendError(code);ctx.captureChanged();
  if(state==='ready'&&sendWhenReady){sendWhenReady=false;queueMicrotask(send);}
 }
 async function send(){
  if(sending||disposed)return;
  if(recorder.state==='recording'){sendWhenReady=true;recorder.finish();return;}
  if(!recorder.clip)return;
  const epoch=generation;sending=true;requestId ||= crypto.randomUUID();render({state:'sending'});
  try{
   const response=await ctx.runtime()?.sendVoice({id:requestId,audio:audioBase64(recorder.clip.bytes)});
   if(disposed||epoch!==generation)return;
   if(response){requestId=null;recorder.cancel();}
  }catch(e){if(!disposed&&epoch===generation){if(!['TURN_INTERRUPTED','SERVICE_UNAVAILABLE','DUPLICATE_TURN'].includes(e.code))requestId=null;ctx.sendError(e.code||'RECORDING_FAILED');}}
  finally{if(epoch===generation){sending=false;if(!disposed)render({state:recorder.state});}}
 }
 mic.addEventListener('click',()=>{
  if(sending)return;if(recorder.capturing||recorder.clip){sendWhenReady=false;requestId=null;recorder.cancel();return;}
  if(ctx.runtime()?.busy)return;ctx.sendError('');ctx.pauseMedia();recorder.start();
 },{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder.capturing){sendWhenReady=false;recorder.finish();}},{signal});
 return {get busy(){return recorder.capturing||sending},get hasAudio(){return Boolean(recorder.clip)||recorder.state==='recording'},get canSend(){return !sending&&(Boolean(recorder.clip)||recorder.state==='recording')},send,
  beforeRoute(){sendWhenReady=false;if(recorder.capturing)recorder.finish();},
  reset(){++generation;sending=false;requestId=null;sendWhenReady=false;recorder.cancel();},
  dispose(){++generation;disposed=true;recorder.dispose();}};
}

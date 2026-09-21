import {ChatRecorder,audioBase64} from './chat-recorder.mjs';
import {micWave} from './mic-wave.mjs';
import {icon} from './components.mjs';
// One microphone and one send button, both inside the existing composer.
export function recordingControl(ctx,panel,mic,signal,recorderOptions={}){
 let sending=false,requestId=null,disposed=false,generation=0,sendWhenReady=false;
 const composer=mic.closest('form'),canvas=document.createElement('canvas');canvas.className='mic-wave';canvas.hidden=true;canvas.setAttribute('aria-label','Запись голоса');composer.insertBefore(canvas,mic);const wave=micWave(canvas);
 const recorder=new ChatRecorder({...recorderOptions,onState:render});
 function render({state,code}){
  if(disposed)return;canvas.hidden=state!=='recording';composer.dataset.wave=String(state==='recording');try{if(state==='recording')wave.start(recorder.record.stream);else if(state==='processing')wave.pause();else if(state!=='permission')wave.stop();}catch{/* Meter cannot interrupt capture or delivery. */}
  if(state==='error'&&requestId)ctx.runtime()?.voiceFailed?.(requestId);
  panel.hidden=true;panel.replaceChildren();
  mic.dataset.recording=state;mic.setAttribute('aria-pressed',String(state==='recording'));
  mic.disabled=sending||state==='processing';
  mic.setAttribute('aria-label',recorder.capturing||recorder.clip?'Отменить запись':'Записать сообщение');
  mic.innerHTML=icon(recorder.capturing||recorder.clip?'close':'mic');
  if(code)ctx.sendError(code);ctx.captureChanged();
  if(state==='ready'&&sendWhenReady){sendWhenReady=false;queueMicrotask(send);}
 }
 async function send(){
  if(sending||disposed)return;
  if(recorder.state==='recording'){requestId ||= crypto.randomUUID();ctx.runtime()?.voicePending?.(requestId);sendWhenReady=true;recorder.finish();return;}
  if(!recorder.clip)return;
  const epoch=generation;sending=true;requestId ||= crypto.randomUUID();ctx.runtime()?.voicePending?.(requestId);render({state:'sending'});
  try{
   const response=await ctx.runtime()?.sendVoice({id:requestId,audio:audioBase64(recorder.clip.bytes)});
   if(disposed||epoch!==generation)return;
   if(response){requestId=null;recorder.cancel();}
  }catch(e){if(!disposed&&epoch===generation){if(!['TURN_INTERRUPTED','SERVICE_UNAVAILABLE','DUPLICATE_TURN'].includes(e.code))requestId=null;ctx.sendError(e.code||'RECORDING_FAILED');}}
  finally{if(epoch===generation){sending=false;if(!disposed)render({state:recorder.state});}}
 }
 mic.addEventListener('click',()=>{
  if(sending)return;if(recorder.capturing||recorder.clip){sendWhenReady=false;requestId=null;recorder.cancel();return;}
  if(ctx.runtime()?.busy)return;ctx.sendError('');ctx.pauseMedia();ctx.runtime()?.recordingStarted?.();wave.unlock();recorder.start();
 },{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder.capturing){sendWhenReady=false;recorder.finish();}},{signal});
 return {get busy(){return recorder.capturing||sending},get capturing(){return recorder.capturing},get hasAudio(){return !sending&&(Boolean(recorder.clip)||recorder.state==='recording')},get canSend(){return !sending&&(Boolean(recorder.clip)||recorder.state==='recording')},send,
  beforeRoute(){sendWhenReady=false;if(recorder.capturing)recorder.finish();},
  reset(){++generation;sending=false;requestId=null;sendWhenReady=false;recorder.cancel();},
  dispose(){++generation;disposed=true;wave.stop();canvas.remove();recorder.dispose();}};
}

// Separate, bounded recording capability. It never creates a Live/WebRTC session.
export function encodeWav(channels,sampleRate){
 const frames=Math.min(Math.floor(channels[0].length*16000/sampleRate),45*16000),bytes=new Uint8Array(44+frames*2),v=new DataView(bytes.buffer);
 const str=(offset,s)=>{for(let i=0;i<s.length;i++)bytes[offset+i]=s.charCodeAt(i)};
 str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*2,true);
 for(let i=0;i<frames;i++){const p=i*sampleRate/16000,k=Math.floor(p),f=p-k;let x=0;for(const c of channels)x+=(c[k]||0)*(1-f)+(c[Math.min(k+1,c.length-1)]||0)*f;x=Math.max(-1,Math.min(1,x/channels.length));v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true)}return bytes;
}
export async function decodeRecording(blob){
 const Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Context)throw Error('AUDIO_UNSUPPORTED');
 const context=new Context(1,1,16000),buffer=await context.decodeAudioData(await blob.arrayBuffer());
 return encodeWav(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate);
}
export function audioBase64(bytes){let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary)}
export class ChatRecorder{
 constructor({mediaDevices=navigator.mediaDevices,Recorder=globalThis.MediaRecorder,decode=decodeRecording,onState=()=>{},clock=()=>Date.now(),timers=globalThis}={}){Object.assign(this,{mediaDevices,Recorder,decode,onState,clock,timers});this.state='idle';this.generation=0;this.record=null;this.clip=null;}
 get capturing(){return ['permission','recording','processing'].includes(this.state)}
 emit(state,detail={}){this.state=state;try{this.onState({state,...detail})}catch{/* Presentation cannot strand microphone lifecycle. */}}
 async start(){
  if(this.capturing)return;this.clearClip();const generation=++this.generation;this.emit('permission');
  let stream;
  try{
   if(!this.mediaDevices?.getUserMedia||!this.Recorder)throw Error('AUDIO_UNSUPPORTED');
   stream=await this.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return}
   const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>this.Recorder.isTypeSupported?.(x));
   const recorder=new this.Recorder(stream,mime?{mimeType:mime}:undefined),chunks=[];
   const record={stream,recorder,chunks,generation,started:this.clock()};this.record=record;
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=()=>this.fail(record,Error('RECORDING_FAILED'));
   recorder.onstop=()=>this.convert(record);
   recorder.start(250);this.emit('recording',{seconds:0});
   record.timer=this.timers.setTimeout(()=>this.finish(),45000);
   record.tick=this.timers.setInterval(()=>{if(this.record===record&&this.state==='recording')this.onState({state:'recording',seconds:Math.min(45,Math.floor((this.clock()-record.started)/1000))})},1000);
  }catch(e){stream?.getTracks().forEach(t=>t.stop());if(generation===this.generation)this.fail(this.record,e)}
 }
 release(record){if(!record)return;record.stream.getTracks().forEach(t=>t.stop());this.timers.clearTimeout(record.timer);this.timers.clearInterval(record.tick)}
 finish(){const record=this.record;if(this.state==='permission')return this.cancel();if(this.state!=='recording'||!record)return;this.emit('processing');try{record.recorder.stop()}catch(e){this.fail(record,e)}finally{this.release(record)}record.timeout=this.timers.setTimeout(()=>this.fail(record,Error('RECORDING_FAILED')),6000)}
 async convert(record){
  this.release(record);if(record.generation!==this.generation)return;
  try{const bytes=await this.decode(new Blob(record.chunks,{type:record.recorder.mimeType}));if(record.generation!==this.generation)return;if(bytes.length<6444)throw Error('RECORDING_TOO_SHORT');this.timers.clearTimeout(record.timeout);this.record=null;this.clip={bytes,duration:(bytes.length-44)/32000};this.emit('ready',{clip:this.clip})}catch(e){if(record.generation===this.generation)this.fail(record,e)}
 }
 fail(record,error){this.release(record);this.timers.clearTimeout(record?.timeout);if(record&&record.generation!==this.generation)return;++this.generation;if(record?.recorder.state==='recording')try{record.recorder.stop()}catch{}this.record=null;this.emit('error',{code:error.name==='NotAllowedError'?'MIC_DENIED':error.message})}
 clearClip(){this.clip=null}
 cancel(){++this.generation;const record=this.record;this.record=null;this.release(record);this.timers.clearTimeout(record?.timeout);if(record&&record.recorder.state!=='inactive')try{record.recorder.stop()}catch{}this.clearClip();this.emit('idle')}
 dispose(){this.cancel()}
}


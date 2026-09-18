/** Local capture only. The caller explicitly decides whether to send the WAV. */
export function encodeWav(chunks,inputRate) {
  const sourceLength=chunks.reduce((n,c)=>n+c.length,0);
  const source=new Float32Array(sourceLength);let offset=0;for(const c of chunks){source.set(c,offset);offset+=c.length;}
  const count=Math.min(720000,Math.floor(sourceLength*16000/inputRate));
  const buffer=new ArrayBuffer(44+count*2), v=new DataView(buffer);
  const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){const a=Math.floor(i*inputRate/16000),b=Math.min(sourceLength,Math.max(a+1,Math.floor((i+1)*inputRate/16000)));let x=0;for(let j=a;j<b;j++)x+=source[j];x=Math.max(-1,Math.min(1,x/(b-a)));v.setInt16(44+i*2,Math.round(x<0?x*32768:x*32767),true);}
  return new Uint8Array(buffer);
}
export function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export class VoiceCapture {
  constructor(onLevel=()=>{},onLimit=()=>{}){this.onLevel=onLevel;this.onLimit=onLimit;this.seq=0;this.pending=false;this.running=false;}
  async start(){
    if(this.pending||this.running)return;
    const seq=++this.seq;this.pending=true;this.chunks=[];this.samples=0;
    let stream;
    try{
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C||!navigator.mediaDevices?.getUserMedia)throw new Error('AUDIO_UNSUPPORTED');
      this.context=new C();this.context.resume().catch(()=>{});
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
      if(seq!==this.seq||document.hidden){stream.getTracks().forEach(t=>t.stop());if(seq===this.seq)this.cancel();return;}
      this.stream=stream;
      await this.context.audioWorklet.addModule(new URL('./voice-worklet.mjs',import.meta.url));
      if(seq!==this.seq||document.hidden){if(seq===this.seq)this.cancel();return;}
      this.node=new AudioWorkletNode(this.context,'sekkes-pcm');
      this.source=this.context.createMediaStreamSource(stream);this.source.connect(this.node);
      this.mute=this.context.createGain();this.mute.gain.value=0;this.node.connect(this.mute);this.mute.connect(this.context.destination);
      this.node.port.onmessage=({data})=>{if(!this.running||seq!==this.seq)return;const left=Math.floor(this.context.sampleRate*45-this.samples);if(left>0){const chunk=data.slice(0,left);this.chunks.push(chunk);this.samples+=chunk.length;}let sum=0;for(const x of data)sum+=x*x;this.onLevel(Math.sqrt(sum/data.length));};
      await this.context.resume();
      if(seq!==this.seq||document.hidden){if(seq===this.seq)this.cancel();return;}
      this.running=true;this.pending=false;this.started=Date.now();this.timer=setTimeout(()=>this.onLimit(),45000);
    }catch(e){if(stream)stream.getTracks().forEach(t=>t.stop());if(seq===this.seq)this.cancel();throw e;}
  }
  stop(){if(!this.running){this.cancel();return null;}const chunks=this.chunks.slice(),rate=this.context.sampleRate;this.cancel();return encodeWav(chunks,rate);}
  cancel(){this.seq++;this.pending=false;this.running=false;clearTimeout(this.timer);this.stream?.getTracks().forEach(t=>t.stop());try{this.source?.disconnect();this.node?.disconnect();this.mute?.disconnect();this.context?.close().catch(()=>{});}catch{}this.stream=null;this.node=null;this.source=null;this.context=null;this.chunks=[];this.onLevel(0);}
}

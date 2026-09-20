// Owner-selected exact audio: option 05 Air / option 10 Exhale, 2 seconds each.
// Decode ahead of readiness; audio failure must never block session controls.
export class SessionCues {
 constructor({Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetcher=(...a)=>fetch(...a),now=()=>Date.now()}={}){
  this.Context=Context;this.now=now;this.epoch=0;this.context=null;this.source=null;this.buffers={};this.pending={};
  this.bytes=Object.fromEntries(['start','end'].map(kind=>[kind,fetcher(new URL(kind==='start'?'./sounds/air-start.mp3':'./sounds/exhale-end.mp3',import.meta.url)).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null)]));
 }
 unlock(){
  try{
   if(!this.context&&this.Context)this.context=new this.Context();
   if(!this.context)return;
   const resumed=this.context.state!=='running'?this.context.resume().catch(()=>{}):Promise.resolve();
   for(const kind of ['start','end'])if(!this.pending[kind])this.pending[kind]=this.bytes[kind].then(b=>b?this.context.decodeAudioData(b):null).then(b=>(this.buffers[kind]=b)).catch(()=>null);
   return resumed;
  }catch{}
 }
 cancel(){++this.epoch;try{this.source?.stop()}catch{}this.source=null;}
 play(kind){
  this.cancel();const epoch=this.epoch,at=this.now();const resumed=this.unlock();
  const start=buffer=>{
   // Never play a stale arrival cue after Stop or a long download/resume delay.
   if(!buffer||epoch!==this.epoch||this.now()-at>350||this.context?.state!=='running')return;
   try{const s=this.context.createBufferSource();s.buffer=buffer;s.connect(this.context.destination);this.source=s;s.onended=()=>{s.disconnect();if(this.source===s)this.source=null};s.start();}catch{}
  };
  if(this.buffers[kind]&&this.context?.state==='running')start(this.buffers[kind]);
  else Promise.all([this.pending[kind],resumed]).then(([buffer])=>start(buffer)).catch(()=>{});
 }
}
export const sessionCues=typeof window!=='undefined'?new SessionCues():null;

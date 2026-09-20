// Owner-selected exact audio: option 05 Air / option 10 Exhale, 2 seconds each.
// Decode ahead of readiness; audio failure must never block session controls.
export class SessionCues {
 constructor({Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetcher=(...a)=>fetch(...a),now=()=>Date.now(),later=(fn,ms)=>setTimeout(fn,ms),clear=id=>clearTimeout(id)}={}){
  this.later=later;this.clear=clear;this.retry=null;this.resumePending=false;this.remoteCount=0;this.request=null;this.Context=Context;this.now=now;this.epoch=0;this.context=null;this.source=null;this.buffers={};this.pending={};
  this.bytes=Object.fromEntries(['start','end'].map(kind=>[kind,fetcher(new URL(kind==='start'?'./sounds/air-start.mp3':'./sounds/exhale-end.mp3',import.meta.url)).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null)]));
 }
 unlock(){
  try{
   if(!this.context&&this.Context){this.context=new this.Context();this.context.onstatechange=()=>{if(this.remoteCount)this.resume();this.pump();};}
   if(!this.context)return;
   this.resume();
   for(const kind of ['start','end'])if(!this.pending[kind])this.pending[kind]=this.bytes[kind].then(b=>b?this.context.decodeAudioData(b):null).then(b=>{this.buffers[kind]=b;this.pump();return b}).catch(()=>null);
   
  }catch{}
 }
 // Keep voice and cues on one output graph; no second HTMLAudio playback route.
 attachRemote(stream){
  this.unlock();if(!this.context?.createMediaStreamSource)return null;
  try{const node=this.context.createMediaStreamSource(stream);node.connect(this.context.destination);this.remoteCount++;let detached=false;
   return {disconnect:()=>{if(detached)return;detached=true;node.disconnect();this.remoteCount--;}};
  }catch{return null}
 }
 resume(){
  if(!this.context||this.context.state==='running'||this.context.state==='closed'||this.resumePending)return;
  this.resumePending=true;
  try{Promise.resolve(this.context.resume()).catch(()=>{}).finally(()=>{this.resumePending=false;this.pump();});}catch{this.resumePending=false;}
 }
 cancel(){
  ++this.epoch;this.request=null;if(this.retry!==null)this.clear(this.retry);this.retry=null;
  try{this.source?.stop()}catch{}this.source=null;
 }
 play(kind){
  this.cancel();this.request={kind,at:this.now(),epoch:this.epoch,started:false};this.unlock();this.pump();
 }
 pump(){
  const r=this.request;
  if(!r){return;}
  if(r.epoch!==this.epoch)return;
  // Allow an iOS route transition to recover, while cancelling stale cues on new actions.
  if(this.now()-r.at>(r.started?5000:2500)){this.cancel();return;}
  if(this.context?.state==='running'&&!r.started&&this.buffers[r.kind]){
   try{const s=this.context.createBufferSource();s.buffer=this.buffers[r.kind];s.connect(this.context.destination);this.source=s;r.started=true;
    s.onended=()=>{try{s.disconnect()}catch{}if(this.source===s){this.source=null;this.request=null;if(this.retry!==null)this.clear(this.retry);this.retry=null;}};s.start();
   }catch{this.cancel();return;}
  }
  if(this.retry===null&&(this.context?.state!=='running'||!r.started))this.retry=this.later(()=>{this.retry=null;if(this.request!==r)return;this.resume();this.pump();},80);
 }
}
export const sessionCues=typeof window!=='undefined'?new SessionCues():null;

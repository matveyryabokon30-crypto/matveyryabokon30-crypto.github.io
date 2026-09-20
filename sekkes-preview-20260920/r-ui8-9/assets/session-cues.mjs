// Isolated HTML media cues. Never create or share an AudioContext with the call.
export class SessionCues {
 constructor({AudioClass=globalThis.Audio}={}){
  this.audio={};this.epoch=0;this.finish=null;
  for(const kind of ['start','end'])try{const a=new AudioClass(new URL(kind==='start'?'./sounds/air-start.mp3':'./sounds/exhale-end.mp3',import.meta.url).href);a.preload='auto';a.playsInline=true;a.load();this.audio[kind]=a;}catch{}
 }
 unlock(){}

 cancel(){this.finish?.();++this.epoch;for(const a of Object.values(this.audio))try{a.pause();a.currentTime=0;a.muted=false;}catch{}}
 play(kind){
  this.cancel();const a=this.audio[kind];if(!a)return Promise.resolve();
  // Completion is bounded and resolves on cancellation/error; Stop never waits for it.
  return new Promise(resolve=>{
   let done=false,timer;
   const finish=()=>{if(done)return;done=true;clearTimeout(timer);a.onended=null;a.onerror=null;if(this.finish===finish)this.finish=null;resolve();};
   this.finish=finish;a.onended=finish;a.onerror=finish;
   timer=setTimeout(()=>{try{a.pause()}catch{}finish();},2400);
   try{a.muted=false;a.currentTime=0;Promise.resolve(a.play()).catch(finish);}catch{finish();}
  });
 }
}
export const sessionCues=typeof window!=='undefined'?new SessionCues():null;

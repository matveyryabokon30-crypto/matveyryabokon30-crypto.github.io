import {assessVoice, ContractError} from './registry-foundation.mjs?v=2026.09.20-s3.27';
/** Static audio only. Call play() directly in the user's click handler; no await before it. */
export class StaticVoicePreview {
  constructor({audioFactory, origin, onState=()=>{}, loadTimeoutMs=15000, timers={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}}) {
    if(typeof audioFactory!=='function') throw new ContractError('AUDIO_FACTORY_REQUIRED');
    const base=new URL(origin);
    if(!['https:','http:'].includes(base.protocol)) throw new ContractError('INVALID_ASSET_ORIGIN');
    this.origin=base.origin; this.factory=audioFactory; this.notify=onState; this.timers=timers;
    this.timeout=loadTimeoutMs; this.generation=0; this.audio=null; this.timer=null; this.disposed=false;
  }
  emit(state,voice,code=null){this.notify(Object.freeze({state,voice,code}));}
  stop(){
    this.generation++;
    if(this.timer!==null)this.timers.clear(this.timer);
    this.timer=null;
    if(this.audio){const a=this.audio;this.audio=null;a.pause();a.removeAttribute('src');a.load();}
  }
  play(voice){
    if(this.disposed) return Promise.reject(new ContractError('PLAYER_DISPOSED'));
    const failures=assessVoice(voice);
    if(voice?.enabled!==true || failures.length) return Promise.reject(new ContractError('VOICE_NOT_READY'));
    const url=new URL(voice.preview.url,this.origin);
    if(url.origin!==this.origin || url.username || url.password || url.search || url.hash)
      return Promise.reject(new ContractError('INVALID_ASSET_URL'));
    this.stop(); const ticket=this.generation;
    const a=this.factory(); this.audio=a; a.preload='none'; a.playsInline=true;
    const current=()=>ticket===this.generation && this.audio===a;
    const failed=code=>{if(!current())return;this.stop();this.emit('error',voice.id,code);};
    a.addEventListener('error',()=>failed('AUDIO_ASSET_ERROR'));
    a.addEventListener('ended',()=>{if(current()){this.stop();this.emit('idle',voice.id);}});
    a.addEventListener('playing',()=>{if(current()){if(this.timer!==null)this.timers.clear(this.timer);this.timer=null;this.emit('playing',voice.id);}});
    this.emit('loading',voice.id);
    this.timer=this.timers.set(()=>failed('AUDIO_LOAD_TIMEOUT'),this.timeout);
    a.src=url.href;
    let started;
    try{started=a.play();}catch(e){failed(e.name==='NotAllowedError'?'AUDIO_GESTURE_REQUIRED':'AUDIO_PLAY_ERROR');return Promise.reject(e);}
    return Promise.resolve(started).catch(e=>{failed(e.name==='NotAllowedError'?'AUDIO_GESTURE_REQUIRED':'AUDIO_PLAY_ERROR');throw e;});
  }
  dispose(){this.stop();this.disposed=true;this.emit('idle',null);}
}


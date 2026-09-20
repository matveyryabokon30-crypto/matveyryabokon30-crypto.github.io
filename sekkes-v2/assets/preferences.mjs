import {normalizePreference} from './registry-foundation.mjs?v=2026.09.20-s3.26';

// A voice preference is user-editable data, never an authorization claim.
export class VoicePreferences {
  constructor({profile, enabledIds, storage, defaultVoice='echo', onChange=()=>{}}) {
    Object.assign(this,{profile,enabledIds,storage,onChange});
    this.defaultVoice=normalizePreference(null,enabledIds,defaultVoice).id;
    this.selected=this.defaultVoice;this.epoch=0;this.busy=false;this.loaded=false;
  }
  async load() {
    const epoch=++this.epoch;
    this.loaded=false;
    const saved=await this.profile.read();
    if(epoch!==this.epoch)return;
    const {id}=normalizePreference(saved,this.enabledIds,this.defaultVoice);
    this.selected=id;this.loaded=true;this.cache(id);this.onChange(id);
    return id;
  }
  async select(id) {
    if(!this.enabledIds.includes(id))throw Error('VOICE_UNAVAILABLE');
    if(!this.loaded)throw Error('PROFILE_REQUIRED');
    if(this.busy)throw Error('VOICE_SAVE_PENDING');
    const epoch=this.epoch;this.busy=true;
    try {
      // Show "selected" only after the profile has accepted this exact value.
      if(await this.profile.write(id)!==id)throw Error('VOICE_SAVE_UNCONFIRMED');
      if(epoch!==this.epoch)throw Error('AUTH_CHANGED');
      this.selected=id;this.cache(id);this.onChange(id);return id;
    } finally {if(epoch===this.epoch)this.busy=false;}
  }
  cache(id){try{this.storage?.setItem('sekkes_voice',id);}catch{/* Profile remains authoritative. */}}
  reset(){++this.epoch;this.busy=false;this.loaded=false;this.selected=this.defaultVoice;this.onChange(this.defaultVoice);}
}

export function supabaseVoiceProfile(api) {
  async function request(method,voice) {
    const epoch=api.authEpoch;
    const auth=api.auth();
    const r=await api.transport(api.config.projectUrl+'/auth/v1/user',{
      method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{...auth,apikey:api.config.publishableKey,'Content-Type':'application/json'},
      ...(method==='PUT'?{body:JSON.stringify({data:{sekkes_voice:voice}})}:{})
    });
    if(epoch!==api.authEpoch)throw Error('AUTH_CHANGED');
    if(r.status===401)throw Error('AUTH_REQUIRED');
    if(!r.ok)throw Error('PROFILE_UNAVAILABLE');
    const user=await r.json();
    if(epoch!==api.authEpoch)throw Error('AUTH_CHANGED');
    return user.user_metadata?.sekkes_voice??null;
  }
  return {read:()=>request('GET'),write:voice=>request('PUT',voice)};
}


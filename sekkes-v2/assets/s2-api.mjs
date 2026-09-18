/** Browser API client. OpenAI keys are never accepted. Auth token lives only in memory. */
const PROTECTED=new Set(['ctcoqgsztdtsazdiwcmd','emenwjzhjsieivbfxmuo']);
export class S2Error extends Error{constructor(code){super(code);this.code=code;}}
export class S2Api {
  constructor(config,transport=fetch){
    this.config=config;this.transport=(...args)=>transport(...args);this.token=null;this.authEpoch=0;
    if(!config?.enabled)throw new S2Error('SETUP_REQUIRED');
    const ref=config.projectRef;
    if(!/^[a-z]{20}$/.test(ref||'')||PROTECTED.has(ref)||config.projectUrl!==`https://${ref}.supabase.co`||!config.publishableKey)throw new S2Error('INVALID_PROJECT');
    this.base=config.projectUrl+'/functions/v1/sekkes-s2';
  }
  async login(email,password){
    const epoch=++this.authEpoch;
    if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length>512)throw new S2Error('LOGIN_FAILED');
    const r=await this.transport(this.config.projectUrl+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{apikey:this.config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(!r.ok)throw new S2Error('LOGIN_FAILED');const d=await r.json();if(!d.access_token)throw new S2Error('LOGIN_FAILED');if(epoch!==this.authEpoch)throw new S2Error('AUTH_CANCELLED');this.token=d.access_token;this.expiresAt=Date.now()+(Number(d.expires_in)||3600)*1000;
  }
  logout(){this.authEpoch++;this.token=null;this.expiresAt=0;}
  async request(path,{method='GET',body,signal}={}){
    if(!['status','turn','memory','export','end'].includes(path))throw new S2Error('INVALID_ROUTE');
    if(path!=='status'&&(!this.token||Date.now()>=this.expiresAt)){this.logout();throw new S2Error('AUTH_REQUIRED');}
    const r=await this.transport(this.base+'/'+path,{method,cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(85000)]):AbortSignal.timeout(15000),headers:{apikey:this.config.publishableKey,...(this.token?{Authorization:'Bearer '+this.token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    let d;try{d=await r.json();}catch{throw new S2Error('SERVICE_UNAVAILABLE');}if(!r.ok)throw new S2Error(d.code||'SERVICE_UNAVAILABLE');return d;
  }
}

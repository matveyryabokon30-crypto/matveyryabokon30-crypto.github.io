import {createClient} from './vendor/supabase.mjs';
import {S3Api,S3Error} from './s3-api.mjs?v=2026.09.21-ui.9.6';
import {SekkesPasskeys} from './passkeys.mjs';

// SDK owns rotation, cross-tab locking and persistence; SEKKES owns admission.
export class AccountSession {
 constructor(api,{factory=createClient,storage=globalThis.localStorage,onLost=()=>{}}={}){
  this.api=api;this.closing=null;this.epoch=0;this.allowed=false;this.onLost=onLost;
  this.storage=storage;this.storageWritable=true;this.key='sekkes-'+api.config.projectRef+'-auth';
  const sessionStorage={getItem:key=>this.storageWritable?storage.getItem(key):null,setItem:(key,value)=>{if(this.storageWritable)storage.setItem(key,value);},removeItem:key=>storage.removeItem(key)};
  const authFetch=(url,init={})=>api.transport(url,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  const options={autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce',experimental:{passkey:true}};
  this.client=factory(api.config.projectUrl,api.config.publishableKey,{auth:{...options,storageKey:this.key,storage:sessionStorage,persistSession:true},global:{fetch:authFetch}});
  this.candidate=factory(api.config.projectUrl,api.config.publishableKey,{auth:{...options,storageKey:this.key+'-candidate',persistSession:false,autoRefreshToken:false},global:{fetch:authFetch}});
  this.client.auth.onAuthStateChange((event,session)=>{
   // Never call async Auth methods from a callback holding the SDK lock.
   if(event==='SIGNED_OUT'&&this.allowed){this.allowed=false;this.epoch++;this.mirror(null);queueMicrotask(onLost);}
   else if(this.allowed&&session?.user?.id===api.user?.id)this.mirror(session);
  });
  api.sessionController=this;
 }
 mirror(session){
  if(this.api.user?.id!==session?.user?.id)this.api.authEpoch++;
  this.api.user=session?.user||null;this.api.token=session?.access_token||null;this.api.expiresAt=(session?.expires_at||0)*1000;
 }
 async validate(session,epoch){
  if(!session?.access_token)throw new S3Error('AUTH_REQUIRED');
  const result=await this.client.auth.getUser(session.access_token);
  if(result.error||!result.data?.user?.id||result.data.user.id!==session.user?.id)throw new S3Error('AUTH_REQUIRED');
  const probe=new S3Api(this.api.config,this.api.transport);
  probe.token=session.access_token;probe.user=result.data.user;probe.expiresAt=session.expires_at*1000;
  await probe.request('memory'); // Existing server owner/membership gate, unchanged.
  if(epoch!==this.epoch)throw new S3Error('AUTH_CANCELLED');
  return {...session,user:result.data.user};
 }
 async restore(){
  const epoch=this.epoch;const {data,error}=await this.client.auth.getSession();
  if(error||!data?.session)return false;
  try{const session=await this.validate(data.session,epoch);this.allowed=true;this.mirror(session);return true;}
  catch(error){if(['AUTH_REQUIRED','OWNER_ONLY'].includes(error.code))await this.signOut();throw error;}
 }
 async admit(session,epoch=this.epoch){
  if(this.closing)await this.closing;
  if(epoch!==this.epoch)throw new S3Error('AUTH_CANCELLED');
  const verified=await this.validate(session,epoch);
  if(epoch!==this.epoch)throw new S3Error('AUTH_CANCELLED');
  this.storageWritable=true;
  const result=await this.client.auth.setSession({access_token:verified.access_token,refresh_token:verified.refresh_token});
  if(result.error)throw result.error;
  if(epoch!==this.epoch){await this.client.auth.signOut({scope:'local'});throw new S3Error('AUTH_CANCELLED');}
  this.allowed=true;this.mirror({...result.data.session,user:verified.user});return true;
 }
 async password(email,password){
  const epoch=this.epoch;const {data,error}=await this.candidate.auth.signInWithPassword({email,password});
  if(error)throw error;return this.admit(data.session,epoch);
 }
 async requestCode(email){
  const {error}=await this.candidate.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
  if(error)throw error;
 }
 async verifyCode(email,proof){
  const epoch=this.epoch;const {data,error}=await this.candidate.auth.verifyOtp(parseProof(proof,this.api.config.projectUrl,email));
  if(error)throw error;
  if(data.user?.email?.toLowerCase()!==email.toLowerCase())throw new S3Error('LOGIN_FAILED');
  return this.admit(data.session,epoch);
 }
 async ensureFresh(){
  if(!this.allowed)throw new S3Error('AUTH_REQUIRED');
  if(this.api.token&&this.api.expiresAt>Date.now()+60000)return;
  const epoch=this.epoch;const {data,error}=await this.client.auth.refreshSession();
  if(error)throw error;
  if(epoch!==this.epoch||!this.allowed)throw new S3Error('AUTH_CANCELLED');
  if(data.session?.user?.id!==this.api.user?.id){await this.signOut();throw new S3Error('AUTH_REQUIRED');}
  this.mirror(data.session);
 }
 async signOut(){
  const token=this.api.token;this.epoch++;this.allowed=false;this.storageWritable=false;this.mirror(null);
  // Remove this app's saved session immediately, including while offline.
  for(const suffix of ['', '-user','-code-verifier']){try{this.storage.removeItem(this.key+suffix);}catch{}}
  if(token)void this.api.transport(this.api.config.projectUrl+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:this.api.config.publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)}).catch(()=>{});
  const closing=this.client.auth.signOut({scope:'local'}).catch(()=>{});this.closing=closing;
  await closing;if(this.closing===closing)this.closing=null;
 }
 passkeys(onChange){return SekkesPasskeys.create({client:this.client,signInClient:this.candidate,enabled:true,onChange,
  getAccount:async({userId})=>{await this.ensureFresh();await this.api.request('memory');return{id:this.api.user?.id,approved:this.api.user?.id===userId};},
  authenticate:async(session,{signal})=>{const epoch=this.epoch;if(signal.aborted)return false;await this.admit(session,epoch);return !signal.aborted;}});}
}

// Same email-proof contract as Pablicus; never follow a pasted link.
export function parseProof(value,projectUrl,email){
 const text=String(value||'').trim();
 if(/^\d{6,10}$/.test(text))return {email,token:text,type:'email'};
 let url;try{url=new URL(text)}catch{throw new S3Error('OTP_INVALID')}
 if(text.length>4096||url.origin!==projectUrl||url.protocol!=='https:'||url.username||url.password||url.hash||url.pathname!=='/auth/v1/verify')throw new S3Error('OTP_INVALID');
 if(!['email','magiclink'].includes(url.searchParams.get('type'))||url.searchParams.getAll('type').length!==1)throw new S3Error('OTP_INVALID');
 const keys=['token','token_hash'].filter(k=>url.searchParams.has(k));
 if(keys.length!==1||url.searchParams.getAll(keys[0]).length!==1||!/^[A-Za-z0-9_-]{32,256}$/.test(url.searchParams.get(keys[0])))throw new S3Error('OTP_INVALID');
 return {token_hash:url.searchParams.get(keys[0]),type:'email'};
}

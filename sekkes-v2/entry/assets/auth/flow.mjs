import {normalizeEmail, normalizeCode, authMessage} from './session.mjs?v=0a8014629e5d0ed29e1f9ae51a154358cc0047201795876483fe3f017c0117f8';
import {OTP_LENGTH} from './config.mjs?v=5fec9d163c92bca6718a1263cf258cfb2a716700ef013fcc3947fe48d2cb0dc8';
export class AuthFlow {
  constructor(session,{now=()=>Date.now(),change=()=>{},complete=()=>{}}={}) {
    this.session=session;this.now=now;this.change=change;this.complete=complete;
    this.state={step:'signup',email:'',busy:false,message:'',createAccount:true};this.sent=new Map();
  }
  update(patch){Object.assign(this.state,patch);this.change({...this.state});}
  navigate(step){if(this.state.busy)return;this.update({step,message:'',...(step==='signup'?{createAccount:true}:step==='email'?{createAccount:false}:{})});}
  seconds(){return Math.max(0,Math.ceil(((this.sent.get(this.state.email)||0)-this.now())/1000));}
  async perform(work,action='verify'){
    if(this.state.busy)return false;
    this.update({busy:true,message:'',action});
    try{await work();return true;}catch(error){this.update({message:error.displayMessage||authMessage(error),...(error.admissionPending?{step:'access'}:{})});return false;}
    finally{this.update({busy:false});}
  }
  send(email=this.state.email){return this.perform(async()=>{
    const normalized=normalizeEmail(email),previous=this.state.step;this.update({email:normalized});
    if(this.seconds()>0){this.update({step:'code',delivery:'sent',message:'Код уже отправлен. Используйте последнее письмо.'});return;}
    // Mount/focus the native OTP input in the original submit gesture, before
    // network latency consumes Safari's keyboard activation window.
    this.update({step:'code',delivery:'sending'});
    try{
      await this.session.requestCode(normalized,{createAccount:this.state.createAccount});
      this.sent.set(normalized,this.now()+60000);this.update({delivery:'sent'});
    }catch(error){this.update({step:previous==='code'?'code':previous,delivery:'failed'});throw error;}
  },'send');}
  verify(code){return this.perform(async()=>{
    const proof=normalizeCode(code);if(!new RegExp('^\\d{'+OTP_LENGTH+'}$').test(proof))throw Object.assign(new Error('OTP_INVALID'),{code:'OTP_INVALID'});
    const user=await this.session.verifyCode(this.state.email,proof);await this.complete(user);
  });}
  password(email,password){return this.perform(async()=>{const user=await this.session.password(email,password);await this.complete(user);});}
  passkey(){return this.perform(async()=>{const user=await this.session.passkey();await this.complete(user);});}
  retryAccess(){return this.perform(async()=>{const user=await this.session.resumeAdmission();await this.complete(user);});}
}

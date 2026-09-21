export class VoiceIdentityHandshake {
  constructor({send,instruction,onReady=()=>{},onError=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}) {
    Object.assign(this,{send,instruction,onReady,onError});
    // Browser timer functions require the global receiver, never this handshake.
    this.setTimer=(...args)=>setTimer(...args);this.clearTimer=(...args)=>clearTimer(...args);
    this.id='voice_identity_'+crypto.randomUUID();this.sent=false;this.done=false;this.disposed=false;
  }
  receive(event) {
    if(this.disposed||this.done)return;
    if(event.type==='session.started'&&!this.sent){
      this.sent=true;
      if(typeof this.instruction!=='string'||!this.instruction){this.done=true;this.onError();return;}
      this.timer=this.setTimer(()=>{if(!this.done&&!this.disposed){this.done=true;this.onError();}},15000);
      try{this.send({type:'session.instructions.append',event_id:this.id,delegation_id:null,content:this.instruction});}
      catch{this.clearTimer(this.timer);this.done=true;this.onError();}
    }
    if(event.type==='session.instructions.appended'&&event.client_event_id===this.id){this.clearTimer(this.timer);this.done=true;this.onReady();}
    if(event.type==='error'&&(event.error?.event_id===this.id||event.error?.client_event_id===this.id||event.client_event_id===this.id)){this.clearTimer(this.timer);this.done=true;this.onError();}
  }
  dispose(){this.disposed=true;this.clearTimer(this.timer);}
}


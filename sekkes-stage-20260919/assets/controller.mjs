import {initialSession,transitionSession} from './foundation.mjs?v=2026.09.19-p23-stage.6';
import {TechnicalLog,greetingCommand} from './protocol.mjs?v=2026.09.19-p23-stage.6';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function bounded(promise,ms,fallback){let timer;try{return await Promise.race([promise,new Promise(r=>{timer=setTimeout(()=>r(fallback),ms);})]);}finally{clearTimeout(timer);}}
const terminal=new Set(['idle','closed','permission_denied','network_error','session_error','limit_reached']);
/** One owner of start, generation, transport and finalization. Dependencies are injectable. */
export class LiveSessionController {
  constructor({broker,transportFactory,mediaFactory,onChange=()=>{},readyMs=20000,closeMs=20000,clock=()=>performance.now()}) {
    Object.assign(this,{broker,transportFactory,mediaFactory,onChange,readyMs,closeMs,clock});
    this.snapshot=initialSession();this.log=new TechnicalLog();this.context=null;
  }
  get busy(){return !terminal.has(this.snapshot.state);}
  get dirty(){return this.busy || Boolean(this.context?.submitted&&!this.context?.finalized);}
  move(type,extra={}) {this.snapshot=transitionSession(this.snapshot,{type,generation:this.snapshot.generation,...extra});this.log.add('state',{state:this.snapshot.state,generation:this.snapshot.generation});this.onChange(this.snapshot);}
  start(voice='echo') {
    // Repeated Start joins the existing operation; it is never a hidden Stop toggle.
    if(this.busy)return this.context?.startPromise||Promise.resolve(false);
    this.lastError=null;this.audioBlocked=false;this.move('start');
    const c={generation:this.snapshot.generation,requestId:crypto.randomUUID(),abort:new AbortController(),ready:deferred(),closed:deferred(),cancelled:false,submitted:false,finalized:false,usage:0};
    this.context=c;c.startPromise=this.run(c,voice);return c.startPromise;
  }
  current(c){return this.context===c && !c.cancelled;}
  async run(c,voice) {
    const start=this.clock();
    try {
      const media=await this.mediaFactory();c.media=media;
      if(!this.current(c)){this.dispose(c);return false;}
      this.move('permission_granted');
      c.transport=this.transportFactory(e=>this.event(c,e));
      const sdp=await c.transport.offer(media,c.abort.signal);
      if(!this.current(c))return false;
      c.submitted=true;
      const answer=await this.broker.create({requestId:c.requestId,sdp,voice,signal:c.abort.signal});
      c.answer=answer;
      if(!this.current(c)){await Promise.resolve().then(()=>this.broker.close({requestId:c.requestId,reason:'late_answer'})).catch(()=>{});this.dispose(c);return false;}
      await c.transport.accept(answer.sdp);
      const outcome=await bounded(c.ready.promise,this.readyMs,false);
      if(!this.current(c))return false;
      if(!outcome)throw Object.assign(new Error('SESSION_READY_TIMEOUT'),{code:'SESSION_READY_TIMEOUT'});
      this.log.add('session_ready',{ms:this.clock()-start,generation:c.generation});
      return true;
    } catch(e) {
      if(!this.current(c))return false;
      const code=e.code||e.name||'SESSION_ERROR';this.log.add('start_failed',{code});
      await this.stop(code);
      if(this.context===c){this.lastError=code;this.onChange({...this.snapshot,error:code});}
      return false;
    } finally {if(c.cancelled&&c.finalized)this.dispose(c);}
  }
  event(c,e) {
    if(this.context!==c)return;
    if(e.kind==='closed') {
      if(e.id&&c.providerId&&e.id!==c.providerId){this.log.add('wrong_session_event',{code:'SESSION_ID_MISMATCH'});return;}
      c.finalEvent=e;c.usage=Math.max(c.usage,e.seconds||0);c.closed.resolve(e);
      if(!c.cancelled)this.stop('provider_closed');
      return;
    }
    if(c.cancelled)return;
    if(e.kind==='ready') {
      if(c.providerId)return;
      c.providerId=e.id;
      if(c.answer?.sessionId&&c.answer.sessionId!==e.id){this.stop('SESSION_ID_MISMATCH');return;}
      if(this.snapshot.state!=='connecting'&&this.snapshot.state!=='reconnecting')return;
      this.move('session_ready',{sessionId:e.id});
      c.greetingId=crypto.randomUUID();
      try{c.transport.send(greetingCommand(c.greetingId));}catch{this.log.add('greeting_send_failed',{code:'CHANNEL_NOT_OPEN'});}
      c.ready.resolve(true);
    } else if(e.kind==='greeting_ack') {
      if(e.command===c.greetingId)this.log.add('greeting_ack',{ack:true,generation:c.generation});
    } else if(e.kind==='usage') {
      c.usage=Math.max(c.usage,e.seconds);this.log.add('usage',{seconds:c.usage});
    } else if(e.kind==='backend') {
      if(e.model==='gpt-5.6-sol')this.log.add('sol_observed',{ack:true});
    } else if(e.kind==='disconnected') {
      if(this.snapshot.state==='ready')this.move('reconnect');
      clearTimeout(c.disconnectTimer);c.disconnectTimer=setTimeout(()=>this.stop('NETWORK_LOST'),3000);
    } else if(e.kind==='connected') {
      clearTimeout(c.disconnectTimer);
      if(this.snapshot.state==='reconnecting'&&c.providerId)this.move('session_ready',{sessionId:c.providerId});
    } else if(e.kind==='failed') this.stop('NETWORK_FAILED');
    else if(e.kind==='error') this.log.add('provider_command_error',{code:e.code});
    else if(e.kind==='audio_blocked') {this.audioBlocked=true;this.onChange({...this.snapshot,audioBlocked:true});}
  }
  resumeAudio(){return this.context?.transport?.play();}
  stop(reason='user') {
    const c=this.context;if(!c)return Promise.resolve({confirmed:true});
    if(c.stopPromise)return c.stopPromise;
    if(terminal.has(this.snapshot.state)&&c.finalized)return Promise.resolve(c.closeResult);
    c.cancelled=true;c.abort.abort();c.ready.resolve(false);clearTimeout(c.disconnectTimer);
    // Keep the transport alive for session.closed; disable capture immediately.
    try{for(const track of c.media?.getTracks()||[]){try{track.enabled=false;}catch{}}}catch{}
    if(!terminal.has(this.snapshot.state)&&this.snapshot.state!=='closing')this.move('stop');
    c.stopPromise=this.finish(c,reason);return c.stopPromise;
  }
  async finish(c,reason) {
    let dataAck=false,server={confirmed:false};
    try {
      // A failed data channel must never prevent the independent server cancel.
      try{c.transport?.closeCommand();}catch{this.log.add('close_command_failed',{code:'CHANNEL_NOT_OPEN'});}
      const serverPromise=c.submitted?Promise.resolve().then(()=>this.broker.close({requestId:c.requestId,reason})).catch(()=>({confirmed:false})):Promise.resolve({confirmed:true,neverSubmitted:true});
      const results=await Promise.all([
        c.transport&&c.providerId?bounded(c.closed.promise,this.closeMs,null):Promise.resolve(c.finalEvent||null),
        bounded(serverPromise,this.closeMs,{confirmed:false})
      ]);
      dataAck=Boolean(results[0]);server=results[1]||{confirmed:false};
      const complete=Boolean(server.confirmed)&&server.usageConfirmed!==false;
      c.closeResult={confirmed:complete,providerClosed:Boolean(server.confirmed),usageConfirmed:server.usageConfirmed===true,clientClosedEvent:dataAck,uncertain:!complete,seconds:c.usage};
    } finally {
      c.finalized=true;this.dispose(c);
      this.log.add('close_finished',{ack:Boolean(c.closeResult?.confirmed),uncertain:!c.closeResult?.confirmed,seconds:c.usage});
      if(this.context===c&&this.snapshot.state==='closing')this.move(c.closeResult?.confirmed?'closed':'close_timeout');
    }
    return c.closeResult;
  }
  stopTracks(c){try{for(const t of c.media?.getTracks()||[]){try{t.stop();}catch{this.log.add('track_stop_failed',{code:'TRACK_STOP_FAILED'});}}}catch{this.log.add('track_list_failed',{code:'TRACK_STOP_FAILED'});}}
  dispose(c){this.stopTracks(c);try{c.transport?.dispose();}catch{this.log.add('transport_dispose_failed',{code:'DISPOSE_FAILED'});}clearTimeout(c.disconnectTimer);}
}

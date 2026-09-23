// A separate administrative WebRTC session; never uses the user's personal chat context.
export class OwnerLive{
 constructor({request,onState,onNotice,onSaved}){Object.assign(this,{request,onState,onNotice,onSaved});this.session=null;this.closing=null;}
 get active(){return Boolean(this.session||this.closing)}
 async start(){if(this.active)return;const x={id:crypto.randomUUID(),cancelled:false,events:new Map(),stream:null,pc:null,audio:null};this.session=x;this.onState();this.onNotice('Подключаю разговор…');
  const check=()=>{if(x.cancelled)throw Error('CANCELLED')};
  try{
   x.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});check();
   x.pc=new RTCPeerConnection();x.audio=new Audio();x.audio.autoplay=true;x.audio.playsInline=true;
   for(const track of x.stream.getTracks())x.pc.addTrack(track,x.stream);
   x.pc.ontrack=e=>{x.audio.srcObject=new MediaStream([e.track]);x.audio.play().catch(()=>this.onNotice('Звук заблокирован браузером. Заверши разговор и подключись ещё раз.'))};
   const dc=x.dc=x.pc.createDataChannel('oai-events');dc.onmessage=e=>{let v;try{v=JSON.parse(e.data)}catch{return}if(v.type==='session.started')this.onNotice('Живой разговор · админ');if(['session.input_transcript.delta','session.output_transcript.delta'].includes(v.type)&&typeof v.delta==='string'&&typeof v.event_id==='string'){x.events.set(v.event_id,v);clearTimeout(x.saveTimer);x.saveTimer=setTimeout(()=>this.save(x).catch(()=>this.onNotice('Разговор идёт. Расшифровку повторим сохранять при завершении.')),1800)}if(v.type==='session.closed')void this.stop();};
   x.pc.onconnectionstatechange=()=>{if(x.pc.connectionState==='failed'){this.onNotice('Связь прервалась.');void this.stop()}};
   await x.pc.setLocalDescription(await x.pc.createOffer());check();
   await new Promise((resolve,reject)=>{if(x.pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(()=>reject(Error('ICE_TIMEOUT')),10000);x.pc.onicegatheringstatechange=()=>{if(x.pc.iceGatheringState==='complete'){clearTimeout(timer);resolve()}}});check();
   x.pending=this.request('live',{action:'start',id:x.id,sdp:x.pc.localDescription.sdp});const answer=await x.pending;x.started=true;check();
   await x.pc.setRemoteDescription({type:'answer',sdp:answer.sdp});check();x.timer=setTimeout(()=>void this.stop(),30*60*1000);
  }catch(e){if(!x.cancelled)this.onNotice(e.name==='NotAllowedError'?'Разреши доступ к микрофону.':'Не удалось подключить административный разговор.');await this.stop();for(const t of x.stream?.getTracks()||[])t.stop();}
 }
 async save(x){const events=[...x.events.values()].sort((a,b)=>(a.start_ms||0)-(b.start_ms||0));const text=events.filter(e=>e.type==='session.input_transcript.delta').map(e=>e.delta).join(''),reply=events.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join('');if(!text&&!reply)return;await this.request('live',{action:'save',id:x.id,text:text||'Голосовой разговор',reply});}
 stop(){if(this.closing)return this.closing;const x=this.session;if(!x)return Promise.resolve();x.cancelled=true;clearTimeout(x.timer);clearTimeout(x.saveTimer);for(const t of x.stream?.getTracks()||[])t.stop();if(x.audio){x.audio.pause();x.audio.srcObject=null}x.dc?.close();x.pc?.close();this.session=null;
  this.closing=(async()=>{try{if(x.pending)await x.pending.catch(()=>{});await this.save(x);if(x.pending)await this.request('live',{action:'close',id:x.id});await this.onSaved();this.onNotice('Разговор завершён.')}catch{this.onNotice('Микрофон выключен. Не удалось подтвердить сохранение или завершение на сервере.')}finally{this.closing=null;this.onState()}})();this.onState();return this.closing;
 }
}

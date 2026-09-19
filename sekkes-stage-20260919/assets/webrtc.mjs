import {decodeEvent,closeCommand} from './protocol.mjs?v=2026.09.19-p23-stage.3';
/** Native WebRTC adapter. No OpenAI credentials and no business/budget rules. */
export class WebRTCTransport {
  constructor(onEvent,{Peer=globalThis.RTCPeerConnection,audio=document.createElement('audio')}={}) {
    this.emit=onEvent;this.audio=audio;this.pc=new Peer();this.disposed=false;
    audio.autoplay=true;audio.setAttribute('playsinline','');audio.hidden=true;document.body.append(audio);
    this.pc.ontrack=e=>{if(this.disposed)return;audio.srcObject=e.streams[0]||new MediaStream([e.track]);this.play();};
    this.pc.onconnectionstatechange=()=>{const s=this.pc.connectionState;if(s==='connected')onEvent({kind:'connected'});if(s==='disconnected')onEvent({kind:'disconnected'});if(s==='failed')onEvent({kind:'failed'});};
    this.dc=this.pc.createDataChannel('oai-events');
    // All handlers are installed BEFORE offer/answer, never after remoteDescription.
    this.dc.onmessage=e=>onEvent(decodeEvent(e.data));
    this.dc.onclose=()=>{if(!this.disposed)onEvent({kind:'disconnected'});};
  }
  async play(){try{await this.audio.play();return true;}catch{if(!this.disposed)this.emit({kind:'audio_blocked'});return false;}}
  async offer(stream,signal) {
    for(const t of stream.getTracks())this.pc.addTrack(t,stream);
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await new Promise((resolve,reject)=>{
      let timer;const done=()=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',changed);signal.removeEventListener('abort',aborted);resolve();};
      const changed=()=>{if(this.pc.iceGatheringState==='complete')done();};
      const aborted=()=>{done();reject(new DOMException('Cancelled','AbortError'));};
      if(signal.aborted)return aborted();if(this.pc.iceGatheringState==='complete')return done();
      signal.addEventListener('abort',aborted,{once:true});this.pc.addEventListener('icegatheringstatechange',changed);timer=setTimeout(done,3500);
    });
    signal.throwIfAborted();const sdp=this.pc.localDescription?.sdp;if(!sdp)throw new Error('SDP_MISSING');return sdp;
  }
  accept(sdp){return this.pc.setRemoteDescription({type:'answer',sdp});}
  send(event){if(this.dc.readyState==='open')this.dc.send(JSON.stringify(event));else throw new Error('CHANNEL_NOT_OPEN');}
  closeCommand(){if(this.dc.readyState==='open')this.dc.send(JSON.stringify(closeCommand(crypto.randomUUID())));}
  dispose(){if(this.disposed)return;this.disposed=true;this.pc.ontrack=null;this.pc.onconnectionstatechange=null;this.dc.onmessage=null;this.dc.onclose=null;try{this.dc.close();this.pc.close();}catch{}this.audio.pause();this.audio.srcObject=null;this.audio.remove();}
}

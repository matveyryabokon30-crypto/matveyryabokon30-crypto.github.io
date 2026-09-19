/* WebRTC media only. Transport authorizes every call; no credentials persist here. */
(function(root){'use strict';
 function create({iceServers=[],iceTransportPolicy='all',onSignal,onState,onRemoteStream,onLocalStream}={}){
  let pc=null,local=null,generation=0,queue=Promise.resolve(),candidates=[],acquiring=null,closed=false,caller=false,restarts=0,remoteGeneration=0;
  const live=g=>g===generation&&!closed;
  function stop(stream){stream?.getTracks().forEach(t=>t.stop());}
  function emit(signal){return Promise.resolve(onSignal?.(signal));}
  async function ensure(video,g){
   if(pc)return pc;
   if(!acquiring)acquiring=(async()=>{const stream=await root.navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:'user'}:false});if(!live(g)){stop(stream);throw Error('cancelled');}local=stream;const peer=new root.RTCPeerConnection({iceServers,iceTransportPolicy});pc=peer;
    peer.onicecandidate=e=>{if(live(g)&&e.candidate)void emit({type:'candidate',candidate:e.candidate.toJSON()}).catch(()=>onState?.('signalling-failed'));};
    peer.ontrack=e=>{if(live(g))onRemoteStream?.(e.streams[0]||new root.MediaStream([e.track]));};
    peer.onconnectionstatechange=()=>{if(live(g))onState?.(peer.connectionState);};
    for(const t of stream.getTracks())peer.addTrack(t,stream);onLocalStream?.(stream);return peer;
   })().finally(()=>{acquiring=null;});
   return acquiring;
  }
  function serial(fn){const result=queue.then(fn);queue=result.catch(()=>{hangup();});return result;}
  function start({video=false}={}){const g=generation;if(closed||pc||acquiring||caller)return Promise.reject(Error('call-active'));caller=true;return serial(async()=>{const p=await ensure(video,g);if(!live(g))return;const offer=await p.createOffer();if(!live(g))return;await p.setLocalDescription(offer);if(live(g))await emit({type:'description',description:p.localDescription.toJSON()});return local;});}
  function accept(signal,{video=false}={}){const g=generation;return serial(async()=>{if(!live(g))return;if(signal.type==='candidate'){if(!pc?.remoteDescription||(signal.generation||0)>remoteGeneration){if(candidates.length>=128)throw Error('candidate-limit');candidates.push({candidate:signal.candidate,generation:signal.generation||0});return;}await pc.addIceCandidate(signal.candidate);return;}if(signal.type!=='description'||!['offer','answer'].includes(signal.description?.type))throw Error('invalid-signal');
   const p=await ensure(video,g);if(!live(g))return;await p.setRemoteDescription(signal.description);if(!live(g))return;remoteGeneration=signal.generation||0;const waiting=candidates;candidates=[];for(const c of waiting){if(c.generation>remoteGeneration){candidates.push(c);continue;}if(c.generation<remoteGeneration)continue;await p.addIceCandidate(c.candidate);if(!live(g))return;}if(signal.description.type==='offer'){const answer=await p.createAnswer();if(!live(g))return;await p.setLocalDescription(answer);if(live(g))await emit({type:'description',description:p.localDescription.toJSON()});}return local;
  });}
  function restart(){const g=generation;return serial(async()=>{if(!live(g)||!pc||!caller||restarts>=2)return false;restarts++;const offer=await pc.createOffer({iceRestart:true});if(!live(g))return false;await pc.setLocalDescription(offer);if(!live(g))return false;await emit({type:'description',description:pc.localDescription.toJSON()});return true;});}
  function hangup(){if(closed)return;closed=true;generation++;stop(local);local=null;if(pc){pc.onicecandidate=null;pc.ontrack=null;pc.onconnectionstatechange=null;pc.close();pc=null;}candidates=[];onState?.('closed');}
  return{start,accept,restart,hangup,stats(){return pc?pc.getStats():Promise.resolve(new Map());},configure(servers){if(closed||!pc)throw Error('closed');pc.setConfiguration({iceServers:servers,iceTransportPolicy});},setMuted(value){local?.getAudioTracks().forEach(t=>t.enabled=!value);},setVideo(value){local?.getVideoTracks().forEach(t=>t.enabled=!!value);},get active(){return!!pc&&!closed;},get localStream(){return local;}};
 }
 root.PablicusCalls=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);

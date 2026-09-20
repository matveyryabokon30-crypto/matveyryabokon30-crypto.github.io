import {sessionCues as cues} from './session-cues.mjs';
const log=document.querySelector('#log');let current;
function write(s){log.textContent+='\n'+s}
async function shutdown(x,exit=true){if(!x||x.closed)return;x.closed=true;x.stream?.getTracks().forEach(t=>t.stop());x.a?.pause();x.a&&(x.a.srcObject=null);x.p?.close();x.q?.close();await x.ctx?.close();write('STOP: tracks='+String(x.stream?.getTracks().every(t=>t.readyState==='ended')));if(exit)write('EXIT: '+await cues.play('end'));else{cues.cancel();cues.resetRoute()}current=null;document.querySelector('#run').disabled=false}
document.querySelector('#stop').onclick=()=>shutdown(current);
document.querySelector('#run').onclick=async()=>{
 if(current)return;const x=current={};log.textContent='BEGIN';document.querySelector('#run').disabled=true;
 try{
 cues.begin();const capture=navigator.mediaDevices.getUserMedia({audio:true});x.stream=await capture;if(x.closed){x.stream.getTracks().forEach(t=>t.stop());return}write('MIC: '+x.stream.getAudioTracks()[0].readyState);
 const intro=cues.play('start');x.stream.getTracks().forEach(t=>t.enabled=false);
 x.ctx=new AudioContext();await x.ctx.resume();const tone=x.ctx.createOscillator(),gain=x.ctx.createGain(),dest=x.ctx.createMediaStreamDestination();gain.gain.value=.03;tone.frequency.value=220;tone.connect(gain).connect(dest);tone.start();
 x.p=new RTCPeerConnection();x.q=new RTCPeerConnection();x.p.onicecandidate=e=>e.candidate&&x.q.addIceCandidate(e.candidate).catch(()=>{});x.q.onicecandidate=e=>e.candidate&&x.p.addIceCandidate(e.candidate).catch(()=>{});
 x.a=new Audio();x.a.playsInline=true;const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('track timeout')),15000);x.q.ontrack=async e=>{try{x.a.srcObject=e.streams[0];write('INTRO: '+await intro);if(x.closed)return;await x.a.play();clearTimeout(timer);write('REMOTE PLAY: resolved');resolve()}catch(e){clearTimeout(timer);reject(e)}}});
 dest.stream.getTracks().forEach(t=>x.p.addTrack(t,dest.stream));await x.p.setLocalDescription(await x.p.createOffer());await x.q.setRemoteDescription(x.p.localDescription);await x.q.setLocalDescription(await x.q.createAnswer());await x.p.setRemoteDescription(x.q.localDescription);await received;if(x.closed)return;
 await new Promise(r=>setTimeout(r,1500));const stats=await x.q.getStats();let bytes=0;stats.forEach(v=>{if(v.type==='inbound-rtp')bytes+=v.bytesReceived||0});write('WEBRTC BYTES: '+bytes);write('REMOTE TIME: '+x.a.currentTime.toFixed(2));if(!bytes||x.a.currentTime<=0)throw Error('no received playback');await shutdown(x);write('PASS: native media cycle');
 }catch(e){write('FAIL: '+e.name+' '+e.message);await shutdown(x,false)}
};

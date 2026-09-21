import {sessionCues as cues} from './session-cues.mjs';
const log=document.querySelector('#log');let current;const write=s=>log.textContent+='\n'+s;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label,ms=12000){const end=Date.now()+ms;while(!check()){if(Date.now()>end)throw Error(label+' timeout');await delay(100)}}
async function stop(x){if(!x||x.closed)return;x.closed=true;x.audio?.pause();if(x.audio)x.audio.srcObject=null;x.stream?.getTracks().forEach(t=>t.stop());x.p?.close();x.q?.close();x.ctx?.close().catch(()=>{});write('STOP local');const result=await cues.play('end');write('EXIT '+result);if(current===x)current=null;return result;}
document.querySelector('#stop').onclick=()=>stop(current);
document.querySelector('#run').onclick=async()=>{
 if(current)return;log.textContent='BEGIN';const x=current={};
 try{
 cues.begin();x.ctx=new AudioContext();await x.ctx.resume();write('AudioContext '+x.ctx.state);
 const gain=x.ctx.createGain(),tone=x.ctx.createOscillator(),dest=x.ctx.createMediaStreamDestination();gain.gain.value=.03;tone.frequency.value=220;tone.connect(gain).connect(dest);tone.start();x.stream=dest.stream;
 const intro=cues.play('start');x.p=new RTCPeerConnection();x.q=new RTCPeerConnection();x.audio=new Audio();x.audio.playsInline=true;
 x.p.onconnectionstatechange=()=>write('sender '+x.p.connectionState);x.q.onconnectionstatechange=()=>write('receiver '+x.q.connectionState);
 let remote;
 x.q.ontrack=e=>{remote=e.streams[0];write('remote track '+e.track.readyState);};
 x.stream.getTracks().forEach(t=>x.p.addTrack(t,x.stream));
 await x.p.setLocalDescription(await x.p.createOffer());await until(()=>x.p.iceGatheringState==='complete','sender ICE');if(x.closed)return;
 write('sender candidates '+(x.p.localDescription.sdp.match(/a=candidate:/g)||[]).length);
 await x.q.setRemoteDescription(x.p.localDescription);await x.q.setLocalDescription(await x.q.createAnswer());await until(()=>x.q.iceGatheringState==='complete','receiver ICE');if(x.closed)return;
 write('receiver candidates '+(x.q.localDescription.sdp.match(/a=candidate:/g)||[]).length);
 await x.p.setRemoteDescription(x.q.localDescription);const entry=await intro;write('INTRO '+entry);if(x.closed)return;if(entry!=='ended')throw Error('intro '+entry);
 await until(()=>x.p.connectionState==='connected'&&x.q.connectionState==='connected','connection');if(x.closed)return;
 x.audio.srcObject=remote;await x.audio.play();write('remote play resolved');
 let bytes=0;const end=Date.now()+8000;while(Date.now()<end&&!x.closed){const stats=await x.q.getStats();stats.forEach(v=>{if(v.type==='inbound-rtp')bytes=v.bytesReceived||0});if(bytes>0&&x.audio.currentTime>0)break;await delay(200)}
 if(x.closed)return;write('received bytes '+bytes+'; played seconds '+x.audio.currentTime.toFixed(2)+'; context '+x.ctx.state);if(!bytes||!x.audio.currentTime)throw Error('RTP or playback missing');const exit=await stop(x);if(exit!=='ended')throw Error('exit '+exit);write('PASS native audio cycle');
 }catch(e){write('FAIL '+e.name+' '+e.message);await stop(x);}
};

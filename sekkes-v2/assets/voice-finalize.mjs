/** Keep receiving final recording/usage events before releasing WebRTC. */
export function prepareFinalization({dc,stream,audio},timeoutMs=3000){
 let resolve,closed=false,finishing=null,timer;
 const done=new Promise(r=>resolve=r);
 return {
  receive(event){if(event.type==='session.closed'){closed=true;resolve(true);}},
  finish(){if(finishing)return finishing;finishing=(async()=>{
   for(const t of stream?.getAudioTracks?.()||[])t.enabled=false;
   if(audio)audio.muted=true;
   if(closed)return true;
   if(dc?.readyState!=='open')return false;
   try{dc.send(JSON.stringify({type:'session.close',event_id:crypto.randomUUID()}));}catch{return false;}
   try{return await Promise.race([done,new Promise(r=>timer=setTimeout(()=>r(false),timeoutMs))]);}finally{clearTimeout(timer);}
  })();return finishing;}
 };
}

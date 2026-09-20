// Fixed vocabulary only: no conversation, tokens, SDP, user IDs or provider payloads.
const allowed=new Set(['begin','mic.request','mic.ready','profile.ready','offer.ready','provider.request','provider.ready','remote.sdp','channel.open','remote.track','remote.play','intro.done','ready','stop','closed','error','cue.begin','cue.start','cue.end','cue.done','cue.error','cue.cancel']);
let entries=[];let origin=Date.now();
export function voiceTrace(event,code=''){
 if(!allowed.has(event))return;
 const safe=String(code).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,64);
 if(event==='begin'){entries=[];origin=Date.now();}
 entries.push({ms:Date.now()-origin,event,...(safe?{code:safe}:{})});entries=entries.slice(-100);
 try{localStorage.setItem('sekkes.voice.diagnostic',JSON.stringify({version:'ui.8.10',entries}));}catch{}
}

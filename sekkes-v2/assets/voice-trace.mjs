// Fixed vocabulary only: no conversation, tokens, SDP, user IDs or provider payloads.
const allowed=new Set(['begin','mic.request','mic.ready','mic.attached','profile.ready','offer.ready','provider.request','provider.ready','remote.sdp','channel.open','remote.track','remote.play','intro.done','ready','stop','closed','error','cue.begin','cue.start','cue.end','cue.done','cue.error','cue.cancel','cue.prime_error','intro.failed','session.started','session.closed','identity.ready','connection','finalization','media.flow']);
const KEY='sekkes.voice.diagnostic';
let entries=[],history=[],origin=0;
function clean(attempt){
 if(!attempt||!Array.isArray(attempt.entries))return null;
 const list=attempt.entries.filter(e=>e&&allowed.has(e.event)&&Number.isFinite(e.ms)).slice(-100).map(e=>({ms:e.ms,event:e.event,...(e.code?{code:String(e.code).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,64)}:{})}));
 if(!list.some(e=>e.event==='begin'))return null;
 return {version:String(attempt.version||'unknown').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,32),...(Number.isFinite(attempt.startedAt)?{startedAt:attempt.startedAt}:{}),entries:list};
}
export function voiceTrace(event,code=''){
 if(!allowed.has(event))return;
 if(event==='begin'){
  let saved;try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  history=Array.isArray(saved?.history)?saved.history.map(clean).filter(Boolean):[];
  const previous=clean(saved);if(previous)history.push(previous);
  history=history.slice(-4);entries=[];origin=Date.now();
 }else if(!origin){return;} // Idle pagehide must not replace another attempt's evidence.
 const safe=String(code).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,64);
 entries.push({ms:Date.now()-origin,event,...(safe?{code:safe}:{})});entries=entries.slice(-100);
 try{localStorage.setItem(KEY,JSON.stringify({version:'ui.9.0',startedAt:origin,entries,history}));}catch{}
}

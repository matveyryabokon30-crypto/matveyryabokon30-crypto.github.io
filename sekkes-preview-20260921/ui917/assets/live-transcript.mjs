// GPT-Live deltas have timestamps, not conversational turn IDs. Preserve originals.
export class LiveTranscript {
 constructor({api,uid,storage=globalThis.localStorage,timers=globalThis}){
  Object.assign(this,{api,uid,storage,timers});this.key='sekkes:transcript-outbox:'+uid;this.queue=[];this.running=null;this.disposed=false;this.timer=null;
  try{const saved=JSON.parse(storage.getItem(this.key)||'[]');if(Array.isArray(saved))this.queue=saved.filter(x=>x?.session_id&&Array.isArray(x.events));}catch{}
 }
 save(){this.storage?.setItem(this.key,JSON.stringify(this.queue));}
 receive(sessionId,event){
  if(this.disposed)return;
  const speaker=event.type==='session.input_transcript.delta'?'user':event.type==='session.output_transcript.delta'?'assistant':null;
  if(!speaker||!event.delta||typeof event.delta!=='string'||!Number.isInteger(event.start_ms)||!Number.isInteger(event.end_ms)||typeof event.event_id!=='string')return;
  let batch=this.queue.find(x=>x.session_id===sessionId);if(!batch){batch={session_id:sessionId,events:[]};this.queue.push(batch);}
  if(batch.events.some(x=>x.event_id===event.event_id))return;
  batch.events.push({speaker,event_id:event.event_id,delta:event.delta,start_ms:event.start_ms,end_ms:event.end_ms});
  try{this.save()}catch{/* Retain in memory if local storage is full. */}
  this.schedule(350);
 }
 schedule(ms){if(this.disposed||this.timer)return;this.timer=this.timers.setTimeout(()=>{this.timer=null;this.flush().catch(()=>{});},ms);}
 flush(){
  if(this.running)return this.running;if(this.disposed||!this.queue.length)return Promise.resolve();
  this.running=(async()=>{
   while(this.queue.length&&!this.disposed){
    if(this.api.user?.id!==this.uid)throw Error('ACCOUNT_CHANGED');
    const batch=this.queue[0],events=batch.events.slice(0,100);
    const result=await this.api.request('conversation',{method:'POST',body:{action:'live_append',session_id:batch.session_id,events}});
    if(!result.saved)throw Error('TRANSCRIPT_NOT_SAVED');
    batch.events.splice(0,events.length);if(!batch.events.length)this.queue.shift();try{this.save()}catch{}
   }
  })().finally(()=>{this.running=null;if(this.queue.length&&!this.disposed)this.schedule(5000);});return this.running;
 }
 dispose(){this.disposed=true;this.timers.clearTimeout(this.timer);this.timer=null;}
}

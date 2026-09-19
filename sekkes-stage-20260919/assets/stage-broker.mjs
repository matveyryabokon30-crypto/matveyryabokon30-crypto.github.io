// Only the dedicated SEKKES staging service receives the current account token.
export class StageBroker {
 constructor(api){this.api=api;this.base='https://wqwqhagyevbszadqcoqj.supabase.co/functions/v1/sekkes-stage-live/';}
 async call(action,body,signal){
  const r=await this.api.transport(this.base+action,{method:'POST',redirect:'error',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(22000),headers:{...this.api.auth(),'Content-Type':'application/json'},body:JSON.stringify(body)});
  let d;try{d=await r.json();}catch{throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});}
  if(!r.ok)throw Object.assign(Error(d.code||'SESSION_UNAVAILABLE'),{code:d.code||'SESSION_UNAVAILABLE'});return d;
 }
 create({requestId,sdp,voice,signal}){return this.call('start',{client_request_id:requestId,sdp,voice,mode:'conversation',adult:true,consent:'sekkes-s3-live-openai-20260918'},signal);}
 close({requestId,reason}){return this.call('close',{client_request_id:requestId,reason});}
}

/** Live wire format is confined here. This is not the Realtime API protocol. */
export const BUILD = '2026.09.19-p2.1.0';
export const MODELS = Object.freeze({voice:'gpt-live-1',reasoning:'gpt-5.6-sol'});
const finite = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
export function decodeEvent(raw) {
  let e; try { e = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {kind:'malformed'}; }
  if (!e || typeof e.type !== 'string') return {kind:'malformed'};
  switch (e.type) {
    case 'session.started': return typeof e.session?.id === 'string' ? {kind:'ready',id:e.session.id,model:e.session.model} : {kind:'malformed'};
    case 'session.closed': return {kind:'closed',id:e.session?.id,seconds:finite(e.usage?.seconds)?e.usage.seconds:null,reason:['close_requested','expired','content','remote_hangup','connection_lost'].includes(e.reason)?e.reason:'unknown'};
    case 'session.usage.updated': return finite(e.usage?.seconds) ? {kind:'usage',seconds:e.usage.seconds} : {kind:'malformed'};
    case 'session.instructions.appended': return {kind:'greeting_ack',command:e.client_event_id};
    case 'delegation.created': return {kind:'delegation'};
    case 'response.event': {
      // A response.done belongs to delegated work, not the end of audible Live output.
      const response=e.event?.response;
      return {kind:'backend',terminal:['response.completed','response.failed','response.incomplete'].includes(e.event?.type),model:typeof response?.model==='string'?response.model:null};
    }
    case 'error': return {kind:'error',code:['invalid_event','invalid_state','permission_denied','invalid_request_error','rate_limit_exceeded'].includes(e.error?.code)?e.error.code:'provider_event_error',command:e.error?.event_id};
    default: return {kind:'ignored'};
  }
}
export function greetingCommand(eventId) {
  return {type:'session.instructions.append',event_id:eventId,delegation_id:null,content:'Сразу поприветствуй собеседника по-русски: «Привет. Я здесь. О чём хочешь поговорить?» Не жди первой реплики. Затем сделай паузу и слушай.'};
}
export function closeCommand(eventId) { return {type:'session.close',event_id:eventId}; }
// Logging is allowlisted. Never pass provider payloads, SDP, text, audio or tokens here.
export class TechnicalLog {
  constructor(limit=200) { this.limit=limit; this.rows=[]; }
  add(event,fields={}) {
    const row={event,build:BUILD};
    for (const k of ['generation','ms','seconds','uncertain','ack','code','state']) {
      const v=fields[k];
      if (typeof v==='boolean' || (typeof v==='number'&&Number.isFinite(v)) || (typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,64}$/.test(v))) row[k]=v;
    }
    this.rows.push(row); if(this.rows.length>this.limit)this.rows.shift(); return row;
  }
}

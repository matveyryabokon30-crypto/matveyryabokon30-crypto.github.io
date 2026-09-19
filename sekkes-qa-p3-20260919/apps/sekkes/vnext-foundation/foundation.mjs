/** SEKKES P2.0. Provider-neutral contracts. No network, microphone, billing or deployment. */
export class ContractError extends Error {
  constructor(code) { super(code); this.name = 'ContractError'; this.code = code; }
}
const transitions = Object.freeze({
  idle: ['start'], closed: ['start'], permission_denied: ['start'],
  network_error: ['start'], session_error: ['start'], limit_reached: ['start'],
  requesting_permission: ['permission_granted', 'permission_denied', 'stop', 'network_error'],
  connecting: ['session_ready', 'stop', 'network_error', 'session_error', 'limit_reached'],
  ready: ['listening', 'thinking', 'speaking', 'reconnect', 'stop', 'network_error', 'session_error', 'limit_reached'],
  listening: ['thinking', 'speaking', 'reconnect', 'stop', 'network_error', 'session_error', 'limit_reached'],
  thinking: ['listening', 'speaking', 'reconnect', 'stop', 'network_error', 'session_error', 'limit_reached'],
  speaking: ['listening', 'thinking', 'reconnect', 'stop', 'network_error', 'session_error', 'limit_reached'],
  reconnecting: ['session_ready', 'stop', 'network_error', 'session_error', 'limit_reached'],
  closing: ['closed', 'close_timeout']
});
const targets = Object.freeze({start:'requesting_permission', permission_granted:'connecting',
  session_ready:'ready', reconnect:'reconnecting', stop:'closing', close_timeout:'closed'});
export function initialSession() {
  return Object.freeze({state:'idle', generation:0, sessionId:null, closeUncertain:false, error:null});
}
/** Only a checked adapter may translate provider events into these domain events. */
export function transitionSession(snapshot, event) {
  if (!snapshot || !Object.hasOwn(transitions, snapshot.state) || !Number.isSafeInteger(snapshot.generation) || snapshot.generation < 0)
    throw new ContractError('INVALID_STATE');
  if (!event || typeof event.type !== 'string') throw new ContractError('INVALID_EVENT');
  if (event.type !== 'start' && event.generation !== snapshot.generation) return snapshot;
  if (!transitions[snapshot.state].includes(event.type)) throw new ContractError('INVALID_TRANSITION');
  if (event.type === 'start') return Object.freeze({...initialSession(), state:'requesting_permission', generation:snapshot.generation+1});
  if (event.type === 'session_ready' && (typeof event.sessionId !== 'string' || !event.sessionId.trim()))
    throw new ContractError('SESSION_ID_REQUIRED');
  const state = targets[event.type] || event.type;
  const terminalError = ['network_error','session_error','permission_denied','limit_reached'].includes(state);
  return Object.freeze({...snapshot, state,
    sessionId: event.type === 'session_ready' ? event.sessionId : snapshot.sessionId,
    closeUncertain: event.type === 'close_timeout' ? true : snapshot.closeUncertain,
    error: terminalError ? state : snapshot.error});
}
const nonnegative = x => Number.isSafeInteger(x) && x >= 0;
/** Unknown or possibly charged work remains counted. Closing a call is NOT a refund. */
export function assessBudget({cap, settled, reserved, uncertain}, request) {
  if (![cap,settled,reserved,uncertain,request].every(nonnegative)) throw new ContractError('INVALID_BUDGET');
  const used=settled+reserved+uncertain;
  if (!Number.isSafeInteger(used) || !Number.isSafeInteger(used+request)) throw new ContractError('BUDGET_OVERFLOW');
  return Object.freeze({allowed:used+request<=cap, remaining:Math.max(0,cap-used), committed:used});
}
/** States are not billing evidence. An explicit provider rejection must be reconciled. */
export function refundable(entry) {
  return entry?.providerAccepted === false && entry?.chargeEvidence === 'confirmed_zero';
}
export function normalizePreference(savedId, enabledIds, fallback='echo') {
  if (!Array.isArray(enabledIds) || !enabledIds.length || !enabledIds.every(x=>typeof x==='string'))
    throw new ContractError('NO_VERIFIED_VOICES');
  const id=enabledIds.includes(savedId)?savedId:enabledIds.includes(fallback)?fallback:enabledIds[0];
  return Object.freeze({id,changed:id!==savedId,reason:id===savedId?'retained':'unavailable_saved_voice'});
}
const sha256 = x => typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
/** Object shape/evidence validation, not a substitute for an actual audio/device test. */
export function assessVoice(voice) {
  const errors=[];
  if (!voice || typeof voice.id!=='string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(voice.id)) return ['INVALID_VOICE_ID'];
  if (voice.enabled !== true) return [];
  for (const key of ['live_session_created','audio_received','session_closed','no_orphan_session']) {
    if (voice.evidence?.[key] !== true) errors.push('MISSING_'+key.toUpperCase());
  }
  if (!sha256(voice.evidence?.artifact_sha256)) errors.push('MISSING_LIVE_EVIDENCE_ARTIFACT');
  if (!voice.model || voice.model!==voice.evidence?.model || voice.id!==voice.evidence?.voice) errors.push('CAPABILITY_MISMATCH');
  const p=voice.preview;
  if (!p || p.kind!=='static_asset') errors.push('STATIC_PREVIEW_REQUIRED');
  if (!sha256(p?.sha256) || !p?.url || !p?.phrase_version || p?.language!=='ru') errors.push('INCOMPLETE_PREVIEW');
  if (!Number.isFinite(p?.duration_seconds) || p.duration_seconds<=0 || p.duration_seconds>30) errors.push('INVALID_PREVIEW_DURATION');
  if (p?.model!==voice.model || p?.voice!==voice.id || p?.origin!=='live_generated') errors.push('PREVIEW_PROVENANCE_MISMATCH');
  if (voice.russian_review!=='owner_approved') errors.push('RUSSIAN_REVIEW_PENDING');
  return errors;
}
/** Release evidence is pinned to one candidate, never borrowed from another build. */
export function assessRelease(release) {
  const errors=[];
  if (!release || !sha256(release.candidate_sha256)) return ['INVALID_CANDIDATE'];
  if (!['staging','production'].includes(release.target)) errors.push('INVALID_TARGET');
  if (!release.version || ![release.html_version,release.js_version,release.sw_version].every(v=>v===release.version)) errors.push('MIXED_RELEASE_VERSIONS');
  if (release.preview_opens_session!==false || release.preview_needs_microphone!==false || release.preview_bills_per_tap!==false) errors.push('PREVIEW_SIDE_EFFECTS');
  if (release.affects_pablicus!==false) errors.push('PABLICUS_BOUNDARY');
  const requirements=release.target==='production'?['unit','browser','real_iphone','owner_acceptance']:['unit','browser'];
  for(const kind of requirements) {
    const e=release.checks?.[kind];
    if (!e || e.result!=='pass' || e.candidate_sha256!==release.candidate_sha256 || !sha256(e.artifact_sha256)) errors.push('EVIDENCE_'+kind.toUpperCase());
  }
  if (!Array.isArray(release.voices) || new Set(release.voices.map(v=>v?.id)).size!==release.voices.length) errors.push('INVALID_VOICE_REGISTRY');
  else for(const v of release.voices) errors.push(...assessVoice(v).map(e=>v.id+':'+e));
  if (release.target==='production' && !release.voices?.some(v=>v.enabled===true)) errors.push('NO_VERIFIED_VOICES');
  return errors;
}

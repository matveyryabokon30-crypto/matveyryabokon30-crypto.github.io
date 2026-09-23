// Versioned UI-domain envelope. Transport adapters retain their existing payloads.
export const MESSAGE_SCHEMA=1;
export const CONTENT_TYPES=Object.freeze(['text','image','video','audio','voice','file','album','sticker','gif','location','contact','poll','system','call','custom']);
export const CAPABILITIES=Object.freeze({
 copy:'local',reply:'quote-draft',forward:'text-draft',delete:'local',pin:'local',reaction:'local',select:'local',text:'local',close:'local',more:'local',
 edit:'planned',deleteEveryone:'planned',thread:'planned',search:'planned',scheduledSend:'planned',silentSend:'planned',readReceipt:'planned',typing:'planned',presence:'planned',mentions:'planned',draftSync:'planned',offlineOutbox:'planned',uploadResume:'planned',mediaForward:'planned',albums:'planned',stickers:'planned',gif:'planned',poll:'planned',contact:'planned',location:'planned',liveLocation:'planned',translation:'planned',transcription:'planned',savedMessages:'planned',reminders:'planned',export:'planned',groups:'planned',channels:'planned',topics:'planned',moderation:'planned',blocking:'planned',reporting:'planned',notifications:'planned',retention:'planned',encryption:'planned',deviceSync:'planned',calls:'planned',bots:'planned'
});
export function createMessageStore(conversationId){
 const records=new Map(),entities=new Map();
 return {set(id,record){
  if(!id)throw new TypeError('Stable message id required');
  const prior=entities.get(id),meta=record.meta||{};
  entities.set(id,{schema:MESSAGE_SCHEMA,id,conversationId,revision:(prior?.revision||0)+1,sender:record.role,
   createdAt:meta.at,delivery:meta.state||'sent',content:[{type:'text',value:record.text}],
   attachments:meta.attachments||prior?.attachments||[],relations:meta.relations||prior?.relations||{},
   extensions:meta.extensions||prior?.extensions||{},transport:meta});records.set(id,record);},
  get:id=>entities.get(id),values:()=>records.values(),clear(){records.clear();entities.clear()}};
}
// Extensions register handlers without writing viewport/scroll coordinates.
export function createCommandRouter(){
 const handlers=new Map();return {register(id,handler){if(!Object.hasOwn(CAPABILITIES,id))throw Error('UNKNOWN_COMMAND');handlers.set(id,handler);return()=>handlers.delete(id)},
  supports:id=>handlers.has(id),execute(id,payload){const handler=handlers.get(id);if(!handler)throw Error('COMMAND_UNAVAILABLE');return handler(payload)}};
}

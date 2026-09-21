export async function restoreConversation(api,cursor=null){
 const epoch=api.authEpoch;
 const data=await api.request('conversation',cursor?{method:'POST',body:{action:'history',before_at:cursor.at,before_id:cursor.id}}:{});
 if(epoch!==api.authEpoch)return null;
 if(!Array.isArray(data.items))throw Error('HISTORY_INVALID');
 return {items:data.items.filter(x=>typeof x.id==='string'&&typeof x.text==='string'&&['user','assistant'].includes(x.speaker)),hasMore:data.hasMore===true};
}
// Compatibility for older callers; the application uses the cross-channel read model above.
export async function restoreLatestThread(api){
 const epoch=api.authEpoch;
 const list=await api.request('journal');
 if(epoch!==api.authEpoch)return null;
 const session=Array.isArray(list.items)?list.items.find(x=>x?.channel==='text'&&typeof x.id==='string'&&x.turn_count>0):null;
 if(!session)return null;
 const history=await api.request('journal',{method:'POST',body:{id:session.id,action:'read'}});
 if(epoch!==api.authEpoch)return null;
 if(history.id!==session.id||!Array.isArray(history.turns))throw Error('HISTORY_INVALID');
 const turns=history.turns.filter(x=>x?.is_final===true&&['user','assistant'].includes(x.speaker)&&typeof x.text==='string'&&Number.isInteger(x.sequence)).sort((a,b)=>a.sequence-b.sequence);
 return {id:session.id,turns};
}

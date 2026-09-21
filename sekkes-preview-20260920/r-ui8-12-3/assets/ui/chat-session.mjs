// Read existing journal using its owner-scoped contract. No history panel, hide/delete or schema changes.
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

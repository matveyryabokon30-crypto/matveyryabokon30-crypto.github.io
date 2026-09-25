// A retry keeps the transport id so the server can return a cached result.
export function retryPayload(messageId,text,stored){
 const match=/^j:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):user$/i.exec(messageId||'');
 if(!match||typeof text!=='string'||!text.trim()||text==='Не отправлено'||text==='…')return null;
 if(stored&&(stored.id!==match[1]||stored.kind!=='text'))return null;
 return {id:match[1],kind:'text',text:stored?.text??text,attachments:[...(stored?.attachments||[])]};
}
export async function retryExisting(turn,{send,render,current=()=>true}){
 render('user',turn.text,{id:'j:'+turn.id+':user',state:'pending',retry:turn});
 try{return await send(turn);}catch(e){if(current())render('user',turn.text,{id:'j:'+turn.id+':user',state:'failed',retry:turn});throw e;}
}

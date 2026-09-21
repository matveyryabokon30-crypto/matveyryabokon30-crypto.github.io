export async function submitChatTurn(api,{id,kind,text,audio},{flush=async()=>{},onUser}={}){
 await flush();
 const result=await api.request('turn',{method:'POST',onUser,body:{id,kind,mode:'explore',...(kind==='voice'?{audio}:{text}),useMemory:true,speak:false,history:[],adult:true,consent:'sekkes-s2-openai-20260918'}});
 if(result.id!==id||typeof result.text!=='string'||typeof result.reply!=='string'||result.journalSaved!==true)throw Object.assign(Error('JOURNAL_SAVE_FAILED'),{code:'JOURNAL_SAVE_FAILED'});
 return result;
}

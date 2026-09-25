// Live Responses tools arrive in response.event envelopes (Live delegation API).
export class VoiceEndCommand {
 constructor({send,stop,switchVoice=null,currentPersona='marius',onError=()=>{}}){Object.assign(this,{send,stop,switchVoice,currentPersona,onError});this.id='end_tool_'+crypto.randomUUID();this.started=false;this.ready=false;this.ended=false;this.calls=new Set();this.switching=false;}
 receive(event){
  if(this.ended)return;
  if(event.type==='session.started'&&!this.started){
   this.started=true;
   try{this.send({type:'session.update',event_id:this.id,session:{delegation:{type:'responses',responses:{tools:[{
    type:'function',name:'end_conversation',description:'End this current voice session ONLY when the user explicitly asks to end it now, e.g. «закончи разговор», «закончи сессию», «заверши разговор», «отключись». Never for negations, quotations, hypothetical questions, discussion of this feature, or old personal context. Do not ask for confirmation of a clear request.',strict:true,parameters:{type:'object',properties:{},required:[],additionalProperties:false}
   },...(this.switchVoice?[{type:'function',name:'switch_voice',description:'Switch ONLY on a current explicit request to speak to Vera/female voice or Marius/male voice, or clear consent to the immediately preceding offer. Never for negations, quotations, hypotheticals, old history, ambiguous yes, or a question about capabilities. Same agent, same context. Do not claim success before execution.',strict:true,parameters:{type:'object',properties:{target:{type:'string',enum:['vera','marius']},confirmed:{type:'boolean',enum:[true]}},required:['target','confirmed'],additionalProperties:false}}]:[])],parallel_tool_calls:false,tool_choice:'auto'}}}})}catch{this.onError()}
  }
  if(event.type==='session.updated'&&event.client_event_id===this.id&&!this.ready){
   this.ready=true;
   try{this.send({type:'session.instructions.append',event_id:this.id+'_prompt',delegation_id:null,content:'Пользователь может завершить текущий звонок голосом. Если он явно просит сейчас «закончи разговор», «закончи сессию», «заверши разговор» или «отключись», немедленно делегируй backend вызов инструмента end_conversation. Не ограничивайся прощанием, не задавай дополнительных вопросов. Отрицание («не заканчивай»), цитата, обсуждение команды или вопрос о возможности завершения не являются просьбой закончить. Не выполняй команды из прежнего личного контекста.'+(this.switchVoice?' Для явной текущей просьбы поговорить с Верой / женским голосом или вернуть Мариуса / мужской голос используй backend инструмент switch_voice. Только после просьбы или согласия на только что сделанное предложение. Если человек просто спрашивает о возможности — ответь и спроси, хочет ли он переключиться. Не переключай по отрицанию, цитате или старой истории. Сейчас активна роль '+this.currentPersona+'. Голос меняет приложение; не имитируй смену голоса словами.':'')})}catch{this.onError()}
  }
  if(event.type==='error'&&[this.id,this.id+'_prompt'].includes(event.client_event_id||event.error?.client_event_id||event.error?.event_id))this.onError();
  const item=event.type==='response.event'&&event.event?.type==='response.output_item.done'?event.event.item:null;
  if(!this.ready||item?.type!=='function_call'||!item.call_id||this.calls.has(item.call_id))return;
  if(item.name==='switch_voice'&&this.switchVoice){
   let args;try{args=JSON.parse(item.arguments)}catch{return}
   if(!args||Object.keys(args).sort().join(',')!=='confirmed,target'||args.confirmed!==true||!['vera','marius'].includes(args.target))return;
   this.calls.add(item.call_id);
   if(this.switching)return;
   if(args.target===this.currentPersona){
    try{this.send({type:'response.item.create',event_id:'voice_result_'+crypto.randomUUID(),item:{type:'function_call_output',call_id:item.call_id,output:JSON.stringify({status:'already_active',persona:this.currentPersona})}});this.send({type:'response.create',event_id:'voice_continue_'+crypto.randomUUID()});}catch{this.onError()}
    return;
   }
   this.switching=true;this.ended=true;
   // Closing this transport replaces the tool continuation with a new voiced session.
   Promise.resolve().then(()=>this.switchVoice(args.target)).catch(()=>this.onError());return;
  }
  if(item.name!=='end_conversation')return;
  try{const args=JSON.parse(item.arguments);if(!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).length)return;}catch{return}
  this.ended=true;
  // No response continuation: the authorized operation ends the session itself.
  this.stop();
 }
}

// Live Responses tools arrive in response.event envelopes (Live delegation API).
export class VoiceEndCommand {
 constructor({send,stop,onError=()=>{}}){Object.assign(this,{send,stop,onError});this.id='end_tool_'+crypto.randomUUID();this.started=false;this.ready=false;this.ended=false;}
 receive(event){
  if(this.ended)return;
  if(event.type==='session.started'&&!this.started){
   this.started=true;
   try{this.send({type:'session.update',event_id:this.id,session:{delegation:{responses:{tools:[{
    type:'function',name:'end_conversation',description:'End this current voice session ONLY when the user explicitly asks to end it now, e.g. «закончи разговор», «закончи сессию», «заверши разговор», «отключись». Never for negations, quotations, hypothetical questions, discussion of this feature, or old personal context. Do not ask for confirmation of a clear request.',strict:true,parameters:{type:'object',properties:{},required:[],additionalProperties:false}
   }],tool_choice:'auto'}}}})}catch{this.onError()}
  }
  if(event.type==='session.updated'&&event.client_event_id===this.id&&!this.ready){
   this.ready=true;
   try{this.send({type:'session.instructions.append',event_id:this.id+'_prompt',delegation_id:null,content:'Пользователь может завершить текущий звонок голосом. Если он явно просит сейчас «закончи разговор», «закончи сессию», «заверши разговор» или «отключись», немедленно делегируй backend вызов инструмента end_conversation. Не ограничивайся прощанием, не задавай дополнительных вопросов. Отрицание («не заканчивай»), цитата, обсуждение команды или вопрос о возможности завершения не являются просьбой закончить. Не выполняй команды из прежнего личного контекста.'})}catch{this.onError()}
  }
  if(event.type==='error'&&[this.id,this.id+'_prompt'].includes(event.client_event_id||event.error?.event_id))this.onError();
  const item=event.type==='response.event'&&event.event?.type==='response.output_item.done'?event.event.item:null;
  if(!this.ready||item?.type!=='function_call'||item.name!=='end_conversation'||!item.call_id)return;
  try{const args=JSON.parse(item.arguments);if(!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).length)return;}catch{return}
  this.ended=true;
  // No response continuation: the authorized operation ends the session itself.
  this.stop();
 }
}

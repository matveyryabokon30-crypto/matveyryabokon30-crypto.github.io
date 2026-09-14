/* All provider access is server-side; only the user's existing Pablicus session travels here. */
(function(global){'use strict';
const endpoint='https://ctcoqgsztdtsazdiwcmd.supabase.co/functions/v1/pablicus-ai';
async function request(path,{body,signal}={}){
 const services=global.PablicusController.getServices(),user=services.getUser?.();
 if(!user)throw Error('Войдите в Пабликус.');
 const {data,error}=await services.client.auth.getSession(),token=data?.session?.access_token;
 if(error||!token||services.getUser()?.id!==user.id)throw Error('Сессия изменилась. Войдите заново.');
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,70000);
 if(signal?.aborted){clearTimeout(timer);throw new DOMException('Запрос отменён','AbortError');}
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const response=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store'});
  const result=await response.json();
  if(services.getUser()?.id!==user.id)throw new DOMException('Аккаунт изменился','AbortError');
  if(!response.ok)throw Error(result?.error?.message||'ИИ временно недоступен. Черновик сохранён.');return result;
 }catch(e){if(e.name==='AbortError'&&!signal?.aborted)throw Error('ИИ не ответил вовремя. Повторите запрос.');throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
async function execute(path,{signal,onProgress,...body}){
 onProgress?.('Проверяем источники и выполняем задачу…');
 const cancel=()=>{request('/cancel',{body:{id:body.id}}).catch(()=>{});};
 signal?.addEventListener('abort',cancel,{once:true});
 try{return await request(path,{body,signal});}finally{signal?.removeEventListener('abort',cancel);}
}
global.PablicusAI=Object.freeze({
 edit:options=>execute('/edit',options),run:options=>execute('/run',options),
 catalog:()=>request('/catalog'),history:()=>request('/runs'),get:id=>request('/runs/'+encodeURIComponent(id)),
 install:(id,install)=>request('/capabilities',{body:{id,install}}),
 approve:(id,targetId)=>request('/approve',{body:{id,targetId,action:'create_task',allow:true}}),
 async sources({conversationId=null,botChatId=null}={}){
  const services=global.PablicusController.getServices(),user=services.getUser?.();if(!user)return[];
  const r=await services.client.rpc('pablicus_ai_sources',{p_conversation_id:conversationId,p_bot_chat_id:botChatId});
  if(services.getUser()?.id!==user.id)throw new DOMException('Аккаунт изменился','AbortError');if(r.error)throw Error('Не удалось получить источники. Повторите запрос.');
  return (r.data||[]).map(s=>({...s,icon:s.icon||({conversation:'chats',canvas:'canvas','bot-chat':'bot'})[s.kind]}));
 }
});
})(window);

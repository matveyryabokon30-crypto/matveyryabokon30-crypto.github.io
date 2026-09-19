// F02-R1 observations are best effort and never gate notification presentation.
const R1_RECEIPT_URL='https://ctcoqgsztdtsazdiwcmd.supabase.co/functions/v1/pablicus-push/receipt';
function r1Meta(p){const r=p?._r1;return r&&PUSH_UUID.test(r.attempt_id||'')&&PUSH_UUID.test(r.event_id||'')&&PUSH_UUID.test(r.installation_id||'')&&/^[a-f0-9]{64}$/.test(r.token||'')?r:null;}
async function r1Receipt(p,state,error){
 const r=r1Meta(p);if(!r)return;
 try{const response=await fetch(R1_RECEIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(3500),body:JSON.stringify({...r,state,...(error?{error_code:['NotAllowedError','InvalidStateError','TypeError'].includes(error.name)?error.name:'UnknownError'}:{})})});await response.body?.cancel();}catch{/* missing receipt remains unknown; never claim a banner was displayed */}
}
self.addEventListener('push',e=>e.waitUntil(queue(async()=>{
 let p;try{p=e.data?.json()}catch{return}
 if(!p||!PUSH_UUID.test(p.recipient_id||'')||!PUSH_UUID.test(p.conversation_id||''))return;
 const task=['task_reminder','task_followup'].includes(p.kind),id=task?p.notification_id:p.message_id;
 if(!PUSH_UUID.test(id||''))return;
 // Do not accept a receipt whose event was substituted in transit/test fixtures.
 if(p._r1&&r1Meta(p)?.event_id!==id)p={...p,_r1:null};
 const observations=[r1Receipt(p,'worker_received')];
 try{
  if(await pushOwner(false)!==p.recipient_id){observations.push(r1Receipt(p,'suppressed_owner'));return;}
  if(task&&(!PUSH_UUID.test(p.task_id||'')||!Number.isFinite(Date.parse(p.expires_at))||Date.parse(p.expires_at)<=Date.now())){observations.push(r1Receipt(p,'expired'));return;}
  const old=await pushState(false,null,'recent'),recent=Array.isArray(old)?old.filter(x=>PUSH_UUID.test(x)).slice(-128):[];
  if(recent.includes(id)){observations.push(r1Receipt(p,'duplicate'));return;}
  let title,body,data={conversationId:p.conversation_id,recipientId:p.recipient_id};
  if(task){title=p.kind==='task_followup'?'Получилось сделать дело?':'Скоро запланировано дело';body=String(p.body||'Откройте дело, чтобы посмотреть срок.').slice(0,240);data={...data,taskId:p.task_id,kind:p.kind,notificationId:id};}
  else{title=String(p.sender_name||'Pablicus').slice(0,80);const kind=String(p.content_kind||'text'),preview=String(p.preview||p.body||'').slice(0,240);body=kind==='image'?(preview||'Фото'):kind==='video'?(preview||'Видео'):kind==='audio'?(preview||'Голосовое сообщение'):preview||'Новое сообщение';data.messageId=p.message_id;}
  if(r1Meta(p))data._r1=p._r1;
  try{await self.registration.showNotification(title,{body,lang:'ru',icon:task?new URL('assets/icon-glass-20260909-192.png',self.registration.scope).href:(p.sender_avatar_url||new URL('assets/icon-glass-20260909-192.png',self.registration.scope).href),badge:new URL('assets/icon-32.png',self.registration.scope).href,tag:task?'pablicus-task-'+p.task_id:'pablicus-conversation-'+p.conversation_id,renotify:true,data});}
  catch(error){observations.push(r1Receipt(p,'show_failed',error));return;}
  observations.push(r1Receipt(p,'show_resolved'));
  await pushState(true,[...recent,id].slice(-128),'recent');
 }finally{await Promise.allSettled(observations);}
})));
self.addEventListener('notificationclick',e=>{
 e.notification.close();const d=e.notification.data;
 e.waitUntil((async()=>{
  if(!d||!PUSH_UUID.test(d.conversationId||'')||!PUSH_UUID.test(d.recipientId||'')||await pushOwner(false)!==d.recipientId)return;
  const receipt=r1Receipt(d,'clicked');
  try{
   const t={type:'PABLICUS_PUSH_OPEN',conversationId:d.conversationId,recipientId:d.recipientId};
   if(d.taskId){t.taskId=d.taskId;t.kind=d.kind;}
   const list=await self.clients.matchAll({type:'window',includeUncontrolled:true}),c=list.filter(x=>validClient(x.url)).sort((a,b)=>Number(b.focused)-Number(a.focused))[0];
   if(c){await c.focus();c.postMessage(t);return;}
   const u=new URL(self.registration.scope);u.searchParams.set('conversation',d.conversationId);u.searchParams.set('recipient',d.recipientId);
   if(d.taskId){u.searchParams.set('task',d.taskId);u.searchParams.set('task_notice',d.kind);}
   await self.clients.openWindow(u.href);
  }finally{await receipt;}
 })());
});

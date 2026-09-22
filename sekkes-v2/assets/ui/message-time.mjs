export function messageTime(at,state,role){
 const date=new Date(at);if(!at||!Number.isFinite(date.getTime()))return null;
 const clock=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 const label=state==='failed'?'Не доставлено':state==='pending'?'Отправляется':role==='user'?'Доставлено':'Получено';
 return {iso:date.toISOString(),text:clock+(state==='failed'||state==='pending'?' · '+label:''),title:label+' · '+date.toLocaleString('ru-RU')};
}

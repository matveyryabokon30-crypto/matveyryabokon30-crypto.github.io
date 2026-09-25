export function messageTime(at,state,role){
 const date=new Date(at);if(!at||!Number.isFinite(date.getTime()))return null;
 const clock=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 const queueLabels={queued:'В очереди',accepted:'Принято к ответу',applied:'Учтено'};
 const label=queueLabels[state]|| (state==='failed'?'Не доставлено':state==='pending'?'Отправляется':role==='user'?'Доставлено':'Получено');
 return {iso:date.toISOString(),text:clock+(state==='failed'||state==='pending'||queueLabels[state]?' · '+label:''),title:label+' · '+date.toLocaleString('ru-RU')};
}

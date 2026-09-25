// Derive views only from the authenticated workspace response; no local copies.
export function dashboardRecords(data,kind){
 const rows=(data.dashboard?.documents||[]).filter(d=>d.kind===kind).map(d=>({...d}));
 if(kind==='example')for(const t of data.turns||[]){
  if(t.status!=='completed'||!t.reply||/^\//.test(t.user_text||''))continue;
  rows.push({id:'turn:'+t.id,title:(t.user_text||'Диалог').slice(0,100),label:'Из административного диалога · не оценён как учебный образец',content:`Запрос:\n${t.user_text}\n\nОтвет:\n${t.reply}`,at:t.answered_at||t.created_at});
 }
 if(kind==='evaluation'){
  const runs=data.training_runs||[];
  for(const r of runs)rows.push({id:'run:'+r.id,title:r.prompt||r.request_text||r.id,label:`${r.mode==='evaluation'?'Проверочный':'Учебный'} запуск · ${r.state} · оценка качества не выставлена`,content:`Запрос:\n${r.prompt||r.request_text||''}\n\nОтвет:\n${r.hidden?'Скрыт после отзыва материала.':r.reply||'Ответ не получен.'}\n\nВходные токены: ${r.usage?.input_tokens??'неизвестно'}\nВыходные токены: ${r.usage?.output_tokens??'неизвестно'}\nID: ${r.id}`,at:r.created_at});
  for(const t of data.turns||[]){
   if(!t.usage?.memory_trial&&!t.usage?.context_pilot)continue;
   rows.push({id:'trial:'+t.id,title:t.user_text||'Испытание',label:'Журнал испытаний · результат не является оценкой качества',content:t.reply||'Нет результата',at:t.created_at});
  }
 }
 return rows;
}

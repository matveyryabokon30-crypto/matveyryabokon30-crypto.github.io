import {el} from './components.mjs';
const states={prepared:'Подготовлен',dispatched:'Выполняется',completed:'Ответ получен',failed:'Ошибка',unknown:'Исход не подтверждён',withheld:'Результат недоступен'};
const verdicts={match:'Текст совпадает с эталоном',needs_review:'Тексты различаются — нужна оценка смысла'};
const button=(label,fn)=>{const b=el('button','owner-button',label);b.type='button';b.onclick=fn;return b;};
export function evaluationSummary(run){
 return `${run.title} · v${run.document_revision} · ${states[run.state]||'Неизвестный статус'}`;
}
export function evaluationDetails(run){
 const box=el('div','owner-evaluation-result');
 box.append(el('p','owner-note',states[run.state]||'Статус неизвестен'));
 for(const [key,label]of [['question','Вопрос'],['expected','Эталон'],['actual','Новый ответ']])if(run[key])box.append(el('p','owner-note',label),el('p','owner-auto-text',run[key]));
 if(run.comparison)box.append(el('p','owner-note',verdicts[run.comparison.result]||'Нужна проверка'),el('p','owner-note',run.comparison.note||''));
 const m=run.manifest||{};
 box.append(el('p','owner-note',`Модель: ${m.model||'неизвестно'} · рассуждение: ${m.effort||'неизвестно'} · инструкция: v${m.instruction_revision??'?'}`),
  el('p','owner-note',`Токены вход/выход: ${run.usage?.input_tokens??'неизвестно'} / ${run.usage?.output_tokens??'неизвестно'}. Начисленная стоимость: не подтверждена.`));
 if(run.created_at)box.append(el('p','owner-note',new Date(run.created_at).toLocaleString('ru-RU')));
 if(run.error_code)box.append(el('p','owner-note','Ошибка: '+run.error_code));
 if(['unknown','prepared','dispatched'].includes(run.state))box.append(el('p','owner-note','Повторного вызова модели нет. Обновление запрашивает только сохранённый результат.'));
 return box;
}
export function evaluationControls({document,onRequest,available=()=>true}){
 const box=el('section','owner-evaluation-controls');
 // This ID survives retries and a failed HTTP reply. A newly mounted panel first displays the server journal.
 let id=null,localBusy=false,nextAction='run';
 const note=el('p','owner-note','Изолированная текстовая проверка: без личной анкеты, памяти, истории, инструментов и голоса. Один запрос к модели; расходуется API-бюджет. Сравнение нормализует только пробелы. Ручная оценка не меняется.');
 const result=el('div'),status=el('p','owner-notice');status.setAttribute('role','status');
 const start=button('Запустить проверку',async()=>{
  if(localBusy||!available())return;localBusy=true;start.disabled=true;status.textContent='Проверка выполняется…';
  const action=nextAction;id??=crypto.randomUUID();nextAction='read';
  try{const r=await onRequest({action,id,document_id:document.id,document_revision:document.revision});if(!box.isConnected)return;result.replaceChildren(evaluationDetails(r));status.textContent=r.state==='completed'?'Результат сохранён в журнале.':'Состояние получено из журнала.';}
  catch(e){if(['INVALID_EVALUATION','PROVIDER_NOT_CONFIGURED','NOT_FOUND','S2_BUSY','S2_BUDGET'].includes(e.code))nextAction='run';if(box.isConnected)status.textContent=e.message||'Связь прервалась. Обнови состояние этого запуска.';}
  finally{localBusy=false;if(box.isConnected){start.disabled=false;start.textContent=nextAction==='run'?'Запустить проверку':'Обновить состояние запуска';}}
 });
 box.append(note,start,status,result);return box;
}
export function evaluationJournal({data,onRead,available=()=>true}){
 const box=el('section','owner-evaluation-journal');box.setAttribute('aria-label','Журнал автоматических проверок');
 box.append(el('p','owner-note',`Журнал проверок · показано ${data.runs?.length||0} из ${data.total??0}`));
 for(const run of data.runs||[]){const detail=el('details','owner-auto-record');detail.append(el('summary','',evaluationSummary(run)));const body=el('div');body.append(evaluationDetails(run));let busy=false;
 const read=button('Открыть результат',async()=>{if(busy||!available())return;busy=true;read.disabled=true;try{const r=await onRead(run.id);if(detail.isConnected)body.replaceChildren(evaluationDetails(r));}catch(e){if(detail.isConnected)body.append(el('p','owner-notice',e.message||'Не удалось прочитать результат.'));}finally{busy=false;read.disabled=false;}});
 detail.append(read,body);box.append(detail);}
 if(!data.runs?.length)box.append(el('p','owner-note','Запусков пока нет. Создай или выбери проверку в начале этой вкладки.'));
 return box;
}

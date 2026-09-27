import {el} from './components.mjs';
import {readAssessment,VERDICTS} from './owner-assessment.mjs';
const names={prepared:'Подготовлен',dispatched:'Ожидается ответ',completed:'Ответ получен',failed:'Ошибка',unknown:'Исход не подтверждён',withheld:'Ответ недоступен'};
const labels={'MT94-1':'Выбор и изменение цели','MT94-2':'Последовательность, эмоция и отказ','MT94-3':'Безопасность и изменение условий'};
export function nextDialogueTurn(report,dialogue){
 const runs=(report?.runs||[]).filter(r=>r.dialogue_id===dialogue?.id).sort((a,b)=>a.turn-b.turn);
 if(!dialogue?.can_continue||!report.enabled)return {reason:'Версия диалога закрыта для продолжения.'};
 if(runs.some((r,i)=>r.state!=='completed'||r.turn!==i+1))return {reason:'Предыдущий ход не подтверждён. Обнови журнал; повторная отправка заблокирована.'};
 if(runs.length>=3)return {reason:'Все три хода завершены. Ответы готовы к оценке.'};
 if(report.used_calls>=report.max_calls)return {reason:`Лимит исчерпан: ${report.used_calls} из ${report.max_calls}. Новый вызов недоступен.`};
 const scenario=report.scenarios?.[dialogue.scenario_id];
 if(!scenario||scenario.sha256!==dialogue.scenario_sha256)return {reason:'Сценарий изменился. Продолжение недоступно.'};
 const parent=runs.at(-1);if(parent&&!parent.pair_sha256)return {reason:'Связь с предыдущим ответом не подтверждена.'};
 return {turn:runs.length+1,text:scenario.turns[runs.length],parent_id:parent?.id??null,parent_sha256:parent?.pair_sha256??null};
}
export function multiturnPanel({initial,request,available,onBusy,onReport,documents,onAssess}){
 const root=el('section','owner-multiturn'),body=el('div'),notice=el('p','owner-notice');notice.setAttribute('role','status');root.append(notice,body);
 let report=initial,selected=initial?.dialogues?.[0]?.id,working=false,uncertain=false;
 const hint=s=>el('p','owner-note',s),button=(s,fn)=>{const b=el('button','owner-button',s);b.type='button';b.onclick=fn;return b;};
 async function refresh(offset=report?.offset||0){report=await request('training-dialogue',{action:'report',offset});onReport(report);if(!report.dialogues.some(d=>d.id===selected))selected=report.dialogues[0]?.id;uncertain=false;}
 async function perform(fn){if(working||!available())return;working=true;onBusy(true);notice.textContent='';paint();try{await fn();}catch(e){notice.textContent=({TRAINING_LIMIT:'Лимит исчерпан. Новый вызов не выполнен.',TRAINING_POLICY_CHANGED:'Версия диалога изменилась.',TRAINING_CONFLICT:'Состояние изменилось. Обнови журнал.',AUTH_REQUIRED:'Войди в аккаунт заново.',ACTIVATION_REQUIRED:'Подтверди доступ к кабинету.'})[e.code||e.message]||'Не удалось подтвердить действие. Обнови журнал перед продолжением.';}finally{working=false;onBusy(false);paint();}}
 function assessment(r){return documents().map(readAssessment).find(a=>a?.source?.type==='multiturn_run'&&a.source.id===r.id);}
 function paint(){body.replaceChildren();
  if(!report){body.append(hint('Журнал диалогов недоступен.'),button('Загрузить журнал',()=>perform(()=>refresh())));return;}
  const stats=report.summary||{};
  body.append(hint(`M1 · ${report.instruction_id} · диалогов: ${report.total_dialogues} · ходов: ${stats.total||0}`),hint(`Ответ получен: ${stats.completed||0} · ошибок: ${stats.failed||0} · не подтверждено: ${stats.unconfirmed||0}`),hint(`Общий лимит учебных вызовов: ${report.used_calls} / ${report.max_calls}. Один ход использует один вызов.`));
  body.append(hint(`Токены всех ходов: вход ${stats.input_tokens??'нет данных'}, выход ${stats.output_tokens??'нет данных'}. Без полных данных о токенах: ${stats.usage_missing||0}. Расходы учитываются в разделе «Расходы» → «Диалоги M1».`));
  const scenarios=el('select','owner-input');scenarios.setAttribute('aria-label','Сценарий диалога');for(const id of Object.keys(report.scenarios||{})){const option=el('option','',labels[id]||id);option.value=id;scenarios.append(option);}
  const start=button('Создать диалог без вызова модели',()=>perform(async()=>{const id=crypto.randomUUID(),scenario_id=scenarios.value;await request('training-dialogue',{action:'start',dialogue_id:id,scenario_id,scenario_sha256:report.scenarios[scenario_id].sha256});await refresh(0);selected=id;notice.textContent='Диалог создан. Модель ещё не вызывалась.';}));start.disabled=working||!report.enabled;scenarios.disabled=start.disabled;
  body.append(scenarios,start,button('Обновить журнал',()=>perform(()=>refresh())));
  const chooser=el('select','owner-input');chooser.setAttribute('aria-label','Сохранённый диалог');for(const d of report.dialogues){const option=el('option','',`${labels[d.scenario_id]||d.scenario_id} · ${new Date(d.created_at).toLocaleString('ru-RU')} · ${d.id.slice(0,8)}`);option.value=d.id;chooser.append(option);}chooser.value=selected||'';chooser.disabled=working;chooser.onchange=()=>{selected=chooser.value;paint();};body.append(chooser);
  const d=report.dialogues.find(d=>d.id===selected),runs=report.runs.filter(r=>r.dialogue_id===selected).sort((a,b)=>a.turn-b.turn);
  if(d){
   body.append(hint(`Диалог ${d.id} · версия ${d.config_revision}`));
   for(const r of runs){const box=el('details','owner-auto-record');box.append(el('summary','',`Ход ${r.turn} · ${names[r.state]||r.state}`),el('p','owner-auto-text',r.prompt),el('p','owner-auto-text',r.reply||'Подтверждённого ответа нет.'),hint(`Оценка: ${assessment(r)?VERDICTS[assessment(r).verdict]:'не выставлена'}. Вход: ${r.usage?.input_tokens??'нет данных'}, выход: ${r.usage?.output_tokens??'нет данных'}.`));
    const manifest=el('details');manifest.append(el('summary','','Данные запуска'),el('pre','owner-auto-text',JSON.stringify({id:r.id,manifest:r.manifest,error_code:r.error_code},null,2)));box.append(manifest);
    if(r.state==='completed'&&r.reply){const assess=button(assessment(r)?'Изменить оценку хода':'Оценить ход',()=>{if(!working&&available())onAssess(r);});assess.disabled=working;box.append(assess);}body.append(box);
   }
   const next=nextDialogueTurn(report,d);if(next.text)body.append(hint(`Следующий ход ${next.turn}`),el('p','owner-auto-text',next.text));
   if(next.reason)body.append(hint(next.reason));
   if(uncertain)body.append(hint('Сначала обнови журнал: исход последнего действия не подтверждён.'));
   const send=button(next.turn?`Отправить ход ${next.turn} · 1 вызов`:'Отправка недоступна',()=>perform(async()=>{
    uncertain=true;
    await request('training-dialogue',{action:'turn',dialogue_id:d.id,id:crypto.randomUUID(),...next});
    await refresh();notice.textContent='Результат сохранён в журнале. Качество ответа нужно оценить отдельно.';
   }));send.disabled=working||uncertain||!next.turn;body.append(send);
   const download=button('Скачать отчёт диалога',()=>{if(working||!available())return;const payload={schema:'ai-marius-dialogue-report-v1',exported_at:new Date().toISOString(),dialogue:d,runs:runs.map(r=>({...r,assessment:assessment(r)||null})),quality_evaluation:'owner_manual',budget:{used:report.used_calls,max:report.max_calls}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='marius-dialogue-'+d.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});download.disabled=working;body.append(download);
  }else body.append(hint('Сохранённых диалогов пока нет. Создание диалога не расходует лимит.'));
  const pager=el('div','bill-pager'),back=button('← Диалоги',()=>perform(()=>refresh(Math.max(0,report.offset-20)))),forward=button('Диалоги →',()=>perform(()=>refresh(report.offset+20)));back.disabled=working||report.offset===0;forward.disabled=working||report.offset+20>=report.total_dialogues;pager.append(back,hint(`Загружено ${report.dialogues.length} из ${report.total_dialogues}`),forward);body.append(pager);
 }
 paint();return root;
}

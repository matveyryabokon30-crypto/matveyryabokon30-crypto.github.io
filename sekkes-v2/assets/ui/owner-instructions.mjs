import {el} from './components.mjs';
export function instructionDiff(before='',after=''){
 const a=before.split('\n'),b=after.split('\n');let start=0,end=0;
 while(start<a.length&&start<b.length&&a[start]===b[start])start++;
 while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
 return {removed:a.slice(start,a.length-end).join('\n'),added:b.slice(start,b.length-end).join('\n'),same:before===after};
}
export function instructionPanel({state,documents,onApply,available=()=>true}){
 const panel=el('div','owner-instruction-control'),note=s=>el('p','owner-note',s);
 const button=(text,fn)=>{const b=el('button','owner-button',text);b.type='button';b.onclick=fn;return b;};
 if(!state?.current){panel.append(note('Управление инструкцией временно недоступно. Обнови данные.'));return panel;}
 const active=state.current;
 panel.append(el('h2','owner-heading','Инструкция Мариуса'),note('Общее дополнение для всех пользователей: текст, голосовые сообщения и живой голос Мариуса и Веры. Админ-диалог и учебные запуски не меняются. Базовые правила и ограничения остаются.'),note(active.revision?`Действует выпуск ${active.revision}: ${active.title}${active.document_revision?' · v'+active.document_revision:''}`:'Действует базовая инструкция, без дополнений.'));
 const current=el('details');current.append(el('summary','','Посмотреть действующее дополнение'),el('p','owner-auto-text',active.content||'Дополнений нет.'));panel.append(current);
 const preview=el('div');preview.setAttribute('aria-label','Просмотр изменений инструкции');
 function choose(value,payload,label){
  if(!available())return;
  const diff=instructionDiff(active.content,value.content);preview.replaceChildren(el('h3','',label));
  if(diff.same){preview.append(note('Содержание совпадает с действующим. Применение не требуется.'));return;}
  preview.append(note('Будет убрано:'),el('p','owner-auto-text',diff.removed||'Ничего'),note('Будет добавлено:'),el('p','owner-auto-text',diff.added||'Ничего'));
  const full=el('details');full.append(el('summary','','Полный текст после применения'),el('p','owner-auto-text',value.content||'Только базовая инструкция.'));preview.append(full,note('Изменение начнёт действовать со следующего сообщения и нового голосового подключения. Текущий разговор не прервётся.'));
  const operation=crypto.randomUUID();let pending=false;
  const status=note('');status.setAttribute('role','status');
  const apply=button(payload.action==='rollback'?'Подтвердить откат':'Применить для всех пользователей',async()=>{
   if(pending||!available())return;pending=true;apply.disabled=true;status.textContent='Применяем…';
   try{await onApply({...payload,expected:active.revision,operation});status.textContent='Применено.';}
   catch(e){status.textContent=e.message||'Не удалось применить. Повтори или обнови данные.';}
   finally{pending=false;apply.disabled=false;}
  });preview.append(apply,status);
 }
 panel.append(note('Сохранённые версии — выбери для сравнения:'));
 const saved=documents.filter(d=>d.kind==='instruction').sort((a,b)=>b.revision-a.revision);
 if(!saved.length)panel.append(note('Сначала создай и сохрани документ «Инструкция». Сохранение само по себе не меняет агента.'));
 for(const d of saved)panel.append(button(`${d.title} · v${d.revision} · сравнить`,()=>choose(d,{action:'apply',document_id:d.id,document_revision:d.revision},`${d.title} · v${d.revision}`)));
 const history=el('details');history.append(el('summary','','История применения и откат · последние 30 изменений'));
 for(const h of state.history||[]){history.append(note(`Выпуск ${h.revision} · ${h.action==='rollback'?'откат':'применение'} · ${h.title} · ${new Date(h.created_at).toLocaleString('ru-RU')}`));if(h.revision<active.revision)history.append(button('Вернуться к выпуску '+h.revision,()=>choose(h,{action:'rollback',target:h.revision},'Откат к выпуску '+h.revision)));}
 if(active.revision)history.append(button('Вернуться к базовой инструкции',()=>choose({content:''},{action:'rollback',target:0},'Откат к базовой инструкции')));
 panel.append(history,preview);return panel;
}

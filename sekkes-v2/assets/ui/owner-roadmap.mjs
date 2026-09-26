import {el} from './components.mjs';
import {pagedCollection} from './owner-hub.mjs';
export const STATES={planned:'Впереди',active:'В работе',done:'Готово'};
const COLORS={planned:'#a9b9cc',active:'#ffcd79',done:'#6fe7b7'};
export function progress(groups){const items=groups.flatMap(g=>g.items),done=items.filter(i=>i.status==='done').length;return {total:items.length,done,active:items.filter(i=>i.status==='active').length,percent:items.length?Math.round(done/items.length*100):0};}
export function groupState(group){return group.items.every(i=>i.status==='done')?'done':group.items.some(i=>i.status!=='planned')?'active':'planned';}
const button=(text,fn)=>{const b=el('button','owner-button',text);b.type='button';b.onclick=fn;return b;};
const note=text=>el('p','bill-note',text);
function bar(value){const t=el('div','bill-track'),f=el('div','bill-fill');t.setAttribute('role','progressbar');t.setAttribute('aria-label','Выполненные подпункты');t.setAttribute('aria-valuenow',value);t.setAttribute('aria-valuemin','0');t.setAttribute('aria-valuemax','100');f.style.width=value+'%';f.style.background='#6fe7b7';t.append(f);return t;}
export function roadmapPanel({request,available=()=>true,onBusy=()=>{},onDirty=()=>{},viewState={}}){
 const root=el('section','owner-billing owner-roadmap'),report=el('div','bill-report'),nav=el('nav','bill-nav'),message=el('p','bill-note');message.setAttribute('role','status');nav.setAttribute('aria-label','Разделы плана');
 root.append(message,report,nav);let data,working=false,edit=null,pending=null;
 const alive=()=>root.isConnected;
 const can=()=>!working&&available();
 const fail=e=>e.code==='REVISION_CONFLICT'||e.message==='REVISION_CONFLICT'?'План изменён в другой сессии. Твоя правка сохранена в форме. Обнови данные и проверь её перед сохранением.':e.code==='ACTIVATION_REQUIRED'||e.message==='ACTIVATION_REQUIRED'?'Подтверди доступ к админке и открой план снова.':'Не удалось сохранить или загрузить план. Можно повторить.';
 async function load(){
  if(working)return;working=true;onBusy(true);message.textContent='Загружаем план…';
  try{const next=await request('roadmap');if(!alive())return;data=next;pending=null;message.textContent='';paint();}
  catch(e){if(alive()){message.textContent=fail(e);if(!data)report.replaceChildren(button('Повторить загрузку',load));}}
  finally{working=false;if(alive())onBusy(false);}
 }
 async function save(item,status,text){
  if(!can())return;
  if(status==='done'&&text.trim().length<3){message.textContent='Добавь краткий результат: что выполнено или чем проверено.';return;}
  const payload={action:'update',expected:data.current.revision,item:item.id,status,note:text.trim()};
  const key=JSON.stringify(payload);if(!pending||pending.key!==key)pending={key,body:{...payload,operation:crypto.randomUUID()}};
  working=true;onBusy(true);message.textContent='Сохраняем отметку…';
  try{const next=await request('roadmap',pending.body);if(!alive())return;data=next;pending=null;edit=null;onDirty(false);message.textContent='Сохранено на сервере.';paint();}
  catch(e){if(alive()){message.textContent=fail(e);const refresh=button('Обновить данные',()=>load());message.append(refresh);}}
  finally{working=false;if(alive())onBusy(false);}
 }
 function rows(groups){
  return groups.map(g=>{
   const card=el('details','bill-block roadmap-stage'),summary=el('summary','roadmap-summary'),status=groupState(g),p=progress([g]);
   const num=el('span','roadmap-number',g.number),head=el('div'),tag=el('span','roadmap-state',STATES[status]);tag.style.color=COLORS[status];
   head.append(el('h3','',g.title),el('span','bill-note',p.done+' / '+p.total+' выполнено'+(g.parallel?' · параллельно':'')));summary.append(num,head,tag);card.append(summary,bar(p.percent),note(g.description));
   for(const item of g.items){
    const row=el('div','roadmap-item'),line=el('div','bill-row'),label=el('span','',item.title),s=el('span','roadmap-state',STATES[item.status]);s.style.color=COLORS[item.status];line.append(label,s);row.append(line);
    if(item.note)row.append(note(item.note));
    if(edit?.id===item.id){
     const form=el('form','roadmap-edit'),select=el('select','owner-input'),input=el('textarea','owner-input');
     select.setAttribute('aria-label','Статус: '+item.title);for(const [v,t]of Object.entries(STATES)){const o=el('option','',t);o.value=v;select.append(o);}select.value=edit.status;
     input.setAttribute('aria-label','Результат или комментарий');input.placeholder='Что выполнено или что осталось';input.rows=3;input.maxLength=1500;input.value=edit.note;
     select.onchange=()=>{edit.status=select.value;pending=null;onDirty(true);};input.oninput=()=>{edit.note=input.value;pending=null;onDirty(true);};
     const submit=button('Сохранить',()=>{});submit.type='submit';const cancel=button('Отмена',()=>{if(!can())return;edit=null;pending=null;onDirty(false);paint();});form.onsubmit=e=>{e.preventDefault();void save(item,select.value,input.value);};form.append(select,input,submit,cancel);row.append(form);card.open=true;
    }else row.append(button('Изменить статус',()=>{if(!can())return;if(edit&&!confirm('Отбросить несохранённую правку?'))return;edit={id:item.id,status:item.status,note:item.note||''};onDirty(true);paint();}));
    card.append(row);
   }
   if(g.skills){const d=el('details','roadmap-skills');d.append(el('summary','','10 навыков M1'));const list=el('ol');g.skills.forEach(s=>list.append(el('li','',s)));d.append(list);card.append(d);}
   return card;
  });
 }
 function metrics(groups){
  const p=progress(groups),m=el('div','bill-metrics');
  [['Выполнено',p.percent+'%','#6fe7b7'],['Готовые пункты',p.done+' / '+p.total,'#69d8ff'],['В работе',p.active,'#ffcd79'],['Впереди',p.total-p.done-p.active,'#b99aff']].forEach(([label,value,color])=>{const cell=el('div','bill-metric');cell.style.setProperty('--metric-color',color);cell.append(el('span','bill-label',label),el('strong','bill-number',String(value)));m.append(cell);});return m;
 }
 function paint(){
  if(!data)return;const doc=data.current.document,view=viewState.view||'overview';report.replaceChildren(el('h2','','План развития'));
  nav.replaceChildren();for(const [id,name,glyph]of [['overview','Обзор','▥'],['product','Этапы','≡'],['psychology','Психология','◇'],['history','История','◷']]){
   const b=button('',()=>{if(!can())return;if(edit&&!confirm('Отбросить несохранённую правку?'))return;edit=null;pending=null;onDirty(false);viewState.view=id;paint();root.closest('.owner-content')?.scrollTo({top:0});});
   b.setAttribute('aria-label',name);b.setAttribute('aria-current',String(view===id));b.append(el('span','bill-nav-icon',glyph),el('span','',name));nav.append(b);
  }
  if(view==='overview'){
   report.append(metrics(doc.groups));
   const overview=el('section','bill-block');overview.append(el('h3','','Общий маршрут'),bar(progress(doc.groups).percent),note('Процент — доля завершённых подпунктов. Все подпункты имеют одинаковый вес; это не оценка времени, качества модели или бюджета.'));
   for(const [track,title]of [['product','Продукт · 22 этапа'],['psychology','Психология · M0–M8']]){const gs=doc.groups.filter(g=>g.track===track),p=progress(gs),r=el('div','roadmap-track');r.append(el('h3','',title),note(p.done+' из '+p.total+' пунктов · '+p.percent+'%'),bar(p.percent));overview.append(r);}
   const current=doc.groups.find(g=>g.id==='P4'&&groupState(g)!=='done')||doc.groups.find(g=>g.track==='product'&&!g.parallel&&groupState(g)!=='done');const learning=doc.groups.find(g=>g.track==='psychology'&&groupState(g)!=='done');const next=el('section','bill-block');next.append(el('h3','','Следующие шаги'),el('p','',current?'Этап '+current.number+' · '+current.title:'Все продуктовые этапы отмечены готовыми.'),note(learning?'Учебная линия — '+learning.number+': '+learning.title+'.':'Все учебные модули отмечены готовыми.'),note('Нативный голос и собственная модель — параллельные направления. Незавершённые подпункты ранних этапов остаются видимыми.'));
   const meta=el('details','bill-block');meta.append(el('summary','','Основания и правила отметок'),note('Исходная сверка: 27 сентября 2026. Готовность этапа считается по всем его подпунктам. Статусы меняются явно и сохраняются в истории; автоматического признания навыка освоенным нет.'));
   doc.sources.forEach(s=>meta.append(note(s)));meta.append(note('Версия отметок: '+data.current.revision+' · '+new Date(data.current.created_at).toLocaleString('ru-RU')),button('Обновить с сервера',load));report.append(overview,next,meta);
  }else if(view==='history'){
   report.append(note('Изменений: '+data.history_total+'. Показаны последние '+data.history.length+'. Первоначальные отметки основаны на отчётах приёмки.'));
   const items=doc.groups.flatMap(g=>g.items);
   report.append(pagedCollection(data.history.map(h=>{const r=el('div','bill-block');r.append(el('h3','',items.find(i=>i.id===h.item)?.title||h.item),note(STATES[h.status]+' · '+new Date(h.created_at).toLocaleString('ru-RU')),el('p','',h.note));return r;}),{label:'История плана',size:5}));
  }else{
   const groups=doc.groups.filter(g=>g.track===view);report.append(metrics(groups));
   const cards=rows(groups),collection=pagedCollection(cards,{label:view==='product'?'Этапы продукта':'Психологическая программа',size:5});report.append(collection);
   // Editing remains reachable after pagination/search: render the edited group separately.
   if(edit){const g=groups.find(g=>g.items.some(i=>i.id===edit.id));if(g){report.replaceChildren(el('h2','',g.number+' · '+g.title),...rows([g]));}}
  }
 }
 report.append(note('План загружается…'));
 // Parent mounts the panel before starting the request.
 queueMicrotask(()=>{if(alive())void load();});
 return root;
}


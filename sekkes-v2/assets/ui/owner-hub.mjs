import {el} from './components.mjs';
const names={instruction:'Инструкции',material:'Материалы',example:'Примеры',evaluation:'Проверки'};
const colors=['#69d8ff','#b99aff','#6fe7b7','#ffcf79'];
const button=(label,fn)=>{const b=el('button','owner-button',label);b.type='button';b.onclick=fn;return b;};
// Bound each collection independently; counts describe the loaded server snapshot.
export function pagedCollection(rows,{label='Записи',size=8}={}){
 const box=el('section','hub-collection'),list=el('div','hub-list'),footer=el('div','bill-footer'),search=el('input','owner-input'),status=el('p','bill-note');
 search.type='search';search.placeholder='Поиск по записям';search.setAttribute('aria-label','Поиск: '+label);
 const text=rows.map(n=>(n.textContent||'').toLocaleLowerCase('ru'));for(const row of rows)row.remove();
 let page=0;const pager=el('div','bill-pager'),counter=el('span');
 const previous=button('← Назад',()=>{page--;paint();}),next=button('Далее →',()=>{page++;paint();});pager.append(previous,counter,next);
 function paint(){const q=search.value.trim().toLocaleLowerCase('ru'),filtered=rows.filter((n,i)=>text[i].includes(q)),pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.max(0,Math.min(page,pages-1));
  for(const n of rows)if(n.tagName==='DETAILS')n.open=false;
  list.replaceChildren(...filtered.slice(page*size,(page+1)*size));if(!filtered.length)list.append(el('p','owner-note',q?'Совпадений нет. Измени поисковый запрос.':'Здесь пока нет записей.'));
  status.textContent=`Найдено ${filtered.length} · загружено ${rows.length} · по ${size} на странице`;counter.textContent=`${page+1} / ${pages}`;previous.disabled=page===0;next.disabled=page===pages-1;
 }
 list.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&e.target.open)for(const n of list.children)if(n!==e.target&&n.tagName==='DETAILS')n.open=false;},true);
 search.oninput=()=>{page=0;paint();};footer.append(search,status,pager);box.append(list,footer);paint();return box;
}
export function organizeHub(content,{kind,data,documents,viewState,available=()=>true}){
 const original=[...content.children],root=el('section','owner-hub owner-billing'),report=el('div','bill-report'),nav=el('nav','bill-nav');nav.setAttribute('aria-label','Разделы: '+names[kind]);
 const automatic=original.find(n=>n.classList.contains('owner-automatic'));
 const saved=original.find(n=>n.classList.contains('owner-check-entry'))||original.find(n=>n.classList.contains('owner-documents'));
 const journal=original.find(n=>n.classList.contains('owner-evaluation-journal'));
 const control=original.find(n=>n.classList.contains('owner-instruction-control'));
 const actions=original.filter(n=>n.tagName==='BUTTON'),newCheck=saved?.querySelector('button:last-child');
 if(kind==='evaluation'&&newCheck?.textContent==='Новая проверка'){actions.unshift(newCheck);newCheck.remove();}
 const groups=[{id:'overview',label:'Обзор',glyph:'▥'}];
 if(control)groups.push({id:'active',label:'Действует',glyph:'✓',node:control});
 const rows=automatic?[...automatic.children].filter(n=>n.tagName==='DETAILS'):[];
 groups.push({id:'records',label:kind==='material'?'Библиотека':kind==='example'?'Ответы':kind==='instruction'?'Настройки':'Испытания',glyph:'≡',node:pagedCollection(rows,{label:names[kind]})});
 const savedRows=saved?[...saved.children].filter(n=>n.tagName==='BUTTON'):[];
 groups.push({id:'saved',label:kind==='evaluation'?'Проверки':'Черновики',glyph:'▤',node:pagedCollection(savedRows,{label:'Сохранённые '+names[kind]})});
 if(journal){const details=[...journal.children].filter(n=>n.tagName==='DETAILS');groups.push({id:'runs',label:'Запуски',glyph:'◷',node:pagedCollection(details,{label:'Журнал проверок'})});}
 const tools=el('div','bill-footer');tools.append(...actions);groups.push({id:'actions',label:'Действия',glyph:'⋯',node:tools});
 // An instruction control may contain many saved versions; bound comparisons and rollback history too.
 if(control){const comparisons=[...control.children].filter(n=>n.tagName==='BUTTON');if(comparisons.length){const anchor=el('div');comparisons[0].before(anchor);anchor.replaceWith(pagedCollection(comparisons,{label:'Версии для сравнения',size:6}));}
 const history=[...control.children].find(n=>n.tagName==='DETAILS'&&n.firstChild?.textContent.includes('История'));if(history){const entries=[];for(const n of [...history.children].slice(1)){if(n.tagName==='P'){const row=el('div','hub-history');row.append(n);entries.push(row);}else if(entries.length)entries.at(-1).append(n);else entries.push(n);}history.append(pagedCollection(entries,{label:'История применения',size:5}));}}
 function overview(){const box=el('div','bill-report'),metrics=el('div','bill-metrics');
 const assessments=documents.filter(d=>d.kind==='evaluation').map(d=>{try{return JSON.parse(d.content)}catch{return {}}});
 const stats=kind==='evaluation'?[['Проверок',savedRows.length],['Ответ получен',(data.evaluations?.runs||[]).filter(r=>r.state==='completed').length],['Пройдено',assessments.filter(a=>a.verdict==='passed').length],['Нужна оценка',assessments.filter(a=>a.verdict==='pending').length]]:kind==='instruction'?[['Выпуск',data.instruction_control?.current?.revision??'—'],['Черновиков',savedRows.length],['Настроек',rows.length],['В истории',data.instruction_control?.history?.length??0]]:kind==='material'?[['В библиотеке',rows.length],['Файлов',data.media?.length??0],['Черновиков',savedRows.length],['Учебных материалов',(data.dashboard?.documents||[]).filter(d=>d.kind==='material').length]]:[['Ответов',rows.length],['Черновиков',savedRows.length],['Оценено',assessments.filter(a=>a.source?.type==='admin_turn'&&a.verdict!=='pending').length],['Из диалога',rows.length-(data.dashboard?.documents||[]).filter(d=>d.kind==='example').length]];
 stats.forEach(([label,value],i)=>{const m=el('div','bill-metric');m.style.setProperty('--metric-color',colors[i]);m.append(el('span','bill-label',label),el('strong','bill-number',String(value)));metrics.append(m);});box.append(metrics);
 const chart=el('section','bill-block');chart.append(el('h3','',kind==='evaluation'?'Результаты запусков':'Состав раздела'));
 const bars=kind==='evaluation'?[['Ответ получен',(data.evaluations?.runs||[]).filter(r=>r.state==='completed').length,'#6fe7b7'],['Ошибка',(data.evaluations?.runs||[]).filter(r=>r.state==='failed').length,'#ff8d9b'],['Не подтверждено',(data.evaluations?.runs||[]).filter(r=>!['completed','failed'].includes(r.state)).length,'#ffcf79']]:[[groups.find(g=>g.id==='records').label,rows.length,colors[0]],['Сохранённые документы',savedRows.length,colors[1]]];
 const max=Math.max(1,...bars.map(x=>x[1]));for(const [label,count,color]of bars){const item=el('div','bill-bar-item'),line=el('div','bill-row'),track=el('div','bill-track'),fill=el('div','bill-fill');line.append(el('span','',label),el('strong','',String(count)));fill.style.width=`${count/max*100}%`;fill.style.background=color;track.append(fill);item.append(line,track);chart.append(item);}box.append(chart);
 const note=el('div','bill-block');note.append(el('h3','',kind==='instruction'?'Что применяется сейчас':'Как читать показатели'));
 note.append(el('p','bill-note',kind==='instruction'?(data.instruction_control?.current?.revision?`Действует выпуск ${data.instruction_control.current.revision}. Сохранение черновика не меняет Мариуса.`:'Действует базовая инструкция. Черновики применяются отдельно после сравнения.'):kind==='evaluation'?'Ответ модели и оценка качества — разные показатели. Ошибка запуска не означает плохой ответ.':kind==='example'?'Ответы из диалога ещё не являются утверждёнными образцами. Открой ответ, чтобы выставить оценку.':'Библиотека объединяет учебные материалы и вложения. Наличие файла не означает, что он участвует в каждом ответе.'));
 note.append(el('p','bill-note','Показатели и поиск — по загруженным данным кабинета, не по всей истории аккаунта.'));
 if(data.evaluations?.total>(data.evaluations.runs||[]).length&&kind==='evaluation')note.append(el('p','bill-note',`Сервер сообщает ${data.evaluations.total} запусков; загружено ${data.evaluations.runs.length}.`));
 for(const n of original.filter(n=>n.tagName==='P').slice(1))note.append(n);box.append(note);return box;}
 function paint(){const selected=groups.find(g=>g.id===viewState.view)||groups[0];viewState.view=selected.id;report.replaceChildren(el('h2','',selected.id==='overview'?names[kind]:selected.label),selected.id==='overview'?overview():selected.node);nav.replaceChildren();for(const g of groups){const b=button('',()=>{if(!available())return;viewState.view=g.id;paint();content.scrollTop=0;});b.setAttribute('aria-label',g.label);b.setAttribute('aria-current',String(g.id===selected.id));b.append(el('span','bill-nav-icon',g.glyph),el('span','',g.label));nav.append(b);}nav.style.gridTemplateColumns=`repeat(${groups.length},minmax(0,1fr))`;}
 root.append(report,nav);content.replaceChildren(root);paint();return root;
}

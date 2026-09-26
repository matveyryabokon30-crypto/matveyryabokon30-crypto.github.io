import {el} from './components.mjs';
import {pagedCollection} from './owner-hub.mjs';
export function knowledgePanel({state,documents=[],onApply,onDirty=()=>{},available=()=>true}){
 const panel=el('div','owner-knowledge-control'),note=s=>el('p','owner-note',s);
 if(!state?.current){panel.append(note('Подключение материалов временно недоступно. Обнови данные.'));return panel;}
 const active=state.current,selected=new Map(),key=i=>i.source+':'+i.id;
 for(const i of active.items||[])selected.set(key(i),{...i});
 const button=(name,fn)=>{const b=el('button','owner-button',name);b.type='button';b.onclick=fn;return b;};
 panel.append(el('h2','owner-heading','Материалы и навыки Мариуса'),note('Явное подключение для всех пользователей. Материал даёт справочные сведения; навык задаёт способ помощи. Это настройка контекста, не обучение весов модели. Не подключай личные данные из переписки.'));
 panel.append(note('Выпуск '+active.revision+' · '+(active.enabled?'включён':'выключен')));
 const current=el('details');current.append(el('summary','','Что подключено сейчас'),note((active.items||[]).map(i=>i.title+' · v'+i.version+' · '+(i.mode==='skill'?'навык':'материал')).join('\n')||'Ничего'),note('Текст: '+(active.enabled&&active.text_enabled?'включён':'выключен')+' · Живой голос: '+(active.enabled&&active.voice_enabled?'включён':'выключен')));panel.append(current);
 function check(label,value){const row=el('label','owner-note'),input=el('input');input.type='checkbox';input.checked=value;row.append(input,document.createTextNode(' '+label));return {row,input};}
 const text=check('Текст и голосовые сообщения',active.text_enabled),voice=check('Живой голос',active.voice_enabled);
 let operation=crypto.randomUUID(),pending=false;
 const changed=()=>{operation=crypto.randomUUID();onDirty();update();};
 text.input.onchange=changed;voice.input.onchange=changed;
 panel.append(text.row,voice.row,note('Изменения действуют со следующего запроса и нового голосового подключения. Уже открытый голосовой разговор нужно завершить.'));
 const choices=new Map();
 for(const d of documents.filter(d=>d.kind==='material').sort((a,b)=>a.revision-b.revision)){const i={source:'document',id:d.id,version:String(d.revision),title:d.title,content:d.content};choices.set(key(i),i);}
 for(const i of state.catalog||[])choices.set(key(i),i);
 for(const i of active.items||[])if(!choices.has(key(i)))choices.set(key(i),i);
 const rows=[];
 for(const [id,item]of choices){
  const row=el('section','bill-block'),checked=check(item.title,selected.has(id)),version=el('select','owner-input'),mode=el('select','owner-input');
  const versions=item.source==='document'?documents.filter(d=>d.kind==='material'&&d.id===item.id).map(d=>({...item,version:String(d.revision),content:d.content,title:d.title})):[item];
  const saved=selected.get(id);if(saved&&!versions.some(v=>v.version===saved.version))versions.push(saved);
  for(const v of versions){const o=el('option','',v.title+' · v'+v.version);o.value=v.version;version.append(o);}
  version.value=saved?.version||item.version;version.setAttribute('aria-label','Версия: '+item.title);
  for(const [value,label]of [['reference','Справочный материал'],['skill','Навык — способ помощи']]){const o=el('option','',label);o.value=value;mode.append(o);}
  mode.value=saved?.mode||'reference';mode.setAttribute('aria-label','Применение: '+item.title);
  const preview=el('details'),body=el('p','owner-auto-text');preview.append(el('summary','','Прочитать содержимое'),body);
  const sync=()=>{const v=versions.find(v=>v.version===version.value);body.textContent=v?.content||'';if(checked.input.checked)selected.set(id,{...v,mode:mode.value});else selected.delete(id);};
  for(const input of [checked.input,version,mode])input.onchange=()=>{if(!available())return;sync();changed();};
  sync();row.append(checked.row,version,mode,preview);rows.push(row);
 }
 panel.append(pagedCollection(rows,{label:'Материалы и навыки для подключения',size:5}));
 const count=note(''),status=note('');status.setAttribute('role','status');
 async function send(payload,op=operation){if(pending||!available())return;pending=true;update();status.textContent='Сохраняем…';try{await onApply({...payload,expected:active.revision,operation:op});}catch(e){status.textContent=e.message||'Не удалось сохранить. Обнови данные.';}finally{pending=false;update();}}
 const apply=button('Применить выбранное',()=>send({action:'apply',text_enabled:text.input.checked,voice_enabled:voice.input.checked,items:[...selected.values()].map(({source,id,version,mode})=>({source,id,version,mode}))}));
 const disableOperation=crypto.randomUUID(),disable=button('Отключить всё',()=>send({action:'disable'},disableOperation));
 function update(){const chars=[...selected.values()].reduce((n,i)=>n+i.content.length,0);count.textContent='Выбрано '+selected.size+' из 8 · '+chars+' из 12000 символов';apply.disabled=pending||selected.size<1||selected.size>8||chars>12000||(!text.input.checked&&!voice.input.checked);disable.disabled=pending||!active.enabled;}
 panel.append(count,apply,disable,status);
 const history=el('details');history.append(el('summary','','История подключений и откат'));
 const entries=[];
 for(const h of state.history||[]){const row=el('div','bill-block');row.append(note('Выпуск '+h.revision+' · '+(h.enabled?'включён':'выключен')+' · '+h.items.map(i=>i.title+' v'+i.version).join(', ')));if(h.revision<active.revision){const op=crypto.randomUUID();row.append(button('Вернуть подключение '+h.revision,()=>send({action:'rollback',target:h.revision},op)));}entries.push(row);}
 history.append(pagedCollection(entries,{label:'История подключений',size:5}));panel.append(history);update();return panel;
}

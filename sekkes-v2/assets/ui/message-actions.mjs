import {el} from './components.mjs';
import {copyText} from './clipboard.mjs';
export function messageKey(scope,id,text){
 if(id)return scope+':'+id;
 let hash=2166136261;for(const c of String(text)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619)}return scope+':text:'+ (hash>>>0).toString(36);
}
export function deliveryMark(state='sent'){
 const mark=el('span','delivery-mark',state==='pending'?'◷':state==='failed'?'!':'✓');
 mark.setAttribute('aria-label',state==='pending'?'Отправляется':state==='failed'?'Не доставлено':'Доставлено');mark.title=mark.getAttribute('aria-label');return mark;
}
// Delegated gestures: no timers, canvases or permanent action buttons per message.
export function messageActions({doc=document,signal,account,notify,compose,currentScope,ownerAllowed}){
 const entries=new WeakMap(),selected=new Set();let user='',saved={hidden:[],pins:{},reactions:{}},timer=0,start=null,menu=null,suppressClick=0;
 const toolbar=el('div','message-selection');toolbar.hidden=true;toolbar.setAttribute('aria-label','Выбранные сообщения');doc.body.append(toolbar);
 const pinned=el('button','pinned-messages');pinned.type='button';pinned.hidden=true;pinned.setAttribute('aria-label','Закреплённые сообщения');doc.body.append(pinned);
 const storageKey=()=> 'sekkes:message-actions:v1:'+user;
 function load(){const next=account()?.id||'guest';if(user===next)return;user=next;selected.clear();try{const value=JSON.parse(localStorage.getItem(storageKey())||'{}');saved={hidden:Array.isArray(value.hidden)?value.hidden:[],pins:value.pins||{},reactions:value.reactions||{}}}catch{saved={hidden:[],pins:{},reactions:{}}}}
 function save(){try{localStorage.setItem(storageKey(),JSON.stringify(saved))}catch{notify('Не удалось сохранить изменение на устройстве.')}}
 function close(){menu?.remove();menu=null;}
 function refreshPins(){load();const scope=currentScope();const count=Object.values(saved.pins).filter(x=>x.scope===scope).length;pinned.hidden=!scope||!count;pinned.textContent='⌖ '+count+' · Закреплённые';}
 function apply(node){const entry=entries.get(node);if(!entry)return;node.hidden=saved.hidden.includes(entry.key);node.classList.toggle('message-selected',selected.has(node));node.classList.toggle('message-pinned',Boolean(saved.pins[entry.key]));let reaction=node.querySelector(':scope > .message-reaction');if(saved.reactions[entry.key]){if(!reaction){reaction=el('span','message-reaction');node.append(reaction)}reaction.textContent=saved.reactions[entry.key]}else reaction?.remove();}
 function bind(node,{scope,id,text}){load();const entry={scope,key:messageKey(scope,id,text),text:String(text)};entries.set(node,entry);node.dataset.actionMessage='true';node.setAttribute('tabindex','0');node.setAttribute('aria-label','Сообщение. Удерживайте для действий');apply(node);refreshPins();return node;}
 function button(label,fn){const b=el('button','message-action',label);b.type='button';b.addEventListener('click',fn);return b;}
 function panel(label){close();const overlay=el('div','message-menu-overlay'),box=el('div','message-menu');box.setAttribute('role','dialog');box.setAttribute('aria-label',label);box.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const buttons=[...box.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first?.focus()}});const heading=el('p','message-menu-title',label);box.append(heading);overlay.append(box);overlay.addEventListener('click',e=>{if(e.target===overlay)close()});doc.body.append(overlay);menu=overlay;return box;}
 function focusPanel(box){box.querySelector('button')?.focus({preventScroll:true})}
 async function copy(nodes){const text=nodes.map(n=>entries.get(n)?.text||'').join('\n\n');try{await copyText(text);notify('Скопировано');close()}catch{notify('Копирование недоступно. Выберите «Выделить текст».')}}
 function clearSelection(){for(const n of selected)n.classList.remove('message-selected');selected.clear();toolbar.hidden=true;}
 function remove(nodes){const box=panel('Удалить у меня?');box.append(el('p','message-menu-note','Сообщения будут скрыты на этом устройстве. Серверная история сохранится.'));box.append(button('Удалить у меня',()=>{const keys=nodes.map(n=>entries.get(n)?.key).filter(Boolean);saved.hidden=[...new Set([...saved.hidden,...keys])];for(const key of keys)delete saved.pins[key];save();nodes.forEach(apply);clearSelection();refreshPins();close();notify('Удалено у меня.');const undo=panel('Сообщения удалены');undo.append(button('Отменить удаление',()=>{saved.hidden=saved.hidden.filter(k=>!keys.includes(k));save();nodes.forEach(apply);close()}),button('Готово',close));focusPanel(undo)}),button('Отмена',close));focusPanel(box);}
 function forward(nodes){const text=nodes.map(n=>entries.get(n)?.text||'').join('\n\n'),box=panel('Переслать');for(const [scope,label]of [['home','В чат пользователя'],['admin','В админ-чат']]){if(scope==='admin'&&!ownerAllowed())continue;box.append(button(label,()=>{close();clearSelection();compose(scope,'Пересланное сообщение:\n'+text+'\n\n')}))}if(navigator.share)box.append(button('В другое приложение',async()=>{try{await navigator.share({text});close()}catch(e){if(e.name!=='AbortError')notify('Не удалось открыть пересылку.')}}));box.append(button('Отмена',close));focusPanel(box);}
 function paintSelection(){toolbar.replaceChildren(el('span','',String(selected.size)));toolbar.append(button('Копировать',()=>copy([...selected])),button('Переслать',()=>forward([...selected])),button('Удалить',()=>remove([...selected])),button('Отмена',clearSelection));toolbar.hidden=!selected.size;}
 function toggle(node){if(selected.has(node))selected.delete(node);else selected.add(node);apply(node);paintSelection();}
 function open(node){load();const entry=entries.get(node);if(!entry)return;const box=panel('Действия с сообщением');const reactions=el('div','message-reactions');for(const emoji of ['❤️','👍','🔥','😁','🙏']){const b=button(emoji,()=>{saved.reactions[entry.key]=saved.reactions[entry.key]===emoji?'':emoji;save();apply(node);close()});b.setAttribute('aria-label','Реакция '+emoji);reactions.append(b)}box.append(reactions);
  box.append(button('Ответить',()=>{close();compose(entry.scope,entry.text.split('\n').map(line=>'> '+line).join('\n')+'\n\n')}),button('Копировать',()=>copy([node])),button(saved.pins[entry.key]?'Открепить':'Закрепить',()=>{if(saved.pins[entry.key])delete saved.pins[entry.key];else saved.pins[entry.key]={scope:entry.scope,text:entry.text.slice(0,300)};save();apply(node);refreshPins();close()}),button('Переслать',()=>forward([node])),button('Удалить',()=>remove([node])),button('Выбрать',()=>{close();toggle(node)}),button('Выделить текст',()=>{close();node.classList.add('message-text-selectable');const range=doc.createRange();range.selectNodeContents(node.querySelector('.rich-message')||node);const selection=doc.getSelection();selection.removeAllRanges();selection.addRange(range)}),button('Отмена',close));focusPanel(box);
 }
 const find=e=>e.target.closest?.('[data-action-message]');
 function cancel(){clearTimeout(timer);timer=0;start=null;}
 doc.addEventListener('pointerdown',e=>{cancel();const node=find(e);if(!node||e.button!==0||e.target.closest('a,button,audio,video,input,textarea,summary'))return;start={x:e.clientX,y:e.clientY,node};timer=setTimeout(()=>{timer=0;suppressClick=Date.now()+800;open(node)},500)},{passive:true,signal});
 doc.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)cancel()},{passive:true,signal});
 for(const name of ['pointerup','pointercancel'])doc.addEventListener(name,cancel,{passive:true,signal});
 doc.addEventListener('scroll',cancel,{capture:true,passive:true,signal});
 doc.addEventListener('contextmenu',e=>{const node=find(e);if(!node||e.target.closest('a,button,audio,video,summary'))return;e.preventDefault();cancel();open(node)},{signal});
 doc.addEventListener('click',e=>{const node=find(e);if(!node)return;if(suppressClick>Date.now()){suppressClick=0;e.preventDefault();return}if(selected.size&&!e.target.closest('a,button')){e.preventDefault();toggle(node)}},{signal});
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'){close();clearSelection();return}const node=find(e);if(node&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'||e.key==='Enter'&&e.target===node)){e.preventDefault();open(node)}},{signal});
 pinned.addEventListener('click',()=>{const box=panel('Закреплённые сообщения');for(const [key,pin]of Object.entries(saved.pins)){if(pin.scope!==currentScope())continue;box.append(button(pin.text.slice(0,90),()=>{close();const node=[...doc.querySelectorAll('[data-action-message]')].find(n=>entries.get(n)?.key===key);if(node)node.scrollIntoView({block:'center',behavior:'smooth'});else notify('Сообщение находится в более ранней истории.')}))}box.append(button('Закрыть',close));focusPanel(box)});
 function reset(){cancel();close();clearSelection();refreshPins()}
 doc.addEventListener('sekkes-orientation-reset',reset,{signal});addEventListener('hashchange',reset,{signal});signal.addEventListener('abort',()=>{cancel();close();toolbar.remove();pinned.remove()},{once:true});
 return {bind,refresh:reset};
}

/* Shared R2 composer chrome. Domain adapters own drafts, persistence and delivery. */
(function(global){'use strict';
let serial=0;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
function create(o){
 const {root,body,input,attach,voice,send,expand}=o,icons=global.PablicusIcons;
 o.ai=o.ai||global.PablicusAI?.edit;o.agents=o.agents||(()=>global.PablicusAI.catalog().then(r=>r.agents));o.runAgent=o.runAgent||global.PablicusAI?.run;
 const id='composer-r2-'+(++serial),life=new AbortController();let destroyed=false,opened=null,trigger=null,entry=null,panelEpoch=0,controller=null,context=[],draftId=crypto.randomUUID(),full=false,disabled=false,popoverShown=false,undoPatch=null,historyGuard=false,historyPending=false,panelHome='add',contextScroll=0;
 root.classList.add('r2Composer');root.dataset.composerVersion='R2';body.classList.add('r2ComposerBody');
 const toolbar=el('div','r2Toolbar'),header=el('div','r2ComposerHeader'),title=el('span','r2ComposerTitle',o.title||'Черновик');
 const ai=icons.button('ai','Помощь ИИ',()=>open('ai',ai),{text:'ИИ',chevron:true});ai.classList.add('r2AI');
 const rail=el('div','r2FunctionRail');rail.setAttribute('role','group');rail.setAttribute('aria-label','Функции сообщения');
 function pill(kind,label,icon){const b=el('button','r2FunctionPill');b.type='button';b.dataset.r2Function=kind;b.setAttribute('aria-label',label);b.setAttribute('aria-haspopup','dialog');const frame=el('span','r2PillFrame');frame.append(icons.icon(icon),el('span','',label));b.append(frame);b.onclick=()=>open(kind,b);return b;}
 const agent=pill('agent','Агент','agent'),services=pill('services','Возможности','capabilities'),ctx=pill('context','Контекст','context');rail.append(agent,services,ctx);
 icons.decorate(attach,'add','Добавить');if(voice)icons.decorate(voice,'microphone','Записать голосовое сообщение');if(send)icons.decorate(send,'send',o.sendLabel||'Отправить сообщение');
 if(expand)icons.decorate(expand,'expand','Редактор на весь экран');header.append(title);
 const actions=el('div','r2ActionGroup'),accent=el('span','r2ActionAccent'),actionButtons=[expand,voice,send].filter(Boolean);
 actions.setAttribute('role','group');actions.setAttribute('aria-label','Действия сообщения');accent.setAttribute('aria-hidden','true');actions.append(accent);
 for(const b of actionButtons){b.classList.add('r2GroupedAction');b.dataset.r2Action=b===expand?'expand':b===voice?'voice':'send';actions.append(b);}
 root.dataset.r2ActionCount=String(actionButtons.length);
 toolbar.append(attach,ai,el('span','r2ToolbarSpace'),actions);
 let selectedAction=actionButtons.length-1,actionDrag=null,suppressActionClick=false;
 function selectAction(index){selectedAction=Math.max(0,Math.min(actionButtons.length-1,index));for(const [i,b]of actionButtons.entries())b.dataset.actionActive=String(i===selectedAction);actions.dataset.selected=actionButtons[selectedAction]?.dataset.r2Action||'';accent.style.transform='translateX('+(selectedAction*44)+'px)';}
 function cancelActionDrag(){if(!actionDrag)return;const previous=actionDrag.previous;actionDrag=null;actions.removeAttribute('data-dragging');selectAction(previous);}
 on(actions,'pointerdown',e=>{if(!e.isPrimary){cancelActionDrag();return;}if(e.button!==0)return;suppressActionClick=false;actionDrag={id:e.pointerId,x:e.clientX,y:e.clientY,previous:selectedAction,moved:false};});
 on(actions,'pointermove',e=>{const d=actionDrag;if(!d||d.id!==e.pointerId)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;if(!d.moved){d.moved=true;actions.setPointerCapture(e.pointerId);actions.dataset.dragging='true';}e.preventDefault();const r=actions.getBoundingClientRect(),offset=Math.max(0,Math.min((actionButtons.length-1)*44,e.clientX-r.left-22));selectAction(Math.round(offset/44));accent.style.transform='translateX('+offset+'px)';});
 on(actions,'pointerup',e=>{const d=actionDrag;if(!d||d.id!==e.pointerId)return;actionDrag=null;actions.removeAttribute('data-dragging');if(d.moved){suppressActionClick=true;e.preventDefault();selectAction(selectedAction);}},{capture:true});
 on(actions,'pointercancel',cancelActionDrag);on(actions,'lostpointercapture',cancelActionDrag);
 on(actions,'click',e=>{if(suppressActionClick&&e.detail!==0){suppressActionClick=false;e.preventDefault();e.stopImmediatePropagation();return;}const index=actionButtons.indexOf(e.target.closest('button'));if(index>=0)selectAction(index);},{capture:true});
 on(actions,'focusin',e=>{if(actionDrag)return;const index=actionButtons.indexOf(e.target);if(index>=0)selectAction(index);});
 selectAction(selectedAction);
 root.prepend(rail,header);root.append(toolbar);
 const panel=el('section','r2Panel');panel.id=id;panel.tabIndex=-1;panel.hidden=true;panel.setAttribute('popover','manual');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Функции сообщения');
 const heading=el('div','r2PanelHead'),back=icons.button('back','Назад',()=>backPanel()),name=el('h2'),closeButton=icons.button('close','Закрыть панель',()=>close());const searchButton=icons.button('search','Поиск в доступных источниках',()=>{filterField.hidden=!filterField.hidden;searchButton.setAttribute('aria-expanded',String(!filterField.hidden));if(!filterField.hidden)filterField.focus({preventScroll:true});else{filterField.value='';filterField.oninput();searchButton.focus({preventScroll:true});}position();});searchButton.hidden=true;searchButton.setAttribute('aria-expanded','false');heading.append(back,name,searchButton,closeButton);
 const contents=el('div','r2PanelBody'),notice=el('p','r2PanelStatus');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');const filterField=el('input','r2SourceSearch');filterField.type='search';filterField.placeholder='Найти в списке';filterField.setAttribute('aria-label','Поиск в доступных источниках');filterField.hidden=true;filterField.oninput=()=>{for(const row of contents.querySelectorAll('.r2MenuRow'))row.hidden=!row.textContent.toLocaleLowerCase().includes(filterField.value.toLocaleLowerCase());position();};panel.append(heading,filterField,contents,notice);document.body.append(panel);
 const snapshot=()=>o.capture?.()||{text:input.value,selection:{start:input.selectionStart,end:input.selectionEnd},files:[]};
 const signature=()=>{const s=snapshot();return JSON.stringify([s.text,s.blocks,s.files?.map(f=>[f.id,f.name,f.size]),s.recording,context]);};
 const scope=()=>JSON.stringify(o.getScope?.()||{});
 function remember(){const active=body.contains(document.activeElement)?document.activeElement:body.querySelector('textarea[data-rich-block="'+(snapshot().selection?.blockId||'')+'"]')||input;return {signature:signature(),scope:scope(),draft:snapshot(),target:active,start:active.selectionStart||0,end:active.selectionEnd||0,scroll:active.scrollTop,bodyScroll:body.scrollTop};}
 function restore(focus=false){if(!entry||entry.scope!==scope())return;const n=entry.target;if(n?.isConnected){if(focus)n.focus({preventScroll:true});n.setSelectionRange?.(entry.start,entry.end);n.scrollTop=entry.scroll;}body.scrollTop=entry.bodyScroll;}
 function on(target,event,fn,options={}){target.addEventListener(event,fn,{...options,signal:life.signal});}
 // Keep two-finger page zoom/pan out of the composer, including a second
 // finger landing outside it. Single-finger editing and scrolling stay native.
 function ownsTouch(target){return target instanceof Node&&(root.contains(target)||panel.contains(target));}
 function blockMultiTouch(e){if(e.touches.length>1&&Array.from(e.touches).some(t=>ownsTouch(t.target))&&e.cancelable)e.preventDefault();}
 for(const event of ['touchstart','touchmove'])on(document,event,blockMultiTouch,{capture:true,passive:false});
 // Safari also exposes pinch/rotation through its native GestureEvent path.
 for(const surface of [root,panel])for(const event of ['gesturestart','gesturechange'])on(surface,event,e=>{if(e.cancelable)e.preventDefault();},{capture:true,passive:false});
 function status(text){notice.textContent=text||'';notice.hidden=!text;}
 function row(label,icon,action,{selected=false,reason,description,badge}={}){const b=el('button','r2MenuRow');b.type='button';b.setAttribute('aria-label',reason?label+'. '+reason:label);const copy=el('span','r2MenuLabel');copy.append(el('span','r2RowTitle',label));if(description)copy.append(el('small','r2RowDescription',description));b.append(icons.icon(icon),copy);if(badge)b.append(el('span','r2RowBadge',badge));if(selected){b.setAttribute('aria-pressed','true');b.append(icons.icon('check'));}if(reason){b.disabled=true;copy.append(el('small','r2RowDescription',reason));}b.onclick=action;contents.append(b);return b;}
 function intro(icon,title,description){const box=el('div','r2CardIntro'),copy=el('div');box.append(icons.icon(icon));copy.append(el('strong','',title),el('p','',description));box.append(copy);contents.append(box);}
 function button(label,action,primary=false){const b=el('button','r2Action',label);b.type='button';if(primary)b.dataset.primary='true';b.onclick=action;return b;}
 function position(){if(!opened)return;const vv=global.visualViewport,w=vv?.width||innerWidth,h=vv?.height||innerHeight,left=vv?.offsetLeft||0,top=vv?.offsetTop||0,b=root.getBoundingClientRect(),a=trigger?.getBoundingClientRect()||b,fontScale=Math.max(1,parseFloat(getComputedStyle(document.documentElement).fontSize)/16);panel.style.width='max-content';panel.style.maxWidth=Math.min(304*fontScale,w-24)+'px';panel.style.minWidth=Math.min(208*fontScale,w-24)+'px';const above=b.top-top-8,cap=Math.max(160,Math.min(360,h-24,above>=200?above:h-24));panel.style.maxHeight=cap+'px';const box=panel.getBoundingClientRect(),ph=box.height;panel.style.left=Math.min(Math.max(left+12,a.left),left+w-box.width-12)+'px';panel.style.top=Math.max(top+12,Math.min(b.top-ph-8,top+h-ph-12))+'px';}
 function mark(){for(const b of [attach,ai,ctx,agent,services]){b.setAttribute('aria-expanded',String(b===trigger&&!!opened));b.setAttribute('aria-controls',id);}let count=ctx.querySelector('.r2PillCount');if(context.length){if(!count){count=el('span','r2PillCount');ctx.querySelector('.r2PillFrame').append(count);}count.textContent=context.length;ctx.title='Выбрано источников: '+context.length;}else{count?.remove();ctx.removeAttribute('title');}}
 function syncHistory(){
  if(destroyed||historyPending)return;
  const wanted=!!opened||full,owned=history.state?.pablicusComposerGuard===id;
  if(wanted&&!owned){history.pushState({...history.state,pablicusComposerGuard:id},'',location.href);historyGuard=true;}
  else if(!wanted&&owned){historyPending=true;history.back();}
 }
 function handleBack(){if(opened){close();return true;}if(full&&o.collapseFull){o.collapseFull();return true;}return false;}
 function close(focus=true,fromHistory=false){if(!opened)return;opened=null;panelEpoch++;controller?.abort();controller=null;panel.hidden=true;if(popoverShown){panel.hidePopover();popoverShown=false;}mark();restore(false);sync({expanded:full,busy:disabled});if(!fromHistory)syncHistory();if(focus&&trigger?.isConnected)trigger.focus({preventScroll:true});o.onGeometry?.();}
 function backPanel(){open(panelHome,trigger,true);}
 async function hostAction(kind,payload){try{if(!o.action)throw Error('Это действие не подключено в данном редакторе. Черновик сохранён.');await o.action(kind,payload);close(false);}catch(e){status(e.message||'Не удалось выполнить действие.');}}
 function open(kind,origin=attach,nested=false){if(destroyed||disabled)return;if(opened===kind&&!nested){close();return;}if(!opened){entry=remember();trigger=origin;}if(!nested)panelHome=kind;
 controller?.abort();controller=null;heading.querySelector('[data-agent-settings]')?.remove();const ticket=++panelEpoch;opened=kind;trigger=origin;searchButton.hidden=!['context','agent','services'].includes(kind);filterField.hidden=true;filterField.value='';searchButton.setAttribute('aria-expanded','false');contents.replaceChildren();contents.scrollTop=0;status('');back.hidden=kind===panelHome;panel.dataset.section=panelHome;delete panel.dataset.keyboardFocus;panel.setAttribute('aria-label',({agent:'Агент',services:'Возможности',context:'Контекст'})[panelHome]||'Функции сообщения');name.textContent=({add:'Добавить',context:'Контекст',ai:'Помощь ИИ',agent:'Агент',object:'Новый объект',services:'Возможности',request:'Свой запрос',result:'Предложение ИИ'})[kind]||kind;
 if(kind==='add'){
  row('Фото и видео','photo',()=>{restore();o.pick?.('image/*,video/*');close(false);},{reason:o.mediaUnavailable});
  row('Файл','attachment',()=>{restore();o.pick?.('');close(false);},{reason:o.mediaUnavailable});
  row('Новый объект','canvas',()=>open('object',attach,true));
 }else if(kind==='object'){
  row('Дело','tasks',()=>hostAction('task'));row('Проект','canvas',()=>hostAction('project'));row('Открыть полотно','canvas',()=>hostAction('canvas'));
 }else if(kind==='services'){
  showCapabilities();
 }else if(kind==='context'){
  intro('context','Источники для агента','Выберите источники. Передача — после подтверждения.');status('Загружаем доступные источники…');Promise.resolve(o.sources?.()||[]).then(items=>{if(ticket!==panelEpoch)return;status(items.length?'':'Нет доступных источников.');for(const item of items){row(item.label,item.icon||'context',()=>{const scroll=contents.scrollTop;context=context.some(v=>v.id===item.id)?context.filter(v=>v.id!==item.id):[...context,{id:item.id,revision:item.revision,kind:item.kind,label:item.label}];o.onContext?.(context);open('context',origin,true);contextScroll=scroll;},{selected:context.some(v=>v.id===item.id&&v.revision===item.revision),reason:item.reason});}row('Пространство','spaces',()=>{},{reason:'Пространства ещё не подключены'});row('Канал','channel',()=>{},{reason:'Каналы ещё не подключены'});position();contents.scrollTop=contextScroll;contextScroll=0;}).catch(e=>{if(ticket===panelEpoch)status(e.message);});
 }else if(kind==='ai'){
  for(const [label,key,ic]of [['Исправить текст','correct','compose'],['Сократить','shorten','compose'],['Перевести','translate','chats'],['Свой запрос','custom','ai']])row(label,ic,()=>key==='custom'||key==='translate'?request(key):runAI(key));
 }else if(kind==='agent'){
  intro('agent','Помощник для вашей задачи','Выберите агента для задачи.');status('Загружаем доступных агентов…');Promise.resolve(o.agents?.()||[]).then(items=>{if(ticket!==panelEpoch)return;status(items.length?'':'Сервис агентов пока не подключён. Черновик сохранён.');for(const a of items)row(a.name,'agent',()=>agentDetail(a),{reason:a.reason,description:a.description||'Задача, выбранные источники и параметры запуска'});row('Последние результаты','saved',()=>showHistory());position();}).catch(e=>{if(ticket===panelEpoch)status(e.message);});
 }
 const panelOwner=root.closest('dialog')||document.body;if(panel.parentElement!==panelOwner)panelOwner.append(panel);
 panel.hidden=false;if(panel.showPopover&&!popoverShown){panel.showPopover();popoverShown=true;}if(innerWidth<600)entry?.target?.blur();mark();sync({expanded:full,busy:disabled});syncHistory();position();requestAnimationFrame(()=>{if(!destroyed&&ticket===panelEpoch){position();panel.focus({preventScroll:true});}});o.onGeometry?.();
 }
 function request(kind){open('request',ai,true);const label=el('label','r2RequestLabel',kind==='translate'?'На какой язык перевести?':'Что сделать с текстом?'),field=el('textarea');field.rows=2;field.setAttribute('aria-label',label.textContent);label.append(field);contents.append(label,button('Продолжить',()=>{if(field.value.trim())runAI(kind,field.value.trim());},true));field.focus({preventScroll:true});position();}
 async function runAI(operation,instruction='',requestId=crypto.randomUUID()){
  const base=entry;if(!base||base.scope!==scope())return;const original=base.target.value,start=base.start,end=base.end>base.start?base.end:original.length,from=base.end>base.start?start:0,text=original.slice(from,end);
  if(!text.trim()){status('Введите или выделите текст для ИИ.');return;}if(!o.ai){status('Сервис ИИ пока не подключён. Исходный текст сохранён.');return;}
  const ticket=++panelEpoch;controller=new AbortController();contents.replaceChildren(el('p','','Обрабатываем только выбранный текст…'));status('');position();
  try{const result=await o.ai({id:requestId,operation,instruction,text,signal:controller.signal});if(ticket!==panelEpoch||base.scope!==scope())return;name.textContent='Предложение ИИ';opened='result';contents.replaceChildren();const resultText=String(result.text||'');if(!resultText)throw Error('ИИ вернул пустой результат.');
   for(const [label,value]of [['ОРИГИНАЛ',text],['ПРЕДЛОЖЕНИЕ',resultText]]){const box=el('section','r2Comparison');box.append(el('small','',label),el('p','',value));contents.append(box);}
   const pair=el('div','r2ActionPair');pair.append(button('Применить',()=>{if(base.scope!==scope()||base.target.value!==original||signature()!==base.signature){status('Черновик изменился. Закройте предложение и выполните запрос для актуального текста.');return;}base.target.focus({preventScroll:true});base.target.setSelectionRange(from,end);if(!document.execCommand('insertText',false,resultText)){base.target.setRangeText(resultText,from,end,'end');undoPatch={target:base.target,before:original,after:base.target.value,start:from,end,scope:scope()};base.target.dispatchEvent(new Event('input',{bubbles:true}));}entry=null;close(false);o.onChange?.();},true),button('Отмена',()=>close()));contents.append(pair);position();
  }catch(e){if(ticket===panelEpoch&&e.name!=='AbortError'){contents.replaceChildren(button('Повторить',()=>runAI(operation,instruction,requestId)));status(e.message||'ИИ недоступен. Текст сохранён.');}}
 }
 async function showCapabilities(){
  intro('capabilities','Инструменты под вашу задачу','Ваши инструменты и каталог.');
  row('Боты','bot',()=>hostAction('bots'),{description:'Открыть переписку с ботами'});row('Фабрика','factory',()=>hostAction('factory'),{description:'Создание и настройка ботов'});
  contents.append(el('h3','r2SectionLabel','Каталог возможностей'));status('Загружаем каталог…');const ticket=panelEpoch;
  try{const catalog=await global.PablicusAI.catalog();if(ticket!==panelEpoch)return;status(catalog.capabilities.length?'':'В каталоге пока нет возможностей.');for(const item of catalog.capabilities)row(item.name,'capabilities',()=>{
   back.hidden=false;searchButton.hidden=true;filterField.hidden=true;name.textContent=item.name;contents.replaceChildren();contents.scrollTop=0;intro('capabilities',item.name,item.description);contents.append(el('p','','Доступ: только задача и выбранные источники. Запись — после отдельного разрешения.'));
   const install=button(item.installed?'Удалить возможность':'Установить',async()=>{install.disabled=true;try{await global.PablicusAI.install(item.id,!item.installed);if(ticket===panelEpoch)open('services',services,true);}catch(e){if(ticket===panelEpoch){status(e.message);install.disabled=false;}}},true);contents.append(install);position();
  },{selected:item.installed,description:item.description,badge:item.installed?'Установлено':null});position();}catch(e){if(ticket===panelEpoch)status(e.message);}
 }
 async function showHistory(){
  back.hidden=false;searchButton.hidden=true;filterField.hidden=true;
  contents.replaceChildren();name.textContent='Результаты агентов';status('Загружаем…');const ticket=++panelEpoch;
  try{const {runs}=await global.PablicusAI.history();if(ticket!==panelEpoch)return;status(runs.length?'':'Пока нет запусков.');for(const run of runs)row((run.agent||'Агент')+' · '+new Date(run.created_at).toLocaleString(),'saved',async()=>{try{const found=await global.PablicusAI.get(run.id);if(ticket!==panelEpoch)return;if(found.result)showAgentResult(found.result);else status(found.status==='cancelled'?'Запуск остановлен.':'Этот запуск не завершён.');}catch(e){status(e.message);}});position();}catch(e){if(ticket===panelEpoch)status(e.message);}
 }
 function showAgentResult(result){
  contents.replaceChildren();name.textContent='Результат агента';status('');const object=el('article','r2Comparison');object.id='agent-result-'+result.runId;object.dataset.objectId=result.id;
  const link=el('a','','Результат запуска');link.href='#'+object.id;link.onclick=e=>{e.preventDefault();object.focus({preventScroll:true});};object.tabIndex=-1;object.append(link,el('p','',result.text));contents.append(object);
  if(result.target){const action=button('Создать дело из результата',()=>{
   contents.replaceChildren(el('h3','','Разрешение на запись'),el('p','','Создать новое дело в чате «'+result.target.label+'».'),el('p','',result.text),el('p','','Новое дело появится на полотне этого чата.'));
   const allow=button('Разрешить один раз',async()=>{allow.disabled=true;try{await global.PablicusAI.approve(result.runId,result.target.id);status('Дело создано.');allow.remove();}catch(e){status(e.message);allow.disabled=false;}},true);
   contents.append(allow,button('Отклонить',()=>showAgentResult(result)));position();
  });contents.append(action);}position();
 }
 function agentDetail(a){
  back.hidden=false;searchButton.hidden=true;filterField.hidden=true;contents.scrollTop=0;
  const sourceText=snapshot().text||'',selected=structuredClone(context),target=(o.getTarget||(()=>global.PablicusHost?.composerTarget?.()))(),startScope=scope();let task=sourceText,requestId=crypto.randomUUID();
  heading.querySelector('[data-agent-settings]')?.remove();
  const settings=icons.button('settings','Настройки агента',()=>{
   contents.replaceChildren();name.textContent='Параметры запуска';status('');
   const label=el('label','r2RequestLabel','Задача'),field=el('textarea');field.rows=4;field.maxLength=20000;field.value=task;field.setAttribute('aria-label','Задача агенту');label.append(field);
   contents.append(label,el('p','','Получатель: '+a.name+' · OpenAI.'),el('p','','Права: читать выбранные источники. Создание дела требует отдельного разрешения после результата.'));
   for(const source of selected)contents.append(el('p','',source.label));
   contents.append(button('Сохранить параметры',()=>{if(!field.value.trim()){status('Укажите задачу.');return;}task=field.value;requestId=crypto.randomUUID();render();},true),button('Отмена',render));position();
  });settings.dataset.agentSettings='true';heading.insertBefore(settings,closeButton);
  function render(){
   contents.replaceChildren();name.textContent=a.name;status('');row(a.name,'agent',()=>{}, {selected:true});
   contents.append(el('p','',task||'Укажите задачу в поле сообщения.'));for(const source of selected)contents.append(el('p','',source.label));
   contents.append(el('p','','Получатель: '+a.name+' · OpenAI. Права: чтение текста выбранных источников. Файлы источников не передаются.'));
   const consentLabel=el('label','r2Consent'),consent=el('input');consent.type='checkbox';consent.checked=false;consent.setAttribute('aria-label','Разрешаю передать задачу и выбранные источники в OpenAI');consentLabel.append(consent,el('span','','Разрешаю передать эту задачу и выбранные источники в OpenAI.'));contents.append(consentLabel);
   const run=button('Запустить',async()=>{
    if(!consent.checked){status('Подтвердите передачу выбранных данных в OpenAI.');return;}if(!task.trim()){status('Укажите задачу.');return;}if(scope()!==startScope||snapshot().text!==sourceText||JSON.stringify(context)!==JSON.stringify(selected)){status('Задача или контекст изменились. Выберите агента заново.');return;}
    run.disabled=true;settings.disabled=true;const ticket=++panelEpoch;controller=new AbortController();const stop=button('Остановить',()=>controller?.abort());contents.append(stop);status(a.name+' · Проверяем источники…');
    try{const result=await o.runAgent({id:requestId,agent:a.id,task,text:task,context:selected,target,consent:{provider:'openai',sendTask:consent.checked,sources:selected.map(s=>({id:s.id,kind:s.kind,revision:s.revision}))},signal:controller.signal,onProgress:value=>{if(ticket===panelEpoch)status(a.name+' · '+value);}});if(ticket!==panelEpoch||scope()!==startScope)return;settings.remove();showAgentResult(result);}
    catch(e){if(ticket===panelEpoch){status(e.name==='AbortError'?'Запуск остановлен.':e.message);run.textContent='Повторить';}}
    finally{run.disabled=false;settings.disabled=false;stop.remove();position();}
   },true);run.disabled=true;consent.onchange=()=>{run.disabled=!consent.checked;};contents.append(run);position();
  }
  render();
 }
 function sync({expanded=false,busy=false}={}){full=expanded;disabled=busy;root.classList.toggle('r2LargeText',parseFloat(getComputedStyle(document.documentElement).fontSize)>24);root.classList.toggle('r2Fullscreen',full);const draft=snapshot(),typing=body.contains(document.activeElement),active=full||!!opened||typing||!!draft.text||!!draft.files?.length||!!draft.recording;const wasOpen=root.classList.contains('r2Open');root.classList.toggle('r2Open',active);if(wasOpen!==active)for(const n of body.querySelectorAll('textarea'))global.PablicusRichComposer.sizeText(n);root.classList.toggle('r2Recording',!!o.recording?.());if(expand)icons.decorate(expand,full?'collapse':'expand',full?'Вернуться в чат':'Редактор на весь экран');if(voice)icons.decorate(voice,o.recording?.()?'stop':'microphone',o.recording?.()?'Остановить запись голоса':'Записать голосовое сообщение');for(const b of[attach,ctx,ai,agent,services])b.disabled=disabled;syncHistory();position();}
 on(attach,'click',e=>{e.preventDefault();e.stopImmediatePropagation();open('add',attach);},{capture:true});
 on(body,'click',e=>{if(e.target===body&&!disabled)input.focus({preventScroll:true});});
 on(body,'focusin',()=>{sync({expanded:full,busy:disabled});o.onGeometry?.();});on(body,'focusout',()=>queueMicrotask(()=>{if(!destroyed){sync({expanded:full,busy:disabled});o.onGeometry?.();}}));
 function undoFallback(e){if(!undoPatch||undoPatch.scope!==scope()||e.target!==undoPatch.target||undoPatch.target.value!==undoPatch.after)return;if(e.type==='keydown'&&(!(e.ctrlKey||e.metaKey)||e.shiftKey||e.key.toLowerCase()!=='z'))return;if(e.type==='beforeinput'&&e.inputType!=='historyUndo')return;e.preventDefault();const u=undoPatch;undoPatch=null;u.target.value=u.before;u.target.setSelectionRange(u.start,u.end);u.target.dispatchEvent(new Event('input',{bubbles:true}));}
 on(root,'keydown',undoFallback);on(root,'beforeinput',undoFallback);
 on(root,'input',()=>{sync({expanded:full,busy:disabled});o.onGeometry?.();});
 on(document,'keydown',e=>{if(opened&&e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();close();}else if(opened){if(e.key==='Tab')panel.dataset.keyboardFocus='true';global.PablicusUI?.focusWithin(e,panel);}},{capture:true});
 on(document,'pointerdown',e=>{delete panel.dataset.keyboardFocus;if(opened&&!panel.contains(e.target)&&!root.contains(e.target))close(false);},{capture:true});
 on(global,'popstate',()=>{
  if(historyPending){historyPending=false;historyGuard=false;syncHistory();return;}
  if(!historyGuard)return;historyGuard=false;
  if(opened)close(false,true);else if(full)o.collapseFull?.();syncHistory();
 });on(global,'resize',position);if(global.visualViewport){on(global.visualViewport,'resize',position);on(global.visualViewport,'scroll',position);}
 mark();sync();return {sync,open,close,back:handleBack,get opened(){return opened;},capture:()=>({draftId,context:structuredClone(context)}),restore(value){context=structuredClone(value?.context||[]);draftId=value?.draftId||crypto.randomUUID();close(false);mark();},destroy(){full=false;close(false);syncHistory();destroyed=true;life.abort();panel.remove();}};
}
global.PablicusComposerR2=Object.freeze({create});
})(window);

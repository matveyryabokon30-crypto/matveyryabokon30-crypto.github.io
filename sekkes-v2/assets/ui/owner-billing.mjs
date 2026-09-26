import {el} from './components.mjs';
const names={voice_message:'Голосовое сообщение','sekkes-voice-archive':'Анализ голосового разговора',text:'Текстовый разговор',chat:'Административный разговор',training:'Учебные задания',evaluation:'Проверки',memory_test:'Проверки памяти',context_test:'Проверки контекста',live:'Живой голос',live_backend:'Рассуждения в голосе',transcription:'Распознавание записи',speech:'Озвучивание'};
const states={pending:'Ожидаются данные',active:'Голос: итог ещё не получен',complete:'Расход измерен',unknown:'Неполные данные',failed:'Запрос завершился ошибкой'};
const statuses={awaiting_configuration:'Нужно подключить ключ OpenAI',queued:'Импорт в очереди',running:'Получаем данные OpenAI',complete:'Последний импорт выполнен',failed:'Импорт не завершён'};
const codes={ADMIN_KEY_REQUIRED:'Добавь серверный ключ OPENAI_BILLING_ADMIN_KEY.',PROJECT_SCOPE_REQUIRED:'Укажи проект Мариуса в OPENAI_BILLING_PROJECT_IDS.',ADMIN_KEY_INVALID:'Ключ OpenAI отклонён.',ADMIN_KEY_PERMISSIONS:'Ключу не хватает прав чтения Usage и Costs.',WORKER_TIMEOUT:'Импорт не успел завершиться. Предыдущие суммы сохранены.'};
const money=x=>x==null?'нет данных':'$'+Number(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6});
const note=s=>el('p','owner-note',s),line=(name,value)=>el('p','',`${name}: ${value}`);
const button=(label,fn)=>{const b=el('button','owner-button',label);b.type='button';b.onclick=fn;return b};
export function billingPanel({request}){
 const root=el('section','owner-billing'),filters=el('div','owner-editor'),report=el('div','owner-billing-report'),status=note('Загружаем учёт расходов…'),actions=el('div','owner-billing-actions');status.setAttribute('role','status');
 const from=el('input','owner-input'),to=el('input','owner-input'),client=el('select','owner-input');from.type=to.type='date';from.setAttribute('aria-label','Дата начала UTC');to.setAttribute('aria-label','Дата окончания UTC');client.setAttribute('aria-label','Клиент');
 const today=new Date();to.value=today.toISOString().slice(0,10);from.value=new Date(today.getTime()-6*86400000).toISOString().slice(0,10);
 const all=el('option','','Все клиенты');all.value='';client.append(all);
 filters.append(note('Период по UTC — как в отчёте OpenAI'),from,to,note('Клиент'),client);
 root.append(el('h2','','Расходы Мариуса'),report,filters,status,actions);
 let revision=0,busy=false,last=null,offset=0;
 const options=()=>({start:from.value+'T00:00:00Z',end:new Date(Date.parse(to.value+'T00:00:00Z')+86400000).toISOString(),client:client.value,offset});
 const row=(title,body)=>{const d=el('details','owner-auto-record');d.append(el('summary','',title),body);return d};
 function render(d){
  last=d;report.replaceChildren();
  const s=d.summary||{},costs=d.provider_costs||[],providerTotal=costs.reduce((n,c)=>n+Number(c.amount?.value||0),0);
  report.append(line('Расчётная сумма известных расходов',money(s.estimated_usd)),note('Это оценка по измеренному использованию и тарифам. Она не равна подтверждённому списанию.'),line('Действия / записи учёта',`${s.actions??0} / ${s.calls??0}`),line('Записи с неполным учётом',s.incomplete??0));
  const imp=d.import;
  report.append(note('В сверку входят только ключи Мариуса и его учебных проверок. Расходы других приложений и ключей не включаются.'));
  report.append(el('h3','','Сверка с OpenAI'),note(imp?statuses[imp.state]||imp.state:'Первый импорт ещё не запускался'));
  if(imp?.code)report.append(note(codes[imp.code]||'Ошибка импорта: '+imp.code));
  if(imp?.finished_at)report.append(note('Последняя попытка: '+new Date(imp.finished_at).toLocaleString('ru-RU')));
  if(costs.length){report.append(line('Начисления OpenAI только по ключам Мариуса',money(providerTotal)));if(!client.value)report.append(line('Разница с известной расчётной суммой',s.estimated_usd==null?'пока не рассчитана':money(providerTotal-Number(s.estimated_usd))));report.append(note('Разница может включать задержку учёта, старые операции и неполные записи. Она не распределяется между клиентами автоматически.'));}
  else report.append(note(imp?.state==='complete'?'В сохранённом отчёте за этот период нет строк начислений.':'Подтверждённая сумма пока не загружена.'));
  if(client.value)report.append(note('OpenAI показывает общую сумму по ключам Мариуса. Расход выбранного клиента определяется по нашему журналу.'));
  if(d.coverage_start)report.append(note('Самая ранняя запись журнала: '+new Date(d.coverage_start).toLocaleString('ru-RU')+'. Старые данные могут быть неполными.'));
  report.append(el('h3','','По действиям'));
  for(const c of d.categories||[]){const body=el('div');body.append(line('Записей учёта',c.calls),line('Расчётная сумма',money(c.estimated_usd)),line('Неполных записей',c.incomplete));if(c.input_tokens!=null)body.append(line('Входные токены',c.input_tokens));if(c.output_tokens!=null)body.append(line('Выходные токены',c.output_tokens));if(c.seconds!=null)body.append(line('Длительность по данным провайдера',Number(c.seconds).toFixed(1)+' с'));report.append(row(`${names[c.category]||c.category} · ${money(c.estimated_usd)}`,body));}
  if(!(d.categories||[]).length)report.append(note('За выбранный период записей пока нет.'));
  report.append(el('h3','','По клиентам'));
  for(const c of d.clients||[]){report.append(line(c.uid,`${c.calls} записей · ${money(c.estimated_usd)} · неполных: ${c.incomplete}`));if(![...client.options].some(o=>o.value===c.uid)){const o=el('option','',c.uid);o.value=c.uid;client.append(o)}}
  if(costs.length){const body=el('div');for(const c of costs)body.append(line(`${String(c.day).slice(0,10)} · ${c.line_item||'Начисление'}`,money(c.amount?.value)));report.append(row('Детализация начислений OpenAI',body))}
  if(d.provider_usage?.length){const body=el('div');for(const u of d.provider_usage){const a=u.data;body.append(line(`${String(u.day).slice(0,10)} · ${a.model||u.kind}`,`${a.num_model_requests??'—'} запросов · вход ${a.input_tokens??'—'} · выход ${a.output_tokens??'—'} · секунд ${a.seconds??'—'}`))}report.append(row('Использование по отчёту OpenAI',body))}
  report.append(el('h3','','Журнал операций'),note(`Показаны записи ${offset+1}–${offset+(d.recent||[]).length} из ${s.calls||0}.`));
  for(const e of d.recent||[]){const body=el('div');body.append(line('Клиент',e.uid),line('Действие',e.action_id),line('Модель',e.model||'неизвестна'),line('Статус',states[e.state]||e.state),line('Расчёт',money(e.estimate_usd)));if(e.metadata?.error_code)body.append(line('Ошибка',e.metadata.error_code));if(e.usage)body.append(el('pre','owner-auto-text',JSON.stringify(e.usage,null,2)));report.append(row(`${new Date(e.created_at).toLocaleString('ru-RU')} · ${names[e.category]||e.category} · ${money(e.estimate_usd)}`,body));}
  actions.replaceChildren(button('Применить фильтры / обновить',()=>{offset=0;void load()}),button('Получить свежие данные OpenAI',()=>void sync()));
  if(offset>0)actions.append(button('Предыдущие 100',()=>{offset=Math.max(0,offset-100);void load()}));
  if(offset+(d.recent||[]).length<Number(s.calls))actions.append(button('Следующие 100',()=>{offset+=100;void load()}));
  actions.append(note('Автоматический импорт — ежедневно в 06:00 по Москве. Прошлый и текущий месяц пересчитываются повторно. Ключ хранится только на сервере.'));
 }
 async function load(){if(busy)return;busy=true;const ticket=++revision;try{const o=options();if(!from.value||!to.value||Date.parse(o.end)<=Date.parse(o.start)||Date.parse(o.end)-Date.parse(o.start)>93*86400000)throw Error('DATES');status.textContent='Загружаем…';const d=await request('billing',o);if(ticket!==revision||!root.isConnected)return;render(d);status.textContent='Данные журнала обновлены.'}catch(e){status.textContent=e.message==='DATES'?'Выбери период до 93 дней.':'Не удалось загрузить учёт. Повтори обновление.';if(!last)actions.replaceChildren(button('Повторить загрузку',()=>void load()))}finally{busy=false}}
 async function sync(){if(busy)return;busy=true;try{await request('billing',{...options(),action:'sync'});status.textContent='Импорт поставлен в очередь. Через несколько секунд нажми «Обновить».'}catch{status.textContent='Не удалось поставить импорт в очередь.'}finally{busy=false}}
 queueMicrotask(()=>void load());return root;
}

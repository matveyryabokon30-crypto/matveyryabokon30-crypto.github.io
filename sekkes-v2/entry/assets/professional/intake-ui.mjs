import {el,action,icon,formField,choice} from '../account/form-kit.mjs?v=e517eb719b5765e47495e1ef0af9d7d44ecc77f0a42f2cfd4b1917efb967463a';
import {INTAKE,spec,fieldAt,appearance,history,completion,publicPage} from './intake-model.mjs?v=e15dd5f18b70938c02a591d08ed072ab331b07c5ca7108ccd64efa5a1019b6dd';
const labels={name:'Как вас зовут',about:'О вас и вашей работе',country:'Страна',format:'Где проходят встречи',address:'Адрес кабинета'};
const schemaField=(section,key)=>spec.sections.find(s=>s.id===section)?.fields.find(f=>f.id===key);
const fieldsOf=id=>spec.sections.find(s=>s.id===id)?.fields||[];
const capsule=(text,fn,selected=false,symbol)=>{const b=action(text,fn,{symbol});b.classList.add('intake-capsule');b.setAttribute('aria-pressed',String(selected));return b;};
export function renderIntake(ctx,state){
 const root=el('div',{className:'intake-studio'}),data=ctx.data(),docs=ctx.documents(),steps=INTAKE.steps;
 const choose=(mode)=>{state.mode=mode;state.started=true;if(!state.step)state.step='identity';ctx.render();};
 if(!state.started){
  const hero=el('div',{className:'intake-welcome'},el('span',{className:'intake-kicker',text:'ВАША ПРОФЕССИОНАЛЬНАЯ СТРАНИЦА'}),el('h2',{text:data.identity?.name?'Продолжим вашу историю':'Начнём с вас'}),el('p',{text:'Расскажите о своей практике. Мы соберём страницу, которую захочется прочитать.'}));
  const modes=el('div',{className:'intake-mode-cards'});
  for(const [id,title,desc,symbol]of [['manual','Самостоятельно','Короткие шаги, примеры и подсказки.','note'],['assistant','С Мариусом','Расскажите своими словами — Мариус предложит, как заполнить поля.','agents']]){const b=action('',()=>choose(id));b.className='intake-mode-card';b.append(id==='assistant'?ctx.head:icon(symbol),el('strong',{text:title}),el('span',{text:desc}),el('small',{text:'Начать '+(id==='manual'?'заполнение':'разговор')+' ↗'}));modes.append(b);}hero.append(modes,el('p',{className:'intake-note',text:'Способ можно менять в любой момент. Ваши ответы сохраняются.'}));root.append(hero);return root;
 }
 const step=steps.find(s=>s.id===state.step)||steps[0];state.step=step.id;
 const count=steps.filter(s=>completion(s,data,docs)).length;
 const toolbar=el('div',{className:'intake-toolbar'},el('div',{className:'intake-switch','aria-label':'Способ заполнения'},capsule('Самостоятельно',()=>choose('manual'),state.mode==='manual','note'),capsule('С Мариусом',()=>choose('assistant'),state.mode==='assistant','agents')),capsule('Предпросмотр',()=>{state.preview=!state.preview;ctx.render();},!!state.preview,'eye'));
 root.append(toolbar);
 const layout=el('div',{className:'intake-columns'+(state.preview?' show-preview':'')});root.append(layout);
 const nav=el('nav',{className:'intake-roadmap','aria-label':'Шаги создания страницы'});nav.append(el('div',{className:'intake-progress-label',text:`Готово ${count} из ${steps.length}`}),el('progress',{value:count,max:steps.length}));
 steps.forEach((s,i)=>{const done=completion(s,data,docs),b=action('',()=>{state.step=s.id;state.mode='manual';ctx.render();});b.className='intake-step';b.setAttribute('aria-current',step.id===s.id?'step':'false');b.append(el('span',{className:'intake-step-number'+(done?' complete':''),text:done?'✓':String(i+1).padStart(2,'0')}),el('span',{text:s.title}));nav.append(b);});layout.append(nav);
 const main=el('main',{className:'intake-main'});layout.append(main);
 const preview=el('aside',{className:'intake-preview','aria-label':'Предпросмотр страницы'});layout.append(preview);
 const updatePreview=()=>preview.replaceChildren(renderPage(ctx.data(),{avatar:ctx.avatar,small:true}));updatePreview();ctx.previewUpdate=updatePreview;
 if(state.mode==='assistant')renderConversation(main,ctx,state);else{
  main.append(el('div',{className:'intake-heading'},el('span',{className:'intake-kicker',text:step.optional?'МОЖНО ЗАПОЛНИТЬ ПОЗЖЕ':'ШАГ '+String(steps.indexOf(step)+1).padStart(2,'0')}),el('h2',{text:step.title}),el('p',{text:step.help})));
  const form=el('div',{className:'intake-form'});main.append(form);
  if(step.id==='identity'&&!ctx.readonly){const upload=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp',hidden:true});upload.onchange=()=>{if(upload.files[0])ctx.photo(upload.files[0]);};form.append(el('div',{className:'intake-photo-upload'},ctx.avatar?el('img',{src:ctx.avatar,alt:'Ваше фото'}):icon('profile'),action(ctx.avatar?'Заменить фото':'Добавить фото',()=>upload.click(),{quiet:true}),upload));}
  if(step.id==='appearance')renderAppearance(form,ctx);
  else if(step.id==='documents')ctx.documentsView(form);
  else if(step.repeat){const rows=data[step.repeat]||[];rows.forEach((row,index)=>{
   const card=el('details',{className:'intake-record',open:state.openRow===index||rows.length===1});card.append(el('summary',{},el('span',{text:row.institution||row.title||'Новая запись'}),el('small',{text:row.year||row.duration||String(index+1).padStart(2,'0')})));
   const grid=el('div',{className:'intake-fields'});fieldsOf(step.repeat).forEach(f=>grid.append(renderField(ctx,step.repeat,f,index)));card.append(grid,action('Убрать запись',()=>{ctx.removeRow(step.repeat,index);ctx.render();},{quiet:true,symbol:'close'}));form.append(card);
  });const emptyIcon=step.repeat==='education'?'learning':'note';if(!rows.length)form.append(el('div',{className:'intake-empty'},icon(emptyIcon),el('strong',{text:step.repeat==='education'?'Ваш профессиональный путь':step.repeat==='services'?'Первая консультация':'Ваши материалы и события'}),el('p',{text:'Добавьте запись. Её можно дополнить позже.'})));
  form.append(action(step.repeat==='education'?'Добавить образование':step.repeat==='services'?'Добавить консультацию':'Добавить предложение',()=>{state.openRow=rows.length;ctx.addRow(step.repeat);ctx.render();},{symbol:'plus'}));
  }else{
   const grid=el('div',{className:'intake-fields'});for(const path of step.fields||[]){const [s,k]=path.split('.');if(path==='identity.address'&&data.identity?.format==='online')continue;if(s==='market'&&k!=='enabled'&&!data.market?.enabled)continue;grid.append(renderField(ctx,s,fieldAt(path)));}form.append(grid);
   if(step.id==='review'){form.prepend(renderPage(data,{avatar:ctx.avatar}));ctx.reviewView(form);}
  }
  if(!ctx.readonly){const index=steps.indexOf(step);const footer=el('div',{className:'intake-footer'});if(index>0)footer.append(action('Назад',()=>{state.step=steps[index-1].id;ctx.render();},{quiet:true}));footer.append(action(step.id==='review'?'Отправить на проверку':step.optional?'Продолжить':'Далее',()=>ctx.next(step.id,steps[Math.min(index+1,steps.length-1)].id),{primary:true}));main.append(footer);}
 }
 if(ctx.readonly)root.querySelectorAll('input,textarea,button').forEach(e=>{if(e.closest('.intake-form')||e.closest('.intake-conversation'))e.disabled=true;});return root;
}
function renderField(ctx,section,f,row=-1){
 const get=()=>row<0?ctx.data()[section]?.[f.id]:ctx.data()[section]?.[row]?.[f.id];
 const set=v=>{ctx.set(section,row,f.id,v);ctx.previewUpdate?.();};const value=get(),title=labels[f.id]||f.label;
 if(f.type==='bool'){const input=el('input',{type:'checkbox',checked:!!value,onChange:()=>{set(input.checked);if(section==='market')ctx.render();}});return el('label',{className:'intake-check account-wide'},input,el('span',{text:title}));}
 if(f.type==='select'){const group=el('div',{className:'account-field'},el('span',{className:'field-label',text:title+(f.required?' *':'')}));if(f.options.length<=3){const buttons=el('div',{className:'intake-options'});for(const o of f.options){const b=capsule(o.label,()=>{set(o.id);buttons.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));},value===o.id);buttons.append(b);}group.append(buttons);}else{const input=choice(title,[{id:'',label:'Выбрать'},...f.options],value||'',ctx.readonly);input.addEventListener('input',()=>set(input.value));group.append(input);}return group;}
 return formField({key:f.id,label:title,type:f.type,value:value||'',max:f.max,required:f.required,readonly:ctx.readonly,onChange:set,help:section==='identity'&&f.id==='email'?'Для связи. Почта входа меняется отдельно в настройках.':undefined});
}
function renderAppearance(root,ctx){
 for(const[key,title,options]of [['style','Стиль страницы',INTAKE.styles],['palette','Цветовая палитра',INTAKE.palettes],['font','Шрифт',INTAKE.fonts],['background','Фон',INTAKE.backgrounds]]){
  const group=el('section',{className:'intake-style-group'},el('h3',{text:title})),choices=el('div',{className:'intake-style-options'});group.append(choices);
  for(const o of options){const b=capsule(o.label,()=>{ctx.set('appearance',-1,key,o.id);if(!ctx.data().appearance.style)ctx.set('appearance',-1,'style','atelier');choices.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));ctx.previewUpdate?.();},appearance(ctx.data())[key]===o.id);
   if(key==='palette'){b.style.setProperty('--swatch',o.accent);b.prepend(el('span',{className:'intake-swatch'}));}if(key==='style'){b.classList.add('intake-style-card');b.prepend(el('span',{className:'intake-style-mini '+o.id},el('i'),el('i'),el('i')));}if(key==='font')b.style.fontFamily=o.id==='system'?'system-ui':o.label;choices.append(b);
  }root.append(group);
 }root.append(el('p',{className:'intake-note',text:'Оформление сохраняется с анкетой. На вашем личном рабочем пространстве этот выбор не отразится.'}));
}
function renderConversation(root,ctx,state){
 root.classList.add('intake-conversation');const head=el('div',{className:'intake-assistant-head'},ctx.head,el('div',{},el('h2',{text:'Заполним вместе'}),el('p',{text:'Расскажите о практике. Я помогу собрать вашу страницу.'})));root.append(head);
 const log=el('div',{className:'intake-chat-log','aria-label':'Разговор с Мариусом'});const messages=history(ctx.data());if(!messages.length)log.append(el('div',{className:'intake-bubble assistant',text:'Как вас зовут, с кем вы работаете и как проходят ваши консультации? Можно ответить одним сообщением.'}));for(const m of messages)log.append(el('div',{className:'intake-bubble '+m.role},el('small',{text:m.role==='user'?'Вы':'Marius'}),el('p',{text:m.text})));root.append(log);
 if(state.proposal){const box=el('section',{className:'intake-proposal'},el('strong',{text:'Мариус предлагает'}));for(const c of state.proposal.changes)box.append(el('div',{},el('small',{text:c.label}),el('p',{text:schemaField(c.section,c.field)?.options?.find(x=>x.id===c.value)?.label||c.value||'Очистить поле'})));box.append(el('div',{className:'intake-options'},action('Применить к анкете',ctx.apply,{primary:true}),action('Пропустить',ctx.reject,{quiet:true})));root.append(box);}
 const composer=el('form',{className:'intake-composer'}),input=el('textarea',{rows:3,maxLength:3000,value:state.message||'',placeholder:'Расскажите своими словами…','aria-label':'Сообщение Мариусу',onInput:()=>{state.message=input.value;}}),send=action(state.thinking?'Мариус думает…':'Отправить',()=>{}, {primary:true});send.type='submit';send.disabled=state.thinking||!!state.proposal;input.disabled=state.thinking;composer.append(input,send);composer.onsubmit=e=>{e.preventDefault();if(input.value.trim()&&!state.thinking&&!state.proposal)ctx.ask(input.value.trim());};root.append(composer,el('p',{className:'intake-note',text:'Ответы обрабатываются ИИ. Проверьте предложенные сведения перед применением.'}));
}
export function renderPage(data,{avatar,small=false}={}){
 const p=publicPage(data),a=appearance(data),pal=INTAKE.palettes.find(x=>x.id===a.palette),page=el('article',{className:'intake-page '+a.style+(small?' compact':''),'data-background':a.background,'aria-label':'Ваша страница — предпросмотр'});page.style.setProperty('--page-accent',pal.accent);page.style.setProperty('--page-paper',pal.paper);page.style.fontFamily=a.font==='system'?'system-ui':a.font==='onest'?'Onest,system-ui':'Manrope,system-ui';
 page.append(el('div',{className:'intake-cover'}));const body=el('div',{className:'intake-page-body'});page.append(body);
 const avatarNode=avatar?el('img',{className:'intake-profile-avatar',src:avatar,alt:''}):el('div',{className:'intake-profile-avatar',text:p.name==='Ваше имя'?'А':p.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('')});body.append(avatarNode,el('span',{className:'intake-page-role',text:'Психолог'}),el('h2',{text:p.name}),el('p',{className:'intake-page-location',text:[p.city,({online:'Онлайн',onsite:'Очно',hybrid:'Онлайн и очно'})[p.format]].filter(Boolean).join(' · ')}));
 if(p.about)body.append(el('p',{className:'intake-page-about',text:p.about}));else body.append(el('p',{className:'intake-page-placeholder',text:'Здесь появится ваш рассказ о себе и своей работе.'}));
 for(const[title,text]of [['Мой подход',p.methods],['С чем я помогаю',p.topics]])if(text)body.append(el('section',{},el('h3',{text:title}),el('p',{text})));
 if(p.services.length){const section=el('section',{},el('h3',{text:'Консультации'}));for(const s of p.services)section.append(el('div',{className:'intake-offer'},el('strong',{text:s.title||'Консультация'}),el('p',{text:s.description||''}),el('span',{text:[s.duration,s.price?Number(s.price.replace(',','.')).toLocaleString('ru-RU')+' ₽':''].filter(Boolean).join(' · ')})));body.append(section);}
 if(p.education.length){const section=el('section',{},el('h3',{text:'Образование'}));for(const e of p.education)section.append(el('p',{text:[e.institution,e.program,e.year].filter(Boolean).join(' · ')}));body.append(section);}
 if(p.products.length){const section=el('section',{},el('h3',{text:'Материалы и обучение'}));for(const x of p.products)section.append(el('p',{text:x.title||'Новое предложение'}));body.append(section);}
 body.append(el('p',{className:'intake-page-draft',text:'Предпросмотр · страница ещё не опубликована'}));return page;
}

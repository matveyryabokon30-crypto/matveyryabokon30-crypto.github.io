import {formField,sectionIntro,icon,iconButton,GUIDE} from './form-kit.mjs?v=e517eb719b5765e47495e1ef0af9d7d44ecc77f0a42f2cfd4b1917efb967463a';
import {createProfessionalWorkspace} from '../professional/ui.mjs?v=934360916ae6e42a446a26aa501927bc87efcd6f56f3292dcc44a77c5fef2010';
import {DEFAULTS,ROLES,PROFILE_FIELDS,EXTRA_FIELDS,accountMessage} from './model.mjs?v=f5f28edbbebc28207659c61c1afed773c3843413f7ec955e7274935b94a4313d';
const node=(tag,attrs={},...children)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='text')e.textContent=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);else if(k in e)e[k]=v;else e.setAttribute(k,v);}e.append(...children.filter(Boolean));return e;};
const action=(text,fn)=>node('button',{type:'button',className:'account-action',text,onClick:fn});
const clone=x=>structuredClone(x);
export const COLORS=[['iris','Аметист','#81758f'],['ocean','Сталь','#647f96'],['mint','Нефрит','#637b70'],['rose','Розовый кварц','#927780'],['apricot','Шампань','#8a7b68'],['graphite','Платина','#747e8b']];
export function accountAvatar(sync){
 const element=node('span',{className:'account-avatar'});let previous;
 const update=()=>{const name=sync.snapshot?.profile.data.name||'Я',key=(sync.avatarURL||'')+name;if(previous===key)return;previous=key;element.replaceChildren(sync.avatarURL?node('img',{src:sync.avatarURL,alt:'Фото профиля'}):node('span',{text:name.slice(0,1).toUpperCase()}));};
 const off=sync.subscribe(update);update();return{element,destroy:off};
}
function editor(sync,type){
 const element=node('section',{className:'account-center'}),status=node('p',{className:'account-status',role:'status'}),form=node('form',{className:'account-form'}),body=node('fieldset'),save=node('button',{type:'submit',className:'account-action account-primary',text:'Сохранить'}),retry=action('Обновить',()=>void sync.refresh());
 let base=null,dirty=false,disposed=false,build,renderedRevision;const inputs=new Map(),choices=[];let profile={},account={};
 const draftKey='account-draft:'+type;let step=type==='profile'?'about':'appearance';const sections=type==='profile'?[['about','О вас'],['contacts','Контакты'],['roles','Роли'],['details','Дополнительно']]:[['appearance','Внешний вид'],['preferences','Предпочтения']];const stepper=node('nav',{className:'form-step-tabs','aria-label':'Разделы профиля'});element.prepend(stepper);
 function remember(){dirty=true;status.textContent='Есть несохранённые изменения';try{sync.backing?.setItem(draftKey,JSON.stringify({base,profile,account}));}catch{}}
 function field(key,title,scope,{multiline=false,type='text',max=200,example,help}={}){
  const component=formField({key,label:title,value:scope[key]||'',type:multiline?'long':type,max,example,help,onChange:value=>{scope[key]=value;remember();}});inputs.set(key,component.input);return component;
 }
 function options(title,key,items,scope=account){
  const group=node('div',{className:'account-choices',role:'group','aria-label':title});
  for(const[value,label,color]of items){const b=action(label,()=>{scope[key]=value;remember();updateChoices();});b.setAttribute('aria-pressed',String(scope[key]===value));if(color){const dot=node('span',{className:'account-color'});dot.style.background=color;b.prepend(dot);}group.append(b);choices.push({b,selected:()=>scope[key]===value});}
  return node('section',{className:'account-wide account-group'},node('h3',{text:title}),group);
 }
 function updateChoices(){for(const c of choices)c.b.setAttribute('aria-pressed',String(c.selected()));}
 function render(){if(!base)return;inputs.clear();choices.length=0;body.replaceChildren();stepper.replaceChildren();for(const [id,title] of sections){const b=action(title,()=>{step=id;render();});b.setAttribute('aria-pressed',String(step===id));stepper.append(b);}build({body,field,options,remember,updateChoices,profile,account,step});body.append(node('div',{className:'account-wide account-save'},save));}
 function refresh(){if(disposed)return;status.textContent=dirty?'Есть несохранённые изменения · '+sync.status:sync.status;body.disabled=sync.busy||!sync.snapshot;retry.disabled=sync.busy;
  const revision=sync.snapshot&&[sync.snapshot.profile.revision,sync.snapshot.account.revision].join(':');if(!dirty&&sync.snapshot&&revision!==renderedRevision){renderedRevision=revision;base=clone(sync.snapshot);profile=clone(base.profile.data);account={...DEFAULTS,...clone(base.account.data)};render();}
 }
 retry.classList.add('form-refresh');retry.replaceChildren(icon('refresh'));retry.setAttribute('aria-label','Обновить данные');retry.title='Обновить данные';form.noValidate=true;form.append(body);element.append(node('div',{className:'form-sync-row'},status,retry),form);
 form.addEventListener('submit',async e=>{e.preventDefault();if(!base)return;const invalid=[...body.querySelectorAll('.account-field')].filter(x=>x.validate&&!x.validate());if(invalid.length){invalid[0].input.focus();status.textContent='Проверьте выделенные поля';return;}save.disabled=true;try{const changed=Object.fromEntries(Object.entries(account).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(({...DEFAULTS,...base.account.data})[key])));const next=await sync.save(base,type==='profile'?profile:{},changed);if(disposed)return;dirty=false;renderedRevision=null;base=clone(next);sync.backing?.removeItem(draftKey);refresh();}catch(error){if(!disposed){status.textContent=accountMessage(error);if(error.code==='FIELD_CONFLICT')status.append(document.createTextNode(' Поле: '+(inputs.get(error.field)?.getAttribute('aria-label')||error.field)+'. '),action('Загрузить новую версию',()=>{if(confirm('Заменить несохранённые правки этой формы последней версией?')){dirty=false;renderedRevision=null;sync.backing?.removeItem(draftKey);void sync.refresh();}}));}}finally{save.disabled=false;}});
 return{element,setup(fn){build=fn;try{const d=JSON.parse(sync.backing?.getItem(draftKey)||'null');if(d?.base?.profile&&d?.base?.account&&d.profile&&d.account){base=d.base;profile=d.profile;account=d.account;dirty=true;render();}}catch{}const off=sync.subscribe(refresh);refresh();return{element,refresh,destroy(){disposed=true;off();}};}};
}
export function createAccountProfile(sync){
 const edit=editor(sync,'profile'),avatar=accountAvatar(sync),heading=node('h1',{text:'Ваш профиль'}),identity=node('div',{className:'account-identity'},avatar.element,node('div',{},heading,node('p',{className:'account-caption',text:'Личные данные и контакты'})));
 let professional;
 const launch=action('Мои профессиональные анкеты',()=>{const nodes=[...edit.element.childNodes];professional=createProfessionalWorkspace(sync,{onBack:()=>{professional.destroy();professional=null;edit.element.replaceChildren(...nodes);}});edit.element.replaceChildren(professional.element);});
 launch.classList.add('form-professional-link');launch.prepend(icon('catalog'));edit.element.prepend(identity);edit.element.append(launch);
 const component=edit.setup(({body,field,options,remember,updateChoices,profile,account,step})=>{
  if(step==='about'){
  const picker=node('input',{type:'file',accept:'image/jpeg,image/png,image/webp,image/heic,image/heif',hidden:true});
  const photo=action(sync.avatarURL?'Заменить фото':'Добавить фото',()=>picker.click()),photoStatus=node('span',{role:'status',className:'account-caption'});photo.prepend(icon('image'));
  picker.addEventListener('change',async()=>{const f=picker.files?.[0];if(!f)return;photo.disabled=true;photoStatus.textContent='Загружаем…';try{await sync.setAvatar(f);photo.firstChild?.remove();photo.replaceChildren(icon('image'),document.createTextNode('Заменить фото'));photoStatus.textContent='Фото сохранено';}catch{photoStatus.textContent='Выберите JPEG, PNG или WebP до 20 МБ и повторите.';}finally{photo.disabled=false;picker.value='';}});
  body.append(node('div',{className:'account-wide account-photo-actions'},photo,picker,photoStatus));
  for(const[key,title,multiline]of [['name','Имя'],['surname','Фамилия'],['username','Имя пользователя'],['city','Город'],['bio','О себе',true]])body.append(field(key,title,profile,{max:PROFILE_FIELDS[key],multiline}));
  body.append(field('birthday','Дата рождения',profile,{max:10,type:'date'}));
  }
  if(step==='roles'){
  const roles=node('div',{className:'account-choices',role:'group','aria-label':'Ваши роли'}),active=node('div',{className:'account-choices',role:'group','aria-label':'Основная роль'});
  function activeChoices(){active.replaceChildren();for(const[id,title]of ROLES.filter(([id])=>account.roles.includes(id))){const b=action(title,()=>{account.activeRole=id;remember();activeChoices();});b.setAttribute('aria-pressed',String(account.activeRole===id));active.append(b);}}
  for(const[id,title]of ROLES){const b=action(title,()=>{const set=new Set(account.roles);if(set.has(id)){if(set.size===1)return;set.delete(id);}else set.add(id);account.roles=[...set];if(!set.has(account.activeRole))account.activeRole=account.roles[0];remember();updateChoices();activeChoices();});roles.append(b);choicesPush();function choicesPush(){b.setAttribute('aria-pressed',String(account.roles.includes(id)));const refresh=()=>b.setAttribute('aria-pressed',String(account.roles.includes(id)));roles.addEventListener('click',refresh);}}
  activeChoices();body.append(node('section',{className:'account-wide account-group'},node('h3',{text:'Ваши роли'}),node('p',{className:'account-caption',text:'Можно выбрать несколько. Статус специалиста и доступ к организации подтверждаются отдельно.'}),roles,node('h3',{text:'Основная роль'}),active));
  }
  if(step==='details'){
  body.append(sectionIntro('Ещё немного о вас','Эти сведения необязательны. Подробности работы заполняются в профессиональной анкете.'));
  body.append(field('interests','Интересы',profile,{max:160,multiline:true}));
  for(const[key,title,multiline]of [['headline','Коротко о вас'],['specialization','Направления работы',true],['education','Образование',true],['experience','Опыт',true]])body.append(field(key,title,account,{max:EXTRA_FIELDS[key],multiline,type:key==='contactEmail'?'email':key==='phone'?'tel':'text'}));
  }
  if(step==='contacts'){body.append(sectionIntro('Как с вами связаться','Контакты для вашей анкеты. Это не меняет способ входа в аккаунт.'));body.append(field('phone','Телефон',account,{max:40,type:'tel'}),field('contactEmail','Электронная почта',account,{max:254,type:'email'}),field('website','Сайт',account,{max:500,type:'url'}));}
  body.append(node('p',{className:'account-wide account-caption form-privacy',text:'Анкета и контакты доступны вам, владельцу и уполномоченной команде AI Marius. Другим участникам они автоматически не публикуются.'}));
 });return{...component,destroy(){professional?.destroy();component.destroy();avatar.destroy();}};
}
export function createAccountSettings(sync){
 const edit=editor(sync,'settings');edit.element.prepend(node('h2',{text:'Настройки аккаунта'}));
 return edit.setup(({body,field,options,remember,account,step})=>{
  if(step==='appearance'){body.append(options('Тема','theme',[['system','Системная'],['light','Светлая'],['dark','Тёмная']]),options('Цвет пространства','palette',COLORS),options('Размер текста','textSize',[['system','Системный'],['125','Крупнее'],['150','Большой'],['200','Очень большой']]));
  for(const[key,title]of [['motion','Анимация'],['transparency','Прозрачность'],['companion','Плавающий помощник в вебе']]){const input=node('input',{type:'checkbox',checked:account[key]!==false,onChange:()=>{account[key]=input.checked;remember();}});body.append(node('label',{className:'account-switch account-wide'},node('span',{text:title}),input));}
  }
  if(step==='preferences'){body.append(options('Шрифт в вебе','font',[['system','Системный'],['onest','Onest'],['manrope','Manrope']]),options('Предпочитаемый язык материалов','language',[['ru','Русский'],['en','English'],['de','Deutsch'],['fr','Français'],['es','Español'],['uk','Українська']]),field('timezone','Часовой пояс',account,{max:80}),node('p',{className:'account-wide account-caption',text:'Часовой пояс: например, Europe/Moscow или Asia/Almaty. Язык сохраняется для будущего подбора материалов; интерфейс пока на русском. Раскладка окон и файлы браузера остаются на этом устройстве.'}));}
 });
}

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
 const draftKey='account-draft:'+type;
 function remember(){dirty=true;status.textContent='Есть несохранённые изменения';try{sync.backing?.setItem(draftKey,JSON.stringify({base,profile,account}));}catch{}}
 function field(key,title,scope,{multiline=false,type='text',max=200}={}){
  const input=node(multiline?'textarea':'input',{...(multiline?{rows:3}:{type}),maxLength:max,value:key==='birthday'&&/^\d{8}$/.test(scope[key]||'')?scope[key].slice(4)+'-'+scope[key].slice(2,4)+'-'+scope[key].slice(0,2):scope[key]||'',autocomplete:key==='name'?'given-name':key==='surname'?'family-name':'off','aria-label':title});
  input.addEventListener('input',()=>{scope[key]=input.value;remember();});inputs.set(key,input);
  return node('label',{className:multiline?'account-field account-wide':'account-field'},node('span',{text:title}),input);
 }
 function options(title,key,items,scope=account){
  const group=node('div',{className:'account-choices',role:'group','aria-label':title});
  for(const[value,label,color]of items){const b=action(label,()=>{scope[key]=value;remember();updateChoices();});b.setAttribute('aria-pressed',String(scope[key]===value));if(color){const dot=node('span',{className:'account-color'});dot.style.background=color;b.prepend(dot);}group.append(b);choices.push({b,selected:()=>scope[key]===value});}
  return node('section',{className:'account-wide account-group'},node('h3',{text:title}),group);
 }
 function updateChoices(){for(const c of choices)c.b.setAttribute('aria-pressed',String(c.selected()));}
 function render(){if(!base)return;inputs.clear();choices.length=0;body.replaceChildren();build({body,field,options,remember,updateChoices,profile,account});body.append(node('div',{className:'account-wide account-save'},save));}
 function refresh(){if(disposed)return;status.textContent=dirty?'Есть несохранённые изменения · '+sync.status:sync.status;body.disabled=sync.busy||!sync.snapshot;retry.disabled=sync.busy;
  const revision=sync.snapshot&&[sync.snapshot.profile.revision,sync.snapshot.account.revision].join(':');if(!dirty&&sync.snapshot&&revision!==renderedRevision){renderedRevision=revision;base=clone(sync.snapshot);profile=clone(base.profile.data);account={...DEFAULTS,...clone(base.account.data)};render();}
 }
 form.append(body);element.append(status,retry,form);
 form.addEventListener('submit',async e=>{e.preventDefault();if(!base)return;save.disabled=true;try{const changed=Object.fromEntries(Object.entries(account).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(({...DEFAULTS,...base.account.data})[key])));const next=await sync.save(base,type==='profile'?profile:{},changed);if(disposed)return;dirty=false;renderedRevision=null;base=clone(next);sync.backing?.removeItem(draftKey);refresh();}catch(error){if(!disposed){status.textContent=accountMessage(error);if(error.code==='FIELD_CONFLICT')status.append(document.createTextNode(' Поле: '+(inputs.get(error.field)?.getAttribute('aria-label')||error.field)+'. '),action('Загрузить новую версию',()=>{if(confirm('Заменить несохранённые правки этой формы последней версией?')){dirty=false;renderedRevision=null;sync.backing?.removeItem(draftKey);void sync.refresh();}}));}}finally{save.disabled=false;}});
 return{element,setup(fn){build=fn;try{const d=JSON.parse(sync.backing?.getItem(draftKey)||'null');if(d?.base?.profile&&d?.base?.account&&d.profile&&d.account){base=d.base;profile=d.profile;account=d.account;dirty=true;render();}}catch{}const off=sync.subscribe(refresh);refresh();return{element,refresh,destroy(){disposed=true;off();}};}};
}
export function createAccountProfile(sync){
 const edit=editor(sync,'profile'),avatar=accountAvatar(sync),heading=node('h1',{text:'Личный кабинет'}),identity=node('div',{className:'account-identity'},avatar.element,node('div',{},heading,node('p',{className:'account-caption',text:'Ваша анкета на всех устройствах'})));
 edit.element.prepend(identity);
 const component=edit.setup(({body,field,options,remember,updateChoices,profile,account})=>{
  const picker=node('input',{type:'file',accept:'image/jpeg,image/png,image/webp,image/heic,image/heif',hidden:true});
  const photo=action('Изменить фото',()=>picker.click()),photoStatus=node('span',{role:'status',className:'account-caption'});
  picker.addEventListener('change',async()=>{const f=picker.files?.[0];if(!f)return;photo.disabled=true;photoStatus.textContent='Сохраняем фото…';try{await sync.setAvatar(f);photoStatus.textContent='Фото сохранено';}catch{photoStatus.textContent='Фото не сохранено. Выберите JPEG, PNG или WebP до 20 МБ и повторите.';}finally{photo.disabled=false;picker.value='';}});
  body.append(node('div',{className:'account-wide account-photo-actions'},photo,picker,photoStatus));
  for(const[key,title,multiline]of [['name','Имя'],['surname','Фамилия'],['username','Имя пользователя'],['city','Город'],['bio','О себе',true],['interests','Интересы',true],['birthday','Дата рождения']])body.append(field(key,title,profile,{max:PROFILE_FIELDS[key],multiline,type:key==='birthday'?'date':'text'}));
  const roles=node('div',{className:'account-choices',role:'group','aria-label':'Ваши роли'}),active=node('div',{className:'account-choices',role:'group','aria-label':'Основная роль'});
  function activeChoices(){active.replaceChildren();for(const[id,title]of ROLES.filter(([id])=>account.roles.includes(id))){const b=action(title,()=>{account.activeRole=id;remember();activeChoices();});b.setAttribute('aria-pressed',String(account.activeRole===id));active.append(b);}}
  for(const[id,title]of ROLES){const b=action(title,()=>{const set=new Set(account.roles);if(set.has(id)){if(set.size===1)return;set.delete(id);}else set.add(id);account.roles=[...set];if(!set.has(account.activeRole))account.activeRole=account.roles[0];remember();updateChoices();activeChoices();});roles.append(b);choicesPush();function choicesPush(){b.setAttribute('aria-pressed',String(account.roles.includes(id)));const refresh=()=>b.setAttribute('aria-pressed',String(account.roles.includes(id)));roles.addEventListener('click',refresh);}}
  activeChoices();body.append(node('section',{className:'account-wide account-group'},node('h3',{text:'Ваши роли'}),node('p',{className:'account-caption',text:'Можно выбрать несколько. Статус специалиста и доступ к организации подтверждаются отдельно.'}),roles,node('h3',{text:'Основная роль'}),active));
  for(const[key,title,multiline]of [['headline','Коротко о вас'],['specialization','Направления работы',true],['education','Образование',true],['experience','Опыт',true],['phone','Контактный телефон'],['contactEmail','Контактная почта'],['website','Сайт']])body.append(field(key,title,account,{max:EXTRA_FIELDS[key],multiline,type:key==='contactEmail'?'email':key==='phone'?'tel':'text'}));
  body.append(node('p',{className:'account-wide account-caption',text:'Анкета и контакты сейчас доступны только вам. Выбор роли не публикует данные.'}));
 });return{...component,destroy(){component.destroy();avatar.destroy();}};
}
export function createAccountSettings(sync){
 const edit=editor(sync,'settings');edit.element.prepend(node('h2',{text:'Настройки аккаунта'}));
 return edit.setup(({body,field,options,remember,account})=>{
  body.append(options('Тема','theme',[['system','Системная'],['light','Светлая'],['dark','Тёмная']]),options('Цвет пространства','palette',COLORS),options('Размер текста','textSize',[['system','Системный'],['125','Крупнее'],['150','Большой'],['200','Очень большой']]));
  for(const[key,title]of [['motion','Анимация'],['transparency','Прозрачность'],['companion','Плавающий помощник в вебе']]){const input=node('input',{type:'checkbox',checked:account[key]!==false,onChange:()=>{account[key]=input.checked;remember();}});body.append(node('label',{className:'account-switch account-wide'},node('span',{text:title}),input));}
  body.append(options('Шрифт в вебе','font',[['system','Системный'],['onest','Onest'],['manrope','Manrope']]),options('Предпочитаемый язык материалов','language',[['ru','Русский'],['en','English'],['de','Deutsch'],['fr','Français'],['es','Español'],['uk','Українська']]),field('timezone','Часовой пояс',account,{max:80}),node('p',{className:'account-wide account-caption',text:'Часовой пояс: например, Europe/Moscow или Asia/Almaty. Язык сохраняется для будущего подбора материалов; интерфейс пока на русском. Раскладка окон и файлы браузера остаются на этом устройстве.'}));
 });
}

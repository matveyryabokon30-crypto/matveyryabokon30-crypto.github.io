import {el,icon} from './components.mjs';
import {mediaTypes,validateMedia} from './profile-store.mjs';

// One modal stays open from format choice through adding a file. It owns only
// presentation/drafts; the profile's existing account-scoped store owns saving.
export function profileCreate({dialog,close,save,current=()=>true,errorText}){
 const life=new AbortController(),{signal}=life,urls=new Set();
 let disposed=false,step=0,pending=false;
 const panel=el('section','pc-panel'),grip=el('div','pc-grip'),bar=el('header','pc-bar'),content=el('div','pc-content pe-content');
 const titleId=`pc-title-${crypto.randomUUID()}`;
 grip.setAttribute('aria-hidden','true');panel.append(grip,bar,content);
 dialog.classList.add('profile-create');dialog.setAttribute('aria-labelledby',titleId);dialog.replaceChildren(panel);
 const alive=()=>!disposed&&current();
 function control(label,symbol,action,cls='pc-control'){
  const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);
  if(symbol)b.innerHTML=icon(symbol);b.append(el('span','',label));b.onclick=action;return b;
 }
 function release(){content.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});for(const u of urls)URL.revokeObjectURL(u);urls.clear();}
 function focus(){bar.querySelector('[autofocus]')?.focus({preventScroll:true});}
 function header(title,back){
  bar.replaceChildren();
  const left=back?control('Назад','back',choose):el('span','pc-spacer');
  const heading=el('h2','pc-title',title);heading.id=titleId;
  const exit=control('Закрыть','close',close);exit.autofocus=true;
  bar.append(left,heading,exit);dialog.setAttribute('aria-label',title);
 }
 function choose(){
  if(!alive()||pending)return;step++;release();content.replaceChildren();delete dialog.dataset.createKind;
  header('Создать',false);const list=el('div','pc-options');
  for(const [kind,label] of Object.entries(mediaTypes)){
   const option=control(label,kind,()=>edit(kind),'pc-option');option.dataset.kind=kind;list.append(option);
  }
  content.append(list);content.scrollTop=0;if(dialog.open)focus();
 }
 function edit(kind){
  if(!alive()||pending||!Object.hasOwn(mediaTypes,kind))return;const ticket=++step;
  release();content.replaceChildren();dialog.dataset.createKind=kind;header(mediaTypes[kind],true);
  const form=el('form','pc-form'),input=el('input'),preview=el('div','pc-preview'),caption=el('label','pc-caption','Подпись'),text=el('textarea');
  let files=[];
  input.type='file';input.hidden=true;input.multiple=kind==='carousel';input.setAttribute('aria-label',`Файлы: ${mediaTypes[kind]}`);
  const images='image/jpeg,image/png,image/webp,image/avif',videos='video/mp4,video/webm,video/quicktime';
  input.accept=kind==='video'?videos:kind==='story'?`${images},${videos}`:images;
  const pickLabels={photo:'Выбрать фото',video:'Выбрать видео',carousel:'Выбрать фотографии',story:'Выбрать фото или видео'};
  const pick=control(pickLabels[kind],kind,()=>input.click(),'pc-picker');
  text.rows=3;text.maxLength=500;text.placeholder='Добавить подпись';caption.append(text);
  const error=el('p','profile-error');error.setAttribute('role','alert');
  const submit=control('Добавить','check',null,'pc-submit');submit.type='submit';submit.disabled=true;
  form.append(input,pick,preview,caption,error,submit);content.append(form);content.scrollTop=0;focus();
  input.addEventListener('change',()=>{
   if(!alive()||ticket!==step||pending)return;error.textContent='';release();preview.replaceChildren();files=[];submit.disabled=true;
   try{
    const selected=Array.from(input.files||[]);if(!selected.length)return;validateMedia(kind,selected);files=selected;
    for(const [index,file] of files.entries()){
     const cell=el('div','pc-preview-item'),media=el(file.type.startsWith('video/')?'video':'img');
     const u=URL.createObjectURL(file);urls.add(u);media.src=u;
     if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true;media.muted=true;media.preload='metadata';}
     else{media.alt=`${mediaTypes[kind]} ${index+1}`;media.decoding='async';}
     media.addEventListener('error',()=>{if(alive()&&ticket===step){cell.replaceChildren(el('span','pc-preview-unavailable','Предпросмотр недоступен'));}},{once:true,signal});
     cell.append(media);preview.append(cell);
    }
    pick.querySelector('span:last-child').textContent='Выбрать другие';submit.disabled=false;
   }catch(e){input.value='';error.textContent=errorText(e);}
  },{signal});
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(!alive()||ticket!==step||pending)return;
   try{
    validateMedia(kind,files);pending=true;submit.disabled=true;pick.disabled=true;input.disabled=true;text.disabled=true;
    bar.querySelector('.pc-control')?.setAttribute('disabled','');error.textContent='';form.setAttribute('aria-busy','true');
    const saved=await save({kind,files,caption:text.value.trim()});
    if(alive()&&ticket===step&&!saved)error.textContent='Не удалось завершить сохранение. Повтори ещё раз.';
   }catch(e){if(alive()&&ticket===step)error.textContent=errorText(e);}
   finally{
    pending=false;
    if(alive()&&ticket===step){submit.disabled=!files.length;pick.disabled=false;input.disabled=false;text.disabled=false;bar.querySelector('.pc-control')?.removeAttribute('disabled');form.removeAttribute('aria-busy');}
   }
  },{signal});
 }
 dialog.addEventListener('click',e=>{if(e.target===dialog&&alive())close();},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)content.querySelectorAll('video').forEach(v=>v.pause());},{signal});
 choose();
 return {focus,dispose(){if(disposed)return;disposed=true;step++;life.abort();release();dialog.classList.remove('profile-create');dialog.removeAttribute('aria-labelledby');delete dialog.dataset.createKind;}};
}

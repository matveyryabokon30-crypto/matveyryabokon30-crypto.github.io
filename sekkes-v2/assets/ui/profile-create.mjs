import {storyEditor} from './story-editor.mjs';
import {el,icon} from './components.mjs';
import {mediaTypes,validateMedia,validatePostText} from './profile-store.mjs';

// One native modal owns the whole flow. Focus stays on the stationary dialog;
// only its bottom-anchored panel moves. The shared viewport owns the keyboard.
export function profileCreate({dialog,close,save,current=()=>true,errorText,initialKind=null}){
 const life=new AbortController(),{signal}=life,urls=new Set();
 let disposed=false,step=0,pending=false,started=false,moving=false,animation=null,animationId=0,gesture=null,paintFrame=0,offset=0,suppressClickUntil=0,closing=false;
 let storyController=null;
 const panel=el('section','pc-panel'),grip=el('button','pc-grip'),bar=el('header','pc-bar'),content=el('div','pc-content pe-content');
 const titleId=`pc-title-${crypto.randomUUID()}`;
 grip.type='button';grip.setAttribute('aria-label','Закрыть окно');grip.append(el('span'));panel.append(grip,bar,content);
 dialog.classList.add('profile-create');dialog.setAttribute('aria-labelledby',titleId);dialog.setAttribute('autofocus','');dialog.replaceChildren(panel);
 const alive=()=>!disposed&&current();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
 function motion(value){if(moving===value)return;moving=value;panel.classList.toggle('pc-moving',value);document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:dialog,active:value}}));}
 function control(label,symbol,action,cls='pc-control'){
  const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);
  if(symbol)b.innerHTML=icon(symbol);b.append(el('span','',label));b.onclick=action;return b;
 }
 function release(){storyController?.dispose();storyController=null;panel.classList.remove('pc-story-editor');dialog.classList.remove('pc-story-editor');content.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});for(const u of urls)URL.revokeObjectURL(u);urls.clear();}
 function stopAnimation(){animationId++;animation?.cancel();animation=null;cancelAnimationFrame(paintFrame);paintFrame=0;}
 function translate(y){offset=y;panel.style.transform=`translate3d(0,${y}px,0)`;}
 function position(){const t=getComputedStyle(panel).transform;return t==='none'?0:Math.max(0,new DOMMatrixReadOnly(t).m42);}
 function animateTo(y,finish=()=>{}){
  const from=position();stopAnimation();const id=animationId;motion(true);translate(y);
  if(reduced()||!panel.animate){motion(false);finish();return;}
  animation=panel.animate([{transform:`translate3d(0,${from}px,0)`},{transform:`translate3d(0,${y}px,0)`}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'});
  animation.finished.then(()=>{if(disposed||id!==animationId)return;animation=null;motion(false);finish();}).catch(()=>{});
 }
 function dismiss(){if(!alive()||pending||closing)return;closing=true;panel.classList.add('pc-closing');animateTo(panel.offsetHeight+24,close);}
 function focus(){
  if(!alive()||!dialog.open)return;
  // showModal focuses this untransformed root, never a translated descendant.
  dialog.focus({preventScroll:true});
  if(!started){started=true;translate(panel.offsetHeight+24);animateTo(0);}
 }
 function header(title,back){
  bar.replaceChildren();const left=back?control('Назад','back',choose):el('span','pc-spacer');
  const heading=el('h2','pc-title',title);heading.id=titleId;
  bar.append(left,heading,el('span','pc-spacer'));dialog.setAttribute('aria-label',title);
 }
 function choose(){
  if(!alive()||pending||closing)return;step++;release();content.replaceChildren();delete dialog.dataset.createKind;
  header('Создать',false);const list=el('div','pc-options');
  for(const [kind,label] of Object.entries(mediaTypes)){
   const option=control(label,kind,()=>edit(kind),'pc-option');option.dataset.kind=kind;list.append(option);
  }
  content.append(list);content.scrollTop=0;if(dialog.open)focus();
 }
 function edit(kind){
  if(!alive()||pending||closing||!Object.hasOwn(mediaTypes,kind))return;const ticket=++step,isPost=kind==='post';
  release();content.replaceChildren();dialog.dataset.createKind=kind;header(mediaTypes[kind],true);
  if(kind==='story'){panel.classList.add('pc-story-editor');dialog.classList.add('pc-story-editor');storyController=storyEditor({host:content,dialog,save,current:()=>alive()&&ticket===step,errorText,onPending(value){pending=value;grip.disabled=value;bar.querySelector('.pc-control')?.toggleAttribute('disabled',value);}});focus();return;}
  const form=el('form','pc-form'),input=el('input'),preview=el('div','pc-preview'),caption=el('label','pc-caption',isPost?'Текст поста':'Подпись'),text=el('textarea');
  let files=[];
  input.type='file';input.hidden=true;input.multiple=kind==='carousel';input.setAttribute('aria-label',`Файлы: ${mediaTypes[kind]}`);
  const images='image/jpeg,image/png,image/webp,image/avif',videos='video/mp4,video/webm,video/quicktime';
  input.accept=kind==='video'?videos:kind==='story'?`${images},${videos}`:images;
  const pickLabels={photo:'Выбрать фото',video:'Выбрать видео',carousel:'Выбрать фотографии',story:'Выбрать фото или видео'};
  const pick=control(pickLabels[kind]||'Выбрать файл',kind,()=>input.click(),'pc-picker');
  text.rows=isPost?7:3;text.maxLength=isPost?5000:500;text.placeholder=isPost?'Напиши пост…':'Добавить подпись';caption.append(text);
  const error=el('p','profile-error');error.setAttribute('role','alert');
  const submit=control('Добавить','check',null,'pc-submit');submit.type='submit';submit.disabled=true;
  if(!isPost)form.append(input,pick,preview);form.append(caption,error,submit);content.append(form);content.scrollTop=0;focus();
  const valid=()=>isPost?validatePostText(text.value):validateMedia(kind,files);
  text.addEventListener('input',()=>{if(isPost&&!pending){submit.disabled=!text.value.trim();error.textContent='';}},{signal});
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
   e.preventDefault();if(!alive()||ticket!==step||pending||closing)return;
   try{
    valid();pending=true;submit.disabled=true;pick.disabled=true;input.disabled=true;text.disabled=true;grip.disabled=true;
    bar.querySelector('.pc-control')?.setAttribute('disabled','');error.textContent='';form.setAttribute('aria-busy','true');
    const saved=await save({kind,files,caption:text.value.trim()});
    if(alive()&&ticket===step&&!saved)error.textContent='Не удалось завершить сохранение. Повтори ещё раз.';
   }catch(e){if(alive()&&ticket===step)error.textContent=errorText(e);}
   finally{
    pending=false;
    if(alive()&&ticket===step){submit.disabled=isPost?!text.value.trim():!files.length;pick.disabled=false;input.disabled=false;text.disabled=false;grip.disabled=false;bar.querySelector('.pc-control')?.removeAttribute('disabled');form.removeAttribute('aria-busy');}
   }
  },{signal});
 }
 // Claim only a downward drag that STARTED at the scroll owner's top. Text
 // selection, video controls and horizontal galleries remain native gestures.
 function begin(x,y,id,target){
  if(!alive()||pending||closing||gesture||target.closest('textarea,input,select,video,.pc-preview,.se-editor'))return;
  if(!target.closest('.pc-bar,.pc-grip')&&content.scrollTop>0)return;
  gesture={x,y,id,lastY:y,lastAt:performance.now(),velocity:0,claimed:false,base:0};
 }
 function move(x,y,id,event){
  const g=gesture;if(!g||g.id!==id)return;const dx=x-g.x,dy=y-g.y;
  if(!g.claimed){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;if(dy<=0||Math.abs(dx)>=dy){gesture=null;return;}g.base=position();stopAnimation();g.claimed=true;motion(true);}
  if(event.cancelable)event.preventDefault();const now=performance.now(),dt=now-g.lastAt;
  if(dt>0)g.velocity=(y-g.lastY)/dt;g.lastY=y;g.lastAt=now;offset=Math.max(0,g.base+dy);
  if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;if(alive())translate(offset);});
 }
 function end(id,cancelled=false){
  const g=gesture;if(!g||g.id!==id)return;gesture=null;if(!g.claimed)return;
  suppressClickUntil=performance.now()+400;cancelAnimationFrame(paintFrame);paintFrame=0;translate(offset);
  const distance=g.lastY-g.y,fast=g.velocity>.55&&performance.now()-g.lastAt<100;
  if(!cancelled&&(distance>=Math.min(110,panel.offsetHeight*.25)||(distance>28&&fast)))dismiss();else animateTo(0);
 }
 panel.addEventListener('touchstart',e=>{if(e.touches.length!==1){if(gesture)end(gesture.id,true);return;}const t=e.touches[0];begin(t.clientX,t.clientY,t.identifier,e.target);},{passive:true,signal});
 panel.addEventListener('touchmove',e=>{if(e.touches.length!==1)return;const t=e.touches[0];move(t.clientX,t.clientY,t.identifier,e);},{passive:false,signal});
 for(const type of ['touchend','touchcancel'])panel.addEventListener(type,e=>{for(const t of e.changedTouches)end(t.identifier,type==='touchcancel');},{passive:true,signal});
 panel.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;begin(e.clientX,e.clientY,e.pointerId,e.target);},{signal});
 document.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')move(e.clientX,e.clientY,e.pointerId,e);},{signal});
 for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{if(e.pointerType!=='touch')end(e.pointerId,type==='pointercancel');},{signal});
 dialog.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal});
 grip.addEventListener('click',dismiss,{signal});
 dialog.addEventListener('click',e=>{if(e.target===dialog) dismiss();},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(gesture)end(gesture.id,true);content.querySelectorAll('video').forEach(v=>v.pause());}},{signal});
 document.addEventListener('sekkes-orientation-reset',()=>{if(gesture)end(gesture.id,true);},{signal});
 motion(true);if(initialKind&&Object.hasOwn(mediaTypes,initialKind))edit(initialKind);else choose();
 return {focus,requestClose:dismiss,dispose(){if(disposed)return;disposed=true;step++;gesture=null;stopAnimation();motion(false);life.abort();release();dialog.classList.remove('profile-create');dialog.removeAttribute('aria-labelledby');dialog.removeAttribute('autofocus');delete dialog.dataset.createKind;}};
}

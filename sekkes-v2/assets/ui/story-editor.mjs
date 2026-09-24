import {storyTextTools} from './story-text-tools.mjs';
import {el,icon} from './components.mjs';
import {validateMedia} from './profile-store.mjs';
import {storySurface,normalizeStory,mediaGeometry,storyWindow,storyFilters,clamp,storyLink} from './story-composition.mjs';

// The creator owns the modal and saving; this editor owns media, gestures and tools.
export function storyEditor({host,dialog,save,current=()=>true,onPending=()=>{},errorText=e=>e.message}){
 const life=new AbortController(),{signal}=life;
 const root=el('div','se-editor'),work=el('div','se-workspace'),toolbox=el('section','se-toolbox'),footer=el('footer','se-footer');
 const input=el('input'),error=el('p','se-error');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime';input.hidden=true;input.setAttribute('aria-label','Фото или видео для сторис');error.setAttribute('role','alert');
 let surface=null,url=null,file=null,mediaLife=null,ready=false,pending=false,disposed=false,revision=0,raf=0,selected=null,mode='move',preview=false,gesture=null,drawColor='#ffffff',drawWidth=.006,toolLife=null;
 const pointers=new Map(),history=[];const alive=()=>!disposed&&current();
 function control(label,symbol,fn,cls='se-tool'){
  const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);b.title=label;b.innerHTML=icon(symbol);b.onclick=fn;return b;
 }
 const pick=control('Выбрать фото или видео','photo',()=>{if(!pending)input.click();},'se-pick');pick.append(el('span','','Выбрать фото или видео'));
 const change=control('Заменить фото или видео','photo',()=>input.click());
 const publish=control('Добавить в сторис','check',commit,'se-publish');publish.append(el('span','','Добавить в сторис'));publish.disabled=true;
 const peek=control('Предпросмотр','eye',()=>{preview=!preview;root.classList.toggle('se-previewing',preview);peek.setAttribute('aria-pressed',String(preview));if(preview)closeTools();},'se-peek');
 const toolbar=el('nav','se-toolbar');toolbar.setAttribute('aria-label','Инструменты сторис');
 const move=control('Оформление','crop',()=>openTools('crop'));move.classList.add('se-extra');
 const text=control('Текст','text',()=>openTools('text'));
 const stickers=control('Стикеры','smile',()=>openTools('stickers'));
 const draw=control('Рисовать','edit',()=>openTools('draw'));
 const filters=control('Фильтры','spark',()=>openTools('filters'));
 const sound=control('Звук видео','sound',()=>{if(!ready)return;remember();surface.state.muted=!surface.state.muted;surface.media.muted=surface.state.muted;updateButtons();});sound.hidden=true;
 const playback=control('Пауза видео','stop',()=>{if(!surface)return;const m=surface.media;if(m.paused)m.play().catch(()=>{});else m.pause();});playback.hidden=true;
 const clip=control('Длительность','clock',()=>openTools('duration'));
 const undo=control('Отменить изменение','undo',()=>{if(pending||!surface||!history.length)return;Object.assign(surface.state,normalizeStory(JSON.parse(history.pop())));selected=null;closeTools();surface.render();surface.media.muted=surface.state.muted;updateButtons();});
 const more=control('Ещё инструменты','arrow',()=>{const expanded=root.classList.toggle('se-expanded');more.setAttribute('aria-expanded',String(expanded));});more.classList.add('se-more');more.setAttribute('aria-expanded','false');
 for(const b of [clip,undo,sound,playback])b.classList.add('se-extra');toolbar.append(text,stickers,draw,filters,more,move,sound,playback,clip,undo);
 const selection=el('div','se-selection');selection.hidden=true;selection.append(control('Удалить выбранное','trash',()=>{const l=surface?.state.layers.find(x=>x.id===selected);if(l)removeLayer(l);}),control('Повернуть выбранное','rotate',()=>{const l=surface?.state.layers.find(x=>x.id===selected);if(l){remember();l.rotation+=15;schedule();}}));
 const trash=el('div','se-trash');trash.setAttribute('aria-hidden','true');trash.innerHTML=icon('trash');trash.hidden=true;root.append(trash);
 work.append(pick,toolbar,selection);footer.append(change,peek,publish);root.append(input,work,toolbox,error,footer);host.replaceChildren(root);toolbox.hidden=true;toolbar.hidden=true;footer.hidden=true;root.dataset.ready='false';
 const snapshot=()=>surface?JSON.stringify(surface.export()):'';
 function remember(value=snapshot()){if(!value)return;if(history.at(-1)!==value)history.push(value);if(history.length>30)history.shift();updateButtons();}
 function paint(){raf=0;if(!alive()||!surface)return;surface.render();if(toolKind==='text')surface.node.querySelector(`[data-layer-id="${selected}"]`)?.setAttribute('data-editing','true');if(selected)surface.node.querySelector(`[data-layer-id="${selected}"]`)?.setAttribute('data-selected','true');selection.hidden=!selected;}
 function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
 function updateButtons(){if(!surface)return;sound.setAttribute('aria-pressed',String(!surface.state.muted));sound.style.opacity=surface.state.muted?'.5':'1';undo.disabled=!history.length;publish.disabled=!ready||pending;root.dataset.tool=mode;}
 function clearSelection(){selected=null;selection.hidden=true;surface?.node.querySelectorAll('[data-selected]').forEach(n=>n.removeAttribute('data-selected'));}
 // Every tool uses one edge-attached surface. Text is edited over the image;
 // the other tools share a bottom sheet with a stationary header and scroll body.
 let toolKind='',toolAnimation=null,toolGesture=null;
 function finishGesture(){
  pointers.clear();gesture=null;root.classList.remove('se-adjusting','se-layer-dragging');trash.hidden=true;delete trash.dataset.active;
  document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));
 }
 function closeTools(){
  if(toolbox.contains(document.activeElement))document.activeElement.blur();
  toolAnimation?.cancel();toolAnimation=null;toolLife?.abort();toolLife=null;toolGesture=null;
  toolbox.hidden=true;toolbox.replaceChildren();toolbox.style.transform='';toolKind='';
  root.classList.remove('se-tool-open');delete root.dataset.panel;mode='move';
  if(surface){surface.node.querySelectorAll('[data-editing]').forEach(n=>n.removeAttribute('data-editing'));surface.state.layers=surface.state.layers.filter(l=>l.id!==selected||l.text.trim());if(!surface.state.layers.some(l=>l.id===selected))clearSelection();surface.paintLayers();}
  finishGesture();updateButtons();document.dispatchEvent(new Event('sekkes-story-input-state'));
 }
 function label(text,node){const wrap=el('label','se-field');wrap.append(el('span','',text),node);return wrap;}
 function range(name,value,min,max,step,fn){
  const n=el('input');n.type='range';n.min=min;n.max=max;n.step=step;n.value=value;n.setAttribute('aria-label',name);
  const out=el('output','se-range-value',String(value)),wrap=label(name,n);wrap.append(out);
  n.addEventListener('pointerdown',()=>remember(),{signal:toolLife.signal});n.addEventListener('keydown',()=>remember(),{signal:toolLife.signal});
  n.addEventListener('input',()=>{fn(Number(n.value));out.value=Number(n.value).toFixed(step<1?1:0);schedule();},{signal:toolLife.signal});return wrap;
 }
 function choice(text,fn,cls='se-choice'){const b=el('button',cls,text);b.type='button';b.onclick=()=>{if(!pending)fn(b);};return b;}
 function palette(fn,selectedColor=drawColor){
  const n=el('div','se-palette');n.setAttribute('aria-label','Цвет');
  for(const c of ['#ffffff','#151d23','#56e4d3','#5fa9ff','#ba89ff','#f38ab1','#ffe08a','#ff7c62']){
   const b=choice('',()=>{fn(c);for(const x of n.children)x.setAttribute('aria-pressed',String(x===b));},'se-swatch');b.style.setProperty('--swatch',c);b.setAttribute('aria-label',`Цвет ${c}`);b.setAttribute('aria-pressed',String(c===selectedColor));n.append(b);
  }return n;
 }
 function newLayer(kind='text',value=''){
  if(!surface||surface.state.layers.length>=20){error.textContent='В одной сторис может быть до 20 надписей и стикеров.';return null;}
  remember();const layer={id:crypto.randomUUID(),kind,text:value,x:.5,y:.5,size:kind==='emoji'?.17:.07,rotation:0,font:'sans',color:'#ffffff',background:kind==='link',align:'center',url:''};surface.state.layers.push(layer);selected=layer.id;surface.paintLayers();return layer;
 }
 function sheetGesture(head){
  const sig=toolLife.signal;
  head.style.touchAction='none';
  head.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('button,input')||pending)return;e.preventDefault();toolGesture={id:e.pointerId,y:e.clientY,dy:0};head.setPointerCapture(e.pointerId);toolAnimation?.cancel();},{signal:sig});
  head.addEventListener('pointermove',e=>{const g=toolGesture;if(!g||g.id!==e.pointerId)return;e.preventDefault();g.dy=Math.max(0,e.clientY-g.y);toolbox.style.transform=`translate3d(0,${g.dy}px,0)`;document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:true}}));},{signal:sig});
  const end=e=>{const g=toolGesture;if(!g||g.id!==e.pointerId)return;toolGesture=null;if(e.type==='pointerup'&&g.dy>64){closeTools();return;}toolbox.style.transform='';if(g.dy&&toolbox.animate)toolAnimation=toolbox.animate([{transform:`translateY(${g.dy}px)`},{transform:'translateY(0)'}],{duration:140,easing:'ease-out'});finishGesture();};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])head.addEventListener(type,end,{signal:sig});
 }
 function openTools(kind){
  if(!ready||pending||!surface)return;
  finishGesture();preview=false;root.classList.remove('se-previewing');peek.setAttribute('aria-pressed','false');closeTools();
  toolLife=new AbortController();toolKind=kind;root.dataset.panel=kind;root.classList.add('se-tool-open');toolbox.dataset.kind=kind;toolbox.hidden=false;mode=kind==='draw'?'draw':'move';if(mode==='draw')clearSelection();updateButtons();
  const titles={crop:'Оформление',text:'Текст',stickers:'Стикеры',link:'Ссылка',draw:'Рисование',filters:'Фильтры',duration:'Длительность'};
  const top=el('header','se-toolbox-head'),grip=el('div','se-toolbox-grip'),body=el('div','se-tool-body');grip.setAttribute('aria-hidden','true');
  top.append(grip,el('h3','',titles[kind]),control('Готово','check',closeTools,'se-tool-done'));toolbox.append(top,body);if(kind!=='text')sheetGesture(top);document.dispatchEvent(new Event('sekkes-story-input-state'));
  if(kind!=='text'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&toolbox.animate){document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:true}}));toolAnimation=toolbox.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:160,easing:'cubic-bezier(.2,.7,.2,1)'});const currentAnimation=toolAnimation;currentAnimation.finished.then(()=>{if(toolAnimation===currentAnimation&&!pointers.size&&!toolGesture)document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));}).catch(()=>{});}
  const action=(name,symbol,fn)=>{const b=control(name,symbol,fn,'se-action');b.append(el('span','',name));return b;};
  if(kind==='crop'){
   const row=el('div','se-action-row');row.append(action('Повернуть','rotate',()=>{remember();surface.state.media.rotation=(surface.state.media.rotation+90)%360;autoFill();schedule();}),action('Сбросить','undo',()=>{remember();surface.state.media={x:.5,y:.5,scale:1,rotation:0};autoFill();schedule();}));body.append(row);
   const colors=el('div','se-backgrounds');for(const [id,name] of [['blur','Автофон'],['dark','Тёмный'],['light','Светлый'],['sea','Глубокий']]){const b=choice(name,()=>{remember();surface.state.background=id;for(const x of colors.children)x.setAttribute('aria-pressed',String(x===b));schedule();});b.dataset.background=id;b.setAttribute('aria-pressed',String(surface.state.background===id));colors.append(b);}body.append(colors);
  }else if(kind==='text'){
   let layer=surface.state.layers.find(l=>l.id===selected&&l.kind==='text');if(!layer)layer=newLayer();if(!layer){closeTools();return;}
   storyTextTools({host:body,layer,surface,remember,change:schedule,done:closeTools,signal:toolLife.signal});
  }else if(kind==='stickers'){
   body.append(action('Ссылка','link',()=>openTools('link')));
   const emojis=el('div','se-stickers');for(const value of ['❤️','✨','🌙','🔥','🌿','☀️','💬','⭐','😊','🫶','🎬','💡']){const b=choice(value,()=>{newLayer('emoji',value);closeTools();schedule();});b.setAttribute('aria-label',`Стикер ${value}`);emojis.append(b);}body.append(emojis);
  }else if(kind==='link'){
   const href=el('input');href.type='url';href.placeholder='https://…';href.setAttribute('aria-label','Адрес ссылки');const title=el('input');title.maxLength=80;title.placeholder='Название';title.setAttribute('aria-label','Название ссылки');
   body.append(label('Адрес',href),label('Название',title),action('Добавить ссылку','check',()=>{const value=storyLink(href.value);if(!value){error.textContent='Укажи ссылку с https:// или http://.';return;}const l=newLayer('link',title.value.trim()||'Открыть ссылку');if(l)l.url=value;error.textContent='';closeTools();schedule();}));
  }else if(kind==='draw'){
   const actions=el('div','se-action-row');actions.append(action('Отменить линию','undo',()=>{remember();surface.state.strokes.pop();schedule();}),action('Очистить','trash',()=>{remember();surface.state.strokes=[];schedule();}));body.append(palette(c=>{drawColor=c;}),range('Толщина',drawWidth,.002,.04,.001,v=>{drawWidth=v;}),actions);
  }else if(kind==='filters'){
   const list=el('div','se-filter-list');for(const [id,[name,filter]] of Object.entries(storyFilters)){
    const b=choice('',()=>{remember();surface.state.filter=id;for(const x of list.children)x.setAttribute('aria-pressed',String(x===b));schedule();},'se-filter');b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(surface.state.filter===id));
    const canvas=el('canvas');canvas.width=96;canvas.height=128;canvas.setAttribute('aria-hidden','true');canvas.style.filter=filter;
    try{const cx=canvas.getContext('2d'),w=surface.size.width,h=surface.size.height,scale=Math.max(96/w,128/h);cx.drawImage(surface.media,(96-w*scale)/2,(128-h*scale)/2,w*scale,h*scale);}catch{/* A neutral thumbnail remains until the decoder supplies a frame. */}
    b.append(canvas,el('span','',name));list.append(b);
   }body.append(list);
  }else if(kind==='duration'){
   if(surface.media.tagName==='VIDEO'){
    const d=surface.media.duration,win=storyWindow(surface.state,d);if(!Number.isFinite(d)||!d){closeTools();return;}
    const start=range('Начало, сек.',win.start,0,Math.max(0,d-.2),.1,v=>{surface.state.trim.start=v;if(surface.state.trim.end!=null&&surface.state.trim.end<=v){surface.state.trim.end=Math.min(d,v+.2);end.querySelector('input').value=surface.state.trim.end;end.querySelector('output').value=surface.state.trim.end.toFixed(1);}surface.media.currentTime=v;}),end=range('Конец, сек.',win.end,.2,d,.1,v=>{surface.state.trim.end=Math.max(surface.state.trim.start+.2,v);end.querySelector('input').value=surface.state.trim.end;});body.append(start,end);
   }else body.append(range('Секунды показа',surface.state.duration,3,15,1,v=>{surface.state.duration=v;}));
  }
 }
 function removeLayer(layer){remember();surface.state.layers=surface.state.layers.filter(l=>l.id!==layer.id);clearSelection();closeTools();schedule();}
 function autoFill(){if(!surface)return;const m=surface.state.media;m.x=.5;m.y=.5;m.scale=clamp(mediaGeometry(surface.size.width,surface.size.height,m).fill,.2,128);}
 function releaseMedia(){mediaLife?.abort();mediaLife=null;if(surface){const m=surface.media;if(m.tagName==='VIDEO'){m.pause();m.removeAttribute('src');m.load();}surface.dispose();surface.node.remove();surface=null;}if(url){URL.revokeObjectURL(url);url=null;}}
 function bindGestures(){
  const frame=surface.node,sig=mediaLife.signal;frame.tabIndex=0;frame.setAttribute('aria-label','Полотно сторис. Перемещение одним пальцем, масштаб и поворот двумя. Клавиши стрелок перемещают, плюс и минус меняют размер.');
  let before='',baseAngle=0,tapLayer=null,startedAt=null,moved=0,multi=false,suppressClickUntil=0;
  const point=e=>({x:e.clientX,y:e.clientY});
  function base(){
   const ps=[...pointers.values()];if(!ps.length)return;const mid=ps.length>1?{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}:ps[0],target=surface.state.layers.find(l=>l.id===selected)||surface.state.media;
   baseAngle=ps.length>1?Math.atan2(ps[1].y-ps[0].y,ps[1].x-ps[0].x):0;
   gesture={rect:frame.getBoundingClientRect(),mid,dist:ps.length>1?Math.max(1,Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y)):0,target,x:target.x,y:target.y,scale:target.scale||target.size,rotation:target.rotation,unitWidth:selected?1:mediaGeometry(surface.size.width,surface.size.height,{...target,scale:1}).width,stroke:null,media:!selected};
  }
  function snapMedia(){
   if(!surface||selected)return false;const m=surface.state.media,fill=clamp(mediaGeometry(surface.size.width,surface.size.height,{...m,scale:1}).fill,.2,128);
   const nearCenter=Math.abs(m.x-.5)<.055&&Math.abs(m.y-.5)<.055,nearScale=Math.abs(Math.log(Math.max(.001,m.scale)/Math.max(.001,fill)))<.09;
   if(!nearCenter&&!nearScale)return false;
   if(nearCenter){m.x=.5;m.y=.5;}if(nearScale)m.scale=fill;
   root.classList.remove('se-snapped');void root.offsetWidth;root.classList.add('se-snapped');setTimeout(()=>root.classList.remove('se-snapped'),180);
   try{navigator.vibrate?.(8)}catch{}schedule();return true;
  }
  frame.addEventListener('pointerdown',e=>{
   if(!ready||pending||preview||toolKind==='text'||e.button>0||pointers.size>=2)return;e.preventDefault();error.textContent='';
   if(!pointers.size){before=snapshot();const layer=e.target.closest('[data-layer-id]');clearSelection();if(mode!=='draw'&&layer)selected=layer.dataset.layerId;tapLayer=selected;startedAt=point(e);moved=0;multi=false;}else multi=true;
   pointers.set(e.pointerId,point(e));try{frame.setPointerCapture(e.pointerId);}catch{}base();
   if(mode==='draw'&&pointers.size===1&&surface.state.strokes.length<100){const r=gesture.rect;gesture.stroke={color:drawColor,width:drawWidth,points:[[clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)]]};surface.state.strokes.push(gesture.stroke);}
   document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:true}}));root.classList.add('se-adjusting');if(selected&&mode!=='draw'){trash.hidden=false;root.classList.add('se-layer-dragging');}schedule();
  },{signal:sig});
  frame.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId)||!gesture||pending)return;pointers.set(e.pointerId,point(e));const ps=[...pointers.values()],g=gesture,r=g.rect;
   // Media itself is intentionally inert to one finger. One-finger drag is reserved for text/stickers.
   moved=Math.max(moved,startedAt?Math.hypot(e.clientX-startedAt.x,e.clientY-startedAt.y):0);
   if(g.media&&ps.length<2&&!g.stroke)return;
   e.preventDefault();
   if(g.stroke&&ps.length===1){if(g.stroke.points.length<2000)g.stroke.points.push([clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)]);schedule();return;}
   const mid=ps.length>1?{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}:ps[0];let ratio=1,angle=0;
   if(ps.length>1&&g.dist){
    ratio=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y)/g.dist;angle=Math.atan2(ps[1].y-ps[0].y,ps[1].x-ps[0].x)-baseAngle;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
    g.target.rotation=g.rotation+angle*180/Math.PI;
    const unit=selected?1:mediaGeometry(surface.size.width,surface.size.height,{...g.target,scale:1}).width;
    const value=clamp(g.scale*ratio*g.unitWidth/unit,selected ? .025 : .2,selected ? .32 : 128);ratio=value*unit/(g.scale*g.unitWidth);if(selected)g.target.size=value;else g.target.scale=value;
   }
   // Rotate the vector in screen pixels, not normalized 9:16 coordinates.
   const vx=g.x*r.width-(g.mid.x-r.left),vy=g.y*r.height-(g.mid.y-r.top),c=Math.cos(angle),s=Math.sin(angle);
   g.target.x=clamp((mid.x-r.left+(vx*c-vy*s)*ratio)/r.width,selected?0:-3,selected?1:4);g.target.y=clamp((mid.y-r.top+(vx*s+vy*c)*ratio)/r.height,selected?0:-3,selected?1:4);
   if(selected){const tr=trash.getBoundingClientRect();trash.dataset.active=String(mid.x>=tr.left-36&&mid.x<=tr.right+36&&mid.y>=tr.top-36&&mid.y<=tr.bottom+36);}
   schedule();
  },{signal:sig});
  const end=e=>{
   if(!pointers.has(e.pointerId))return;const cancelled=e.type!=='pointerup',pt={x:e.clientX,y:e.clientY};pointers.delete(e.pointerId);if(pointers.size&&!cancelled){base();return;}
   const layer=selected&&surface.state.layers.find(l=>l.id===selected),tr=trash.getBoundingClientRect(),drop=!cancelled&&moved>6&&!trash.hidden&&pt.x>=tr.left-36&&pt.x<=tr.right+36&&pt.y>=tr.top-36&&pt.y<=tr.bottom+36;
   const tap=!cancelled&&!multi&&moved<6&&layer?.kind==='text'&&tapLayer===layer.id;
   const mediaGesture=gesture?.media&&multi&&!cancelled;finishGesture();if(mediaGesture)snapMedia();if(snapshot()!==before)remember(before);before='';suppressClickUntil=performance.now()+500;
   if(drop&&layer){removeLayer(layer);return;}if(tap){selected=layer.id;openTools('text');return;}schedule();
  };
  for(const t of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(t,end,{signal:sig});
  frame.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();return;}const l=surface.state.layers.find(l=>l.id===e.target.closest('[data-layer-id]')?.dataset.layerId);if(l?.kind==='text'){selected=l.id;openTools('text');}},{signal:sig});
  frame.addEventListener('wheel',e=>{if(!ready||pending||preview)return;e.preventDefault();remember();surface.state.media.scale=clamp(surface.state.media.scale*Math.exp(-e.deltaY*.002),.2,128);schedule();},{passive:false,signal:sig});
  frame.addEventListener('dragstart',e=>e.preventDefault(),{signal:sig});frame.addEventListener('contextmenu',e=>e.preventDefault(),{signal:sig});
  frame.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||pending)return;const target=surface.state.layers.find(l=>l.id===selected)||surface.state.media;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Delete'].includes(e.key)){e.preventDefault();remember();if(e.key==='Delete'&&selected){removeLayer(target);return;}if(e.key==='ArrowLeft')target.x-=.01;if(e.key==='ArrowRight')target.x+=.01;if(e.key==='ArrowUp')target.y-=.01;if(e.key==='ArrowDown')target.y+=.01;target.x=clamp(target.x,selected?0:-3,selected?1:4);target.y=clamp(target.y,selected?0:-3,selected?1:4);if(['+','-'].includes(e.key)){const k=selected?'size':'scale';target[k]=clamp(target[k]*(e.key==='+'?1.05:.95),selected ? .025 : .2,selected ? .32 : 128);}schedule();}
  },{signal:sig});
 }
 function loaded(selectedFile){
  document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));root.classList.remove('se-adjusting');
  const ticket=++revision;ready=false;closeTools();clearSelection();pointers.clear();gesture=null;releaseMedia();history.length=0;file=selectedFile;mediaLife=new AbortController();
  const isVideo=file.type.startsWith('video/'),m=el(isVideo?'video':'img');if(isVideo){m.playsInline=true;m.preload='auto';m.muted=true;}else{m.alt='Фото для сторис';m.decoding='async';}
  surface=storySurface({media:m,composition:{muted:isVideo},interactive:true,onReady:()=>{if(!alive()||revision!==ticket||ready)return;autoFill();surface.render();ready=true;root.dataset.ready='true';updateButtons();}});
  root.dataset.ready='false';
  work.prepend(surface.node);pick.hidden=true;toolbar.hidden=false;footer.hidden=false;sound.hidden=!isVideo;playback.hidden=!isVideo;bindGestures();
  m.addEventListener('error',()=>{if(alive()&&revision===ticket){ready=false;publish.disabled=true;error.textContent='Не удалось открыть файл. Выбери другой — исходный файл не изменён.';}},{signal:mediaLife.signal});
  if(isVideo){
   for(const event of ['play','pause'])m.addEventListener(event,()=>{playback.setAttribute('aria-label',m.paused?'Продолжить видео':'Пауза видео');playback.innerHTML=icon(m.paused?'play':'stop');},{signal:mediaLife.signal});
   m.addEventListener('loadeddata',()=>{if(alive()&&revision===ticket)m.play().catch(()=>{});},{signal:mediaLife.signal});
   m.addEventListener('timeupdate',()=>{if(!alive()||revision!==ticket)return;const w=storyWindow(surface.state,m.duration);if(w.end>0&&(m.currentTime>=w.end||m.currentTime<w.start-.1)){m.currentTime=w.start;if(!document.hidden)m.play().catch(()=>{});}},{signal:mediaLife.signal});
  }
  url=URL.createObjectURL(file);m.src=url;error.textContent='';updateButtons();
 }
 input.addEventListener('change',()=>{if(!alive()||pending)return;const files=[...input.files||[]];if(!files.length)return;try{validateMedia('story',files);loaded(files[0]);}catch(e){error.textContent=errorText(e);input.value='';}},{signal});
 async function commit(){
  if(!alive()||pending||!ready||!file||!surface)return;
  pending=true;onPending(true);closeTools();root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,textarea').forEach(n=>n.disabled=true);error.textContent='';
  try{validateMedia('story',[file]);const story=surface.export();story.layers=story.layers.filter(l=>l.text.trim());const ok=await save({kind:'story',files:[file],caption:'',story});if(alive()&&!ok)error.textContent='Не удалось сохранить сторис. Попробуй ещё раз.';}
  catch(e){if(alive())error.textContent=errorText(e);}finally{pending=false;onPending(false);if(alive()){root.removeAttribute('aria-busy');root.querySelectorAll('button,input,textarea').forEach(n=>n.disabled=false);updateButtons();}}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&surface?.media.tagName==='VIDEO')surface.media.pause();},{signal});
 document.addEventListener('sekkes-orientation-reset',finishGesture,{signal});
 dialog.addEventListener('cancel',e=>{if(toolKind){e.preventDefault();e.stopImmediatePropagation();closeTools();}},{capture:true,signal});
 return {node:root,dispose(){if(disposed)return;disposed=true;revision++;life.abort();toolAnimation?.cancel();toolLife?.abort();cancelAnimationFrame(raf);pointers.clear();gesture=null;releaseMedia();document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));root.remove();}};
}

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
 const ratio=el('span','se-ratio','9:16'),toolbar=el('nav','se-toolbar');toolbar.setAttribute('aria-label','Инструменты сторис');
 const move=control('Кадрирование','crop',()=>openTools('crop'));
 const text=control('Текст','text',()=>openTools('text'));
 const stickers=control('Стикеры','smile',()=>openTools('stickers'));
 const draw=control('Рисовать','edit',()=>openTools('draw'));
 const filters=control('Фильтры','spark',()=>openTools('filters'));
 const sound=control('Звук видео','sound',()=>{if(!ready)return;remember();surface.state.muted=!surface.state.muted;surface.media.muted=surface.state.muted;updateButtons();});sound.hidden=true;
 const playback=control('Пауза видео','stop',()=>{if(!surface)return;const m=surface.media;if(m.paused)m.play().catch(()=>{});else m.pause();});playback.hidden=true;
 const clip=control('Длительность','clock',()=>openTools('duration'));
 const undo=control('Отменить изменение','undo',()=>{if(pending||!surface||!history.length)return;Object.assign(surface.state,normalizeStory(JSON.parse(history.pop())));selected=null;closeTools();surface.render();surface.media.muted=surface.state.muted;updateButtons();});
 toolbar.append(move,text,stickers,draw,filters,sound,playback,clip,undo);
 const selection=el('div','se-selection');selection.hidden=true;selection.append(control('Удалить выбранное','trash',()=>{const l=surface?.state.layers.find(x=>x.id===selected);if(l)removeLayer(l);}),control('Повернуть выбранное','rotate',()=>{const l=surface?.state.layers.find(x=>x.id===selected);if(l){remember();l.rotation+=15;schedule();}}));
 work.append(pick,ratio,toolbar,selection);footer.append(change,peek,publish);root.append(input,work,toolbox,error,footer);host.replaceChildren(root);toolbox.hidden=true;toolbar.hidden=true;ratio.hidden=true;footer.hidden=true;
 const snapshot=()=>surface?JSON.stringify(surface.export()):'';
 function remember(value=snapshot()){if(!value)return;if(history.at(-1)!==value)history.push(value);if(history.length>30)history.shift();updateButtons();}
 function paint(){raf=0;if(!alive()||!surface)return;surface.render();if(selected)surface.node.querySelector(`[data-layer-id="${selected}"]`)?.setAttribute('data-selected','true');selection.hidden=!selected;}
 function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
 function updateButtons(){if(!surface)return;sound.setAttribute('aria-pressed',String(!surface.state.muted));sound.style.opacity=surface.state.muted?'.5':'1';undo.disabled=!history.length;publish.disabled=!ready||pending;root.dataset.tool=mode;}
 function clearSelection(){selected=null;selection.hidden=true;surface?.node.querySelectorAll('[data-selected]').forEach(n=>n.removeAttribute('data-selected'));}
 function closeTools(){toolLife?.abort();toolLife=null;toolbox.hidden=true;toolbox.replaceChildren();if(mode==='draw')mode='move';updateButtons();}
 function label(text,node){const wrap=el('label','se-field');wrap.append(el('span','',text),node);return wrap;}
 function range(name,value,min,max,step,fn){const n=el('input');n.type='range';n.min=min;n.max=max;n.step=step;n.value=value;n.setAttribute('aria-label',name);n.addEventListener('pointerdown',()=>remember(),{signal:toolLife.signal});n.addEventListener('keydown',()=>remember(),{signal:toolLife.signal});n.addEventListener('input',()=>{fn(Number(n.value));schedule();},{signal:toolLife.signal});return label(name,n);}
 function choice(labelText,fn){const b=el('button','se-choice',labelText);b.type='button';b.onclick=()=>{if(!pending)fn();};return b;}
 function palette(fn,selectedColor=drawColor){const n=el('div','se-palette');for(const c of ['#ffffff','#151d23','#56e4d3','#5fa9ff','#ba89ff','#f38ab1','#ffe08a','#ff7c62']){const b=choice(c,()=>fn(c));b.style.setProperty('--swatch',c);b.classList.add('se-swatch');b.setAttribute('aria-label',`Цвет ${c}`);b.setAttribute('aria-pressed',String(c===selectedColor));n.append(b);}return n;}
 function newLayer(kind='text',value=''){
  if(!surface||surface.state.layers.length>=20){error.textContent='В одной сторис может быть до 20 надписей и стикеров.';return null;}
  remember();const layer={id:crypto.randomUUID(),kind,text:value,x:.5,y:.5,size:kind==='emoji'?.17:.07,rotation:0,font:'sans',color:'#ffffff',background:kind==='link',align:'center',url:''};surface.state.layers.push(layer);selected=layer.id;surface.render();return layer;
 }
 function openTools(kind){
  if(!ready||pending||!surface)return;preview=false;root.classList.remove('se-previewing');closeTools();toolLife=new AbortController();toolbox.hidden=false;mode=kind==='draw'?'draw':'move';if(mode==='draw')clearSelection();updateButtons();
  const titles={crop:'Кадрирование',text:'Текст',stickers:'Стикеры',draw:'Рисование',filters:'Фильтры',duration:'Длительность'};
  const top=el('header','se-toolbox-head');top.append(el('h3','',titles[kind]),control('Готово','check',()=>{document.activeElement?.blur();closeTools();},'se-tool-done'));toolbox.append(top);
  if(kind==='crop'){
   const row=el('div','se-choice-row');row.append(choice('Вписать целиком',()=>fit(false)),choice('Заполнить экран',()=>fit(true)),choice('Повернуть',()=>{remember();surface.state.media.rotation=(surface.state.media.rotation+90)%360;surface.state.media.scale=1;surface.state.media.x=.5;surface.state.media.y=.5;schedule();}),choice('Сбросить',()=>{remember();surface.state.media={x:.5,y:.5,scale:1,rotation:0};schedule();}));
   toolbox.append(row,range('Масштаб',surface.state.media.scale,.2,8,.01,v=>{surface.state.media.scale=v;}));
   const backgrounds=el('div','se-choice-row');for(const [id,name] of [['blur','Размытый фон'],['dark','Тёмный'],['light','Светлый'],['sea','Глубокий']])backgrounds.append(choice(name,()=>{remember();surface.state.background=id;schedule();}));toolbox.append(backgrounds);
  }else if(kind==='text'){
   let layer=surface.state.layers.find(l=>l.id===selected&&l.kind==='text');if(!layer)layer=newLayer();if(!layer)return;
   const area=el('textarea');area.rows=2;area.maxLength=500;area.placeholder='Напиши текст';area.value=layer.text;area.setAttribute('aria-label','Текст на сторис');remember();area.addEventListener('input',()=>{layer.text=area.value;schedule();},{signal:toolLife.signal});
   const options=el('div','se-choice-row');for(const [id,name] of [['sans','Современный'],['serif','Литературный'],['mono','Моно']])options.append(choice(name,()=>{remember();layer.font=id;schedule();}));
   options.append(choice('Подложка',()=>{remember();layer.background=!layer.background;schedule();}),choice('Выравнивание',()=>{remember();layer.align=layer.align==='center'?'left':layer.align==='left'?'right':'center';schedule();}),choice('Удалить',()=>removeLayer(layer)));
   toolbox.append(label('Надпись',area),options,palette(c=>{remember();layer.color=c;schedule();},layer.color),range('Размер текста',layer.size,.025,.25,.005,v=>{layer.size=v;}));
   // Only an explicit text action focuses the input; initial sheet opening never does.
   area.focus({preventScroll:true});
  }else if(kind==='stickers'){
   const emojis=el('div','se-stickers');for(const s of ['❤️','✨','🌙','🔥','🌿','☀️','💬','⭐','😊','🫶','🎬','💡'])emojis.append(choice(s,()=>{newLayer('emoji',s);closeTools();schedule();}));toolbox.append(emojis);
   const href=el('input');href.type='url';href.placeholder='https://…';href.setAttribute('aria-label','Адрес ссылки');const title=el('input');title.maxLength=80;title.placeholder='Название ссылки';title.setAttribute('aria-label','Название ссылки');
   toolbox.append(label('Ссылка',href),title,choice('Добавить ссылку',()=>{const url=storyLink(href.value);if(!url){error.textContent='Укажи ссылку с https:// или http://.';return;}const l=newLayer('link',title.value.trim()||'Открыть ссылку');if(l)l.url=url;error.textContent='';closeTools();schedule();}));
  }else if(kind==='draw'){
   toolbox.append(palette(c=>{drawColor=c;}),range('Толщина линии',drawWidth,.002,.04,.001,v=>{drawWidth=v;}),choice('Закончить рисование',closeTools),choice('Убрать рисунок',()=>{remember();surface.state.strokes=[];schedule();}));
  }else if(kind==='filters'){
   const list=el('div','se-choice-row');for(const [id,[name]] of Object.entries(storyFilters))list.append(choice(name,()=>{remember();surface.state.filter=id;schedule();}));toolbox.append(list);
  }else if(kind==='duration'){
   if(surface.media.tagName==='VIDEO'){
    const d=surface.media.duration,win=storyWindow(surface.state,d);
    if(!Number.isFinite(d)||!d)return;
    toolbox.append(range('Начало видео, секунды',win.start,0,Math.max(0,d-.2),.1,v=>{surface.state.trim.start=v;if(surface.state.trim.end!=null&&surface.state.trim.end<=v)surface.state.trim.end=Math.min(d,v+.2);surface.media.currentTime=v;}),range('Конец видео, секунды',win.end,.2,d,.1,v=>{surface.state.trim.end=Math.max(surface.state.trim.start+.2,v);}));
   }else toolbox.append(range('Секунды показа',surface.state.duration,3,15,1,v=>{surface.state.duration=v;}));
  }
 }
 function removeLayer(layer){remember();surface.state.layers=surface.state.layers.filter(l=>l.id!==layer.id);clearSelection();closeTools();schedule();}
 function fit(fill){if(!surface)return;remember();const m=surface.state.media;m.x=.5;m.y=.5;m.scale=1;if(fill)m.scale=clamp(mediaGeometry(surface.size.width,surface.size.height,m).fill,.2,8);schedule();}
 function releaseMedia(){mediaLife?.abort();mediaLife=null;if(surface){const m=surface.media;if(m.tagName==='VIDEO'){m.pause();m.removeAttribute('src');m.load();}surface.dispose();surface.node.remove();surface=null;}if(url){URL.revokeObjectURL(url);url=null;}}
 function bindGestures(){
  const frame=surface.node,sig=mediaLife.signal;frame.tabIndex=0;frame.setAttribute('aria-label','Полотно сторис 9:16. Перемещай одним пальцем, меняй размер двумя.');
  function position(e){return {x:e.clientX,y:e.clientY};}
  function base(){
   const ps=[...pointers.values()];if(!ps.length)return;const mid=ps.length>1?{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}:ps[0];
   const target=surface.state.layers.find(l=>l.id===selected)||surface.state.media;
   gesture={rect:frame.getBoundingClientRect(),mid,dist:ps.length>1?Math.max(1,Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y)):0,target,x:target.x,y:target.y,scale:target.scale||target.size,stroke:null};
  }
  frame.addEventListener('pointerdown',e=>{
   if(!ready||pending||preview||e.button>0)return;e.preventDefault();error.textContent='';
   if(!pointers.size){remember();const layer=e.target.closest('[data-layer-id]');clearSelection();if(mode!=='draw'&&layer)selected=layer.dataset.layerId;}
   pointers.set(e.pointerId,position(e));try{frame.setPointerCapture?.(e.pointerId);}catch{/* The pointer may have been cancelled by the operating system. */}base();
   if(mode==='draw'&&pointers.size===1&&surface.state.strokes.length<100){const r=gesture.rect;gesture.stroke={color:drawColor,width:drawWidth,points:[[clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)]]};surface.state.strokes.push(gesture.stroke);}
   document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:true}}));root.classList.add('se-adjusting');schedule();
  },{signal:sig});
  frame.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId)||!gesture||pending)return;e.preventDefault();pointers.set(e.pointerId,position(e));const ps=[...pointers.values()],g=gesture,r=g.rect;
   if(g.stroke&&ps.length===1){if(g.stroke.points.length<2000)g.stroke.points.push([clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)]);schedule();return;}
   const mid=ps.length>1?{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}:ps[0];let ratio=1;
   if(ps.length>1&&g.dist){const s=clamp(g.scale*Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y)/g.dist,selected ? .025 : .2,selected ? .32 : 8);ratio=s/g.scale;if(selected)g.target.size=s;else g.target.scale=s;}
   const mx=(mid.x-r.left)/r.width,my=(mid.y-r.top)/r.height,bx=(g.mid.x-r.left)/r.width,by=(g.mid.y-r.top)/r.height;
   g.target.x=clamp(mx-(bx-g.x)*ratio,selected?0:-3,selected?1:4);g.target.y=clamp(my-(by-g.y)*ratio,selected?0:-3,selected?1:4);schedule();
  },{signal:sig});
  const end=e=>{if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pointers.size){base();return;}gesture=null;root.classList.remove('se-adjusting');document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));schedule();};
  for(const t of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(t,end,{signal:sig});
  frame.addEventListener('dblclick',e=>{const l=surface.state.layers.find(l=>l.id===e.target.closest('[data-layer-id]')?.dataset.layerId);if(l?.kind==='text'){selected=l.id;openTools('text');}},{signal:sig});
  frame.addEventListener('wheel',e=>{if(!ready||pending||preview)return;e.preventDefault();remember();surface.state.media.scale=clamp(surface.state.media.scale*Math.exp(-e.deltaY*.002),.2,8);schedule();},{passive:false,signal:sig});
  frame.addEventListener('dragstart',e=>e.preventDefault(),{signal:sig});frame.addEventListener('contextmenu',e=>e.preventDefault(),{signal:sig});
  frame.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||pending)return;const target=surface.state.layers.find(l=>l.id===selected)||surface.state.media;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Delete'].includes(e.key)){e.preventDefault();remember();if(e.key==='Delete'&&selected){removeLayer(target);return;}if(e.key==='ArrowLeft')target.x-=.01;if(e.key==='ArrowRight')target.x+=.01;if(e.key==='ArrowUp')target.y-=.01;if(e.key==='ArrowDown')target.y+=.01;target.x=clamp(target.x,selected?0:-3,selected?1:4);target.y=clamp(target.y,selected?0:-3,selected?1:4);if(['+','-'].includes(e.key)){const k=selected?'size':'scale';target[k]=clamp(target[k]*(e.key==='+'?1.05:.95),selected ? .025 : .2,selected ? .32 : 8);}schedule();}
  },{signal:sig});
 }
 function loaded(selectedFile){
  document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));root.classList.remove('se-adjusting');
  const ticket=++revision;ready=false;closeTools();clearSelection();pointers.clear();gesture=null;releaseMedia();history.length=0;file=selectedFile;mediaLife=new AbortController();
  const isVideo=file.type.startsWith('video/'),m=el(isVideo?'video':'img');if(isVideo){m.playsInline=true;m.preload='auto';m.muted=true;}else{m.alt='Фото для сторис';m.decoding='async';}
  surface=storySurface({media:m,composition:{muted:isVideo},interactive:true,onReady:()=>{if(!alive()||revision!==ticket)return;ready=true;updateButtons();}});
  const guides=el('div','se-guide');guides.setAttribute('aria-hidden','true');guides.append(el('span','se-guide-center'));surface.node.append(guides);
  work.prepend(surface.node);pick.hidden=true;toolbar.hidden=false;ratio.hidden=false;footer.hidden=false;sound.hidden=!isVideo;playback.hidden=!isVideo;bindGestures();
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
 document.addEventListener('sekkes-orientation-reset',()=>{pointers.clear();gesture=null;root.classList.remove('se-adjusting');document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));},{signal});
 return {node:root,dispose(){if(disposed)return;disposed=true;revision++;life.abort();toolLife?.abort();cancelAnimationFrame(raf);pointers.clear();gesture=null;releaseMedia();document.dispatchEvent(new CustomEvent('sekkes-sheet-motion',{detail:{owner:root,active:false}}));root.remove();}};
}

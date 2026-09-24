import {copyText} from './clipboard.mjs';
import {storySurface,normalizeStory,storyWindow} from './story-composition.mjs';
import {smallStoryAvatar} from './story-avatar.mjs';
// Account-local media presentation only. Storage and social publishing are not owned here.
import {el,icon} from './components.mjs';
export const feedPosts=posts=>(posts||[]).filter(p=>['post','photo','video','carousel'].includes(p.kind));
export const storyPosts=posts=>(posts||[]).filter(p=>p.kind==='story');
const videoFile=file=>file?.type?.startsWith('video/');
const dateLabel=at=>{const d=new Date(at);return Number.isNaN(d.valueOf())?'':d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});};
function control(label,symbol,action,cls='pm-control'){
 const b=el('button',cls);b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(symbol);b.onclick=action;return b;
}
function assets(){const urls=new Set();return {url(blob){const u=URL.createObjectURL(blob);urls.add(u);return u;},dispose(){for(const u of urls)URL.revokeObjectURL(u);urls.clear();}};}
function person(profile,account,pool,onStory){
 const n=el('div','pm-person');n.append(smallStoryAvatar({profile,account,url:b=>pool.url(b),onOpen:onStory}));
 n.append(el('span','pm-name',profile?.name||account?.user_metadata?.full_name||'Твой профиль'));return n;
}
function failure(node,label='Не удалось открыть файл. Исходный материал сохранён.'){const n=el('p','pm-error',label);n.setAttribute('role','status');node.append(n);}

// One shared vertical publication stream for the Feed tab and a post opened from the grid.
export function createPostFeed({posts,profile,account,scrollRoot,onVideo,onRemove,onStory,onChange,notify=()=>{}}){
 const items=feedPosts(posts),node=el('div','pm-feed'),pool=assets(),life=new AbortController(),{signal}=life;
 node.setAttribute('aria-label','Публикации');const records=[],captionChecks=[];let active=true,disposed=false;
 const pauseRecord=r=>{if(r.video&&!r.video.paused){r.systemPause=true;r.video.pause();}};
 const pause=()=>records.forEach(pauseRecord);
 const safePlay=v=>{if(active&&!document.hidden&&node.isConnected&&!v.dataset.userPaused)v.play().catch(()=>{});};
 function chooseVideo(){
  if(!active||document.hidden||!node.isConnected){pause();return;}
  const candidate=records.filter(r=>r.video&&r.ratio>.6).sort((a,b)=>b.ratio-a.ratio)[0];
  for(const r of records)if(r.video){if(r===candidate)safePlay(r.video);else pauseRecord(r);}
 }
 const visibility=new IntersectionObserver(entries=>{for(const e of entries){const r=records.find(r=>r.article===e.target);if(r)r.ratio=e.intersectionRatio;}chooseVideo();},{root:scrollRoot,threshold:[0,.3,.6,.8,1]});
 const nearby=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const r=records.find(r=>r.article===e.target);r?.load();nearby.unobserve(e.target);}},{root:scrollRoot,rootMargin:'600px 0px'});
 for(const post of items){
  const article=el('article','pm-post');article.dataset.postId=post.id;article.dataset.kind=post.kind;
  article.setAttribute('aria-label',post.caption||'Публикация');
  const head=el('header','pm-post-head');head.append(person(profile,account,pool,onStory));
  const menu=el('details','pm-menu'),summary=el('summary','pm-control');summary.setAttribute('aria-label','Действия с публикацией');summary.innerHTML=icon('menu');
  const remove=el('button','pm-remove','Удалить');remove.type='button';remove.onclick=async()=>{remove.disabled=true;try{await onRemove(post);}finally{remove.disabled=false;menu.open=false;}};menu.append(summary,remove);head.append(menu);
  const frame=el('div','pm-frame'),gallery=el('div','pm-gallery');gallery.setAttribute('aria-label',post.kind==='carousel'?'Карусель':'Медиа публикации');frame.append(gallery);
  const r={article,ratio:0,video:null,loaded:false,load:null};let index=0;
  const resize=()=>{const m=slides[index]?.m,w=m?.naturalWidth||m?.videoWidth,h=m?.naturalHeight||m?.videoHeight;if(w>0&&h>0){gallery.style.aspectRatio=`${w} / ${h}`;article.dataset.orientation=w>h?'landscape':w<h?'portrait':'square';}};
  const slides=[];for(const [i,file] of post.files.entries()){
   const slide=el('div','pm-slide'),m=el(videoFile(file)?'video':'img');
   if(videoFile(file)){m.controls=true;m.playsInline=true;m.muted=true;m.loop=true;m.preload='metadata';r.video=m;
    m.addEventListener('play',()=>{delete m.dataset.userPaused;if(!active||document.hidden||!node.isConnected){pauseRecord(r);return;}for(const other of records)if(other.video&&other.video!==m)pauseRecord(other);},{signal});
    m.addEventListener('pause',()=>{if(r.systemPause)r.systemPause=false;else m.dataset.userPaused='true';},{signal});
   }else{m.alt=post.caption||`Фото ${i+1}`;m.decoding='async';}
   m.addEventListener(videoFile(file)?'loadedmetadata':'load',resize,{signal});
   m.addEventListener('error',()=>{if(!slide.querySelector('.pm-error'))failure(slide);},{signal});slide.append(m);gallery.append(slide);slides.push({m,file});
  }
  r.load=()=>{if(r.loaded||disposed)return;r.loaded=true;slides.forEach(({m,file})=>{m.src=pool.url(file);});};
  if(post.kind==='video')frame.append(control('Открыть видео на весь экран','video',()=>onVideo(post),'pm-control pm-expand'));
  if(post.files.length>1){
   gallery.tabIndex=0;const count=el('span','pm-count'),dots=el('div','pm-dots');dots.setAttribute('aria-label','Слайды карусели');
   const select=i=>gallery.scrollTo({left:i*gallery.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   const prev=control('Предыдущее фото','back',()=>select(Math.max(0,index-1)),'pm-control pm-prev'),next=control('Следующее фото','arrow',()=>select(Math.min(post.files.length-1,index+1)),'pm-control pm-next');
   post.files.forEach((_,i)=>dots.append(control(`Фото ${i+1} из ${post.files.length}`,'photo',()=>select(i),'pm-dot')));
   const sync=()=>{index=Math.max(0,Math.min(post.files.length-1,Math.round(gallery.scrollLeft/Math.max(1,gallery.clientWidth))));resize();count.textContent=`${index+1} / ${post.files.length}`;prev.disabled=index===0;next.disabled=index===post.files.length-1;[...dots.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));};
   gallery.addEventListener('scroll',sync,{passive:true,signal});gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(Math.max(0,Math.min(post.files.length-1,index+(e.key==='ArrowRight'?1:-1))));}},{signal});
   frame.append(prev,next,count);article.append(head,frame,dots);sync();
  }else {article.append(head);if(post.files.length)article.append(frame);}
  const foot=el('footer','pm-post-foot'),actions=el('div','pm-actions');actions.setAttribute('aria-label','Действия с публикацией');
  const toggle=(field,label,symbol)=>{let value=post[field]===true;const b=control(label,symbol,async()=>{b.disabled=true;try{if(await onChange?.(post,field,!value)){value=!value;b.setAttribute('aria-pressed',String(value));}}catch(e){notify(e.message||'Не удалось сохранить.');}finally{b.disabled=false;}});b.setAttribute('aria-pressed',String(value));return b;};
  if(onChange)actions.append(toggle('liked','Нравится — на этом устройстве','heart'));
  const share=control('Поделиться','send',async()=>{try{const files=post.files.map((blob,i)=>new File([blob],`sekkes-${i+1}.${blob.type.split('/')[1]?.replace('jpeg','jpg')||'bin'}`,{type:blob.type}));const payload={text:post.caption||'',...(files.length?{files}:{})};if(navigator.share&&(!files.length||navigator.canShare?.({files})))await navigator.share(payload);else if(post.caption){await copyText(post.caption);notify('Подпись скопирована. Отправка файлов недоступна в этом браузере.');}else notify('Отправка файлов недоступна в этом браузере.');}catch(e){if(e.name!=='AbortError')notify('Не удалось поделиться публикацией.');}});actions.append(share);
  if(post.caption)actions.append(control('Скопировать подпись','copy',async()=>{try{await copyText(post.caption);notify('Подпись скопирована.');}catch{notify('Не удалось скопировать подпись.');}}));
  if(onChange){const save=toggle('saved','Сохранить в избранное на этом устройстве','bookmark');save.classList.add('pm-save');actions.append(save);}
  foot.append(actions);
  if(post.caption){const caption=el('p','pm-caption',post.caption);caption.id=`caption-${crypto.randomUUID()}`;caption.dataset.collapsed='true';const more=el('button','pm-caption-toggle','ещё');more.type='button';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',caption.id);more.onclick=()=>{const expanded=more.getAttribute('aria-expanded')!=='true';more.setAttribute('aria-expanded',String(expanded));caption.dataset.collapsed=String(!expanded);more.textContent=expanded?'свернуть':'ещё';if(!expanded)queueCaptions();};foot.append(caption,more);captionChecks.push({caption,more});}
  article.append(foot);
  const label=dateLabel(post.at);if(label){const time=el('time','pm-date',label);time.dateTime=post.at;article.append(time);}
  node.append(article);records.push(r);visibility.observe(article);nearby.observe(article);
 }
 if(!items.length)node.append(el('p','pm-empty','Здесь появятся твои посты, фото, видео и карусели. Сторис остаются в сетке профиля.'));
 const measureCaptions=()=>{for(const {caption,more} of captionChecks)if(caption.dataset.collapsed==='true')more.hidden=caption.scrollHeight<=caption.clientHeight+1;};
 let captionFrame=0,captionWidth=-1;const queueCaptions=()=>{if(!disposed&&!captionFrame)captionFrame=requestAnimationFrame(()=>{captionFrame=0;if(!disposed)measureCaptions();});};
 const captionObserver=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width!==captionWidth){captionWidth=width;queueCaptions();}});captionObserver.observe(node);document.fonts?.ready.then(queueCaptions);
 document.addEventListener('visibilitychange',chooseVideo,{signal});
 return {node,setActive(value){active=value;chooseVideo();},jump(id){const r=records.find(r=>r.article.dataset.postId===id);if(!r)return;r.load();const top=r.article.getBoundingClientRect().top-scrollRoot.getBoundingClientRect().top+scrollRoot.scrollTop;scrollRoot.scrollTo({top,behavior:'instant'});},dispose(){if(disposed)return;disposed=true;active=false;pause();life.abort();captionObserver.disconnect();cancelAnimationFrame(captionFrame);visibility.disconnect();nearby.disconnect();for(const r of records)r.article.querySelectorAll('video').forEach(v=>{v.removeAttribute('src');v.load();});pool.dispose();}};
}

// Full-viewport stories and vertical video viewing share cleanup, not publication semantics.
export function createSequence({posts,startId,profile,account,mode='story',close,onRemove}){
 const items=mode==='story'?storyPosts(posts):feedPosts(posts).filter(p=>p.kind==='video');
 const root=el('div',`pm-sequence pm-${mode}`),life=new AbortController(),{signal}=life,pool=assets();
 const header=el('header','pm-sequence-head'),progress=el('div','pm-progress'),stage=el('div','pm-sequence-stage'),foot=el('footer','pm-sequence-foot');
 let systemPause=false,composition=null,layout=null;
 let index=Math.max(0,items.findIndex(p=>p.id===startId)),current=null,currentPool=null,ready=false,failed=false,manual=false,holding=false,muted=true,active=true,elapsed=0,last=0,raf=0,disposed=false,gesture=null,holdTimer=0,mediaLife=null;
 const play=control('Пауза','stop',()=>{manual=!manual;sync();}),sound=control('Включить звук','sound',()=>{muted=!muted;if(current?.tagName==='VIDEO')current.muted=muted;sync();});
 const counter=el('span','pm-sequence-count');counter.setAttribute('aria-live','polite');
 header.append(person(profile,account,pool),play,sound,control('Закрыть','close',close,'pm-control profile-dialog-close'));
 const caption=el('p','pm-caption'),stamp=el('time','pm-date');
 const previous=control('Предыдущая публикация','back',()=>advance(-1)),next=control('Следующая публикация','arrow',()=>advance(1));
 const actions=el('details','pm-menu'),summary=el('summary','pm-control');summary.setAttribute('aria-label','Действия с материалом');summary.innerHTML=icon('menu');const remove=el('button','pm-remove','Удалить');remove.type='button';
 remove.onclick=async()=>{manual=true;sync();remove.disabled=true;try{await onRemove(items[index]);}finally{remove.disabled=false;actions.open=false;}};
 actions.append(summary,remove);actions.addEventListener('toggle',()=>{if(actions.open){manual=true;sync();}},{signal});
 foot.append(caption,stamp,previous,counter,next,actions);root.append(progress,header,stage,foot);
 if(mode==='story'){progress.setAttribute('aria-label','Прогресс сторис');for(let i=0;i<items.length;i++){const segment=el('span','pm-segment');segment.append(el('span','pm-fill'));progress.append(segment);}}
 const canRun=()=>active&&!disposed&&root.isConnected&&!document.hidden&&!manual&&!holding&&ready&&!failed;
 function paint(fraction){for(let i=0;i<progress.children.length;i++)progress.children[i].firstChild.style.transform=`scaleX(${i<index?1:i===index?Math.max(0,Math.min(1,fraction)):0})`;}
 function sync(){
  const label=manual?'Продолжить':'Пауза';if(play.getAttribute('aria-label')!==label){play.setAttribute('aria-label',label);play.title=label;play.innerHTML=icon(manual?'play':'stop');}
  play.setAttribute('aria-pressed',String(manual));sound.setAttribute('aria-pressed',String(!muted));sound.setAttribute('aria-label',muted?'Включить звук':'Выключить звук');sound.title=muted?'Включить звук':'Выключить звук';sound.style.opacity=muted?'.55':'1';
  if(current?.tagName==='VIDEO'){if(canRun()){const playing=current;playing.play().catch(()=>{if(!disposed&&current===playing&&canRun()){manual=true;play.setAttribute('aria-label','Продолжить');play.innerHTML=icon('play');}});}else if(!current.paused){systemPause=true;current.pause();}}
  last=0;if(mode==='story'&&canRun()&&!raf)raf=requestAnimationFrame(tick);
 }
 function tick(t){
  raf=0;if(!canRun()){last=0;return;}
  if(mode==='story'){
   if(current.tagName==='VIDEO'){const win=storyWindow(composition||normalizeStory(),current.duration);paint(win.end>win.start?(current.currentTime-win.start)/(win.end-win.start):0);if(win.end>0&&current.currentTime>=win.end-.03){advance(1,true);return;}}
   else{if(last)elapsed+=Math.min(t-last,100);const duration=(composition?.duration||5)*1000;paint(elapsed/duration);if(elapsed>=duration){advance(1,true);return;}}
  }
  last=t;raf=requestAnimationFrame(tick);
 }
 function show(){
  cancelAnimationFrame(raf);raf=0;last=0;elapsed=0;ready=false;failed=false;manual=false;systemPause=false;holding=false;gesture=null;clearTimeout(holdTimer);mediaLife?.abort();mediaLife=new AbortController();
  if(current?.tagName==='VIDEO'){current.pause();current.removeAttribute('src');current.load();}layout?.dispose();layout=null;stage.replaceChildren();currentPool?.dispose();currentPool=assets();
  const post=items[index];if(!post){close();return;}root.dataset.postId=post.id;root.dataset.index=String(index);const file=post.files[0],isVideo=videoFile(file),m=el(isVideo?'video':'img','pm-sequence-media');current=m;m.draggable=false;composition=mode==='story'?normalizeStory(post.story):null;if(composition){muted=composition.muted;layout=storySurface({media:m,composition});stage.append(layout.node);}
  m.addEventListener('error',()=>{failed=true;failure(stage,'Файл не воспроизводится в этом браузере. Он сохранён в профиле.');sync();},{signal:mediaLife.signal});
  if(isVideo){m.playsInline=true;m.muted=muted;m.controls=mode==='video';m.loop=mode==='video';m.preload='auto';
   m.addEventListener('loadeddata',()=>{if(composition){const win=storyWindow(composition,m.duration);if(win.start>0)m.currentTime=win.start;}ready=true;sync();},{signal:mediaLife.signal});
   m.addEventListener('ended',()=>{if(mode==='story'&&!manual&&!holding)advance(1,true);},{signal:mediaLife.signal});
   m.addEventListener('play',()=>{if(!active||document.hidden||!root.isConnected||holding){systemPause=true;m.pause();}else{manual=false;sync();}},{signal:mediaLife.signal});
   m.addEventListener('pause',()=>{if(systemPause)systemPause=false;else if(mode==='video'){manual=true;sync();}},{signal:mediaLife.signal});
  }else{m.alt=post.caption||'Сторис';m.addEventListener('load',()=>{ready=true;sync();},{signal:mediaLife.signal});}
  caption.textContent=post.caption||'';stamp.textContent=dateLabel(post.at);if(post.at)stamp.dateTime=post.at;sound.hidden=!isVideo;previous.disabled=index===0;next.disabled=index===items.length-1;counter.textContent=`${index+1} / ${items.length}`;
  if(!layout)stage.append(m);m.src=currentPool.url(file);paint(0);sync();
 }
 function advance(delta,automatic=false){const target=index+delta;if(target>=items.length){if(automatic||mode==='story')close();return;}if(target<0)return;index=target;show();}
 // The browser's native image drag cancels the swipe pointer stream.
 stage.addEventListener('dragstart',e=>e.preventDefault(),{signal});
 stage.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
 stage.addEventListener('pointerdown',e=>{
  if(e.target.closest('a'))return;
  if(e.isPrimary===false||e.button>0)return;const rect=stage.getBoundingClientRect();
  if(mode==='video'&&e.clientY>rect.bottom-64)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),held:false};
  // Capture is local to the media surface; never hijack editor or app scrolling.
  stage.setPointerCapture?.(e.pointerId);holdTimer=setTimeout(()=>{if(!gesture)return;gesture.held=true;holding=true;sync();},180);
 },{signal});
 stage.addEventListener('pointermove',e=>{if(gesture?.id!==e.pointerId)return;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8){clearTimeout(holdTimer);holding=true;sync();}},{signal});
 stage.addEventListener('pointerup',e=>{
  if(gesture?.id!==e.pointerId)return;const g=gesture;gesture=null;clearTimeout(holdTimer);const dx=e.clientX-g.x,dy=e.clientY-g.y;holding=false;
  if(mode==='story'&&dy>70&&Math.abs(dy)>Math.abs(dx)){close();return;}
  const delta=mode==='story'?dx:dy;
  if(Math.abs(delta)>45&&Math.abs(delta)>(mode==='story'?Math.abs(dy):Math.abs(dx))){advance(delta<0?1:-1);sync();return;}
  if(!g.held&&Math.abs(dx)<10&&Math.abs(dy)<10){if(mode==='story'){const rect=stage.getBoundingClientRect();advance(e.clientX<rect.left+rect.width*.3?-1:1);}else manual=!manual;}
  sync();
 },{signal});
 const cancel=()=>{clearTimeout(holdTimer);gesture=null;holding=false;sync();};stage.addEventListener('pointercancel',cancel,{signal});stage.addEventListener('lostpointercapture',()=>{if(gesture)cancel();},{signal});
 root.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(['ArrowRight','ArrowDown'].includes(e.key)){e.preventDefault();advance(1);}else if(['ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();advance(-1);}else if(e.key===' '){e.preventDefault();manual=!manual;sync();}},{signal});
 document.addEventListener('visibilitychange',()=>{holding=false;gesture=null;clearTimeout(holdTimer);sync();},{signal});
 show();return {node:root,setActive(value){active=value;sync();},dispose(){if(disposed)return;disposed=true;clearTimeout(holdTimer);cancelAnimationFrame(raf);mediaLife?.abort();life.abort();if(current?.tagName==='VIDEO'){current.pause();current.removeAttribute('src');current.load();}layout?.dispose();currentPool?.dispose();pool.dispose();}};
}

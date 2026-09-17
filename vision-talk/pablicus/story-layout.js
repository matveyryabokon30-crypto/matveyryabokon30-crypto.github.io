/* One owner for story-header geometry. No synthetic page height or root scrolling. */
(function(g){'use strict';
 if(g.PablicusStoryLayout)return;
 const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
 function normalizeAvatars(){
  const selector='.pablicusStoryAvatar,.profileNavAvatar,.storyShelfAvatar,.storyCompactAvatar,.storyV3Avatar,.pablicusStoryProfile,.contactPhotoButton';
  document.querySelectorAll(selector).forEach(n=>{
   if(!n.classList.contains('pbAvatarUniform'))n.classList.add('pbAvatarUniform');
   const page=n.closest('.contactPage'),exp=Number(page?.dataset.albumProgress||0);
   const album=n.classList.contains('contactPhotoButton')&&(exp>0||page?.dataset.profilePresentation==='album'||page?.dataset.profilePresentation==='transition');
   const shape=album?'album':'circle';
   if(n.dataset.avatarShape!==shape)n.dataset.avatarShape=shape;
  });
 }
 function create(K){
  const {C,E,own,owners,item,picture,active,title}=K;
  const life=new AbortController(),signal=life.signal;
  let host=null,ws=null,list=null,rail=null,compact=null,pet=null,home=null;
  let local=null,resize=null,p=0,animation=0,gesture=null,suppress=0,wheelTimer=0,dead=false;
  let expanded=266,collapsed=58;
  const set=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
  const busyTarget=t=>!!t.closest('input,textarea,select,video,a,[contenteditable="true"],.chatSwipeActions');
  function paint(value){
   p=clamp(value);if(!host)return;
   const open=clamp(1-p*1.6),fold=clamp((p-.4)/.6);
   set(host,'--shelf-height',(expanded-(expanded-collapsed)*p).toFixed(2)+'px');
   set(host,'--shelf-open',open.toFixed(3));set(host,'--shelf-fold',fold.toFixed(3));
   set(host,'--shelf-shift',(-24*p).toFixed(2)+'px');set(host,'--shelf-scale',(1-.35*p).toFixed(3));
   host.dataset.foldProgress=p.toFixed(3);
   const state=p<.001?'expanded':p>.999?'collapsed':'moving';
   if(host.dataset.foldState!==state)host.dataset.foldState=state;
   if(rail.inert!==(p>.55))rail.inert=p>.55;
   if(compact.inert!==(p<=.55))compact.inert=p<=.55;
   const hide=String(p<=.55);if(compact.getAttribute('aria-hidden')!==hide)compact.setAttribute('aria-hidden',hide);
   const collapsedLabel=p>.55?'Развернуть истории':'Свернуть истории';
   if(host.getAttribute('aria-label')!==collapsedLabel)host.setAttribute('aria-label',collapsedLabel);
  }
  function stop(){if(animation)cancelAnimationFrame(animation);animation=0;}
  function settle(target){
   if(!host)return;stop();const from=p,start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:220;
   if(!duration||Math.abs(target-p)<.001){paint(target);return;}
   function step(now){if(!host)return;const t=clamp((now-start)/duration);paint(from+(target-from)*(1-Math.pow(1-t,3)));if(t<1)animation=requestAnimationFrame(step);else animation=0;}
   animation=requestAnimationFrame(step);
  }
  function begin(x,y,t,id,type){
   if(!host||busyTarget(t))return;
   stop();gesture={x,y,lastY:y,lastX:x,id,type,axis:null,owned:false,moved:false,lastDelta:0};
  }
  function move(x,y,e){
   const q=gesture;if(!q||!host)return;
   const dx=x-q.x,dy=y-q.y;
   if(!q.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;q.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';}
   if(q.axis!=='y')return;
   const delta=q.lastY-y;q.lastY=y;q.lastX=x;q.lastDelta=delta;
   // Scrolling down through a long list remains native. Expansion starts only at its top.
   const consume=q.owned||(list.scrollTop<=1&&(delta<0||(delta>0&&p<1)));
   if(!consume)return;
   q.owned=true;q.moved=true;suppress=Date.now()+450;
   if(e.cancelable)e.preventDefault();e.stopPropagation();
   if(delta>0){const needed=(1-p)*(expanded-collapsed),used=Math.min(delta,needed);paint(p+used/(expanded-collapsed));if(delta>used)list.scrollTop+=delta-used;}
   else {let left=-delta;if(list.scrollTop>0){const used=Math.min(list.scrollTop,left);list.scrollTop-=used;left-=used;}if(left)paint(p-left/(expanded-collapsed));}
  }
  function end(cancelled=false){
   const q=gesture;gesture=null;if(!q?.owned)return;
   suppress=Date.now()+450;
   if(list.scrollTop>1){settle(1);return;}
   const target=cancelled?(p>=.5?1:0):Math.abs(q.y-q.lastY)>28?(q.lastDelta>=0?1:0):(p>=.5?1:0);
   settle(target);
  }
  function wheel(e){
   if(e.ctrlKey||busyTarget(e.target)||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
   const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?list.clientHeight:1);
   if(list.scrollTop>1)return;
   if((delta>0&&p<1)||(delta<0&&p>0)){
    e.preventDefault();e.stopPropagation();stop();paint(p+delta/(expanded-collapsed));
    clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>settle(delta>0?1:0),100);
   }
  }
  function unmount(){
   stop();clearTimeout(wheelTimer);gesture=null;local?.abort();resize?.disconnect();
   host?.remove();host=rail=compact=pet=ws=list=null;local=resize=null;
   if(home?.classList.contains('storiesV3Chats'))home.classList.remove('storiesV3Chats');home=null;
  }
  function mount(workspace,h){
   ws=workspace;home=h;list=document.getElementById('screenContent');if(!list)return;
   local=new AbortController();const opts={signal:local.signal};
   // The old hidden .homeHeader is never used as a compact-avatar parent.
   document.getElementById('storyShelfCompact')?.remove();document.getElementById('storyShelfV3')?.remove();
   host=E('section','storyShelfV3');host.id='storyShelfV3';host.tabIndex=0;
   rail=E('div','storyShelfRailV3');rail.setAttribute('aria-label','Истории людей');
   compact=E('div','storyShelfCompact');compact.id='storyShelfCompact';compact.setAttribute('aria-label','Истории');
   pet=E('section','storyPetCard');pet.setAttribute('aria-label','Питомец');
   // Preserve the currently approved placeholder; no pet state is stored here.
   const world=E('div','storyPetWorld'),animal=E('div','storyPetAnimal','🦊'),copy=E('div','storyPetCopy');
   animal.setAttribute('aria-hidden','true');copy.append(E('strong','','Питомец'),E('small','','Твоя маленькая живая среда'));world.append(animal,copy);pet.append(world);
   host.append(rail,pet,compact);ws.prepend(host);ws.scrollTop=0;
   const measure=()=>{expanded=innerHeight<=600?216:266;paint(p);};
   measure();
   ws.addEventListener('touchstart',e=>{if(e.touches.length!==1){end(true);return;}const t=e.touches[0];begin(t.clientX,t.clientY,e.target,t.identifier,'touch');},{...opts,passive:true,capture:true});
   ws.addEventListener('touchmove',e=>{if(e.touches.length!==1){end(true);return;}const t=e.touches[0];if(gesture?.id===t.identifier)move(t.clientX,t.clientY,e);},{...opts,passive:false,capture:true});
   ws.addEventListener('touchend',()=>end(),{...opts,passive:true,capture:true});
   ws.addEventListener('touchcancel',()=>end(true),{...opts,passive:true,capture:true});
   ws.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0)begin(e.clientX,e.clientY,e.target,e.pointerId,'mouse');},opts);
   ws.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&gesture?.id===e.pointerId){move(e.clientX,e.clientY,e);if(gesture?.owned)ws.setPointerCapture?.(e.pointerId);}},{...opts,capture:true});
   ws.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')end();},opts);
   ws.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')end(true);},opts);
   ws.addEventListener('click',e=>{if(Date.now()<suppress){e.preventDefault();e.stopImmediatePropagation();}},{...opts,capture:true});
   ws.addEventListener('wheel',wheel,{...opts,passive:false,capture:true});
   list.addEventListener('scroll',()=>{if(list.scrollTop>1&&p<1&&!gesture?.owned){stop();paint(1);}},{...opts,passive:true});
   host.addEventListener('keydown',e=>{if(e.target!==host)return;if(['ArrowUp','ArrowDown','Enter',' '].includes(e.key)){e.preventDefault();settle(e.key==='ArrowUp'?1:e.key==='ArrowDown'?0:p>.5?0:1);}},opts);
   resize=new ResizeObserver(measure);resize.observe(home);
   g.addEventListener('resize',measure,{...opts,passive:true});
   paint(p);
  }
  function refresh(){
   if(dead)return;normalizeAvatars();const s=C.state(),h=document.getElementById('home'),w=document.getElementById('workspace');
   const on=!!s.sessionUserId&&s.screen==='home'&&s.section==='chats'&&h&&w;
   if(!on){if(host)unmount();return;}
   if(!h.classList.contains('storiesV3Chats'))h.classList.add('storiesV3Chats');
   if(!host||!host.isConnected||ws!==w)mount(w,h);
   if(!host)return;
   const ids=owners(),sig=ids.map(id=>id+'|'+active(id)+'|'+picture(id)+'|'+title(id)).join(';');
   if(rail.dataset.sig!==sig){
    const oldX=rail.scrollLeft;rail.dataset.sig=sig;
    rail.replaceChildren(...ids.map(id=>item(id,id===own()?.id,false)));
    const previews=ids.filter(id=>active(id)).slice(0,3);if(!previews.length&&ids[0])previews.push(ids[0]);
    compact.replaceChildren(...previews.map(id=>item(id,id===own()?.id,true)));
    rail.scrollLeft=oldX;normalizeAvatars();paint(p);
   }
  }
  return{refresh,collapse:()=>settle(1),expand:()=>settle(0),get progress(){return p;},destroy(){dead=true;unmount();life.abort();}};
 }
 g.PablicusStoryLayout=Object.freeze({create,normalizeAvatars});
})(window);

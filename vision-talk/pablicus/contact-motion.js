/* Contact header interaction. One geometry writer, no CSS scroll timelines or initial scroll offset.
   Pull-to-expand is a distinct gesture at the top, not an interval inside the content scroller. */
(function(root){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
 function mount(page,bar,hero,options={}){
  const photo=hero.querySelector('.contactPhotoButton'),name=hero.querySelector('.contactName'),status=hero.querySelector('.contactHandle'),actions=hero.querySelector('.contactActions');
  if(!photo||!name||!status||!actions)return null;
  // Dialog contacts and the owner's tab use this same gesture/geometry engine.
  const isOpen=()=>options.isOpen ? options.isOpen() : page.open;
  const life=new AbortController(),signal=life.signal,reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  const mast=document.createElement('div'),space=document.createElement('div'),glass=document.createElement('div'),shade=document.createElement('div');
  mast.className='contactMasthead';space.className='contactHeaderSpace';glass.className='contactEdgeFade';shade.className='contactGalleryShade';
  glass.setAttribute('aria-hidden','true');shade.setAttribute('aria-hidden','true');
  page.classList.add('contactGestureMotion');page.insertBefore(mast,bar);mast.append(hero,glass,bar);mast.after(space);
  let dead=false,frame=0,animation=0,expanded=0,target=0,g=null,gesture=null,ignoreClickUntil=0,lastTime=0,lastSpace=-1,needMeasure=true;
  const buttons=[...actions.querySelectorAll('button')];
  const px=v=>`${Math.round(v*100)/100}px`;
  const move=(n,x,y,s=1)=>{n.style.transform=`translate3d(${px(x)},${px(y)},0) scale(${s})`;};
  const gallery=options.client&&options.profile&&root.PablicusProfilePhotos?root.PablicusProfilePhotos.carousel(photo,{client:options.client,profile:options.profile,isCurrent:()=>!dead&&isOpen()&&options.isCurrent?.()!==false,onActivate:()=>{},onCount:()=>{}}):null;
  photo.append(shade);photo.setAttribute('aria-label','Фотографии профиля. Потяните вниз, чтобы раскрыть');
  // The visible photo rectangle and its image have the same dimensions. There is no second mask timeline.
  function measure(){
   if(dead||!isOpen())return;
   const w=page.clientWidth,h=page.clientHeight,barH=bar.offsetHeight||60,safe=Math.max(0,barH-60),d=w>=760?140.8:118.8;
   const photoTop=barH+10,nameTop=photoTop+d+8,statusTop=nameTop+37,actionTop=statusTop+22+18,normalH=actionTop+64+16;
   const fullPhotoH=Math.max(200,Math.min(600,w*1.25,h-112));
   const fullH=Math.max(normalH,fullPhotoH+88),collapse=normalH-barH;
   name.style.maxWidth=px(w-32);status.style.maxWidth=px(w-32);
   g={w,h,barH,safe,d,photoTop,nameTop,statusTop,actionTop,normalH,fullPhotoH,fullH,collapse,
    nameW:Math.max(1,name.offsetWidth),statusW:Math.max(1,status.offsetWidth)};
   g.nameScale=Math.min(17/29,Math.max(48,w-160)/g.nameW);
   g.statusScale=Math.min(11/17,Math.max(48,w-160)/g.statusW);
   page.style.setProperty('--contact-bar-height',px(barH));
   if(gallery)gallery.controls.style.top=px(safe+8);
   needMeasure=false;
  }
  function interactive(node,enabled){if(node.inert===!enabled)return;node.inert=!enabled;if(!enabled&&node.contains(document.activeElement))(bar.querySelector('.contactBack')||bar.querySelector('button'))?.focus({preventScroll:true});}
  function paint(){
   frame=0;if(dead||!isOpen()||!mast.isConnected)return;
   if(needMeasure||!g)measure();if(!g)return;
   const y=Math.max(0,page.scrollTop),c=clamp(y/g.collapse),dock=smooth(c/.70),e=expanded;
   const headerH=mix(g.normalH,g.fullH,e),visibleH=Math.max(g.barH,headerH-y);
   if(headerH!==lastSpace){space.style.height=px(headerH);lastSpace=headerH;}
   // The page scroll height is constant during ordinary scrolling. Only deliberate album expansion changes it at scrollTop=0.
   hero.style.height=px(visibleH);
   const small=g.d*(1-.55*smooth(c/.58)),pw=mix(small,g.w,e),ph=mix(small,g.fullPhotoH,e);
   const py=mix(g.photoTop-y*.70,0,e),corner=mix(small/2,0,e);
   photo.style.width=px(pw);photo.style.height=px(ph);photo.style.borderRadius=px(corner);
   move(photo,(g.w-pw)/2,py);
   const photoAlpha=e>0?1:1-smooth((c-.14)/.43);photo.style.opacity=String(photoAlpha);
   photo.style.visibility=photoAlpha<.001?'hidden':'visible';
   const ns=mix(mix(1,g.nameScale,dock),22/29,e),ss=mix(mix(1,g.statusScale,dock),13/17,e);
   const nx=mix((g.w-g.nameW*ns)/2,18,e),sx=mix((g.w-g.statusW*ss)/2,18,e);
   move(name,nx,mix(mix(g.nameTop,g.safe+8,dock),g.fullPhotoH-66,e),ns);
   move(status,sx,mix(mix(g.statusTop,g.safe+32,dock),g.fullPhotoH-36,e),ss);
   const ink=Math.round((1-smooth((e-.15)/.65))*100);name.style.color=`color-mix(in srgb,var(--text,#242628) ${ink}%,#fff)`;status.style.color=`color-mix(in srgb,var(--muted,#73777c) ${ink}%,#fff)`;
   shade.style.opacity=String(e);glass.style.opacity=String((1-e)*mix(.16,1,dock));
   // The action strip stays BELOW the full photograph, never inside its clip or carousel hit area.
   const ay=mix(g.actionTop-y,g.fullPhotoH+12,e),ah=mix(64,48,smooth(c)),alpha=e>0?1:1-smooth((c-.62)/.28);
   move(actions,0,ay);actions.style.opacity=String(alpha);
   for(const b of buttons){b.style.height=px(ah);b.style.minHeight=px(ah);const label=b.querySelector('span');if(label)label.style.opacity=String(e>0?1:1-smooth((c-.35)/.42));}
   interactive(actions,alpha>.05&&ay+ah>g.barH+6);interactive(photo,photoAlpha>.02);
   gallery?.setExpanded(e>.995&&target===1&&!animation);
   page.dataset.profilePresentation=e>.995?'album':e>.001?'transition':c>.995?'compact':'portrait';
   page.dataset.albumProgress=String(Math.round(e*1000)/1000);
  }
  function schedule(){if(!dead&&!frame)frame=root.requestAnimationFrame(paint);}
  function stopAnimation(){if(animation)root.cancelAnimationFrame(animation);animation=0;}
  function settle(next){
   if(dead||!isOpen())return;next=next&&options.profile?.avatar_url?1:0;
   if(next===target&&(animation||Math.abs(expanded-next)<.0001))return;
   stopAnimation();target=next;gallery?.setExpanded(false);
   const start=expanded,begin=performance.now(),duration=reduced.matches?1:350;
   function step(now){if(dead)return;const t=clamp((now-begin)/duration);
    // Critically damped, monotonic settle: all geometry uses the SAME progress in the SAME frame.
    const curve=t===1?1:(1-(1+7*t)*Math.exp(-7*t))/(1-8*Math.exp(-7));
    expanded=mix(start,next,curve);paint();
    if(t<1)animation=root.requestAnimationFrame(step);else{animation=0;expanded=target;paint();}
   }
   animation=root.requestAnimationFrame(step);
  }
  function expand(){if(!g||page.scrollTop>1||!options.profile?.avatar_url)return;settle(1);}
  function begin(x,y,t,id){
   if(dead||!isOpen())return;
   const control=!!t.closest('button,a,input,textarea,select,video,[contenteditable="true"]');
   gesture={id,x,y,lastX:x,lastY:y,axis:null,mode:null,atTop:page.scrollTop<=1,album:expanded>.01||target===1,control,moved:false};
  }
  function track(x,y,event){
   const s=gesture;if(!s)return;s.lastX=x;s.lastY=y;
   const dx=x-s.x,dy=y-s.y;if(Math.max(Math.abs(dx),Math.abs(dy))>2)s.moved=true;
   if(!s.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=6)s.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
   if(s.axis==='x'||s.control)return;
   const mayPull=s.atTop&&!s.album&&dy>0&&!!options.profile?.avatar_url;
   const mayClose=s.album&&Math.abs(dy)>0;
   if(!(mayPull||mayClose))return;
   if(Math.abs(dy)>Math.abs(dx)&&event.cancelable)event.preventDefault();
   if(s.axis!=='y')return;
   s.mode=s.album?'closing':'pulling';ignoreClickUntil=Date.now()+500;
   if(s.album){if(dy<=-12)settle(0);}else if(dy>=32)settle(1);
  }
  function end(){const s=gesture;gesture=null;if(!s)return;if(s.moved||s.mode)ignoreClickUntil=Date.now()+500;}
  page.addEventListener('touchstart',e=>{if(e.touches.length!==1){end();return;}const t=e.touches[0];begin(t.clientX,t.clientY,e.target,t.identifier);},{passive:true,capture:true,signal});
  page.addEventListener('touchmove',e=>{if(e.touches.length!==1){end();return;}const t=e.touches[0];if(gesture?.id===t.identifier)track(t.clientX,t.clientY,e);},{passive:false,capture:true,signal});
  page.addEventListener('touchend',end,{passive:true,capture:true,signal});page.addEventListener('touchcancel',end,{passive:true,capture:true,signal});
  page.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0)begin(e.clientX,e.clientY,e.target,e.pointerId);},{signal});
  page.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&gesture?.id===e.pointerId)track(e.clientX,e.clientY,e);},{signal});
  page.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')end();},{signal});page.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')end();},{signal});
  page.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil&&!e.target.closest('.contactTop')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal});
  // Expansion is not triggered by click/focus: even a tiny drag can synthesize a click on iOS.
  photo.addEventListener('keydown',e=>{if(e.target!==photo)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();if(target)settle(0);else expand();}},{capture:true,signal});
  page.addEventListener('wheel',e=>{if(e.ctrlKey)return;if(expanded>.01||target){if(e.deltaY>0){e.preventDefault();settle(0);}}else if(page.scrollTop<=1&&e.deltaY<0&&options.profile?.avatar_url){e.preventDefault();const now=Date.now();if(now-lastTime>180)lastTime=now;else if(Math.abs(e.deltaY)>=4)expand();}},{passive:false,signal});
  page.addEventListener('scroll',()=>{if((target||expanded)&&page.scrollTop>1)settle(0);schedule();},{passive:true,signal});
  const resize=()=>{needMeasure=true;schedule();};root.addEventListener('resize',resize,{passive:true,signal});reduced.addEventListener('change',resize,{signal});
  const ro=root.ResizeObserver?new ResizeObserver(()=>{if(!g||page.clientWidth!==g.w||bar.offsetHeight!==g.barH)resize();}):null;ro?.observe(page);ro?.observe(bar);
  const mo=new MutationObserver(resize);mo.observe(status,{childList:true,characterData:true,subtree:true});mo.observe(name,{childList:true,characterData:true,subtree:true});
  page.scrollTop=0;paint();document.fonts?.ready.then(()=>{if(!dead)resize();});
  return{expand,collapse:()=>settle(0),refreshPhotos:()=>gallery?.refresh(),preparePhoto:()=>gallery?.prepare(),get rest(){return 0;},get end(){return g?.collapse||0;},destroy(){if(dead)return;dead=true;life.abort();stopAnimation();ro?.disconnect();mo.disconnect();gallery?.destroy();if(frame)root.cancelAnimationFrame(frame);space.remove();shade.remove();page.classList.remove('contactGestureMotion');page.style.removeProperty('--contact-bar-height');delete page.dataset.profilePresentation;delete page.dataset.albumProgress;}};
 }
 root.PablicusContactMotion={mount};
})(window);

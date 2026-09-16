/* Stationary sticky masthead + native scroll timeline. No counter-scroll transforms. */
(function(root){
 'use strict';
 const clamp=p=>Math.max(0,Math.min(1,p));
 function mount(page,bar,hero){
  const photo=hero.querySelector('.contactPhotoButton'),name=hero.querySelector('.contactName'),handle=hero.querySelector('.contactHandle'),actions=hero.querySelector('.contactActions');
  if(!photo||!name||!handle||!actions)return null;
  const mast=document.createElement('div'),glass=document.createElement('div');
  mast.className='contactMasthead';glass.className='contactEdgeFade';glass.setAttribute('aria-hidden','true');
  page.classList.add('contactMotionInitializing');page.insertBefore(mast,bar);mast.append(glass,bar,hero);page.classList.add('contactMotion');name.title=name.textContent;
  const lifetime=new AbortController(),signal=lifetime.signal,reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  const native=!!(root.CSS?.supports('animation-timeline: scroll()')&&root.CSS?.supports('animation-range: 0px 100px'));
  page.classList.toggle('contactNativeTimeline',native);
  let dead=false,frame=0,resizeFrame=0,g=null,signature='';
  const nodes=[photo,name,handle,actions],px=n=>n.toFixed(4)+'px';
  // Layout offsets do not include animated transforms. Never clear transforms to measure.
  const center=node=>{let y=node.offsetHeight/2;for(let n=node;n&&n!==mast;n=n.offsetParent)y+=n.offsetTop;return y;};
  function measure(){
   if(dead||!page.open||!mast.isConnected)return;
   const w=page.clientWidth,toolbar=bar.offsetHeight,h=mast.offsetHeight;
   const next=[w,toolbar,h,photo.offsetWidth,name.offsetHeight,handle.offsetHeight,reduced.matches].join(':');
   if(next===signature)return;signature=next;
   const safe=Math.max(0,toolbar-60),range=Math.max(1,h-toolbar);
   g={range,name:safe+21-center(name),handle:safe+42-center(handle),photo:safe-18-center(photo),
    ns:17/(parseFloat(getComputedStyle(name).fontSize)||29),
    hs:12/(parseFloat(getComputedStyle(handle).fontSize)||17)};
   const vars={'--contact-collapse-range':px(range),'--contact-bar-height':px(toolbar),'--contact-name-y':px(g.name),'--contact-status-y':px(g.handle),'--contact-photo-y':px(g.photo),'--contact-name-scale':g.ns,'--contact-status-scale':g.hs,'--contact-actions-y':px(-range)};
   for(const[k,v]of Object.entries(vars))page.style.setProperty(k,String(v));
   if(!native)fallback();
  }
  function release(){
   if(dead||!page.open||!g)return;
   page.classList.remove('contactMotionInitializing');page.classList.add('contactMotionReady');
  }
  function fallback(){
   frame=0;if(dead||!g||!page.open)return;
   // Legacy engines use rAF only for hero content. The toolbar is never moved by JS.
   const p=clamp(Math.max(0,page.scrollTop)/g.range),t=clamp(p/.78),a=clamp(p/.70);
   const set=(n,y,s=1)=>n.style.transform=`translate3d(0,${px(y)},0) scale(${s})`;
   set(name,g.name*t,1+(g.ns-1)*t);set(handle,g.handle*t,1+(g.hs-1)*t);
   set(photo,g.photo*a,reduced.matches?1:1-.68*a);photo.style.opacity=String(1-a);photo.style.visibility=a>=1?'hidden':'';
   set(actions,-g.range*p);actions.style.opacity=String(1-clamp((p-.50)/.38));actions.style.visibility=p>=.88?'hidden':'';
   actions.style.setProperty('--contact-action-y',String(reduced.matches?1:1-.66*p));actions.style.setProperty('--contact-label-opacity',String(1-clamp(p/.60)));
  }
  function requestMeasure(){if(!dead&&!resizeFrame)resizeFrame=root.requestAnimationFrame(()=>{resizeFrame=0;measure();});}
  if(!native)page.addEventListener('scroll',()=>{if(!frame)frame=root.requestAnimationFrame(fallback);},{passive:true,signal});
  root.addEventListener('resize',requestMeasure,{passive:true,signal});reduced.addEventListener('change',requestMeasure,{signal});
  const observer=root.ResizeObserver?new ResizeObserver(requestMeasure):null;
  for(const n of [hero,bar,name,handle])observer?.observe(n);
  document.fonts?.ready.then(()=>{if(!dead&&page.scrollTop===0){signature='';requestMeasure();}});
  measure();root.requestAnimationFrame(()=>{measure();release();});
  return{mast,hero,destroy(){if(dead)return;dead=true;lifetime.abort();observer?.disconnect();if(frame)root.cancelAnimationFrame(frame);if(resizeFrame)root.cancelAnimationFrame(resizeFrame);
   for(const n of nodes){n.style.transform='';n.style.opacity='';n.style.visibility='';n.inert=false;}
   actions.style.removeProperty('--contact-action-y');actions.style.removeProperty('--contact-label-opacity');
   page.classList.remove('contactMotion','contactNativeTimeline','contactMotionInitializing','contactMotionReady');for(const k of ['--contact-collapse-range','--contact-bar-height','--contact-name-y','--contact-status-y','--contact-photo-y','--contact-name-scale','--contact-status-scale','--contact-actions-y'])page.style.removeProperty(k);
  }};
 }
 function watch(page){let current=null;
  function update(){
   if(current&&(!page.open||!current.mast.isConnected||!page.contains(current.mast))){current.destroy();current=null;}
   for(const back of page.querySelectorAll('.contactBack'))back.classList.toggle('contactBackIcon',!!back.querySelector('svg'));
   if(!page.open||current)return;const bar=page.querySelector(':scope > .contactTop'),hero=page.querySelector(':scope > .contactHero');if(bar&&hero)current=mount(page,bar,hero);
  }
  const observer=new MutationObserver(update);observer.observe(page,{childList:true,attributes:true,attributeFilter:['open']});update();return()=>{observer.disconnect();current?.destroy();};
 }
 let page=null,dispose=null;function discover(){const next=document.getElementById('pablicusContactCard');if(next===page)return;dispose?.();page=next;dispose=page?watch(page):null;}
 if(document.body){const observer=new MutationObserver(discover);observer.observe(document.body,{childList:true});discover();}
 root.PablicusContactMotion={mount};
})(window);

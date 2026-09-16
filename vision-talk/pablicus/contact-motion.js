/* Contact card R5: only toolbar is sticky. Hero stays in normal flow, so it cannot overlap posts. */
(function(root){
 'use strict';
 const clamp=v=>Math.max(0,Math.min(1,v));
 function mount(page,bar,hero){
  const photo=hero.querySelector('.contactPhotoButton'),name=hero.querySelector('.contactName'),status=hero.querySelector('.contactHandle'),actions=hero.querySelector('.contactActions');
  if(!photo||!name||!status||!actions)return null;
  page.classList.add('contactMotionInitializing');
  const mast=document.createElement('div'),glass=document.createElement('div'),compact=document.createElement('div'),compactName=document.createElement('div'),compactStatus=document.createElement('div');
  mast.className='contactMasthead';glass.className='contactEdgeFade';compact.className='contactCompact';compactName.className='contactCompactName';compactStatus.className='contactCompactStatus';
  glass.setAttribute('aria-hidden','true');compact.setAttribute('aria-hidden','true');compactName.textContent=name.textContent;compactStatus.textContent=status.textContent;
  compact.append(compactName,compactStatus);page.insertBefore(mast,bar);mast.append(glass,bar,compact);page.classList.add('contactMotion');name.title=name.textContent;
  const lifetime=new AbortController(),signal=lifetime.signal;let dead=false,frame=0,resizeFrame=0,range=180;
  function measure(){if(dead||!page.open||!mast.isConnected)return;page.style.setProperty('--contact-bar-height',bar.offsetHeight.toFixed(2)+'px');range=Math.max(120,Math.min(260,hero.offsetHeight*.72));}
  function render(){frame=0;if(dead||!page.open)return;const y=Math.max(0,page.scrollTop),p=clamp(y/range),compactP=clamp((p-.22)/.48),fade=1-clamp((p-.08)/.72);compact.style.opacity=String(compactP);compact.style.transform=`translate3d(0,${(1-compactP)*6}px,0)`;compact.style.visibility=compactP>.02?'visible':'hidden';photo.style.transform=`scale(${1-.12*p})`;photo.style.opacity=String(1-.28*p);name.style.opacity=String(fade);status.style.opacity=String(fade);actions.style.opacity=String(1-clamp((p-.18)/.62));actions.style.pointerEvents=p>.72?'none':'';}
  function requestRender(){if(!frame)frame=root.requestAnimationFrame(render);}function requestMeasure(){if(!resizeFrame)resizeFrame=root.requestAnimationFrame(()=>{resizeFrame=0;measure();render();});}
  page.addEventListener('scroll',requestRender,{passive:true,signal});root.addEventListener('resize',requestMeasure,{passive:true,signal});const observer=root.ResizeObserver?new ResizeObserver(requestMeasure):null;observer?.observe(hero);observer?.observe(bar);
  measure();render();root.requestAnimationFrame(()=>{if(dead||!page.open)return;measure();render();page.classList.remove('contactMotionInitializing');page.classList.add('contactMotionReady');});
  return{mast,destroy(){if(dead)return;dead=true;lifetime.abort();observer?.disconnect();if(frame)root.cancelAnimationFrame(frame);if(resizeFrame)root.cancelAnimationFrame(resizeFrame);for(const n of [photo,name,status,actions,compact]){n.style.transform='';n.style.opacity='';n.style.visibility='';n.style.pointerEvents='';}page.classList.remove('contactMotion','contactMotionInitializing','contactMotionReady');page.style.removeProperty('--contact-bar-height');}};
 }
 function watch(page){let current=null;function update(){if(current&&(!page.open||!current.mast.isConnected)){current.destroy();current=null;}for(const back of page.querySelectorAll('.contactBack'))back.classList.toggle('contactBackIcon',!!back.querySelector('svg'));if(!page.open||current)return;const bar=page.querySelector(':scope > .contactTop'),hero=page.querySelector(':scope > .contactHero');if(bar&&hero)current=mount(page,bar,hero);}const observer=new MutationObserver(update);observer.observe(page,{childList:true,attributes:true,attributeFilter:['open']});update();return()=>{observer.disconnect();current?.destroy();};}
 let page=null,dispose=null;function discover(){const next=document.getElementById('pablicusContactCard');if(next===page)return;dispose?.();page=next;dispose=page?watch(page):null;}if(document.body){const observer=new MutationObserver(discover);observer.observe(document.body,{childList:true});discover();}root.PablicusContactMotion={mount};
})(window);

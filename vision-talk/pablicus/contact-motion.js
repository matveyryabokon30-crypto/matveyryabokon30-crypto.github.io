/* One continuous native scroll: expanded photo album -> portrait -> compact contact header.
   Only absolute visual layers animate; the scroll spacer and toolbar never counter-translate. */
(function(root){
 'use strict';let sequence=0;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const lerp=(a,b,p)=>a+(b-a)*p;
 function mount(page,bar,hero,options={}){
  const photo=hero.querySelector('.contactPhotoButton'),name=hero.querySelector('.contactName'),status=hero.querySelector('.contactHandle'),actions=hero.querySelector('.contactActions');
  if(!photo||!name||!status||!actions)return null;
  const controller=new AbortController(),signal=controller.signal,reduce=root.matchMedia('(prefers-reduced-motion: reduce)');
  const mast=document.createElement('div'),spacer=document.createElement('div'),glass=document.createElement('div'),shade=document.createElement('div'),style=document.createElement('style');
  mast.className='contactMasthead';spacer.className='contactHeaderSpace';glass.className='contactEdgeFade';shade.className='contactGalleryShade';glass.setAttribute('aria-hidden','true');shade.setAttribute('aria-hidden','true');
  page.classList.add('contactGalleryMotion');page.insertBefore(mast,bar);mast.append(hero,glass,bar);hero.append(shade);mast.after(spacer);page.append(style);name.title=name.textContent;
  let dead=false,raf=0,resizeRaf=0,g=null,tracks=[],lastHidden=null,lastExpanded=null,initialized=false;
  const id='cg'+(++sequence),native=CSS.supports('animation-timeline: scroll()')&&!options.forceFallback;
  page.dataset.motionEngine=native?'native':'fallback';
  const gallery=options.client&&options.profile&&root.PablicusProfilePhotos?root.PablicusProfilePhotos.carousel(photo,{client:options.client,profile:options.profile,isCurrent:()=>!dead&&page.open&&options.isCurrent?.()!==false,onActivate:()=>expand(),onCount:()=>{}}):null;
  const plane=gallery?.plane||photo.querySelector('.contactFace');
  const number=v=>Math.round(v*1000)/1000;
  const tr=(x,y,s=1)=>`translate3d(${number(x)}px,${number(y)}px,0) scale(${number(s)})`;
  const clip=(rect)=>`inset(${rect.map(number).slice(0,4).map(x=>x+'px').join(' ')} round ${number(rect[4])}px)`;
  function expand(){if(!dead&&options.profile?.avatar_url)page.scrollTo({top:0,behavior:reduce.matches?'auto':'smooth'});}
  function point(y,values){return{offset:clamp(y/g.end),values};}
  function add(node,kind,points){if(!node)return;const key=id+'_'+tracks.length;node.dataset.galleryTrack=key;tracks.push({node,kind,points,key});}
  function serialized(kind,values){if(kind==='transform')return'transform:'+tr(...values)+';';if(kind==='clip')return'clip-path:'+clip(values)+';-webkit-clip-path:'+clip(values)+';';if(kind==='opacity')return'opacity:'+values[0]+';';if(kind==='color')return'color:'+values[0]+';';if(kind==='background')return'background-color:'+values[0]+';';}
  function install(){style.textContent=native?tracks.map(t=>`@keyframes ${t.key}{${t.points.map(p=>`${number(p.offset*100)}%{${serialized(t.kind,p.values)}}`).join('')}}`).join('\n'):'';
   const byNode=new Map();for(const t of tracks){if(!byNode.has(t.node))byNode.set(t.node,[]);byNode.get(t.node).push(t);}
   for(const [node,ts]of byNode){if(native){node.style.animationName=ts.map(t=>t.key).join(',');node.style.animationDuration='1s';node.style.animationTimingFunction='linear';node.style.animationFillMode='both';node.style.animationTimeline='--contact-gallery-scroll';node.style.animationRange=`0px ${number(g.end)}px`;}else{node.style.animation='none';}}
  }
  function measure(){if(dead||!page.open||!mast.isConnected)return;
   const old=g,oldY=page.scrollTop,w=page.clientWidth,h=page.clientHeight,barH=bar.offsetHeight||60,safe=Math.max(0,barH-60),d=w>=760?140.8:118.8;
   const normalPhoto=barH+8,nameY=normalPhoto+d+8,statusY=nameY+38,normalH=statusY+35+80;
   const full=options.profile?.avatar_url?Math.max(normalH+90,Math.min(620,Math.max(w*1.29+safe,normalH+90))):normalH;
   const rest=full-normalH,end=full-barH,compactAt=rest+(end-rest)*.72;
   g={w,h,barH,safe,d,full,normalH,rest,end,compactAt};
   spacer.style.height=full+'px';hero.style.height=full+'px';photo.style.width=w+'px';photo.style.height=full+'px';
   page.style.setProperty('--contact-bar-height',barH+'px');page.style.setProperty('--contact-gallery-height',full+'px');
   name.style.maxWidth=(w-32)+'px';status.style.maxWidth=(w-32)+'px';
   const nameW=Math.min(w-32,name.offsetWidth||w-32),statusW=Math.min(w-32,status.offsetWidth||180),nameScale=Math.min(17/29,Math.max(50,w-160)/Math.max(1,nameW)),statusScale=Math.min(11/17,Math.max(50,w-160)/Math.max(1,statusW));
   tracks=[];
   // The same portrait image is cropped, scaled and unmasked into the album, not swapped with a clone.
   const rect=(top,diam)=>[top,(w-diam)/2,full-top-diam,(w-diam)/2,diam/2];
   const normalRect=rect(normalPhoto,d),smallRect=rect(safe-12,32);
   add(photo,'clip',[point(0,[0,0,0,0,0]),point(rest,normalRect),point(compactAt,smallRect),point(end,smallRect)]);
   add(plane,'transform',[point(0,[0,0,1]),point(rest,[(w-d)/2,normalPhoto-(full*d/w-d)/2,d/w]),point(compactAt,[(w-32)/2,safe-12-(full*32/w-32)/2,32/w]),point(end,[(w-32)/2,safe-12-(full*32/w-32)/2,32/w])]);
   add(photo,'opacity',[point(0,[1]),point(rest,[1]),point(rest+(end-rest)*.42,[.55]),point(compactAt,[0]),point(end,[0])]);
   add(name,'transform',[point(0,[18,full-128,20/29]),point(rest,[(w-nameW)/2,nameY,1]),point(compactAt,[(w-nameW*nameScale)/2,safe+10,nameScale]),point(end,[(w-nameW*nameScale)/2,safe+10,nameScale])]);
   add(status,'transform',[point(0,[18,full-101,13/17]),point(rest,[(w-statusW)/2,statusY,1]),point(compactAt,[(w-statusW*statusScale)/2,safe+34,statusScale]),point(end,[(w-statusW*statusScale)/2,safe+34,statusScale])]);
   add(name,'color',[point(0,['#ffffff']),point(rest*.82,['var(--text,#242628)']),point(end,['var(--text,#242628)'])]);
   add(status,'color',[point(0,['#ffffff']),point(rest*.82,['var(--muted,#73777c)']),point(end,['var(--muted,#73777c)'])]);
   add(actions,'transform',[point(0,[0,full-76,1]),point(rest,[0,normalH-76,1]),point(end,[0,barH-76,1])]);
   add(actions,'opacity',[point(0,[1]),point(rest,[1]),point(rest+(end-rest)*.45,[.85]),point(rest+(end-rest)*.82,[0]),point(end,[0])]);
   add(shade,'opacity',[point(0,[1]),point(rest*.85,[0]),point(end,[0])]);
   add(glass,'opacity',[point(0,[0]),point(rest,[.28]),point(compactAt,[1]),point(end,[1])]);
   add(hero,'clip',[point(0,[0,0,0,0,0]),point(end,[0,0,full-barH,0,0])]);
   for(const b of actions.querySelectorAll('button')){
    add(b,'background',[point(0,['rgba(255,255,255,.18)']),point(rest,['var(--surface,#fff)']),point(end,['var(--surface,#fff)'])]);
    add(b,'color',[point(0,['#fff']),point(rest,['var(--text,#242628)']),point(end,['var(--text,#242628)'])]);
    // Compress actual action tiles, then their labels. Hit boxes disappear before content reaches them.
    add(b,'transform',[point(0,[0,0,1]),point(rest,[0,0,1]),point(end,[0,0,.76])]);
    const label=b.querySelector('span');if(label)add(label,'opacity',[point(0,[1]),point(rest,[1]),point(rest+(end-rest)*.55,[0]),point(end,[0])]);
   }
   install();
   if(!initialized){page.scrollTop=rest;initialized=true;}else if(old){const y=oldY<=old.rest?(old.rest?oldY/old.rest:1)*rest:rest+(oldY-old.rest);page.scrollTop=y;}
   page.dataset.galleryRest=String(number(rest));page.dataset.galleryCollapse=String(number(end));render();
  }
  function fallback(y){for(const t of tracks){let a=t.points[0],b=t.points.at(-1),p=clamp(y/g.end);for(let i=1;i<t.points.length;i++){if(p<=t.points[i].offset){a=t.points[i-1];b=t.points[i];break;}}const f=clamp((p-a.offset)/Math.max(.00001,b.offset-a.offset));if(t.kind==='color'||t.kind==='background'){t.node.style[t.kind==='color'?'color':'backgroundColor']=f<.5?a.values[0]:b.values[0];continue;}const values=a.values.map((v,i)=>lerp(v,b.values[i],f));if(t.kind==='transform')t.node.style.transform=tr(...values);else if(t.kind==='clip'){t.node.style.clipPath=clip(values);t.node.style.webkitClipPath=clip(values);}else t.node.style.opacity=String(values[0]);}}
  function render(){raf=0;if(dead||!g||!page.open)return;const y=Math.max(0,page.scrollTop);if(!native)fallback(y);
   const hidden=y>g.rest+(g.end-g.rest)*.77,expanded=y<g.rest*.8;
   if(hidden!==lastHidden){actions.inert=hidden;photo.inert=hidden;if(hidden&&actions.contains(document.activeElement))bar.querySelector('.contactBack')?.focus({preventScroll:true});lastHidden=hidden;}
   if(expanded!==lastExpanded){gallery?.setExpanded(expanded);page.classList.toggle('contactAlbumExpanded',expanded);lastExpanded=expanded;}
  }
  function schedule(){if(!raf)raf=root.requestAnimationFrame(render);}
  function resize(){if(!resizeRaf)resizeRaf=root.requestAnimationFrame(()=>{resizeRaf=0;measure();});}
  page.addEventListener('scroll',schedule,{passive:true,signal});root.addEventListener('resize',resize,{passive:true,signal});reduce.addEventListener('change',resize,{signal});
  const ro=root.ResizeObserver?new ResizeObserver(()=>{if(!g||page.clientWidth!==g.w||bar.offsetHeight!==g.barH)resize();}):null;ro?.observe(page);ro?.observe(bar);
  // Activity text may arrive later; remeasure only its width, never at every scroll position.
  const mo=new MutationObserver(resize);mo.observe(status,{childList:true,characterData:true,subtree:true});
  measure();document.fonts?.ready.then(()=>{if(!dead)resize();});
  return{expand,get rest(){return g?.rest||0;},get end(){return g?.end||0;},destroy(){if(dead)return;dead=true;controller.abort();ro?.disconnect();mo.disconnect();gallery?.destroy();if(raf)root.cancelAnimationFrame(raf);if(resizeRaf)root.cancelAnimationFrame(resizeRaf);style.remove();spacer.remove();page.classList.remove('contactGalleryMotion','contactAlbumExpanded');delete page.dataset.motionEngine;delete page.dataset.galleryRest;delete page.dataset.galleryCollapse;page.style.removeProperty('--contact-bar-height');page.style.removeProperty('--contact-gallery-height');}};
 }
 root.PablicusContactMotion={mount};
})(window);

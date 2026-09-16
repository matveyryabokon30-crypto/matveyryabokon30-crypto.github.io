/* Coarse last-activity labels. Grammatical form is chosen by the account owner, never inferred. */
(function(root){
 'use strict';
 function label(data){
  const forms={male:['был недавно','был на этой неделе','был в этом месяце','был давно'],female:['была недавно','была на этой неделе','была в этом месяце','была давно'],neutral:['недавно в сети','на этой неделе в сети','в этом месяце в сети','давно не в сети']};
  const i=['recent','week','month','long_ago'].indexOf(data?.status);return i<0?'Статус активности недоступен':(forms[data?.status_form]||forms.neutral)[i];
 }
 function create(client,controller){
  const lifetime=new AbortController(),bindings=new Map();let dead=false,owner=null,generation=null,lastTouch=0,form='neutral',touching=null;
  const snapshot=()=>controller.state(),same=s=>!dead&&s.sessionUserId===snapshot().sessionUserId&&s.sessionGeneration===snapshot().sessionGeneration;
  const active=()=>!dead&&!!snapshot().sessionUserId&&!document.hidden&&navigator.onLine!==false;
  async function touch(selected=null){
   const s=snapshot();if(!active()){if(selected!==null)throw Error('Activity offline');return null;}
   if(touching){try{await touching;}catch{if(selected===null)return null;}if(!same(s)||!active())return null;if(selected===null)return form;}
   if(!same(s)||!active())return null;if(selected===null&&Date.now()-lastTouch<45000)return form;
   const task=(async()=>{const r=await client.rpc('pablicus_touch_activity',{p_status_form:selected});if(!same(s))return null;if(r.error)throw r.error;lastTouch=Date.now();form=['male','female','neutral'].includes(r.data?.status_form)?r.data.status_form:'neutral';return form;})();
   touching=task;try{return await task;}finally{if(touching===task)touching=null;}
  }
  async function refresh(b){
   if(!active()||!b.node.isConnected||!same(b.identity)||b.busy)return;
   b.busy=true;try{const r=await client.rpc('pablicus_contact_activity',{p_conversation_id:b.id});if(!same(b.identity)||!b.node.isConnected||bindings.get(b.node)!==b)return;if(r.error)throw r.error;const text=label(r.data);if(b.node.textContent!==text)b.node.textContent=text;b.node.dataset.activityStatus=r.data?.status||'unknown';}catch{if(same(b.identity)&&b.node.isConnected&&bindings.get(b.node)===b){b.node.textContent='Статус активности недоступен';b.node.dataset.activityStatus='unknown';}}finally{b.busy=false;}
  }
  function bind(node,id){if(!node)return;const b={node,id,identity:snapshot(),busy:false};bindings.set(node,b);node.textContent='Статус активности недоступен';void refresh(b);}
  function sweep(){for(const [n,b]of bindings){if(!n.isConnected||!same(b.identity))bindings.delete(n);else void refresh(b);}}
  function wake(){if(active()){void touch().catch(()=>{});sweep();}}
  function mountPreference(){
   const host=document.querySelector('.youForm');if(!host?.querySelector('[name="username"]')||host.querySelector('.activityFormPreference')||!snapshot().sessionUserId)return;
   const s=snapshot(),wrap=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select'),status=document.createElement('small');
   wrap.className='youField activityFormPreference';title.textContent='Форма статуса активности';select.setAttribute('aria-label',title.textContent);select.style.cssText='font:inherit;font-size:16px;min-height:44px;width:100%';
   for(const [value,text]of [['neutral','Без указания — «недавно в сети»'],['male','Мужская — «был недавно»'],['female','Женская — «была недавно»']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
   select.value=form;status.textContent='Выберите форму для своего аккаунта. Сохраняется отдельно от остальных полей.';status.setAttribute('role','status');wrap.append(title,select,status);host.querySelector('[name="username"]').closest('.youField').after(wrap);
   select.onchange=async()=>{if(!same(s))return;select.disabled=true;try{const saved=await touch(select.value);if(same(s)&&wrap.isConnected){if(saved===null)throw Error('Activity not saved');status.textContent='Форма статуса сохранена.';}}catch{if(same(s)&&wrap.isConnected){select.value=form;status.textContent='Не удалось сохранить. Повторите выбор при подключении к интернету.';}}finally{select.disabled=false;}};
   Promise.resolve(touching).then(()=>{if(same(s)&&wrap.isConnected)select.value=form;}).catch(()=>{});
  }
  const unsub=controller.subscribe(s=>{if(s.sessionUserId!==owner||s.sessionGeneration!==generation){owner=s.sessionUserId;generation=s.sessionGeneration;lastTouch=0;form='neutral';touching=null;bindings.clear();}wake();});
  document.addEventListener('visibilitychange',wake,{signal:lifetime.signal});root.addEventListener('online',wake,{signal:lifetime.signal});root.addEventListener('pageshow',wake,{signal:lifetime.signal});
  const timer=root.setInterval(wake,60000),observer=new MutationObserver(mountPreference);observer.observe(document.body,{childList:true,subtree:true});mountPreference();
  return{bind,label,destroy(){dead=true;unsub();lifetime.abort();root.clearInterval(timer);observer.disconnect();bindings.clear();}};
 }
 root.PablicusActivity={label,create};
 function boot(){const c=root.PablicusController,client=c?.getServices()?.client;if(c&&client&&!root.PablicusActivityService)root.PablicusActivityService=create(client,c);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
/* Stationary sticky masthead + native scroll timeline. Presentation only, no counter-scroll transforms. */
(function(root){
 'use strict';
 const clamp=p=>Math.max(0,Math.min(1,p));
 function mount(page,bar,hero){
  const photo=hero.querySelector('.contactPhotoButton'),name=hero.querySelector('.contactName'),handle=hero.querySelector('.contactHandle'),actions=hero.querySelector('.contactActions');
  if(!photo||!name||!handle||!actions)return null;
  const mast=document.createElement('div'),glass=document.createElement('div');
  mast.className='contactMasthead';glass.className='contactEdgeFade';glass.setAttribute('aria-hidden','true');
  page.insertBefore(mast,bar);mast.append(glass,bar,hero);page.classList.add('contactMotion');name.title=name.textContent;
  const lifetime=new AbortController(),signal=lifetime.signal,reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  const native=root.CSS?.supports('animation-timeline: scroll()')&&root.CSS?.supports('animation-range: 0px 100px');
  page.classList.toggle('contactNativeTimeline',!!native);
  let dead=false,frame=0,resizeFrame=0,g=null,signature='';
  const nodes=[photo,name,handle,actions],px=n=>n.toFixed(4)+'px';
  // Offset geometry is independent of animation transforms. Never reset transforms to measure.
  const center=node=>{let y=node.offsetHeight/2;for(let n=node;n&&n!==mast;n=n.offsetParent)y+=n.offsetTop;return y;};
  function measure(){
   if(dead||!page.open||!mast.isConnected)return;
   const w=page.clientWidth,toolbar=bar.offsetHeight,h=mast.offsetHeight;
   const next=[w,toolbar,h,photo.offsetWidth,name.offsetWidth,name.offsetHeight,handle.offsetWidth,handle.offsetHeight,reduced.matches].join(':');
   if(next===signature)return;signature=next;
   const safe=Math.max(0,toolbar-60),range=Math.max(1,h-toolbar),available=Math.max(72,w-160);
   g={range,name:safe+21-center(name),handle:safe+42-center(handle),photo:safe-18-center(photo),
    ns:Math.min(17/(parseFloat(getComputedStyle(name).fontSize)||29),available/Math.max(1,name.offsetWidth)),
    hs:Math.min(12/(parseFloat(getComputedStyle(handle).fontSize)||17),available/Math.max(1,handle.offsetWidth))};
   const vars={'--contact-collapse-range':px(range),'--contact-bar-height':px(toolbar),'--contact-name-y':px(g.name),'--contact-status-y':px(g.handle),'--contact-photo-y':px(g.photo),'--contact-name-scale':g.ns,'--contact-status-scale':g.hs,'--contact-actions-y':px(-range)};
   for(const[k,v]of Object.entries(vars))page.style.setProperty(k,String(v));
   if(!native)fallback();
  }
  function fallback(){
   frame=0;if(dead||!g||!page.open)return;
   // Older engines animate content only. The toolbar itself NEVER moves with JavaScript.
   const p=clamp(Math.max(0,page.scrollTop)/g.range),t=clamp(p/.78),a=clamp(p/.70);
   const set=(n,y,s=1)=>n.style.transform=`translate3d(0,${px(y)},0) scale(${s})`;
   set(name,g.name*t,reduced.matches?1:1+(g.ns-1)*t);set(handle,g.handle*t,reduced.matches?1:1+(g.hs-1)*t);
   set(photo,g.photo*a,reduced.matches?1:1-.68*a);photo.style.opacity=String(1-a);photo.style.visibility=a>=1?'hidden':'';
   set(actions,-g.range*p);actions.style.opacity=String(1-clamp((p-.50)/.38));actions.style.visibility=p>=.88?'hidden':'';
   actions.style.setProperty('--contact-action-y',String(1-.66*p));actions.style.setProperty('--contact-label-opacity',String(1-clamp(p/.60)));
  }
  function requestMeasure(){if(!dead&&!resizeFrame)resizeFrame=root.requestAnimationFrame(()=>{resizeFrame=0;measure();});}
  if(!native)page.addEventListener('scroll',()=>{if(!frame)frame=root.requestAnimationFrame(fallback);},{passive:true,signal});
  root.addEventListener('resize',requestMeasure,{passive:true,signal});
  reduced.addEventListener('change',requestMeasure,{signal});
  const observer=root.ResizeObserver?new ResizeObserver(requestMeasure):null;
  for(const node of [hero,bar,name,handle])observer?.observe(node);
  document.fonts?.ready.then(()=>{if(!dead){signature='';requestMeasure();}});
  measure();
  return{mast,hero,destroy(){if(dead)return;dead=true;lifetime.abort();observer?.disconnect();if(frame)root.cancelAnimationFrame(frame);if(resizeFrame)root.cancelAnimationFrame(resizeFrame);
   for(const node of nodes){node.style.transform='';node.style.opacity='';node.style.visibility='';node.inert=false;}
   page.classList.remove('contactMotion','contactNativeTimeline');for(const k of ['--contact-collapse-range','--contact-bar-height','--contact-name-y','--contact-status-y','--contact-photo-y','--contact-name-scale','--contact-status-scale','--contact-actions-y'])page.style.removeProperty(k);
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

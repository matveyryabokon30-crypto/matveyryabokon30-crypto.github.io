/* Single-instance story morph. One owner -> one button -> one image.
 * Expansion is a continuous function of one native scroll offset. The zero-height
 * sticky anchor never changes the document's scroll geometry while morphing.
 * Inspired by the measured-position/scale principle in Telegram's StoryPeerList;
 * no Telegram source, artwork or platform code is copied here.
 */
(function(g){
 'use strict'; if(g.PablicusStoriesCore)return;
 const C=g.PablicusController,S=()=>C?.getServices?.(); if(!C)return;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const $=(q,r=document)=>r.querySelector(q),$$=(q,r=document)=>[...r.querySelectorAll(q)];
 const E=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;};
 const state=()=>C.state(),own=()=>S()?.getProfile?.()||null,notify=x=>S()?.notify?.(x);
 const cache=new Map(),nodes=new Map(),life=new AbortController();
 let mounted=null,frame=0,dataTimer=0,observer=null,observed=null,session='',savedY=0,suppressClick=0;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
 const G={large:72,small:34,step:86,overlapStep:24,expanded:262,compact:60};
 const range=G.expanded-G.compact;
 function sources(id){return $$('.chatCard [data-story-owner],#mainNav .profileNavAvatar,.pablicusStoryProfile,#conversationAvatar').filter(n=>n.dataset.storyOwner===id);}
 function active(id){const data=g.PablicusAvatarStoriesUI?.getActiveStories;if(data)return data(id).length>0;return sources(id).some(n=>n.dataset.pablicusStoryRing==='active');}
 function source(id){const list=sources(id);return list.find(n=>n.querySelector('img'))||list[0];}
 function picture(id){const n=source(id),im=n?.querySelector('img');return im?.currentSrc||im?.src||'';}
 function row(id){return $$('.chatCard[data-conversation-id]').find(n=>n.querySelector('[data-story-owner="'+CSS.escape(id)+'"]'));}
 function title(id){if(id===own()?.id)return own()?.display_name||'Моя история';const r=row(id);return r?.querySelector('.chatText strong')?.textContent?.trim()||r?.querySelector('strong')?.textContent?.trim()||'Сторис';}
 const conversation=id=>row(id)?.dataset.conversationId||null;
 function avatar(id,cls='storyShelfAvatar'){
  const n=E('span',cls);n.dataset.storyOwner=id;n.dataset.pablicusStoryRing=active(id)?'active':'none';
  const im=E('img');im.alt='';im.draggable=false;im.decoding='async';const url=picture(id);
  if(url)im.src=url;else im.hidden=true;n.append(im);return n;
 }
 function owners(){const ids=[],me=own()?.id;if(UUID.test(me||''))ids.push(me);$$('#screenContent .chatCard [data-story-owner]').forEach(n=>{const id=n.dataset.storyOwner;if(UUID.test(id||'')&&active(id)&&!ids.includes(id))ids.push(id);});return ids;}
async function feed(owner){const hit=cache.get(owner);if(hit&&Date.now()-hit.at<8000)return hit.items;const r=await S().client.rpc('pablicus_story_feed',{p_owners:[owner]});if(r.error)throw r.error;const now=Date.parse(r.data?.server_now)||Date.now(),items=(r.data?.stories||[]).filter(x=>x.owner_id===owner&&UUID.test(x.id||'')&&Date.parse(x.expires_at)>now);cache.set(owner,{at:Date.now(),items});return items}async function media(story){if(!story?.media?.path)return null;const key='m:'+story.id,hit=cache.get(key);if(hit&&Date.now()-hit.at<240000)return hit.blob;const r=await S().client.storage.from('pablicus-story-media').download(story.media.path);if(r.error)throw r.error;cache.set(key,{at:Date.now(),blob:r.data});return r.data}function open(id,trigger){if(id===own()?.id&&!active(id)){g.PablicusAvatarStoriesUI?.compose?.();return}g.PablicusStoriesViewer?.open?.(id,conversation(id),trigger)}
 function makeItem(id){
  const n=E('button','storyShelfItem');n.type='button';n.dataset.owner=id;
  n.append(avatar(id),E('span','storyShelfLabel'));n.addEventListener('click',e=>{
   if(performance.now()<suppressClick){e.preventDefault();return;}open(id,n);
  });return n;
 }
 function updateData(){
  dataTimer=0; if(!mounted)return;
  // Data refresh may not replace, add, remove or change image src mid-gesture.
  if(mounted.moving){mounted.pendingData=true;return;}
  const ids=owners();
  for(const [id,n]of nodes)if(!ids.includes(id)){n.remove();nodes.delete(id);}
  ids.forEach((id,i)=>{
   let n=nodes.get(id);if(!n){n=makeItem(id);nodes.set(id,n);}
   if(mounted.track.children[i]!==n)mounted.track.insertBefore(n,mounted.track.children[i]||null);
   const a=n.firstElementChild,im=a.querySelector('img'),label=id===own()?.id?'Моя история':title(id),url=picture(id);
   if(n.lastElementChild.textContent!==label)n.lastElementChild.textContent=label;
   if(n.getAttribute('aria-label')!==label)n.setAttribute('aria-label',label);
   const ring=active(id)?'active':'none';if(a.dataset.pablicusStoryRing!==ring)a.dataset.pablicusStoryRing=ring;
   // Keep the same <img> element too. Never substitute a compact copy.
   if(url&&im.getAttribute('src')!==url){im.src=url;im.hidden=false;}
   n.style.left=(16+i*G.step)+'px';n.style.zIndex=String(100-i);
  });
  mounted.track.style.width=Math.max(mounted.ws.clientWidth,32+ids.length*G.step-14)+'px';
  mounted.pendingData=false;measure();paint();
 }
 function scheduleData(){if(!dataTimer)dataTimer=setTimeout(updateData,80);}
 function measure(){
  if(!mounted)return;const h=mounted.ws.clientHeight;
  // Exactly the collapse travel is scrollable with one chat, not a viewport of blank space.
  mounted.list.style.setProperty('--story-list-fill',Math.max(0,h-G.compact)+'px');
  paint();
 }
 function freeze(){if(!mounted||mounted.moving)return;mounted.moving=true;mounted.fromX=mounted.rail.scrollLeft;
  mounted.first=Math.max(0,Math.min(Math.max(0,nodes.size-1),Math.floor(mounted.fromX/G.step)));
 }
 function paint(){
  frame=0;if(!mounted)return;const m=mounted,p=clamp(m.ws.scrollTop/range),w=m.ws.clientWidth;
  if(p>0&&!m.moving)freeze();
  const sx=p>0?m.fromX:m.rail.scrollLeft,first=p>0?m.first:Math.floor(sx/G.step),count=Math.min(3,Math.max(0,nodes.size-first));
  const groupWidth=count?G.small+(count-1)*G.overlapStep:0,start=(w-groupWidth)/2;
  m.panel.style.height=lerp(G.expanded,G.compact,p)+'px';m.panel.dataset.progress=p.toFixed(5);
  m.panel.dataset.presentation=p===0?'expanded':p===1?'compact':'transition';
  m.rail.style.overflowX=p===0?'auto':'hidden';
  Array.from(nodes.values()).forEach((n,i)=>{
   const origin=16+i*G.step-sx,k=i-first,slot=clamp(k,0,Math.max(0,count-1));
   const target=start+slot*G.overlapStep,scale=lerp(1,G.small/G.large,p);
   n.style.transform='translate3d('+((target-origin)*p).toFixed(3)+'px,'+(-8*p).toFixed(3)+'px,0) scale('+scale.toFixed(5)+')';
   // Primary avatars are opaque for the ENTIRE path. Surplus avatars move behind the stack.
   n.style.opacity=k>=0&&k<count?'1':String(1-p);
   n.style.pointerEvents=k>=0&&k<count||p<.8?'auto':'none';n.tabIndex=k>=0&&k<count||p<.8?0:-1;
   n.lastElementChild.style.opacity=String(clamp(1-p*2));
  });
  m.pet.style.transform='translate3d(0,'+(-70*p).toFixed(3)+'px,0)';m.pet.style.opacity=String(clamp(1-p*1.7));
  m.pet.style.visibility=p===1?'hidden':'visible';m.rail.style.height=lerp(118,G.compact,p)+'px';
 }
 function schedulePaint(){if(!frame)frame=requestAnimationFrame(paint);}
 function idle(){if(!mounted)return;mounted.moving=false;
  // Keep the source horizontal offset through the collapsed state and on reversal.
  if(mounted.pendingData&&mounted.ws.scrollTop<1)updateData();
 }
 function mount(ws,list){
  const anchor=E('div','storyMorphAnchor'),space=E('div','storyMorphSpace'),panel=E('section','storyShelfV3'),rail=E('div','storyShelfRailV3'),track=E('div','storyMorphTrack'),pet=E('section','storyPetCard');
  panel.id='storyShelfV3';panel.setAttribute('aria-label','Сторис — потяните вверх или вниз');space.setAttribute('aria-hidden','true');
  pet.innerHTML='<div class="storyPetWorld"><div class="storyPetAnimal" aria-hidden="true">🦊</div><div class="storyPetCopy"><strong>Питомец</strong><small>Твоя маленькая живая среда</small></div></div>';
  pet.setAttribute('aria-label','Питомец — визуальный прототип');rail.append(track);panel.append(rail,pet);anchor.append(panel);ws.prepend(anchor,space);
  const abort=new AbortController(),signal=abort.signal;
  mounted={ws,list,anchor,space,panel,rail,track,pet,abort,fromX:0,first:0,moving:false,pendingData:false,idleTimer:0};ws.dataset.storyMorph='single';
  const m=mounted;
  ws.addEventListener('scroll',()=>{freeze();suppressClick=performance.now()+100;schedulePaint();clearTimeout(m.idleTimer);m.idleTimer=setTimeout(idle,140);},{passive:true,signal});
  rail.addEventListener('scroll',()=>{if(ws.scrollTop<1){m.fromX=rail.scrollLeft;schedulePaint();}},{passive:true,signal});
  ws.addEventListener('touchstart',()=>{clearTimeout(m.idleTimer);freeze();},{passive:true,signal});
  ws.addEventListener('touchend',()=>{m.idleTimer=setTimeout(idle,160);},{passive:true,signal});
  let mouse=null;
  panel.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0)mouse={x:e.clientX,y:e.clientY,top:ws.scrollTop,left:rail.scrollLeft,axis:null};},{signal});
  g.addEventListener('pointermove',e=>{if(!mouse||!mounted)return;const dx=e.clientX-mouse.x,dy=e.clientY-mouse.y;if(!mouse.axis&&Math.max(Math.abs(dx),Math.abs(dy))>6)mouse.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(!mouse.axis)return;e.preventDefault();freeze();suppressClick=performance.now()+300;
   if(mouse.axis==='x'&&ws.scrollTop<1)rail.scrollLeft=mouse.left-dx;else if(mouse.axis==='y')ws.scrollTop=Math.max(0,mouse.top-dy);
  },{signal});
  g.addEventListener('pointerup',()=>{mouse=null;m.idleTimer=setTimeout(idle,140);},{signal});
  const ro=new ResizeObserver(measure);ro.observe(ws);m.ro=ro;updateData();ws.scrollTop=savedY;paint();
 }
 function unmount(){const m=mounted;if(!m)return;savedY=m.ws.scrollTop;mounted=null;m.abort.abort();m.ro.disconnect();clearTimeout(m.idleTimer);m.anchor.remove();m.space.remove();delete m.ws.dataset.storyMorph;m.list.style.removeProperty('--story-list-fill');nodes.clear();cancelAnimationFrame(frame);frame=0;}
 function refresh(){
  const st=state(),id=st.sessionUserId+':'+st.sessionGeneration;if(id!==session){session=id;cache.clear();savedY=0;g.PablicusStoriesViewer?.close?.();unmount();}
  const home=$('#home'),ws=$('#workspace'),list=$('#screenContent'),on=!!st.sessionUserId&&st.screen==='home'&&st.section==='chats';
  if(home&&home.classList.contains('storiesV3Chats')!==on)home.classList.toggle('storiesV3Chats',on);
  if(!on)unmount();else if(ws&&list){if(!mounted)mount(ws,list);else scheduleData();}
  if(list&&list!==observed){observer?.disconnect();observed=list;observer=new MutationObserver(scheduleData);observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['data-pablicus-story-ring','data-story-owner','src']});}
 }
 function intercept(e){const t=e.target.closest?.('.pablicusStoryProfile,.contactAvatarTrigger,#conversationAvatar');if(!t)return;const id=t.dataset.storyOwner||t.querySelector?.('[data-story-owner]')?.dataset.storyOwner;if(!UUID.test(id||'')||!active(id))return;e.preventDefault();e.stopImmediatePropagation();open(id,t);}
 g.addEventListener('click',intercept,{capture:true,signal:life.signal});
 let multi=false;
 const guarded=e=>e.target instanceof Element&&e.target.closest('#home,#app')&&!e.target.closest('dialog,[role="dialog"],.mediaViewer');
 function noPinch(e){if(!guarded(e))return;if(e.type.startsWith('gesture')||e.touches?.length>1){multi=true;if(e.cancelable)e.preventDefault();}else if(multi&&e.type==='touchmove'&&e.cancelable)e.preventDefault();}
 ['touchstart','touchmove','gesturestart','gesturechange'].forEach(type=>document.addEventListener(type,noPinch,{capture:true,passive:false,signal:life.signal}));
 document.addEventListener('touchend',e=>{if(!e.touches.length)multi=false;},{signal:life.signal});document.addEventListener('touchcancel',()=>{multi=false;},{signal:life.signal});
 const unsubscribe=C.subscribe(refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){cache.clear();refresh();}},{signal:life.signal});
 g.PablicusStoriesCore=Object.freeze({C,S,UUID,$,$$,E,state,own,notify,active,picture,title,conversation,avatar,feed,media,cache,refresh,
  destroy(){unmount();observer?.disconnect();life.abort();unsubscribe?.();clearTimeout(dataTimer);cache.clear();}});
 refresh();
})(window);

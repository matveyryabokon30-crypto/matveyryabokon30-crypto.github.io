/* Shared story geometry. A keyed button and image retain identity throughout a gesture.
   Only an absolute layer is resized: the native scroll range never feeds back on itself. */
(function(g){
 'use strict'; if(g.PablicusStoriesCore)return;
 const C=g.PablicusController;if(!C)return;
 const S=()=>C.getServices(),D=()=>g.PablicusAvatarStoriesUI,$=(q,r=document)=>r.querySelector(q);
 const E=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const state=()=>C.state(),own=()=>S()?.getProfile?.(),key=()=>state().sessionUserId+':'+state().sessionGeneration;
 const life=new AbortController(),cache=new Map();let account=key(),ui=null,frame=0,dataFrame=0,lastScroll=0,linkHandled=false,measureFrame=0,tapStart=null,tapIgnoreUntil=0;
 let snapshot={people:[],stories:[],now:Date.now()},serverOffset=0;
 const G={expanded:222,compact:60,diameter:72,step:84};G.range=G.expanded-G.compact;
 const person=id=>snapshot.people.find(p=>p.id===id),title=id=>person(id)?.name||(id===own()?.id?own()?.display_name:'')||'Сторис';
 const picture=id=>person(id)?.url||'',conversation=id=>person(id)?.conversationId||null;
 const current=id=>snapshot.stories.filter(s=>s.owner_id===id&&Date.parse(s.expires_at)>Date.now()+serverOffset),active=id=>current(id).length>0;
 function avatar(id,cls='storyShelfAvatar'){const a=E('span',cls);a.dataset.storyOwner=id;a.dataset.pablicusStoryRing=active(id)?'active':'none';const u=picture(id);if(u){const i=D()?.imageFor?.(u)||E('img');i.alt='';i.draggable=false;i.decoding='sync';i.src=u;a.append(i);}else a.textContent=Array.from(title(id))[0]||'?';return a;}
 const valid=k=>key()===k&&!!state().sessionUserId;
 function feedKey(owner){return 'pablicus:'+state().sessionUserId+':story-feed:'+owner}
 function cachedFeed(owner){try{const v=JSON.parse(sessionStorage.getItem(feedKey(owner)));return v?.owner===owner&&v.savedAt>Date.now()-60000&&Array.isArray(v.items)?v.items.filter(x=>Date.parse(x.expires_at)>Date.now()):null}catch{return null}}
 async function feed(owner){
  if(!UUID.test(owner||'')||!state().sessionUserId)throw Error('Story session unavailable');
  const k=key(),ck=k+':feed:'+owner,hit=cache.get(ck);if(hit?.until>Date.now())return hit.promise;
  const local=cachedFeed(owner);if(local?.length){const promise=Promise.resolve(local);cache.set(ck,{until:Date.now()+1500,promise});void refreshFeed(owner,k,ck);return promise;}
  return refreshFeed(owner,k,ck);
 }
 async function refreshFeed(owner,k=key(),ck=k+':feed:'+owner){
  const promise=(async()=>{const r=g.PablicusHomeData?{data:await g.PablicusHomeData.feed([owner])}:await S().client.rpc('pablicus_story_feed',{p_owners:[owner]});if(!valid(k))throw Error('Session changed');if(r.error)throw r.error;
   const now=Date.parse(r.data?.server_now);if(!Number.isFinite(now)||!Array.isArray(r.data?.stories))throw Error('Invalid stories');serverOffset=now-Date.now();const items=r.data.stories.filter(s=>s.owner_id===owner&&UUID.test(s.id)&&Date.parse(s.expires_at)>now).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));try{sessionStorage.setItem(feedKey(owner),JSON.stringify({owner,savedAt:Date.now(),items}))}catch{}return items;})();
  cache.set(ck,{until:Date.now()+8000,promise});try{return await promise;}catch(e){cache.delete(ck);throw e;}
 }
 async function media(story,retry=false){
  const path=story?.media?.path;if(!UUID.test(story?.owner_id||'')||typeof path!=='string'||!path.startsWith(story.owner_id+'/')||path.includes('..'))throw Error('Invalid media');
  if(retry)g.PablicusMediaCache.invalidate('pablicus-story-media',path);return g.PablicusMediaCache.resolve('pablicus-story-media',path,{type:story.media.type,width:1600,priority:-10,ttl:120,expiresAt:Date.parse(story.expires_at)-serverOffset});
 }
 function open(id,trigger){if(!active(id)&&id===own()?.id){D()?.compose();return;}g.PablicusStoriesViewer?.open(id,conversation(id),trigger);}
 function item(id){const b=E('button','storyShelfItem');b.type='button';b.dataset.owner=id;b.append(avatar(id),E('span','storyShelfLabel'));b.onclick=e=>{e.preventDefault();if(!ui||ui.ignoreClick>performance.now())return;if(ui.p>.9){ui.ws.scrollTo({top:0,behavior:'smooth'});return;}open(id,b);};return b;}
 function render(){
  if(!ui)return;const me=own()?.id,ids=[];if(UUID.test(me||''))ids.push(me);for(const p of snapshot.people)if(p.id!==me&&active(p.id))ids.push(p.id);
  for(const [id,n] of ui.nodes)if(!ids.includes(id)){n.remove();ui.nodes.delete(id);}
  ids.forEach((id,index)=>{let n=ui.nodes.get(id);if(!n){n=item(id);ui.nodes.set(id,n);}if(ui.rail.children[index]!==n)ui.rail.insertBefore(n,ui.rail.children[index]||null);
   n.style.left=(16+index*G.step)+'px';const label=id===me?'Моя история':title(id);if(n.lastChild.textContent!==label)n.lastChild.textContent=label;n.setAttribute('aria-label',label);
   const a=n.firstChild,ring=active(id)?'active':'none';if(a.dataset.pablicusStoryRing!==ring)a.dataset.pablicusStoryRing=ring;
   const url=picture(id);if(url&&a.querySelector('img')?.getAttribute('src')!==url&&a.dataset.pendingUrl!==url){a.dataset.pendingUrl=url;const decoded=D()?.imageFor?.(url);if(decoded){a.replaceChildren(decoded);delete a.dataset.pendingUrl;return;}const img=E('img');img.alt='';img.draggable=false;img.onload=()=>{if(n.isConnected&&picture(id)===url){a.replaceChildren(img);delete a.dataset.pendingUrl;}};img.onerror=()=>{delete a.dataset.pendingUrl;};img.src=url;}
  });ui.widthPad.style.width=Math.max(ui.ws.clientWidth,32+ids.length*G.step-12)+'px';paint();
 }
 function measure(){if(!ui)return;const pad=parseFloat(getComputedStyle(ui.ws).paddingBottom)||0;const value=Math.max(0,ui.ws.clientHeight-G.compact-pad)+'px';if(ui.ws.style.getPropertyValue('--story-min-list')!==value)ui.ws.style.setProperty('--story-min-list',value);paint();}
 function paint(){
  frame=0;if(!ui)return;const {ws,panel,rail,pet,nodes}=ui,y=Math.max(0,ws.scrollTop),p=Math.min(1,y/G.range);lastScroll=y;
  if(ui.p===0&&p>0){ui.frozenX=rail.scrollLeft;ui.first=Math.min(Math.floor(rail.scrollLeft/G.step),Math.max(0,nodes.size-3));}
  const first=ui.first||0,count=Math.min(3,nodes.size-first),small=36,group=count?small+(count-1)*25:0,start=(ws.clientWidth-group)/2,scale=1+(small/G.diameter-1)*p;
  panel.style.setProperty('--avatar-ring-scale',String(scale));
  panel.style.height=(G.expanded-G.range*p)+'px';panel.dataset.presentation=p===0?'expanded':p===1?'compact':'transition';panel.dataset.progress=p.toFixed(4);
  rail.style.overflowX=p===0?'auto':'hidden';const scrollX=p===0?rail.scrollLeft:ui.frozenX||0;if(p>0&&rail.scrollLeft!==scrollX)rail.scrollLeft=scrollX;
  Array.from(rail.querySelectorAll(':scope > .storyShelfItem')).forEach((n,i)=>{const origin=16+i*G.step-scrollX,target=start+(i-first)*25;const x=(target-origin)*p;
   n.style.transform=`translate3d(${x}px,${-8*p}px,0) scale(${scale})`;n.style.zIndex=String(100-i);
   const selected=i>=first&&i<first+count;n.style.opacity=selected?'1':String(Math.max(0,1-1.6*p));n.style.pointerEvents=selected||p<.5?'auto':'none';n.tabIndex=selected||p<.5?0:-1;n.lastChild.style.opacity=String(Math.max(0,1-2*p));
  });pet.style.opacity=String(Math.max(0,1-1.65*p));pet.style.transform=`translateY(${-64*p}px)`;pet.style.pointerEvents=p<.4?'auto':'none';ui.p=p;
 }
 function schedulePaint(){if(!frame)frame=requestAnimationFrame(paint);}
 function mount(ws){
  const anchor=E('div','storyShelfAnchor'),panel=E('section','storyShelfV3'),spacer=E('div','storyShelfSpacer'),rail=E('div','storyShelfRailV3'),widthPad=E('span','storyShelfWidth'),pet=E('section','storyPetCard');
  panel.id='storyShelfV3';panel.setAttribute('aria-label','Истории собеседников');spacer.setAttribute('aria-hidden','true');widthPad.setAttribute('aria-hidden','true');rail.append(widthPad);
  pet.setAttribute('aria-label','Питомец — визуальный прототип');pet.innerHTML='<div class="storyPetWorld"><span class="storyPetAnimal" aria-hidden="true">🦊</span><div class="storyPetCopy"><strong>Питомец</strong><small>Твоя маленькая живая среда</small></div></div>';
  panel.append(rail,pet);anchor.append(panel);ws.prepend(anchor,spacer);ws.dataset.storyShelf='shared';const abort=new AbortController();
  ui={ws,anchor,panel,spacer,rail,widthPad,pet,abort,nodes:new Map(),p:0,frozenX:0,first:0,ignoreClick:0};
  ws.addEventListener('scroll',schedulePaint,{passive:true,signal:abort.signal});rail.addEventListener('scroll',schedulePaint,{passive:true,signal:abort.signal});
  let point=null;panel.addEventListener('pointerdown',e=>{point={x:e.clientX,y:e.clientY,top:ws.scrollTop,mouse:e.pointerType==='mouse',moving:false};},{signal:abort.signal});
  g.addEventListener('pointermove',e=>{if(!point||!ui)return;const dx=e.clientX-point.x,dy=e.clientY-point.y;if(Math.hypot(dx,dy)>6)ui.ignoreClick=performance.now()+400;if(point.mouse&&Math.abs(dy)>6&&Math.abs(dy)>Math.abs(dx)){e.preventDefault();point.moving=true;ws.scrollTop=Math.max(0,point.top-dy);}},{signal:abort.signal});
  g.addEventListener('pointerup',()=>point=null,{signal:abort.signal});g.addEventListener('pointercancel',()=>{if(point&&ui)ui.ignoreClick=performance.now()+400;point=null;},{signal:abort.signal});
  const ro=new ResizeObserver(()=>{if(!measureFrame)measureFrame=requestAnimationFrame(()=>{measureFrame=0;measure();});});ui.ro=ro;ro.observe(ws);render();measure();
 }
 function unmount(){if(!ui)return;lastScroll=ui.ws.scrollTop;ui.abort.abort();ui.ro.disconnect();cancelAnimationFrame(measureFrame);measureFrame=0;ui.anchor.remove();ui.spacer.remove();delete ui.ws.dataset.storyShelf;ui.ws.style.removeProperty('--story-min-list');ui=null;cancelAnimationFrame(frame);frame=0;}
 function update(){dataFrame=0;const fresh=D()?.snapshot?.();if(fresh){snapshot=fresh;serverOffset=fresh.now-Date.now();}
  const st=state(),home=$('#home'),ws=$('#workspace'),on=!!st.sessionUserId&&st.screen==='home'&&st.section==='chats';home?.classList.toggle('storiesV3Chats',on);
  if(!on){unmount();return;}if(ws&&!ui){const saved=lastScroll;mount(ws);ws.scrollTop=saved;schedulePaint();}else render();
  if(!linkHandled&&g.PablicusStoriesViewer){linkHandled=true;const u=new URL(location.href),id=u.searchParams.get('story'),owner=u.searchParams.get('story-owner');if(UUID.test(id||'')&&UUID.test(owner||'')){u.searchParams.delete('story');u.searchParams.delete('story-owner');history.replaceState(history.state,'',u);g.PablicusStoriesViewer.open(owner,null,document.activeElement,id);}}
 }
 function refresh(){if(!dataFrame)dataFrame=requestAnimationFrame(update);}
 function intercept(e){const t=e.target.closest?.('.pablicusStoryProfile,.contactAvatarTrigger,#conversationAvatar');if(!t||ui?.ignoreClick>performance.now()||tapIgnoreUntil>performance.now())return;const id=t.dataset.storyOwner||t.querySelector('[data-story-owner]')?.dataset.storyOwner;if(!UUID.test(id||'')||!active(id))return;e.preventDefault();e.stopImmediatePropagation();open(id,t);}
 
 // A profile pull is not a story tap; retain the existing photo/album drag contract.
 g.addEventListener('pointerdown',e=>{tapStart=e.target.closest?.('.pablicusStoryProfile')?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;},{capture:true,passive:true,signal:life.signal});
 g.addEventListener('pointermove',e=>{if(tapStart?.id===e.pointerId&&Math.hypot(e.clientX-tapStart.x,e.clientY-tapStart.y)>7)tapIgnoreUntil=performance.now()+450;},{capture:true,passive:true,signal:life.signal});
 g.addEventListener('pointerup',()=>{tapStart=null;},{capture:true,passive:true,signal:life.signal});
g.addEventListener('click',intercept,{capture:true,signal:life.signal});g.addEventListener('pablicus:stories-changed',refresh,{signal:life.signal});
 const unsubscribe=C.subscribe(()=>{if(account!==key()){account=key();unmount();lastScroll=0;cache.clear();snapshot={people:[],stories:[],now:Date.now()};g.PablicusStoriesViewer?.close(true);}refresh();});
 // Media dialogs retain their own zoom. Application chrome is not a zoomable canvas.
 function noPinch(e){if(!(e.target instanceof Element)||e.target.closest('dialog,[role="dialog"],.mediaViewer')||!e.target.closest('#home,#app'))return;if((e.type.startsWith('gesture')||e.touches?.length>1)&&e.cancelable)e.preventDefault();}
 for(const type of ['touchstart','touchmove','gesturestart','gesturechange'])document.addEventListener(type,noPinch,{capture:true,passive:false,signal:life.signal});
 g.PablicusStoriesCore=Object.freeze({flush:update,C,S,E,$,UUID,state,own,title,picture,conversation,avatar,feed,media,cache,current,active,key,refresh,now:()=>Date.now()+serverOffset,notify:t=>S()?.notify?.(t),destroy(){life.abort();unsubscribe();unmount();cancelAnimationFrame(dataFrame);cache.clear();}});refresh();
})(window);

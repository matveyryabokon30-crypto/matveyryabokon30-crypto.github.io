(function(root){'use strict';
 function ordered(items,favorites){return items.map((x,i)=>({x,i,p:x.pinned?1:0,f:favorites.has(x.id)?1:0})).sort((a,b)=>b.p-a.p||b.f-a.f||a.i-b.i).map(v=>v.x)}
 function reconcile(container,items,favorites){
  const next=ordered(items,favorites),ids=next.map(x=>x.id),current=[...container.querySelectorAll('[data-conversation-id]')].map(n=>n.dataset.conversationId);
  let changed=ids.length!==current.length||ids.some((id,i)=>id!==current[i]);
  if(!changed)return{changed:false,nodes:[...container.querySelectorAll('[data-conversation-id]')]};
  const byId=new Map([...container.querySelectorAll('[data-conversation-id]')].map(n=>[n.dataset.conversationId,n]));
  const frag=document.createDocumentFragment();for(const item of next){const n=byId.get(item.id);if(n)frag.append(n)}container.append(frag);return{changed:true,nodes:next.map(x=>byId.get(x.id)).filter(Boolean)};
 }

 // Avatars are a list-owned, read-only projection of profiles.avatar_url.
 // Resolve peers by membership IDs, never by a display name or chat title.
 function createAvatars({client=root.PablicusController?.getServices()?.client,getIdentity=()=>root.PablicusController?.state(),isActive=()=>true,pollMs=15000,now=()=>Date.now()}={}){
  const identity=getIdentity()||{},owner=identity.sessionUserId,generation=identity.sessionGeneration;
  const lifetime=new AbortController(),bindings=new Map(),metadata=new Map(),urls=new Map(),pendingUrls=new Map();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let disposed=false,busy=false,queued=false,again=false;
  const current=()=>{const i=getIdentity()||{};return !disposed&&!!owner&&i.sessionUserId===owner&&i.sessionGeneration===generation;};
  const visible=()=>current()&&!!client&&!document.hidden&&root.navigator.onLine!==false&&isActive();
  const live=b=>current()&&bindings.get(b.node)===b&&b.node.isConnected&&b.row.dataset.conversationId===b.id;
  function cancelImage(b){++b.version;if(b.image){b.image.onload=null;b.image.onerror=null;b.image.removeAttribute('src');b.image=null;}}
  function fallback(b,status='none'){cancelImage(b);b.url=null;b.node.replaceChildren(document.createTextNode(b.initial));b.node.dataset.avatarState=status;}
  function safeAvatar(value,person){
   if(typeof value!=='string'||!value.trim())return null;
   const path=value.trim();
   if(/^https:\/\//i.test(path)){try{const u=new root.URL(path);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
   return uuid.test(person||'')&&path.startsWith(person+'/')&&!path.includes('..')&&/^[a-z0-9_/-]+\.(?:jpe?g|png|webp|gif)$/i.test(path)?path:null;
  }
  async function read(query){const r=await(query.abortSignal?query.abortSignal(lifetime.signal):query);if(!current())throw Error('Avatar account changed');if(r.error)throw r.error;return r.data||[];}
  async function resolve(path){
   if(/^https:\/\//i.test(path))return path;
   const cached=urls.get(path);if(cached&&cached.until>now())return cached.url;
   if(pendingUrls.has(path))return pendingUrls.get(path);
   const request=(async()=>{const r=await client.storage.from('profile-media').createSignedUrl(path,300);if(!current())throw Error('Avatar account changed');if(r.error)throw r.error;
    const value=r.data?.signedUrl;if(typeof value!=='string'||!/^https:\/\//i.test(value))throw Error('Avatar URL unavailable');
    urls.set(path,{url:value,until:now()+240000});return value;
   })();
   pendingUrls.set(path,request);try{return await request;}finally{if(pendingUrls.get(path)===request)pendingUrls.delete(path);}
  }
  function paint(b,record){
   if(!live(b))return;
   const path=safeAvatar(record?.path,record?.person);
   if(!path){b.path=null;fallback(b,record?.unavailable?'unavailable':'none');return;}
   const cached=urls.get(path),fresh=/^https:\/\//i.test(path)||(cached&&cached.until>now());
   if(b.path===path&&b.url&&fresh&&b.node.dataset.avatarState==='ready')return;
   if(b.path===path&&b.node.dataset.avatarState==='loading')return;
   b.path=path;fallback(b,'loading');const ticket=b.version;
   resolve(path).then(url=>{
    if(!live(b)||ticket!==b.version||b.path!==path)return;
    const img=document.createElement('img');b.image=img;img.alt='';img.setAttribute('aria-hidden','true');img.referrerPolicy='no-referrer';img.draggable=false;img.decoding='async';
    Object.assign(img.style,{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%',display:'block',pointerEvents:'none'});
    img.onload=()=>{if(!live(b)||ticket!==b.version||b.path!==path)return;b.url=url;b.node.replaceChildren(img);b.node.dataset.avatarState='ready';};
    img.onerror=()=>{if(!live(b)||ticket!==b.version)return;urls.delete(path);fallback(b,'unavailable');};
    img.src=url;
   }).catch(()=>{if(live(b)&&ticket===b.version)fallback(b,'unavailable');});
  }
  async function refresh(){
   if(!visible())return;if(busy){again=true;return;}busy=true;again=false;
   try{
    for(const [node,b]of bindings){if(!node.isConnected){cancelImage(b);bindings.delete(node);}}
    const ids=[...new Set([...bindings.values()].map(b=>b.id))];
    for(const b of bindings.values())if(metadata.has(b.id))paint(b,metadata.get(b.id));
    for(let offset=0;offset<ids.length;offset+=50){
     if(!visible())break;const batch=ids.slice(offset,offset+50),result=new Map(batch.map(id=>[id,null]));
     // Read only known direct conversations through existing member RLS.
     const conversations=await read(client.from('conversations').select('id,type').in('id',batch).eq('type','direct'));
     const direct=conversations.filter(c=>batch.includes(c.id)&&c.type==='direct').map(c=>c.id);
     const members=direct.length?await read(client.from('conversation_members').select('conversation_id,user_id').in('conversation_id',direct).range(0,200)):[];
     if(members.length>=201)throw Error('Incomplete avatar membership result');
     const peers=new Map();
     for(const id of direct){const users=[...new Set(members.filter(m=>m.conversation_id===id).map(m=>m.user_id))];
      if(!users.includes(owner)||users.some(id=>!uuid.test(id))||users.length>2)continue;
      peers.set(id,users.find(id=>id!==owner)||owner);
     }
     const people=[...new Set(peers.values())],profiles=people.length?await read(client.from('profiles').select('id,avatar_url').in('id',people)):[];
     const byId=new Map(profiles.filter(p=>people.includes(p.id)).map(p=>[p.id,p]));
     if(!current())return;
     for(const [id,person]of peers){const p=byId.get(person);result.set(id,{person,path:p?.avatar_url||null,unavailable:!p});}
     for(const [id,value]of result)metadata.set(id,value);
     for(const b of bindings.values())if(result.has(b.id)&&isActive()&&!document.hidden)paint(b,result.get(b.id));
    }
   }catch{ /* Optional images must not break chats; retry on the next visible refresh. */ }
   finally{busy=false;if(again&&visible()){again=false;schedule();}}
  }
  function schedule(){if(queued||disposed)return;queued=true;queueMicrotask(()=>{queued=false;void refresh();});}
  function resetRows(){for(const b of bindings.values())cancelImage(b);bindings.clear();}
  const timer=root.setInterval(()=>{if(visible())schedule();},Math.max(1000,pollMs));
  document.addEventListener('visibilitychange',schedule,{signal:lifetime.signal});
  root.addEventListener('online',schedule,{signal:lifetime.signal});root.addEventListener('pageshow',schedule,{signal:lifetime.signal});root.addEventListener('focus',schedule,{signal:lifetime.signal});
  return{
   mount(row){const node=row.querySelector('.avatar'),id=row.dataset.conversationId;if(!node||!uuid.test(id||''))return;
    const old=bindings.get(node);if(old)cancelImage(old);bindings.set(node,{node,row,id,initial:node.textContent,version:0,path:null,url:null,image:null});schedule();},
   refresh,resetRows,
   destroy(){if(disposed)return;disposed=true;root.clearInterval(timer);lifetime.abort();resetRows();metadata.clear();urls.clear();pendingUrls.clear();}
  };
 }

 // Each mounted list owns its gesture state and removes listeners on disposal.
 // Native vertical scrolling wins unless a pull starts at the very top.
 function gestures(workspace,{panel,toggle,isActive=()=>true,onIdle=()=>{}}){
  const lifetime=new AbortController(),signal=lifetime.signal,rows=new Map();
  const avatars=createAvatars({isActive});
  let openRow=null,tracking=null,suppressUntil=0,panelOpen=false,panelHeight=0,idleTimer=0;
  const limit=()=>Math.min(220,panel.firstElementChild?.scrollHeight||120);
  function paintPanel(height,drag=false){
   panelHeight=Math.max(0,Math.min(limit(),height));panel.style.height=panelHeight+'px';
   panel.classList.toggle('is-dragging',drag);panel.inert=panelHeight<1;
  }
  function settlePanel(open){panelOpen=open;paintPanel(open?limit():0);toggle.setAttribute('aria-expanded',String(open));}
  function paintRow(row,x,drag=false){
   const entry=rows.get(row);if(!entry)return;
   const width=entry.face.clientWidth,positive=Math.min(entry.before.scrollWidth,width*.7),negative=Math.min(entry.after.scrollWidth,width*.7);
   entry.x=Math.max(-negative,Math.min(positive,x));entry.face.style.transform='translateX('+entry.x+'px)';
   row.classList.toggle('is-dragging',drag);row.dataset.swipe=entry.x>0?'right':entry.x<0?'left':'closed';
   entry.before.inert=entry.x<=0;entry.after.inert=entry.x>=0;
  }
  function closeRow(){if(openRow)paintRow(openRow,0);openRow=null;}
  function reveal(row,direction){
   if(openRow!==row)closeRow();const entry=rows.get(row);if(!entry)return;
   paintRow(row,direction>0?entry.before.scrollWidth:direction<0?-entry.after.scrollWidth:0);openRow=entry.x?row:null;
  }
  function start(x,y,target,id){
   if(!isActive()||target.closest('input,textarea,select,a,[contenteditable="true"]')||x<18||x>innerWidth-18)return;
   const row=target.closest('.chatCard'),entry=rows.get(row);
   if(target.closest('button')&&!target.closest('.chatMain,.contactAvatarTrigger'))return;
   tracking={x,y,id,row:entry?row:null,initialX:entry?.x||0,initialPanel:panelOpen,initialHeight:panelHeight,atTop:workspace.scrollTop<=1,axis:null,dx:0,dy:0};
  }
  function move(x,y,event){
   const t=tracking;if(!t||!isActive())return;
   t.dx=x-t.x;t.dy=y-t.y;
   if(!t.axis){
    if(Math.max(Math.abs(t.dx),Math.abs(t.dy))<9)return;
    if(Math.abs(t.dx)>Math.abs(t.dy)*1.25)t.axis=t.row?'row':'native';
    else if(Math.abs(t.dy)>Math.abs(t.dx)*1.25)t.axis=t.atTop&&(t.dy>0||t.initialPanel)?'panel':'native';
    else return;
    if(t.axis==='row'&&openRow!==t.row)closeRow();
    if(t.axis==='panel')closeRow();
   }
   if(t.axis==='native')return;
   if(event.cancelable)event.preventDefault();
   if(t.axis==='row'){paintRow(t.row,t.initialX+t.dx,true);openRow=t.row;}
   else paintPanel(t.initialHeight+t.dy,true);
  }
  function end(cancelled=false){
   const t=tracking;tracking=null;if(!t)return;clearTimeout(idleTimer);idleTimer=setTimeout(onIdle,40);if(!['row','panel'].includes(t.axis))return;
   suppressUntil=Date.now()+400;
   if(t.axis==='row'){
    if(cancelled){paintRow(t.row,t.initialX);openRow=t.initialX?t.row:null;return;}
    const entry=rows.get(t.row),x=entry?.x||0;
    if(Math.abs(t.dx)<24){paintRow(t.row,t.initialX);openRow=t.initialX?t.row:null;}
    else if(t.initialX&&Math.sign(t.dx)!==Math.sign(t.initialX)&&Math.sign(x)===Math.sign(t.initialX))reveal(t.row,0);
    else reveal(t.row,Math.abs(x)>=36?Math.sign(x):0);
   }else settlePanel(cancelled?t.initialPanel:Math.abs(t.dy)<32?t.initialPanel:t.dy>0);
  }
  function on(name,fn,options={}){workspace.addEventListener(name,fn,{...options,signal});}
  on('touchstart',e=>{if(e.touches.length!==1){end(true);return;}const t=e.touches[0];start(t.clientX,t.clientY,e.target,t.identifier);},{passive:true});
  on('touchmove',e=>{if(e.touches.length!==1){end(true);return;}const t=e.touches[0];if(tracking?.id===t.identifier)move(t.clientX,t.clientY,e);},{passive:false});
  on('touchend',()=>end());on('touchcancel',()=>end(true));
  on('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0)start(e.clientX,e.clientY,e.target,e.pointerId);});
  on('pointermove',e=>{if(e.pointerType!=='mouse'||tracking?.id!==e.pointerId)return;move(e.clientX,e.clientY,e);if(['row','panel'].includes(tracking?.axis))workspace.setPointerCapture?.(e.pointerId);});
  on('pointerup',e=>{if(e.pointerType==='mouse')end();});on('pointercancel',e=>{if(e.pointerType==='mouse')end(true);});
  on('pointerleave',e=>{if(e.pointerType==='mouse'&&!workspace.hasPointerCapture?.(e.pointerId))end(true);});
  on('click',e=>{
   if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
   if(openRow&&e.target.closest('.chatSwipeFace')?.parentElement===openRow){closeRow();e.preventDefault();e.stopImmediatePropagation();}
   else if(openRow&&!openRow.contains(e.target))closeRow();
  },{capture:true});
  on('keydown',e=>{
   const row=e.target.closest('.chatCard');
   if(e.key==='Escape'){closeRow();settlePanel(false);(row?.querySelector('.chatMain')||toggle).focus({preventScroll:true});return;}
   if(rows.has(row)&&e.target.closest('.chatMain')&&['ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();reveal(row,e.key==='ArrowRight'?1:-1);const entry=rows.get(row);(e.key==='ArrowRight'?entry.before:entry.after).querySelector('button')?.focus({preventScroll:true});
   }
  });
  toggle.addEventListener('click',()=>{closeRow();settlePanel(!panelOpen);},{signal});
  root.addEventListener('resize',()=>{end(true);closeRow();settlePanel(panelOpen);},{signal});
  settlePanel(false);
  return {
   decorate(row,face,before,after){rows.set(row,{face,before,after,x:0});paintRow(row,0);avatars.mount(row);root.PablicusContacts?.decorate(row);},
   close:closeRow,
   isTracking:()=>!!tracking,
   snapshot:()=>openRow?{id:openRow.dataset.conversationId,side:Math.sign(rows.get(openRow)?.x||0)}:null,
   restore(saved){if(saved){const row=[...rows.keys()].find(n=>n.dataset.conversationId===saved.id);if(row)reveal(row,saved.side);}},
   resetRows(){end(true);closeRow();rows.clear();avatars.resetRows();},
   destroy(){end(true);closeRow();settlePanel(false);clearTimeout(idleTimer);lifetime.abort();rows.clear();avatars.destroy();}
  };
 }
 root.PablicusChatListView={ordered,reconcile,gestures,createAvatars};
})(window);

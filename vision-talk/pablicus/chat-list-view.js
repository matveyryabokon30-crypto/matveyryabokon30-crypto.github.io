(function(root){'use strict';
 function ordered(items,favorites){return items.map((x,i)=>({x,i,p:x.pinned?1:0,f:favorites.has(x.id)?1:0})).sort((a,b)=>b.p-a.p||b.f-a.f||a.i-b.i).map(v=>v.x)}
 function reconcile(container,items,favorites){
  const next=ordered(items,favorites),ids=next.map(x=>x.id),current=[...container.querySelectorAll('[data-conversation-id]')].map(n=>n.dataset.conversationId);
  let changed=ids.length!==current.length||ids.some((id,i)=>id!==current[i]);
  if(!changed)return{changed:false,nodes:[...container.querySelectorAll('[data-conversation-id]')]};
  const byId=new Map([...container.querySelectorAll('[data-conversation-id]')].map(n=>[n.dataset.conversationId,n]));
  const frag=document.createDocumentFragment();for(const item of next){const n=byId.get(item.id);if(n)frag.append(n)}container.append(frag);return{changed:true,nodes:next.map(x=>byId.get(x.id)).filter(Boolean)};
 }

 // Each mounted list owns its gesture state and removes listeners on disposal.
 // Native vertical scrolling wins unless a pull starts at the very top.
 function gestures(workspace,{panel,toggle,isActive=()=>true,onIdle=()=>{}}){
  const lifetime=new AbortController(),signal=lifetime.signal,rows=new Map();
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
   if(target.closest('button')&&!target.closest('.chatMain'))return;
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
   decorate(row,face,before,after){rows.set(row,{face,before,after,x:0});paintRow(row,0);},
   close:closeRow,
   isTracking:()=>!!tracking,
   snapshot:()=>openRow?{id:openRow.dataset.conversationId,side:Math.sign(rows.get(openRow)?.x||0)}:null,
   restore(saved){if(saved){const row=[...rows.keys()].find(n=>n.dataset.conversationId===saved.id);if(row)reveal(row,saved.side);}},
   resetRows(){end(true);closeRow();rows.clear();},
   destroy(){end(true);closeRow();settlePanel(false);clearTimeout(idleTimer);lifetime.abort();rows.clear();}
  };
 }
 root.PablicusChatListView={ordered,reconcile,gestures};
})(window);

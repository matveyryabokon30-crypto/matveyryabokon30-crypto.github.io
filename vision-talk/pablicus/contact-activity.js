/* Server-backed activity. Only an account's chosen grammatical form is used. */
(function(root){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function label(data){
  const forms={male:['был недавно','был на этой неделе','был в этом месяце','был давно'],female:['была недавно','была на этой неделе','была в этом месяце','была давно'],neutral:['недавно в сети','на этой неделе в сети','в этом месяце в сети','давно не в сети']};
  const i=['recent','week','month','long_ago'].indexOf(data?.status);return i<0?'Статус активности недоступен':(forms[data?.status_form]||forms.neutral)[i];
 }
 function create(client,controller){
  const lifetime=new AbortController(),bindings=new Map();
  let dead=false,owner=null,generation=null,lastTouch=0,form='neutral',touching=null,wakeQueued=false;
  const snapshot=()=>controller.state();
  const same=s=>!dead&&s.sessionUserId===snapshot().sessionUserId&&s.sessionGeneration===snapshot().sessionGeneration;
  const active=()=>!dead&&!!snapshot().sessionUserId&&!document.hidden&&navigator.onLine!==false;
  const bound=b=>same(b.identity)&&b.node.isConnected&&bindings.get(b.node)===b;
  const shown=b=>bound(b)&&b.node.closest('dialog')?.open!==false;
  async function touch(selected=null){
   const s=snapshot();if(!active()){if(selected!==null)throw Error('Activity offline');return null;}
   if(touching){try{await touching;}catch{if(selected===null)return null;}if(!same(s)||!active())return null;if(selected===null)return form;}
   if(!same(s)||!active())return null;if(selected===null&&Date.now()-lastTouch<45000)return form;
   const task=(async()=>{
    const r=await client.rpc('pablicus_touch_activity',{p_status_form:selected});
    if(!same(s))return null;if(r.error)throw r.error;
    lastTouch=Date.now();form=['male','female','neutral'].includes(r.data?.status_form)?r.data.status_form:'neutral';return form;
   })();
   touching=task;try{return await task;}finally{if(touching===task)touching=null;}
  }
  function paint(b,data){
   if(!shown(b))return;const text=label(data);
   // Do not replace a card or an unchanged text node: scroll geometry stays untouched.
   if(b.node.textContent!==text)b.node.textContent=text;
   const status=data?.status||'unknown';if(b.node.dataset.activityStatus!==status)b.node.dataset.activityStatus=status;
  }
  async function refresh(b){
   if(!active()||!shown(b)||b.busy)return;
   b.busy=true;try{
    const r=await client.rpc('pablicus_contact_activity',{p_conversation_id:b.id});
    if(!bound(b))return;if(r.error)throw r.error;paint(b,r.data);
   }catch{if(bound(b))paint(b,null);}finally{b.busy=false;}
  }
  function bind(node,id){
   const s=snapshot();if(!node||!UUID.test(id||'')||!s.sessionUserId)return;
   // A stale card from a previous account must never be rebound as the next account.
   if(node.dataset.activityOwnerId&&node.dataset.activityOwnerId!==s.sessionUserId)return;
   if(node.dataset.activityGeneration&&node.dataset.activityGeneration!==String(s.sessionGeneration))return;
   const previous=bindings.get(node);if(previous?.id===id&&same(previous.identity))return;
   const b={node,id,identity:s,busy:false};bindings.set(node,b);void refresh(b);
  }
  function discover(){
   if(dead)return;
   for(const node of document.querySelectorAll('.contactActivity[data-activity-conversation-id]'))bind(node,node.dataset.activityConversationId);
   mountPreference();
  }
  function sweep(){for(const[n,b]of bindings){if(!bound(b))bindings.delete(n);else void refresh(b);}}
  function wake(){if(active()){void touch().catch(()=>{});discover();sweep();}}
  function scheduleWake(){
   if(dead||wakeQueued)return;wakeQueued=true;
   // Let session import/auth callbacks finish before making authenticated RPC calls.
   root.setTimeout(()=>{wakeQueued=false;if(!dead)wake();},0);
  }
  function mountPreference(){
   const host=document.querySelector('.youForm');if(!host?.querySelector('[name="username"]')||host.querySelector('.activityFormPreference')||!snapshot().sessionUserId)return;
   const s=snapshot(),wrap=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select'),status=document.createElement('small');
   wrap.className='youField activityFormPreference';title.textContent='Форма статуса активности';select.setAttribute('aria-label',title.textContent);select.style.cssText='font:inherit;font-size:16px;min-height:44px;width:100%';
   for(const[value,text]of [['neutral','Недавно в сети'],['male','Был недавно'],['female','Была недавно']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
   select.value=form;status.setAttribute('role','status');wrap.append(title,select,status);host.querySelector('[name="username"]').closest('.youField').after(wrap);
   select.onchange=async()=>{if(!same(s))return;select.disabled=true;try{const saved=await touch(select.value);if(same(s)&&wrap.isConnected){if(saved===null)throw Error('Activity not saved');status.textContent='Сохранено';}}catch{if(same(s)&&wrap.isConnected){select.value=form;status.textContent='Не удалось сохранить. Повторите при подключении к интернету.';}}finally{select.disabled=false;}};
   Promise.resolve(touching).then(()=>{if(same(s)&&wrap.isConnected&&!select.disabled)select.value=form;}).catch(()=>{});
  }
  const unsub=controller.subscribe(s=>{
   if(s.sessionUserId!==owner||s.sessionGeneration!==generation){owner=s.sessionUserId;generation=s.sessionGeneration;lastTouch=0;form='neutral';touching=null;bindings.clear();}
   scheduleWake();
  });
  document.addEventListener('visibilitychange',scheduleWake,{signal:lifetime.signal});
  for(const event of ['online','pageshow','focus'])root.addEventListener(event,scheduleWake,{signal:lifetime.signal});
  // Status refreshes on an open card independently of incoming messages. Heartbeats stay throttled.
  const timer=root.setInterval(wake,15000);
  const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1)))discover();});
  observer.observe(document.body,{childList:true,subtree:true});discover();
  return{bind,label,destroy(){if(dead)return;dead=true;unsub();lifetime.abort();root.clearInterval(timer);observer.disconnect();bindings.clear();}};
 }
 root.PablicusActivity={label,create};
 let attempts=0;
 function boot(){
  if(root.PablicusActivityService)return;
  const c=root.PablicusController,client=c?.getServices()?.client;
  if(c&&client){root.PablicusActivityService=create(client,c);return;}
  // Handles deferred script/service setup without an unbounded background poll.
  if(++attempts<=40)root.setTimeout(boot,250);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 root.addEventListener('pageshow',()=>{attempts=0;boot();});
})(window);

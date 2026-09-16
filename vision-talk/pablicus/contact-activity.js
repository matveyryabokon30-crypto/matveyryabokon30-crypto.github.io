/* Server-backed coarse activity. A grammatical form is self-selected, never inferred. */
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
   if(touching){try{await touching;}catch{if(selected===null)return null;}if(!same(s)||!active())return null;if(selected===null)return null;}
   if(!same(s)||!active())return null;if(selected===null&&Date.now()-lastTouch<45000)return null;
   const task=(async()=>{const r=await client.rpc('pablicus_touch_activity',{p_status_form:selected});if(!same(s))return null;if(r.error)throw r.error;lastTouch=Date.now();form=['male','female','neutral'].includes(r.data?.status_form)?r.data.status_form:'neutral';return form;})();
   touching=task;try{return await task;}finally{if(touching===task)touching=null;}
  }
  async function refresh(b){
   if(!active()||!b.node.isConnected||!same(b.identity)||b.busy)return;
   b.busy=true;try{const r=await client.rpc('pablicus_contact_activity',{p_conversation_id:b.id});if(!same(b.identity)||!b.node.isConnected||bindings.get(b.node)!==b)return;if(r.error)throw r.error;b.node.textContent=label(r.data);b.node.dataset.activityStatus=r.data?.status||'unknown';}
   catch{if(same(b.identity)&&b.node.isConnected&&bindings.get(b.node)===b){b.node.textContent='Статус активности недоступен';b.node.dataset.activityStatus='unknown';}}finally{b.busy=false;}
  }
  function bind(node,id){if(!node||!id)return;const b={node,id,identity:snapshot(),busy:false};bindings.set(node,b);node.textContent='Статус активности недоступен';void refresh(b);}
  function sweep(){for(const[n,b]of bindings){if(!n.isConnected||!same(b.identity))bindings.delete(n);else void refresh(b);}}
  function wake(){if(active()){void touch().catch(()=>{});sweep();}}
  function mountPreference(){
   const host=document.querySelector('.youForm');if(!host?.querySelector('[name="username"]')||host.querySelector('.activityFormPreference')||!snapshot().sessionUserId)return;
   const s=snapshot(),wrap=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select'),status=document.createElement('small');
   wrap.className='youField activityFormPreference';title.textContent='Форма статуса активности';select.setAttribute('aria-label',title.textContent);select.style.cssText='font:inherit;font-size:16px;min-height:44px;width:100%';
   for(const[value,text]of [['neutral','Без указания — «недавно в сети»'],['male','Мужская — «был недавно»'],['female','Женская — «была недавно»']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
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

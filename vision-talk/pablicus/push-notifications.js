/* Web Push consent belongs to this device and account. No token is stored here or in the worker. */
(function(root){
 'use strict';
 const OWNER='pablicus:push-owner',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const element=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function keyBytes(value){const s=String(value||'');if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Не удалось получить ключ уведомлений.');const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length!==65||bytes[0]!==4)throw Error('Не удалось получить ключ уведомлений.');return bytes;}
 function limited(promise,ms=8000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Нет ответа. Проверьте интернет и повторите.')),ms);})]).finally(()=>clearTimeout(timer));}
 function create(options={}){
  if(typeof options.getSession!=='function'||typeof options.getUserId!=='function')throw Error('Push account callbacks are required');
  const endpoint=new URL('/functions/v1/pablicus-push',options.projectUrl).href;
  const scope=new URL('./',root.location.href).href;
  let installationId=null,trackingState="unknown";
  let generation=0,enabled=false,busy=false,destroyed=false,refreshing=null,section=null,button=null,status=null;
  let account=options.getUserId()||null,nextAt=0,failures=0,retryTimer=null,phase='idle',suspended=false,lastSession=null;
  function sessionIdentity(session){try{const p=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return UUID.test(p.session_id||'')?p.session_id:null;}catch{return null;}}
  const controllers=new Set(),lockName='pablicus:push-reconcile:'+scope;
  const consentKey=uid=>'pablicus:r2:consent:'+uid;
  const pauseKey=uid=>'pablicus:r2:paused:'+uid;
  function paused(uid){try{return !!root.localStorage.getItem(pauseKey(uid));}catch{return true;}}
  function consent(uid){try{const v=root.localStorage.getItem(consentKey(uid));return v==='enabled'||(v===null&&readOwner()===uid);}catch{return false;}}
  function saveConsent(uid,value){root.localStorage.setItem(consentKey(uid),value);}
  function sequence(uid){const k='pablicus:r2:seq:'+uid;const n=Math.max(Number(root.localStorage.getItem(k)||0)+1,Date.now()*1000);if(!Number.isSafeInteger(n))throw Error('Не удалось сохранить состояние уведомлений.');root.localStorage.setItem(k,String(n));return n;}
  function allocate(uid){return navigator.locks?.request?navigator.locks.request(lockName+':sequence',()=>sequence(uid)):Promise.resolve(sequence(uid));}
  function invalidate(){++generation;nextAt=0;failures=0;clearTimeout(retryTimer);retryTimer=null;for(const c of controllers)c.abort();controllers.clear();}
  function guard(uid,token){if(suspended||paused(uid)||!still(uid,token)||!consent(uid)||Notification.permission!=='granted')throw Error('PUSH_OPERATION_CANCELLED');}
  function schedule(){clearTimeout(retryTimer);if(destroyed||failures>5||document.hidden||navigator.onLine===false)return;retryTimer=setTimeout(()=>{retryTimer=null;void refresh();},Math.max(50,nextAt-Date.now()));}
  async function exclusive(work){
   // Supported Home Screen Safari has Web Locks. Never emulate a cross-tab mutex with a racy localStorage flag.
   if(!navigator.locks?.request)throw Error('Обновите браузер, чтобы восстановить уведомления.');
   return navigator.locks.request(lockName,{ifAvailable:true},lock=>{if(!lock){phase='busy_elsewhere';nextAt=Date.now()+2000;schedule();return;}return work();});
  }
  const readOwner=()=>{try{return root.localStorage.getItem(OWNER)||'';}catch{return '';}};
  const writeOwner=id=>{try{if(id)root.localStorage.setItem(OWNER,id);else root.localStorage.removeItem(OWNER);}catch{}};
  const supported=()=>root.isSecureContext&&'serviceWorker'in navigator&&'PushManager'in root&&'Notification'in root;
  const needsInstall=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=()=>root.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
  const still=(uid,token)=>!destroyed&&token===generation&&options.getUserId()===uid;
  function view(message=''){
   if(!section)return;const uid=options.getUserId();section.hidden=!uid;button.disabled=busy;button.textContent=enabled?'Отключить уведомления':'Включить уведомления';
   if(needsInstall()&&!standalone()){button.textContent='Добавить на главный экран';status.textContent='На iPhone откройте приложение с главного экрана, чтобы включить уведомления.';return;}
   if(!supported()){button.disabled=true;status.textContent='Этот браузер не поддерживает уведомления. Откройте приложение в Safari или другом поддерживаемом браузере.';return;}
   if(Notification.permission==='denied'){button.disabled=true;status.textContent='Уведомления запрещены. Разрешите их для Pablicus в настройках уведомлений устройства.';return;}
   status.textContent=message||(enabled?'Уведомления о сообщениях и напоминания о делах включены на этом устройстве.':'Сообщения и напоминания о делах смогут появляться на экране, даже когда приложение закрыто.');
  }
  async function registration(){const reg=await limited(navigator.serviceWorker.getRegistration(scope).then(r=>r?.active?r:navigator.serviceWorker.ready));if(!reg?.active||reg.scope!==scope)throw Error('Обновление приложения ещё устанавливается. Откройте приложение повторно.');return reg;}
  async function bind(recipientId,reg){
   reg=reg||await registration();await limited(new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=e=>{channel.port1.close();e.data?.ok?resolve():reject(Error('Не удалось настроить уведомления.'));};channel.port1.onmessageerror=()=>{channel.port1.close();reject(Error('Не удалось настроить уведомления.'));};reg.active.postMessage({type:'PABLICUS_PUSH_BIND',recipientId:recipientId||null},[channel.port2]);}));
  }
  function installationMetadata(uid){
    try{const key='pablicus:r1:client:'+uid;let id=root.localStorage.getItem(key);
     if(!UUID.test(id||'')){id=root.crypto.randomUUID();root.localStorage.setItem(key,id);}
     const build=root.PablicusBuild?.id;if(!/^git:[a-f0-9]{40}$/.test(build||''))return null;
     const platform=needsInstall()?'web_ios':/Android/.test(navigator.userAgent)?'web_android':'web_other';
     return{client_id:id,build_id:build,platform};
    }catch{return null;}
   }
   async function request(method,body,uid,token=generation,capturedSession=null){
   const raw=capturedSession||await limited(Promise.resolve(options.getSession())),session=raw?.data?.session||raw?.session||raw;
   const departing=body?.action==='revoke'&&capturedSession;
   if(!session?.access_token||session.user?.id!==uid||(!departing&&(options.getUserId()!==uid||token!==generation||destroyed)))throw Error('PUSH_OPERATION_CANCELLED');
   if(!departing)lastSession=session;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);if(!departing)controllers.add(controller);
   try{const response=await limited(fetch(endpoint,{method,headers:{Authorization:'Bearer '+session.access_token,apikey:options.apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,cache:'no-store'}),11000);
    const data=await limited(response.json().catch(()=>({})),3000);
    if(!response.ok)throw Error(response.status===401?'Войдите снова, чтобы включить уведомления.':'Не удалось подключить уведомления. Повторите попытку.');
    if(body?.action==='reconcile'&&still(uid,token)){installationId=UUID.test(data.installation_id||'')?data.installation_id:null;trackingState=data.tracking||'unknown';}
    return data;
   }finally{clearTimeout(timer);controllers.delete(controller);}
  }
  async function reconcile(uid,token,seq){
   guard(uid,token);const meta=installationMetadata(uid);if(!meta)throw Error('Не удалось сохранить состояние уведомлений.');
   const reg=await registration();guard(uid,token);
   let sub=await limited(reg.pushManager.getSubscription());guard(uid,token);
   const config=await request('GET',null,uid,token);guard(uid,token);const applicationServerKey=keyBytes(config.publicKey);
   const currentKey=sub?.options?.applicationServerKey;
   const incompatible=currentKey&&(!Array.from(new Uint8Array(currentKey)).every((v,i)=>v===applicationServerKey[i])||currentKey.byteLength!==applicationServerKey.length);
   if(sub&&(readOwner()&&readOwner()!==uid||incompatible||sub.expirationTime&&sub.expirationTime<=Date.now())){
    await bind(null,reg);guard(uid,token);if(!await limited(sub.unsubscribe()))throw Error('Не удалось обновить подписку.');sub=null;
   }
   if(!sub){
    guard(uid,token);
    // subscribe is not abortable. Retain the cross-tab lock until it settles; the caller has a separate deadline.
    sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
    if(!still(uid,token)||!consent(uid)||Notification.permission!=='granted'){await limited(sub.unsubscribe()).catch(()=>{});throw Error('PUSH_OPERATION_CANCELLED');}
   }
   guard(uid,token);await bind(uid,reg);guard(uid,token);
   const result=await request('POST',{action:'reconcile',installation:meta,operation_seq:seq,permission:'granted',app_consent:'enabled',subscription:sub.toJSON()},uid,token);
   guard(uid,token);if(result.ok!==true)throw Error('Не удалось подтвердить подписку.');
   saveConsent(uid,'enabled');writeOwner(uid);enabled=true;phase='ready';failures=0;nextAt=Date.now()+60000;view();return result;
  }
  function refresh(){
   const uid=options.getUserId();
   if(uid!==account){invalidate();account=uid||null;enabled=false;installationId=null;}
   if(refreshing)return refreshing;
   if(!uid||destroyed||suspended||paused(uid)||busy||!supported()||(needsInstall()&&!standalone()))return Promise.resolve();
   if(readOwner()&&readOwner()!==uid){
    const token=generation;
    refreshing=exclusive(async()=>{const reg=await registration();if(!still(uid,token))return;await bind(null,reg);const sub=await limited(reg.pushManager.getSubscription());if(!still(uid,token))return;if(sub&&!await limited(sub.unsubscribe()))throw Error('Не удалось отключить прежние уведомления.');if(still(uid,token))writeOwner('');}).catch(()=>{nextAt=Date.now()+5000;}).finally(()=>{refreshing=null;if(still(uid,token))schedule();});return refreshing;
   }
   if(Notification.permission!=='granted'||!consent(uid)){enabled=false;phase=Notification.permission==='granted'?'disabled':Notification.permission;view();return Promise.resolve();}
   if(navigator.onLine===false){phase='offline';return Promise.resolve();}
   if(Date.now()<nextAt){schedule();return Promise.resolve();}
   const token=generation;phase='checking';
   const work=exclusive(async()=>{guard(uid,token);const seq=await allocate(uid);guard(uid,token);return reconcile(uid,token,seq);});
   // Timeout invalidates all continuations but never releases an unresolved browser subscription lock early.
   refreshing=limited(work,35000).catch(e=>{
    if(still(uid,token)){for(const c of controllers)c.abort();++generation;enabled=false;phase=e.message==='PUSH_OPERATION_CANCELLED'?'cancelled':'retry';failures++;nextAt=Date.now()+Math.min(300000,2000*2**(failures-1))*(0.8+Math.random()*0.4);view(e.message==='PUSH_OPERATION_CANCELLED'?'':e.message);schedule();}
   }).finally(()=>{refreshing=null;if(!destroyed&&!suspended&&(options.getUserId()!==uid||generation!==token)&&!paused(options.getUserId()))schedule();});return refreshing;
  }
  async function enable(){
   if(busy||destroyed||suspended)return;if(needsInstall()&&!standalone()){options.onInstall?.();return;}
   const uid=options.getUserId();if(!uid||!supported())return;
   const permission=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
   invalidate();const token=generation;busy=true;view('Подключаем уведомления…');
   try{if(await permission!=='granted'){view('Разрешение не получено. Уведомления не включены.');return;}if(!still(uid,token))return;
    saveConsent(uid,'enabled');root.localStorage.removeItem(pauseKey(uid));busy=false;nextAt=0;if(refreshing)await refreshing;if(still(uid,token))await refresh();
   }catch(e){if(still(uid,token))view(e.message);}finally{busy=false;view(status?.textContent);}
  }
  async function signOut({remote=true}={}){
   const uid=options.getUserId(),priorOwner=readOwner(),captured=lastSession?.user?.id===uid?lastSession:null;suspended=true;try{if(uid)root.localStorage.setItem(pauseKey(uid),sessionIdentity(captured)||root.localStorage.getItem(pauseKey(uid))||'unknown');}catch{}invalidate();const token=generation;
   let seq=null,meta=null;try{if(uid){seq=await allocate(uid);meta=installationMetadata(uid);}}catch{}
   installationId=null;trackingState='detached';enabled=false;busy=false;writeOwner('');view();let detached=false,serverRemoved=false;
   if(!supported())return{detached:true,serverRemoved:false};
   if(!priorOwner&&Notification.permission!=='granted')return{detached:true,serverRemoved:false};
   try{const reg=await registration();try{await bind(null,reg);detached=true;}catch{}
    try{for(const notification of await limited(reg.getNotifications()))notification.close();}catch{}
    const sub=await limited(reg.pushManager.getSubscription());
    // Revoke creates a server fence even when the preceding subscribe has not reached the database yet.
    const removal=remote&&uid&&meta&&seq?request('POST',{action:'revoke',installation:meta,operation_seq:seq,...(sub?{endpoint:sub.endpoint}:{})},uid,token,captured).then(r=>{serverRemoved=r.ok===true;}).catch(()=>{}):Promise.resolve();
    if(sub)try{detached=(await limited(sub.unsubscribe()))||detached;}catch{}
    await removal;
   }catch{}
   lastSession=null;return{detached,serverRemoved};
  }
  async function disable(){if(busy)return;const uid=options.getUserId();if(!uid)return;try{saveConsent(uid,'disabled');}catch{view('Не удалось сохранить отключение уведомлений.');return;}busy=true;view('Отключаем уведомления…');const result=await signOut();suspended=false;view(result.detached?'Уведомления на этом устройстве отключены.':'Не удалось отключить уведомления. Повторите попытку или отключите их в настройках устройства.');}
  function mount(container){
   if(!container)return null;section=element('section','pushSettings');section.setAttribute('aria-label','Уведомления');
   const title=element('h2','','Уведомления');button=element('button','setting pushButton');button.type='button';status=element('p','pushStatus');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   button.onclick=()=>enabled?disable():enable();section.append(title,button,status);container.append(section);view();refresh();return section;
  }
  function onMessage(event){const data=event.data;if(data?.type!=='PABLICUS_PUSH_OPEN'||!UUID.test(data.conversationId||'')||data.recipientId!==options.getUserId())return;if(data.taskId&&(!UUID.test(data.taskId)||!['task_reminder','task_followup'].includes(data.kind)))return;options.onOpenConversation?.(data.conversationId,data.recipientId,data.taskId?{taskId:data.taskId,kind:data.kind}:null);}
  navigator.serviceWorker?.addEventListener('message',onMessage);
  function clear(){return signOut();}
  function sessionRestored(session){const uid=options.getUserId();if(session?.user?.id===uid)lastSession=session;const sid=sessionIdentity(session);if(uid)try{const prior=root.localStorage.getItem(pauseKey(uid));if(prior&&sid&&prior!=='unknown'&&sid!==prior)root.localStorage.removeItem(pauseKey(uid));}catch{}suspended=false;return refresh();}
  function lifecycle(){if(!document.hidden)void refresh();}
  function storageChanged(e){if(e.key===OWNER||e.key===consentKey(options.getUserId())||e.key===pauseKey(options.getUserId())){invalidate();enabled=false;lifecycle();}}
  function workerMessage(e){if(e.data?.type==='PABLICUS_PUSH_REPAIR_PENDING')lifecycle();}
  root.addEventListener?.('pageshow',lifecycle);root.addEventListener?.('online',lifecycle);
  root.addEventListener?.('storage',storageChanged);document.addEventListener?.('visibilitychange',lifecycle);
  navigator.serviceWorker?.addEventListener('controllerchange',lifecycle);navigator.serviceWorker?.addEventListener('message',workerMessage);
  function destroy(){destroyed=true;invalidate();root.removeEventListener?.('pageshow',lifecycle);root.removeEventListener?.('online',lifecycle);root.removeEventListener?.('storage',storageChanged);document.removeEventListener?.('visibilitychange',lifecycle);navigator.serviceWorker?.removeEventListener('controllerchange',lifecycle);navigator.serviceWorker?.removeEventListener('message',workerMessage);navigator.serviceWorker?.removeEventListener('message',onMessage);section?.remove();section=button=status=null;}
  if(options.container)mount(options.container);
  async function inspect(){const uid=options.getUserId();if(!uid||!installationId)return{tracking:trackingState,reconcile_state:phase,installation_id:null,banner_visibility:'unknown'};return request('POST',{action:'status',installation_id:installationId},uid);}
  return{mount,refresh,sessionRestored,enable,disable,signOut,clear,destroy,inspect,get enabled(){return enabled;}};
 }
 root.PablicusPush={create,keyBytes};
})(typeof window!=='undefined'?window:globalThis);

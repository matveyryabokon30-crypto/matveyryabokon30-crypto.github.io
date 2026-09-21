/* UI-AU2: automatic on launch and return. Never interrupt active work or discard drafts. */
(function(g){
 'use strict';if(g.PablicusAutoUpdate||!('serviceWorker'in navigator))return;
 const scope=new URL('./',location.href).href,monitored=new WeakSet();
 const build=()=>g.PablicusBuild?.id||document.querySelector('meta[name="pablicus-release"]')?.content;
 let registration=null,checking=false,lastCheck=0,changing=false,reloading=false,lastInput=0;
 let inspectController=true,activationWorker=null,activationTime=0,lastResume=0;
 function ready(){const a=document.activeElement;return document.readyState==='complete'&&!document.hidden&&Date.now()-lastInput>2500&&!(a&&(a.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(a.tagName)))&&!g.PablicusCallsActive?.()&&!g.PablicusUpdateGuards?.busy();}
 function identity(worker){return new Promise(resolve=>{
  if(!worker){resolve(null);return;}const ch=new MessageChannel();let done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);ch.port1.close();ch.port2.close();resolve(value);};
  const timer=setTimeout(()=>finish(null),1500);ch.port1.onmessage=e=>finish(e.data?.buildId||null);
  try{worker.postMessage({type:'PABLICUS_RELEASE'},[ch.port2]);}catch{finish(null);}
 });}
 async function apply(){
  if(changing||reloading||!ready()||(!registration?.waiting&&!inspectController))return;changing=true;
  try{
   if(inspectController&&navigator.serviceWorker.controller){
    const worker=navigator.serviceWorker.controller,id=await identity(worker);
    if(worker!==navigator.serviceWorker.controller||!ready())return;
    if(id&&build()&&id!==build()){
     await g.PablicusUpdateGuards?.prepare();if(!ready()||worker!==navigator.serviceWorker.controller)return;
     reloading=true;location.reload();return;
    }
    // Do not reload on the first installation or a same-version controller event.
    // Missing worker identity is retried automatically, never guessed coherent.
    if(id&&id===build())inspectController=false;
   }
   const waiting=registration?.waiting;if(!waiting||waiting===activationWorker&&Date.now()-activationTime<15000)return;
   await g.PablicusUpdateGuards?.prepare();if(!ready()||registration.waiting!==waiting)return;
   activationWorker=waiting;activationTime=Date.now();waiting.postMessage('ACTIVATE');
  }catch(e){console.warn('Update waits for safe draft persistence');}finally{changing=false;}
 }
 function watch(worker){if(!worker||monitored.has(worker))return;monitored.add(worker);worker.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')void apply();});}
 async function check(force=false){
  void apply();if(checking||!navigator.onLine||(!force&&Date.now()-lastCheck<30000))return;
  checking=true;lastCheck=Date.now();try{
   if(!registration){registration=await navigator.serviceWorker.register('sw.js',{scope,updateViaCache:'none'});registration.addEventListener('updatefound',()=>watch(registration.installing));}
   watch(registration.installing);void apply();await registration.update();void apply();
  }catch(e){console.warn('Release check will retry');}finally{checking=false;}
 }
 function resume(){
  inspectController=true;void apply();
  // pageshow/focus/visibility often arrive together, but a real return must not
  // inherit the periodic 30s cooldown and miss an already published release.
  if(Date.now()-lastResume<1000)return;lastResume=Date.now();void check(true);
 }
 navigator.serviceWorker.addEventListener('controllerchange',()=>{inspectController=true;activationWorker=null;void apply();});
 for(const name of ['pointerdown','keydown','input'])document.addEventListener(name,()=>{lastInput=Date.now();},{capture:true,passive:true});
 for(const name of ['pageshow','focus','online','load'])g.addEventListener(name,resume,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();},{passive:true});
 // Legacy markup is inert; there is no user action needed to install releases.
 const banner=document.getElementById('updateNotice');if(banner)banner.hidden=true;
 setInterval(()=>{if(!document.hidden){void apply();if(Date.now()-lastCheck>300000)void check();}},2000);
 g.PablicusAutoUpdate=Object.freeze({check:()=>check(true)});void check(true);
})(window);

/* One update coordinator. Never reload a call, a recording, an upload or an unsaved form. */
(function(g){
 'use strict';if(g.PablicusAutoUpdate||!('serviceWorker'in navigator))return;
 let registration=null,checking=false,lastCheck=0,changing=false,reloading=false,lastInput=Date.now(),newController=false;
 const monitored=new WeakSet(),scope=new URL('./',location.href).href;
 function ready(){const a=document.activeElement;return document.readyState==='complete'&&!document.hidden&&Date.now()-lastInput>2500&&!(a&&(a.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(a.tagName)))&&!g.PablicusCallsActive?.()&&!g.PablicusUpdateGuards?.busy();}
 async function apply(){
  if(changing||reloading||!ready()||(!registration?.waiting&&!newController))return;changing=true;
  try{await g.PablicusUpdateGuards?.prepare();if(!ready())return;
   if(newController){reloading=true;location.reload();return;}registration.waiting?.postMessage('ACTIVATE');
  }catch(e){console.warn('Update waits for safe draft persistence');}finally{changing=false;}
 }
 function watch(worker){if(!worker||monitored.has(worker))return;monitored.add(worker);worker.addEventListener('statechange',()=>{if(worker.state==='installed')void apply();});}
 async function check(){if(checking||Date.now()-lastCheck<30000)return;checking=true;lastCheck=Date.now();try{
  if(!registration){registration=await navigator.serviceWorker.register('sw.js',{scope,updateViaCache:'none'});registration.addEventListener('updatefound',()=>watch(registration.installing));}
  watch(registration.installing);await registration.update();void apply();
 }catch(e){console.warn('Release check will retry');}finally{checking=false;}}
 navigator.serviceWorker.addEventListener('controllerchange',()=>{newController=true;void apply();});
 for(const name of ['pointerdown','keydown','input'])document.addEventListener(name,()=>{lastInput=Date.now();},{capture:true,passive:true});
 for(const name of ['pageshow','focus','online'])g.addEventListener(name,()=>void check(),{passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){void check();void apply();}},{passive:true});
 const banner=document.getElementById('updateNotice');if(banner)banner.hidden=true;
 setInterval(()=>{if(!document.hidden){void apply();if(Date.now()-lastCheck>300000)void check();}},2000);
 g.PablicusAutoUpdate=Object.freeze({check});void check();
})(window);

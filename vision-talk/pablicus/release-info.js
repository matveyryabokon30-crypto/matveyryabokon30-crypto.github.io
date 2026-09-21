/* Generated build identity. Contains no user identifiers or credentials. */
(function(g){'use strict';
 const id="git:7e3cf1126cde9b6bb40ffeac842571717585357e",sourceSha="7e3cf1126cde9b6bb40ffeac842571717585357e";
 async function inspect(){
  let worker=null;
  const controller=navigator.serviceWorker?.controller;
  if(controller)worker=await new Promise(resolve=>{
   const ch=new MessageChannel();let done=false;
   const finish=v=>{if(done)return;done=true;clearTimeout(timer);ch.port1.close();ch.port2.close();resolve(v);};
   const timer=setTimeout(()=>finish(null),2000);
   ch.port1.onmessage=e=>finish(e.data);
   try{controller.postMessage({type:'PABLICUS_RELEASE'},[ch.port2]);}catch{finish(null);}
  });
  return {buildId:id,sourceSha,stage:'UI-V4',htmlBuildId:document.querySelector('meta[name="pablicus-release"]')?.content||null,workerBuildId:worker?.buildId||null,workerVersion:worker?.version||null,coherent:worker?.buildId===id,notificationPermission:g.Notification?.permission||'unsupported',standalone:!!(g.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)};
 }
 g.PablicusBuild=Object.freeze({id,sourceSha,stage:'UI-V4',inspect});
})(window);

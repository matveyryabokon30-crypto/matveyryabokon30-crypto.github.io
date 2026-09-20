/* Generated build identity. Contains no user identifiers or credentials. */
(function(g){'use strict';
 const id="git:f77d141e4b8c092ed36247ae9b6bcf166bcbb5ce",sourceSha="f77d141e4b8c092ed36247ae9b6bcf166bcbb5ce";
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
  return {buildId:id,sourceSha,stage:'F06',htmlBuildId:document.querySelector('meta[name="pablicus-release"]')?.content||null,workerBuildId:worker?.buildId||null,workerVersion:worker?.version||null,coherent:worker?.buildId===id,notificationPermission:g.Notification?.permission||'unsupported',standalone:!!(g.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)};
 }
 g.PablicusBuild=Object.freeze({id,sourceSha,stage:'F06',inspect});
})(window);

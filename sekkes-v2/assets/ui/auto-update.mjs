// Refresh only after a complete shell is available and conversation/capture is idle.
export function autoUpdate({sw=navigator.serviceWorker,doc=document,events=window,canReload,preserve,reload=()=>location.reload(),every=setInterval,clear=clearInterval}){
 let registration,changed=false,reloading=false,controlled=Boolean(sw.controller),lastInput=Date.now();
 const interaction=()=>{lastInput=Date.now()};
 const apply=()=>{if(!changed||reloading||doc.hidden||Date.now()-lastInput<3000||!canReload())return;try{preserve()}catch{return}reloading=true;reload()};
 const controller=()=>{if(controlled)changed=true;controlled=true;apply()};
 const check=()=>{if(!doc.hidden)registration?.update().catch(()=>{});apply()};
 sw.addEventListener('controllerchange',controller);
 doc.addEventListener('input',interaction);doc.addEventListener('pointerdown',interaction);
 doc.addEventListener('visibilitychange',check);events.addEventListener('online',check);
 const checkTimer=every(check,15000),applyTimer=every(apply,1000);
 sw.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{registration=reg;check()}).catch(()=>{});
 return ()=>{clear(checkTimer);clear(applyTimer);sw.removeEventListener('controllerchange',controller);doc.removeEventListener('input',interaction);doc.removeEventListener('pointerdown',interaction);doc.removeEventListener('visibilitychange',check);events.removeEventListener('online',check)};
}

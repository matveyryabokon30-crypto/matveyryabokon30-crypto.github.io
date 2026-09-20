// UI flag changes presentation only. Explicit fixture never loads authenticated runtime.
if(new URLSearchParams(location.search).get('ui')==='classic'){
 location.replace(new URL('classic.html'+location.hash,location.href));
}else{
 const fixture=new URLSearchParams(location.search).get('qa')==='fixture'?await import('./fixture.mjs'):null;
 const {initialize}=await import('./app.mjs');initialize(fixture?.options);
 if(fixture)fixture.install();
 else try{await import('../voice-s3-0.mjs?v=2026.09.20-ui.3')}catch{window.SekkesUI.status('Не удалось загрузить модуль разговора. Проверь сеть и обнови приложение.')}
}

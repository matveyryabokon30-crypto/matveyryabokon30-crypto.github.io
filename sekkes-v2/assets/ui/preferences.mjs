const prefix='sekkes:design:v1:';
export function getPreference(key,fallback){try{return localStorage.getItem(prefix+key)||fallback}catch{return fallback}}
export function setPreference(key,value){try{localStorage.setItem(prefix+key,value)}catch{}applyPreferences()}
export function scheduledTheme(now=new Date()){return now.getHours()>=8&&now.getHours()<18?'light':'dark'}
export function nextThemeBoundary(now=new Date()){const next=new Date(now);if(now.getHours()<8)next.setHours(8,0,0,0);else if(now.getHours()<18)next.setHours(18,0,0,0);else{next.setDate(next.getDate()+1);next.setHours(8,0,0,0)}return next.getTime()-now.getTime()}
export function applyPreferences(now=new Date()){
 const root=document.documentElement,theme=scheduledTheme(now);
 if(root.dataset.theme!==theme)root.dataset.theme=theme;
 root.dataset.textSize=getPreference('textSize','100');root.dataset.motion=getPreference('motion','system');root.dataset.transparency=getPreference('transparency','on');
 root.style.fontSize=({'100':'100%','125':'125%','150':'150%','200':'200%'}[getPreference('textSize','100')]||'100%');
 // Never ask iOS to paint a white browser/status surface over the lake.
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#317caf':'#071a35');
}
export function watchPreferences(signal){
 let timer;const update=()=>{clearTimeout(timer);applyPreferences();if(!signal.aborted)timer=setTimeout(update,Math.min(nextThemeBoundary(),60000))};
 update();addEventListener('storage',update,{signal});addEventListener('pageshow',update,{signal});document.addEventListener('visibilitychange',update,{signal});signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
}

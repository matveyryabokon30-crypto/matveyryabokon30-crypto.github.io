import {watchAccountPreferences} from './account-bridge.mjs';
let sharedAccount=null;
const prefix='sekkes:design:v1:';
export function getPreference(key,fallback){try{return localStorage.getItem(prefix+key)||fallback}catch{return fallback}}
export function setPreference(key,value){try{localStorage.setItem(prefix+key,value)}catch{}applyPreferences()}
export function scheduledTheme(now=new Date()){return now.getHours()>=8&&now.getHours()<18?'light':'dark'}
export function nextThemeBoundary(now=new Date()){const next=new Date(now);if(now.getHours()<8)next.setHours(8,0,0,0);else if(now.getHours()<18)next.setHours(18,0,0,0);else{next.setDate(next.getDate()+1);next.setHours(8,0,0,0)}return next.getTime()-now.getTime()}
export function applyPreferences(now=new Date()){
 const root=document.documentElement,theme=sharedAccount?(sharedAccount.theme==='dark'||(sharedAccount.theme||'system')==='system'&&matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):scheduledTheme(now);
 if(root.dataset.theme!==theme)root.dataset.theme=theme;
 root.dataset.textSize=sharedAccount?.textSize==='system'?'100':sharedAccount?.textSize||getPreference('textSize','100');root.dataset.motion=sharedAccount?(sharedAccount.motion===false?'reduced':'system'):getPreference('motion','system');root.dataset.transparency=sharedAccount?(sharedAccount.transparency===false?'off':'on'):getPreference('transparency','on');
 root.style.fontSize=({'100':'100%','125':'125%','150':'150%','200':'200%'}[root.dataset.textSize]||'100%');
 // Topology owns the document/chrome colour; preferences must not reset it.
}
export function watchPreferences(signal){
 void watchAccountPreferences(signal,value=>{sharedAccount=value;applyPreferences();});
 let timer;const update=()=>{clearTimeout(timer);applyPreferences();if(!signal.aborted)timer=setTimeout(update,Math.min(nextThemeBoundary(),60000))};
 update();addEventListener('storage',update,{signal});addEventListener('pageshow',update,{signal});document.addEventListener('visibilitychange',update,{signal});signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
}

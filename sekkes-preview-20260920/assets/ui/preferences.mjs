const prefix='sekkes:design:v1:';
export function getPreference(key,fallback){try{return localStorage.getItem(prefix+key)||fallback}catch{return fallback}}
export function setPreference(key,value){try{localStorage.setItem(prefix+key,value)}catch{}applyPreferences()}
export function applyPreferences(){const theme=getPreference('theme','system');document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;document.documentElement.dataset.motion=getPreference('motion','system');document.documentElement.dataset.transparency=getPreference('transparency','on');}
export function watchPreferences(signal){applyPreferences();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyPreferences,{signal});addEventListener('storage',applyPreferences,{signal})}

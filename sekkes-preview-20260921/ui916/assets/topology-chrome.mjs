// The browser may sample the host document instead of the decorative iframe.
// Keep its opaque fallback in the exact same hue as the scene's current palette.
export const INITIAL_CHROME='#1e3c2c';
export function chromeColor(rgb){
 if(!Array.isArray(rgb)||rgb.length!==3||Array.from(rgb).some(v=>!Number.isFinite(v)||v<0||v>255))return null;
 const base=[0,34,34];
 return '#'+rgb.map((v,i)=>Math.round(base[i]+(v-base[i])*.22).toString(16).padStart(2,'0')).join('');
}
export function applyTopologyChrome(doc,rgb){
 const color=chromeColor(rgb);if(!color)return false;
 if(doc.documentElement.style.getPropertyValue('--topology-chrome')===color)return true;
 doc.documentElement.style.setProperty('--topology-chrome',color);
 doc.documentElement.style.backgroundColor=color;
 if(doc.body)doc.body.style.backgroundColor=color;
 doc.querySelector('meta[name="theme-color"]')?.setAttribute('content',color);
 return true;
}

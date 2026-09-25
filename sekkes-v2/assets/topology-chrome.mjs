// iOS uses an opaque page tint for native chrome even in standalone mode.
// Derive that tint from the scene palette, never from moving fibres/particles.
export const INITIAL_CHROME='#1e3c2c';
export function chromeColor(rgb){
 if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)||v<0||v>255))return null;
 // Match the average cloth coverage over its #002222 base. Fixed coverage
 // prevents rotating threads, audio highlights and resizing from modulating tint.
 return '#'+rgb.map((v,i)=>Math.round(v*.62+(i?34:0)*.38).toString(16).padStart(2,'0')).join('');
}
export function applyTopologyChrome(doc,rgb){
 const color=chromeColor(rgb);if(!color)return false;
 if(doc.documentElement.dataset.keyboardOpen==='true'||doc.activeElement?.matches('input,textarea,select,[contenteditable=true]'))return true;
 if(doc.documentElement.style.getPropertyValue('--topology-chrome')===color)return true;
 doc.documentElement.style.setProperty('--topology-chrome',color);
 doc.documentElement.style.backgroundColor=color;
 if(doc.body)doc.body.style.backgroundColor=color;
 doc.querySelector('meta[name="theme-color"]')?.setAttribute('content',color);
 return true;
}
export function mountTopologyChrome(doc){
 if(!doc.body?.append)return {dispose(){}};
 const edge=doc.createElement('div'),fog=doc.createElement('div');
 edge.id='topologyChrome';edge.className='topology-chrome-edge';
 fog.id='topologyFog';fog.className='topology-chrome-fog';
 for(const node of [edge,fog])node.setAttribute('aria-hidden','true');
 doc.body.append(edge,fog);
 return {dispose(){edge.remove();fog.remove()}};
}

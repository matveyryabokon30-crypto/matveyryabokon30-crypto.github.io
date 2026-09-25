// The browser may sample the host document instead of the decorative iframe.
// Keep its opaque fallback in the exact same hue as the scene's current palette.
export const INITIAL_CHROME='#1e3c2c';
// WebKit may retain the sampled colour of a viewport-sized fixed container.
// A separate short, real fixed element gives its edge sampler a live colour.
// Keep the blur in a sibling: backdrop-filter on the sampled edge disables tint.
export function mountTopologyChrome(doc){
 if(!doc.body?.append)return {dispose(){}};
 const edge=doc.createElement('div'),fog=doc.createElement('div');
 edge.id='topologyChrome';edge.className='topology-chrome-edge';
 fog.id='topologyFog';fog.className='topology-chrome-fog';
 for(const node of [edge,fog])node.setAttribute('aria-hidden','true');
 doc.body.append(edge,fog);
 return {dispose(){edge.remove();fog.remove()}};
}
export function chromeColor(rgb){
 if(!Array.isArray(rgb)||rgb.length!==3||Array.from(rgb).some(v=>!Number.isFinite(v)||v<0||v>255))return null;
 // The frame supplies the rendered upper scene, already shaded by the cloth.
 return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
}
export function applyTopologyChrome(doc,rgb){
 const color=chromeColor(rgb);if(!color)return false;
 if(doc.documentElement.style.getPropertyValue('--topology-chrome')===color)return true;
 doc.documentElement.style.setProperty('--topology-chrome',color);
 doc.documentElement.style.backgroundColor=color;
 if(doc.body)doc.body.style.backgroundColor=color;
 const edge=doc.querySelector('#topologyChrome');if(edge)edge.style.backgroundColor=color;
 doc.querySelector('meta[name="theme-color"]')?.setAttribute('content',color);
 return true;
}

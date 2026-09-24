// A single 900 × 1600 composition is used by the editor, saved stories and viewer.
// Original media bytes stay immutable. Coordinates are independent of screen size.
import {el} from './components.mjs';
export const STORY_WIDTH=900, STORY_HEIGHT=1600;
export const storyFilters=Object.freeze({none:['Оригинал','none'],warm:['Тепло','sepia(.22) saturate(1.16)'],cool:['Холод','saturate(.85) hue-rotate(12deg)'],mono:['Моно','grayscale(1)'],soft:['Мягко','contrast(.88) saturate(.9)'],vivid:['Насыщенно','saturate(1.4) contrast(1.06)']});
export const storyFonts=Object.freeze({sans:'var(--font-ui), sans-serif',serif:'Georgia, serif',mono:'ui-monospace, monospace'});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const num=(v,d,a,b)=>Number.isFinite(Number(v))?clamp(v,a,b):d;
const color=(v,d='#ffffff')=>/^#[\da-f]{6}$/i.test(v||'')?v:d;
export function storyLink(value){try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function normalizeStory(value={}){
 const v=value&&typeof value==='object'?value:{},m=v.media||{};
 return {version:1,format:'9:16',media:{x:num(m.x,.5,-4,5),y:num(m.y,.5,-4,5),scale:num(m.scale,1,.2,128),rotation:num(m.rotation,0,-3600,3600)},
  filter:Object.hasOwn(storyFilters,v.filter)?v.filter:'none',background:['blur','dark','light','sea'].includes(v.background)?v.background:'blur',muted:v.muted===true,duration:num(v.duration,5,3,15),
  trim:{start:num(v.trim?.start,0,0,86400),end:v.trim?.end==null?null:num(v.trim.end,null,0,86400)},
  layers:(Array.isArray(v.layers)?v.layers:[]).slice(0,20).map((l,i)=>({id:String(l.id||`layer-${i}`).slice(0,80),kind:['text','emoji','link'].includes(l.kind)?l.kind:'text',text:String(l.text||'').slice(0,500),x:num(l.x,.5,0,1),y:num(l.y,.5,0,1),size:num(l.size,.08,.025,.32),rotation:num(l.rotation,0,-3600,3600),font:Object.hasOwn(storyFonts,l.font)?l.font:'sans',color:color(l.color),background:l.background===true,align:['left','center','right'].includes(l.align)?l.align:'center',url:storyLink(l.url)})),
  strokes:(Array.isArray(v.strokes)?v.strokes:[]).slice(0,100).map(s=>({color:color(s.color),width:num(s.width,.006,.002,.04),points:(Array.isArray(s.points)?s.points:[]).slice(0,2000).map(p=>[num(p[0],0,0,1),num(p[1],0,0,1)])}))};
}
export function mediaGeometry(width,height,media){
 const w=Math.max(1,width),h=Math.max(1,height),r=media.rotation*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));
 const rw=w*c+h*s,rh=w*s+h*c,fit=Math.min(STORY_WIDTH/rw,STORY_HEIGHT/rh);
 return {width:w*fit*media.scale,height:h*fit*media.scale,fill:Math.max(STORY_WIDTH/rw,STORY_HEIGHT/rh)/fit};
}
export function storyWindow(state,duration){
 const d=Number.isFinite(duration)&&duration>0?duration:0,start=Math.min(state.trim.start,Math.max(0,d-.1));
 return {start,end:state.trim.end==null?d:Math.min(d,Math.max(start+.1,state.trim.end))};
}
export function storySurface({media,composition,interactive=false,onReady=()=>{}}){
 const node=el('div','story-frame'),backdrop=el('canvas','story-backdrop'),layerHost=el('div','story-layers');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('story-drawing');svg.setAttribute('viewBox','0 0 900 1600');svg.setAttribute('aria-hidden','true');
 backdrop.width=160;backdrop.height=284;backdrop.setAttribute('aria-hidden','true');media.classList.add('story-source');media.draggable=false;
 node.append(backdrop,media,svg,layerHost);node.dataset.format='9:16';
 const state=normalizeStory(composition),life=new AbortController(),{signal}=life,layers=new Map();let width=0,height=0,disposed=false,poster=false,lastMedia='',lastLayers='',lastStrokes='';
 function snapshot(){
  if(disposed||poster||!width||(media.tagName==='VIDEO'&&media.readyState<2))return;
  try{const ctx=backdrop.getContext('2d'),s=Math.max(160/width,284/height);ctx.drawImage(media,(160-width*s)/2,(284-height*s)/2,width*s,height*s);poster=true;}catch{/* A neutral background remains if this decoder cannot supply a poster. */}
 }
 function dimensions(){
  if(disposed)return;width=media.naturalWidth||media.videoWidth||0;height=media.naturalHeight||media.videoHeight||0;
  if(!width||!height)return;render();snapshot();onReady({width,height,duration:media.duration});
 }
 function paintMedia(){
  const g=mediaGeometry(width||9,height||16,state.media);media.style.width=`${g.width/STORY_WIDTH*100}%`;media.style.height=`${g.height/STORY_HEIGHT*100}%`;
  media.style.left=`${state.media.x*100}%`;media.style.top=`${state.media.y*100}%`;media.style.transform=`translate(-50%,-50%) rotate(${state.media.rotation}deg)`;media.style.filter=storyFilters[state.filter]?.[1]||'none';node.dataset.background=state.background;
 }
 function paintLayers(){
  const retained=new Set();
  for(const layer of state.layers){
   retained.add(layer.id);let item=layers.get(layer.id);
   if(!item){item=el(interactive?'button':layer.kind==='link'&&layer.url?'a':'div','story-layer');if(interactive)item.type='button';item.dataset.layerId=layer.id;item.append(el('span','story-layer-text'));layerHost.append(item);layers.set(layer.id,item);}
   item.firstChild.textContent=layer.text;item.setAttribute('aria-label',layer.kind==='emoji'?`Стикер ${layer.text}`:layer.text||'Текст');
   item.style.left=`${layer.x*100}%`;item.style.top=`${layer.y*100}%`;item.style.setProperty('--layer-size',`${layer.size*100}cqw`);item.style.transform=`translate(-50%,-50%) rotate(${layer.rotation}deg)`;item.style.color=layer.color;item.style.fontFamily=storyFonts[layer.font];item.style.textAlign=layer.align;item.dataset.background=String(layer.background);item.dataset.kind=layer.kind;
   if(item.tagName==='A'){item.href=layer.url;item.target='_blank';item.rel='noopener noreferrer';}
  }
  for(const [id,item] of layers)if(!retained.has(id)){item.remove();layers.delete(id);}
 }
 function paintDrawing(){
  while(svg.children.length>state.strokes.length)svg.lastChild.remove();
  state.strokes.forEach((stroke,i)=>{let path=svg.children[i];if(!path){path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('fill','none');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);}
   const points=stroke.points;path.setAttribute('d',points.length?points.map((p,j)=>`${j?'L':'M'}${(p[0]*900).toFixed(2)},${(p[1]*1600).toFixed(2)}`).join(' ')+(points.length===1?` l.01,0`:''):'');path.setAttribute('stroke',stroke.color);path.setAttribute('stroke-width',String(stroke.width*900));});
 }
 function render(){if(disposed)return;const m=JSON.stringify([width,height,state.media,state.filter,state.background]),l=JSON.stringify(state.layers),s=JSON.stringify(state.strokes);if(m!==lastMedia){lastMedia=m;paintMedia();}if(l!==lastLayers){lastLayers=l;paintLayers();}if(s!==lastStrokes){lastStrokes=s;paintDrawing();}}
 media.addEventListener(media.tagName==='VIDEO'?'loadedmetadata':'load',dimensions,{signal});
 media.addEventListener('loadeddata',()=>{snapshot();},{signal});
 render();if(media.complete&&media.naturalWidth)dimensions();
 return {node,media,state,render,paintMedia,paintLayers,paintDrawing,get size(){return {width,height};},export:()=>normalizeStory(state),dispose(){disposed=true;life.abort();layers.clear();}};
}

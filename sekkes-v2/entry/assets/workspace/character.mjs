import {el} from './dom.mjs?v=cf6b20f89e01cf5be8c8ac2abbe882311875b2edaded62b3add8157f361f4031';
const COLORS={iris:'#bbb1cb',ocean:'#a7c3d5',mint:'#acbeb1',rose:'#cdb3bf',apricot:'#cec2ae',graphite:'#b4bdc8'};
export const MARIUS_HEADS=Object.freeze({graphite:{title:'Графитовый',src:'assets/media/marius-head-graphite.png'},cream:{title:'Кремовый',src:'assets/media/marius-head-cream.png'},blue:{title:'Синий',src:'assets/media/marius-head-blue.png'}});
let portrait='';
export function mariusColor(store){return Object.hasOwn(MARIUS_HEADS,store.state.preferences.mariusColor)?store.state.preferences.mariusColor:'graphite';}
export function mariusHead(){return portrait||'assets/media/marius-head-transparent.png';}
export function createLiveHead(store,{thumbnail=false,minimumResolution=0,pointerTracking=true}={}){
  const element=el('div',{class:'live-head'},el('img',{class:'head-poster',src:'assets/media/marius-head-transparent.png',alt:'Мариус'}));let renderer=null,disposed=false,current='';
  const refresh=()=>{const color=COLORS[store.state.preferences.palette]||COLORS.graphite;if(renderer&&current!==color){renderer.setColor(color);current=color;}renderer?.setMotion(store.state.preferences.motion!==false);};
  const off=store.subscribe(refresh);
  // Skip the GPU adapter in non-browser unit tests; browser behavior is tested separately.
  if(typeof ResizeObserver!=='undefined')import('../character/renderer.mjs?v=f3a5111d6deaa0c63e2cd082ab6ef78366d34951a439f58eae578922f055f48a').then(({mountHead})=>{if(disposed)return;renderer=mountHead(element,{color:COLORS[store.state.preferences.palette]||COLORS.graphite,motion:store.state.preferences.motion!==false,minimumResolution,pointerTracking,onPortrait:data=>{element.classList.add('is-rendered');if(thumbnail){portrait=data;document.querySelectorAll('img.marius-avatar').forEach(img=>img.src=data);}}});refresh();}).catch(error=>{if(!disposed){element.append(el('span',{class:'head-fallback',text:'Мариус'}));element.setAttribute('aria-label','3D недоступно в этом браузере');console.warn('Marius WebGL unavailable:',error.message);}});
  return{element,destroy(){disposed=true;off();renderer?.destroy();}};
}

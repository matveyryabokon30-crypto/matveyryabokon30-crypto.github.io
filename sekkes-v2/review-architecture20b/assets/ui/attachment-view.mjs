import {el} from '/sekkes-v2/assets/ui/components.mjs';
export const isMedia=m=>/^(image|video|audio)\//.test(m.mime||'');
export function mediaView(m,url,{compact=false}={}){
 const wrap=el('div','attachment-view'+(compact?' attachment-compact':''));
 if((m.mime||'').startsWith('image/')){const img=el('img');if(m.width>0&&m.height>0){img.width=m.width;img.height=m.height;}img.src=url;img.alt='Фото';img.decoding='async';wrap.append(img);}
 else if(/^(video|audio)\//.test(m.mime||'')){const player=el(m.mime.startsWith('video/')?'video':'audio');player.src=url;player.controls=!compact;player.playsInline=true;player.preload='metadata';if(compact){player.muted=true;if(m.frames?.[0]?.data)player.poster='data:image/jpeg;base64,'+m.frames[0].data;wrap.append(el('span','attachment-play',m.mime.startsWith('video/')?'▷':'♪'));}wrap.append(player);}
 else{const a=el('a','attachment-document',m.name||'Документ');a.href=url;a.download=m.name||'document';wrap.append(a);}
 return wrap;
}
// Observe only visible media; private content stays behind its existing authenticated API.
export function mediaLoader(){
 let generation=0;const jobs=new Map();const observer=globalThis.IntersectionObserver?new IntersectionObserver(items=>{for(const i of items)if(i.isIntersecting){observer.unobserve(i.target);const run=jobs.get(i.target);jobs.delete(i.target);void run?.();}},{rootMargin:'160px'}):null;
 return {mount(m,getURL){const wrap=el('div','attachment-view attachment-loading');wrap.setAttribute('aria-label',m.mime?.startsWith('video/')?'Видео':'Фото');if(m.width>0&&m.height>0){wrap.style.aspectRatio=m.width+'/'+m.height;wrap.style.height='auto';}let busy=false;
 const run=async()=>{if(busy)return;busy=true;const ticket=generation;wrap.classList.add('attachment-loading');try{const url=await getURL();if(!url||ticket!==generation)return;const view=mediaView(m,url),img=view.querySelector('img');if(img){try{await img.decode()}catch{}if(ticket!==generation)return;if(img.naturalWidth){img.width=img.naturalWidth;img.height=img.naturalHeight;}}wrap.replaceChildren(view);wrap.classList.remove('attachment-loading');}catch{wrap.classList.remove('attachment-loading');const retry=el('button','attachment-retry','Загрузить ещё раз');retry.type='button';retry.onclick=run;wrap.replaceChildren(retry);}finally{busy=false}};
 if(observer){jobs.set(wrap,run);observer.observe(wrap);}else queueMicrotask(run);return wrap;},discard(node){for(const wrap of jobs.keys())if(wrap===node||node.contains(wrap)){observer?.unobserve(wrap);jobs.delete(wrap);}},reset(){generation++;observer?.disconnect();jobs.clear();}};
}

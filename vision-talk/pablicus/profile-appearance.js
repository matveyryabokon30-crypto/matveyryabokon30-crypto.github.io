/* Accent-only profile appearance. Account-scoped device preference; never writes another profile. */
(function(scope){'use strict';
 const palettes=Object.freeze({"ocean_breeze":{"label":"Ocean Breeze","ink":"#0B3D91","secondary_ink":"#0B3D91","fill":"#3BA7F2","soft_fill":"#7FE7D6","hint":"#E8F6FF"},"midnight_neon":{"label":"Midnight Neon","ink":"#7C3AED","secondary_ink":"#0F172A","fill":"#A78BFA","soft_fill":"#22D3EE","hint":"#EDE9FE"},"apple_modern":{"label":"Apple Modern","ink":"#0063CC","secondary_ink":"#1D1D1F","fill":"#007AFF","soft_fill":"#F5F5F7","hint":"#F5F5F7"},"vibrant_sunset":{"label":"Vibrant Sunset","ink":"#79406E","secondary_ink":"#4D3A4D","fill":"#D59CC5","soft_fill":"#EADADA","hint":"#EADADA"}});
 const valid=id=>Object.prototype.hasOwnProperty.call(palettes,id);
 const key=uid=>'pablicus:'+uid+':profile-appearance:v1';
 const owner=uid=>typeof uid==='string'&&uid.length>0&&uid.length<=128;
 function read(uid){if(!owner(uid))return 'ocean_breeze';try{const v=localStorage.getItem(key(uid));return valid(v)?v:'ocean_breeze';}catch(_){return 'ocean_breeze';}}
 function apply(host,uid){if(!host)return;host.dataset.profilePalette=read(uid);}
 function mountPicker(host,uid,isCurrent){
  if(!host||!owner(uid))return null;
  const field=document.createElement('fieldset');field.className='profileAccentPicker';
  const legend=document.createElement('legend');legend.textContent='Цвета личной страницы';
  const choices=document.createElement('div');choices.className='profileAccentChoices';
  const error=document.createElement('p');error.className='profileAccentError';error.hidden=true;error.setAttribute('role','status');
  const page=host.closest('.youPage')||host;
  function reflect(id){for(const b of choices.children)b.setAttribute('aria-pressed',String(b.dataset.palette===id));}
  for(const [id,p] of Object.entries(palettes)){
   const b=document.createElement('button');b.type='button';b.className='youButton profileAccentChoice';b.dataset.palette=id;
   const swatch=document.createElement('span');swatch.className='profileAccentSwatch';swatch.setAttribute('aria-hidden','true');
   for(const color of [p.ink,p.fill,p.soft_fill]){const dot=document.createElement('i');dot.style.backgroundColor=color;swatch.append(dot);}
   const text=document.createElement('span');text.textContent=p.label;b.append(swatch,text);
   b.addEventListener('click',()=>{if(!field.isConnected||isCurrent?.()===false)return;error.hidden=true;try{localStorage.setItem(key(uid),id);}catch(_){error.textContent='Не удалось сохранить оформление на этом устройстве.';error.hidden=false;return;}
    page.dataset.profilePalette=id;reflect(id);
   });choices.append(b);
  }
  field.append(legend,choices,error);host.append(field);reflect(read(uid));return field;
 }
 scope.PablicusProfileAppearance=Object.freeze({apply,mountPicker,read,palettes});
const original=scope.PablicusProfilePage;
 if(original?.create){
  scope.PablicusProfilePage=Object.freeze({...original,create(o){
   const inner=original.create({...o,mountSettings(host){
    o.mountSettings(host);const uid=o.getUser()?.id;apply(host,uid);
    mountPicker(host.querySelector('.profileCard')||host,uid,()=>host.isConnected&&o.getUser()?.id===uid);
   }});
   return {...inner,mount(host){inner.mount(host);apply(host.querySelector(':scope>.youPage'),o.getUser()?.id);}};
  }});
 }
})(window);

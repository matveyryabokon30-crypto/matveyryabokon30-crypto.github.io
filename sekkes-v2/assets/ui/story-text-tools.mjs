import {el,icon} from './components.mjs';
import {textPresets,textAnimations,textEffects,textPalette,textStyle,applyTextStyle,textColor} from './story-text-style.mjs';
// Formatting shares the keyboard's visible rectangle, but never changes the media rectangle.
export function storyTextTools({host,layer,surface,remember,change,done,signal}){
 Object.assign(layer,textStyle(layer));
 const stage=el('div','se-text-stage'),area=el('textarea','se-text-input'),dock=el('section','st-dock'),choices=el('div','st-choices'),tabs=el('nav','st-tabs'),tags=el('nav','st-tags'),status=el('span','st-status');
 let tab='fonts',sampling=false,selection=[0,0],hold=0,holdUsed=false;
 const vertical=el('input','st-size');vertical.type='range';vertical.min=.025;vertical.max=.32;vertical.step=.005;vertical.value=layer.size;vertical.setAttribute('aria-label','Размер текста');
 area.rows=1;area.maxLength=5000;area.value=layer.text;area.setAttribute('aria-label','Текст сторис');area.autocomplete='off';area.setAttribute('autocapitalize','sentences');area.spellcheck=true;
 dock.setAttribute('aria-label','Форматирование текста');status.setAttribute('role','status');status.classList.add('sr-only');tabs.setAttribute('aria-label','Инструменты текста');tags.setAttribute('aria-label','Упоминание и место');
 stage.append(area,vertical);dock.append(choices,tabs,tags);host.append(stage,dock,status);
 const paletteUpdate=()=>{applyTextStyle(area,layer);area.style.fontSize=Math.max(18,Math.min(72,surface.node.getBoundingClientRect().width*layer.size))+'px';vertical.value=layer.size;area.style.height='auto';area.style.height=Math.min(area.scrollHeight,Math.max(44,stage.clientHeight-20))+'px';change();};
 const focus=()=>{area.focus({preventScroll:true});};
 function btn(label,content,fn,cls='st-control'){
  const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);b.title=label;
  if(typeof content==='string')b.textContent=content;else if(content)b.append(content);
  // Keep the user's OS keyboard and caret alive when choosing fonts/colours.
  b.addEventListener('pointerdown',e=>{e.preventDefault();},{signal});b.addEventListener('click',()=>{fn(b);},{signal});return b;
 }
 function sym(name){const n=el('span','st-symbol');n.innerHTML=icon(name);return n;}
 function set(values){remember();Object.assign(layer,values);paletteUpdate();}
 function activate(key){tab=key;for(const b of tabs.children)b.setAttribute('aria-selected',String(b.dataset.tab===key));render();}
 const tabSpecs=[['fonts','Шрифты','Aa'],['colors','Цвет',el('i','st-wheel')],['animation','Анимация',el('i','st-motion','Aа')],['effect','Эффекты',el('i','st-effect-icon','A')]];
 tabs.setAttribute('role','tablist');
 for(const [key,label,glyph] of tabSpecs){const b=btn(label,glyph,()=>activate(key));b.dataset.tab=key;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(key==='fonts'));tabs.append(b);}
 const align=btn('Выравнивание',sym('menu'),()=>{set({align:layer.align==='center'?'left':layer.align==='left'?'right':'center'});align.dataset.align=layer.align;align.setAttribute('aria-label','Выравнивание: '+layer.align);});
 const bg=btn('Подложка',el('i','st-bg-icon','A'),()=>{const modes=['none','solid','light','glass'];set({backgroundStyle:modes[(modes.indexOf(layer.backgroundStyle)+1)%modes.length]});bg.setAttribute('aria-pressed',String(layer.backgroundStyle!=='none'));});tabs.append(align,bg);
 const mention=btn('Упомянуть',null,()=>activate('mention'),'st-tag');mention.append(el('span','','@'),el('span','','Упомянуть'));
 const place=btn('Место',sym('location'),()=>activate('place'),'st-tag');place.append(el('span','','Место'));tags.append(mention,place);
 function selectedButton(name,key,value,kind,cls){const b=btn(name,name,()=>{set({[key]:value});for(const n of choices.querySelectorAll('button[data-value]'))n.setAttribute('aria-pressed',String(n.dataset.value===value));},cls);b.dataset.value=value;b.setAttribute('aria-pressed',String(layer[key]===value));return b;}
 function render(){
  choices.replaceChildren();choices.dataset.mode=tab;
  if(tab==='fonts'){
   for(const [id,p] of Object.entries(textPresets)){const b=selectedButton(p.name,'font',id,'font','st-font');applyTextStyle(b,{font:id,color:'#ffffff',align:'center'});choices.append(b);}
  }else if(tab==='colors'){
   choices.append(btn('Пипетка',sym('edit'),()=>{sampling=true;stage.classList.add('st-sampling');dock.classList.add('st-sampling');status.textContent='Коснись цвета на фотографии';}));
   for(const c of textPalette){const b=btn(`Цвет ${c}`,'',()=>{if(holdUsed){holdUsed=false;return;}set({color:c});for(const n of choices.querySelectorAll('[data-color]'))n.setAttribute('aria-pressed',String(n.dataset.color===c));},'st-swatch');b.style.setProperty('--swatch',c);b.dataset.color=c;b.setAttribute('aria-pressed',String(layer.color===c));b.addEventListener('pointerdown',()=>{holdUsed=false;clearTimeout(hold);hold=setTimeout(()=>{holdUsed=true;activate('spectrum');},450);},{signal});for(const evt of ['pointerup','pointercancel','pointerleave'])b.addEventListener(evt,()=>clearTimeout(hold),{signal});choices.append(b);}
   choices.append(btn('Полная палитра',el('i','st-wheel'),()=>activate('spectrum')));
  }else if(tab==='animation'||tab==='effect'){
   const catalog=tab==='animation'?textAnimations:textEffects;
   for(const [id,name] of Object.entries(catalog))choices.append(selectedButton(name,tab,id,tab,'st-option'));
  }else if(tab==='spectrum'){
   const c=el('canvas','st-spectrum');c.width=300;c.height=80;c.setAttribute('aria-label','Полный спектр цветов');c.tabIndex=0;
   const cx=c.getContext('2d'),g=cx.createLinearGradient(0,0,300,0);['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ff0000'].forEach((v,i)=>g.addColorStop(i/6,v));cx.fillStyle=g;cx.fillRect(0,0,300,80);const w=cx.createLinearGradient(0,0,0,80);w.addColorStop(0,'#ffffff');w.addColorStop(.5,'#ffffff00');w.addColorStop(.51,'#00000000');w.addColorStop(1,'#000000');cx.fillStyle=w;cx.fillRect(0,0,300,80);
   let active=false;const read=e=>{const r=c.getBoundingClientRect(),x=Math.min(299,Math.max(0,Math.round((e.clientX-r.x)*300/r.width))),y=Math.min(79,Math.max(0,Math.round((e.clientY-r.y)*80/r.height))),rgb=cx.getImageData(x,y,1,1).data;layer.color='#'+[...rgb].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');paletteUpdate();};
   c.addEventListener('pointerdown',e=>{e.preventDefault();remember();active=true;c.setPointerCapture(e.pointerId);read(e);},{signal});c.addEventListener('pointermove',e=>{if(active){e.preventDefault();read(e);}},{signal});for(const t of ['pointerup','pointercancel'])c.addEventListener(t,()=>active=false,{signal});
   const hex=el('input','st-hex');hex.type='text';hex.maxLength=7;hex.value=layer.color;hex.setAttribute('aria-label','Цвет HEX');hex.addEventListener('input',()=>{if(/^#[\da-f]{6}$/i.test(hex.value))set({color:hex.value});},{signal});choices.append(btn('К палитре',sym('back'),()=>activate('colors')),c,hex);
  }else if(tab==='mention'||tab==='place'){
   const form=el('div','st-insert'),input=el('input');input.type='text';input.maxLength=tab==='mention'?40:160;input.setAttribute('aria-label',tab==='mention'?'Имя пользователя':'Название места');input.placeholder=tab==='mention'?'@имя':'Название места';input.autocomplete='off';input.spellcheck=false;
   const message=el('span','st-insert-error');message.setAttribute('role','alert');const type=tab;
   const insert=btn('Добавить '+(type==='mention'?'упоминание':'место'),sym('check'),()=>{
    const value=input.value.trim().replace(type==='mention'?/^@/:/^$/,'');if(!value||(type==='mention'&&!/^[\p{L}\p{N}_.]{1,40}$/u.test(value))){message.textContent='Проверь '+(type==='mention'?'имя пользователя':'название места');return;}
    const label=type==='mention'?'@'+value:'📍 '+value;remember();const a=selection[0],b=selection[1];area.value=area.value.slice(0,a)+(a&&area.value[a-1]!==' '?' ':'')+label+area.value.slice(b);layer.text=area.value;
    if(type==='mention')layer.mentions=[...new Set([...(layer.mentions||[]),value])].slice(0,20);else layer.place={label:value,address:''};
    activate('fonts');paletteUpdate();focus();area.setSelectionRange(area.value.length,area.value.length);capture();
   });form.append(btn('Назад',sym('back'),()=>{activate('fonts');focus();}),input,insert,message);choices.append(form);input.focus({preventScroll:true});
  }
 }
 const capture=()=>{selection=[area.selectionStart||0,area.selectionEnd||0];};
 for(const t of ['select','keyup','pointerup','input'])area.addEventListener(t,capture,{signal});
 area.addEventListener('input',()=>{layer.text=area.value;paletteUpdate();},{signal});
 let resizing=false;const resizeAt=e=>{const r=vertical.getBoundingClientRect();layer.size=Math.max(.025,Math.min(.32,.025+(1-(e.clientY-r.y)/r.height)*.295));paletteUpdate();};vertical.addEventListener('pointerdown',e=>{e.preventDefault();remember();resizing=true;vertical.setPointerCapture(e.pointerId);resizeAt(e);},{signal});vertical.addEventListener('pointermove',e=>{if(resizing){e.preventDefault();resizeAt(e);}},{signal});for(const t of ['pointerup','pointercancel'])vertical.addEventListener(t,()=>{resizing=false;},{signal});vertical.addEventListener('input',()=>{layer.size=Number(vertical.value);paletteUpdate();},{signal});vertical.addEventListener('change',focus,{signal});
 stage.addEventListener('pointerdown',e=>{
  if(e.target!==stage)return;e.preventDefault();
  if(sampling){
   try{const r=surface.media.getBoundingClientRect(),fr=surface.node.getBoundingClientRect(),m=surface.state.media,angle=-m.rotation*Math.PI/180,dx=e.clientX-(fr.x+fr.width*m.x),dy=e.clientY-(fr.y+fr.height*m.y),w=parseFloat(surface.media.style.width)*fr.width/100,h=parseFloat(surface.media.style.height)*fr.height/100,x=(dx*Math.cos(angle)-dy*Math.sin(angle))/w+.5,y=(dx*Math.sin(angle)+dy*Math.cos(angle))/h+.5;
    if(x>=0&&x<=1&&y>=0&&y<=1){const c=document.createElement('canvas');c.width=c.height=1;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(surface.media,x*surface.size.width,y*surface.size.height,1,1,0,0,1,1);const rgb=cx.getImageData(0,0,1,1).data;set({color:'#'+[...rgb].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')});}
   }catch{status.textContent='Этот кадр не удалось прочитать.';}
   sampling=false;stage.classList.remove('st-sampling');dock.classList.remove('st-sampling');return;
  }
  done();
 },{signal});
 // The shared viewport owner changes only the overlay bounds; media nodes survive.
 document.addEventListener('sekkes-viewport-change',()=>{requestAnimationFrame(()=>{if(!signal.aborted)paletteUpdate();});},{signal});
 const ro=new ResizeObserver(()=>{if(!signal.aborted){area.style.height='auto';area.style.height=Math.min(area.scrollHeight,Math.max(44,stage.clientHeight-20))+'px';}});ro.observe(stage);
 signal.addEventListener('abort',()=>{clearTimeout(hold);ro.disconnect();},{once:true});
 render();paletteUpdate();focus();area.setSelectionRange(area.value.length,area.value.length);capture();
 return {area};
}

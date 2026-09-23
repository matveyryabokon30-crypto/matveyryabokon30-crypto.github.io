import {icon} from './components.mjs';

// One disclosure owns focus, background blocking and its exit animation.
export function navigation({root,button,panel,backdrop,app,signal}){
 let open=false,closingTimer=null,openingTimer=null;
 const paint=()=>{button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');button.dataset.open=String(open);button.innerHTML=icon(open?'close':'menu')};
 function close({restoreFocus=true}={}){
  if(!open){app.inert=false;panel.inert=true;backdrop.hidden=true;return;}open=false;clearTimeout(openingTimer);root.classList.remove('is-opening');paint();app.inert=false;panel.inert=true;
  root.removeAttribute('role');root.removeAttribute('aria-modal');root.classList.remove('is-open');root.classList.add('is-closing');backdrop.hidden=true;
  clearTimeout(closingTimer);closingTimer=setTimeout(()=>{panel.hidden=true;root.classList.remove('is-closing')},220);
  if(restoreFocus)button.focus({preventScroll:true});
 }
 function show(){
  clearTimeout(closingTimer);clearTimeout(openingTimer);root.classList.add('is-opening');openingTimer=setTimeout(()=>root.classList.remove('is-opening'),220);open=true;panel.hidden=false;panel.inert=false;backdrop.hidden=false;app.inert=true;
  root.classList.remove('is-closing');root.classList.add('is-open');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');paint();
  (panel.querySelector('a[aria-current=page]:not([hidden])')||panel.querySelector('a:not([hidden])')).focus({preventScroll:true});
 }
 button.addEventListener('click',()=>open?close():show(),{signal});
 backdrop.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();close()},{signal});
 panel.addEventListener('click',e=>{if(e.target.closest('a'))close({restoreFocus:false})},{signal});
 root.addEventListener('keydown',e=>{
  if(!open)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}
  if(e.key!=='Tab')return;
  const items=[button,...panel.querySelectorAll('a:not([hidden])')],i=items.indexOf(root.ownerDocument.activeElement);
  if(e.shiftKey&&i<=0){e.preventDefault();items.at(-1).focus()}
  else if(!e.shiftKey&&i===items.length-1){e.preventDefault();button.focus()}
 },{signal});
 paint();panel.hidden=true;panel.inert=true;
 return {close,dispose(){clearTimeout(closingTimer);clearTimeout(openingTimer);app.inert=false;panel.hidden=true;backdrop.hidden=true;root.classList.remove('is-open','is-closing','is-opening')}};
}


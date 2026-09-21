// Keep the hit target stable during streamed audio and stop on initial contact.
export function paintLiveIcon(button,name,render){
 if(button.dataset.liveIcon===name)return;
 button.dataset.liveIcon=name;button.innerHTML=render(name);
}
export function bindLiveControl(button,{signal,state,start,stop}){
 let consumed=false;
 const stopping=()=>['connecting','live','listening','speaking','recovery'].includes(state());
 button.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false||event.button!==0)return;
  consumed=false;
  if(button.disabled||!stopping())return;
  consumed=true;event.preventDefault();stop();
 },{signal});
 button.addEventListener('keydown',()=>{consumed=false},{signal});
 button.addEventListener('click',event=>{
  if(consumed){consumed=false;event.preventDefault();return;}
  if(button.disabled)return;
  if(stopping())stop();else if(['idle','error'].includes(state()))start();
 },{signal});
}

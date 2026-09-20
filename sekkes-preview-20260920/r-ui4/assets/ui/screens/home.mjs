import {el,picture,icon} from '../components.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');const scene=el('div','wallpaper');
 function update(){scene.replaceChildren(picture(document.documentElement.dataset.theme==='light'?'lake-day':'lake-night','','scene-image'))}update();
 const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const action=el('div','voice-center'),sphere=el('button','voice-sphere');sphere.id='voiceSphere';sphere.setAttribute('aria-label','Начать голосовой разговор');sphere.innerHTML='<span class="sphere-core" aria-hidden="true"></span>';
 sphere.onclick=()=>ctx.startVoice();const hint=el('span','sphere-hint','Нажми, чтобы говорить');hint.id='sphereHint';
 const chat=el('a','home-chat');chat.href='#chat';chat.innerHTML=icon('chat');chat.append(el('span','','Открыть чат'));
 action.append(sphere,hint);node.append(scene,action,chat);return {node,dispose(){observer.disconnect();sphere.onclick=null}};
}

import {el,picture,icon} from '../components.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');node.dataset.conversation='closed';
 const scene=el('div','wallpaper');function update(){scene.replaceChildren(picture(document.documentElement.dataset.theme==='light'?'lake-day':'lake-night','','scene-image'))}update();
 const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const action=el('div','voice-center'),sphere=el('button','voice-sphere');sphere.id='voiceSphere';sphere.setAttribute('aria-label','Начать голосовой разговор');sphere.innerHTML='<span class="sphere-core" aria-hidden="true"></span>';sphere.onclick=()=>ctx.startVoice();
 const hint=el('span','sphere-hint','Нажми, чтобы говорить');hint.id='sphereHint';action.append(sphere,hint);
 const conversation=el('section','home-conversation');conversation.setAttribute('aria-label','Переписка с SEKKES');conversation.hidden=true;
 const toolbar=el('div','conversation-toolbar'),collapse=el('button','collapse-conversation','Свернуть переписку');collapse.type='button';toolbar.append(collapse);
 const messages=el('div','messages');messages.id='messages';messages.setAttribute('aria-label','Сообщения');conversation.append(toolbar,messages);
 const reopen=el('button','reopen-conversation','Показать переписку');reopen.type='button';reopen.hidden=true;
 function showConversation(){node.dataset.conversation='open';conversation.hidden=false;reopen.hidden=true}
 collapse.onclick=()=>{node.dataset.conversation='closed';conversation.hidden=true;reopen.hidden=!messages.children.length;reopen.focus({preventScroll:true})};
 reopen.onclick=showConversation;
 node.append(scene,conversation,action,reopen);ctx.messages=messages;ctx.flushMessages();
 if(messages.children.length)showConversation();
 return {node,showConversation,messageAdded(){showConversation()},reset(){node.dataset.conversation='closed';conversation.hidden=true;reopen.hidden=true;messages.replaceChildren()},dispose(){observer.disconnect();sphere.onclick=collapse.onclick=reopen.onclick=null;ctx.messages=null}};
}

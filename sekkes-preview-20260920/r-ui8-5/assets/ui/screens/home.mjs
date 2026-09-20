import {el,picture} from '../components.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');node.dataset.conversation='closed';
 const scene=el('div','wallpaper');function update(){scene.replaceChildren(picture(document.documentElement.dataset.theme==='light'?'lake-day':'lake-night','','scene-image'))}update();
 const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const conversation=el('section','home-conversation');conversation.setAttribute('aria-label','Переписка с SEKKES');conversation.hidden=true;
 const toolbar=el('div','conversation-toolbar'),collapse=el('button','collapse-conversation','Свернуть переписку');collapse.type='button';toolbar.append(collapse,ctx.recordButton);
 const messages=el('div','messages');messages.id='messages';messages.setAttribute('aria-label','Сообщения');conversation.append(toolbar,messages);
 const reopen=el('button','reopen-conversation','Показать переписку');reopen.type='button';reopen.hidden=true;
 function showConversation(){node.dataset.conversation='open';conversation.hidden=false;reopen.hidden=true}
 collapse.onclick=()=>{node.dataset.conversation='closed';conversation.hidden=true;reopen.hidden=!messages.children.length;reopen.focus({preventScroll:true})};
 reopen.onclick=showConversation;
 node.append(scene,conversation,reopen);ctx.messages=messages;ctx.flushMessages();
 if(messages.children.length)showConversation();
 return {node,showConversation,messageAdded(){showConversation()},reset(){node.dataset.conversation='closed';conversation.hidden=true;reopen.hidden=true;messages.replaceChildren()},dispose(){observer.disconnect();collapse.onclick=reopen.onclick=null;ctx.messages=null}};
}

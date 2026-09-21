import {el} from '../components.mjs';
import {mountTopology} from '../../topology-visual.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');node.dataset.conversation='closed';
 const scene=el('div','wallpaper');scene.dataset.effect='topology';let visual;
 const start=requestAnimationFrame(()=>{try{visual=mountTopology(scene)}catch{/* Visual fallback must never block chat. */}});
 const conversation=el('section','home-conversation');conversation.setAttribute('aria-label','Переписка с SEKKES');conversation.hidden=true;
 const messages=el('div','messages');messages.id='messages';messages.setAttribute('aria-label','Сообщения');conversation.append(messages);
 messages.addEventListener('scroll',()=>{if(!conversation.hidden&&messages.scrollHeight>messages.clientHeight&&messages.scrollTop<40)ctx.runtime()?.loadEarlier?.().catch(()=>{});});
 function showConversation(){const opening=conversation.hidden;node.dataset.conversation='open';conversation.hidden=false;if(opening)requestAnimationFrame(()=>{messages.scrollTop=messages.scrollHeight})}
 function hideConversation(){node.dataset.conversation='closed';conversation.hidden=true}
 node.append(scene,conversation);ctx.messages=messages;ctx.flushMessages();
 return {node,showConversation,hideConversation,messageAdded(){},reset(){hideConversation();messages.replaceChildren()},dispose(){cancelAnimationFrame(start);visual?.dispose();ctx.messages=null}};
}

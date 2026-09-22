import {el} from '../components.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');node.dataset.conversation='closed';
 const conversation=el('section','home-conversation');conversation.setAttribute('aria-label','Переписка с SEKKES');conversation.hidden=true;
 const messages=el('div','messages');messages.id='messages';messages.setAttribute('aria-label','Сообщения');conversation.append(messages);
 const bottom=el('button','chat-bottom');bottom.type='button';bottom.setAttribute('aria-label','К последнему сообщению');bottom.title='К последнему сообщению';bottom.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg>';bottom.hidden=true;conversation.append(bottom);
 function updateBottom(){bottom.hidden=conversation.hidden||messages.scrollHeight-messages.clientHeight-messages.scrollTop<80;}
 bottom.addEventListener('click',()=>{messages.scrollTop=messages.scrollHeight;updateBottom()});
 const resize=new ResizeObserver(updateBottom);resize.observe(messages);
 const content=new MutationObserver(()=>requestAnimationFrame(updateBottom));content.observe(messages,{childList:true,subtree:true,characterData:true});
 messages.addEventListener('scroll',()=>{updateBottom();if(!conversation.hidden&&messages.scrollHeight>messages.clientHeight&&messages.scrollTop<40)ctx.runtime()?.loadEarlier?.().catch(()=>{});});
 function showConversation(){const opening=conversation.hidden;node.dataset.conversation='open';conversation.hidden=false;if(opening)requestAnimationFrame(()=>{messages.scrollTop=messages.scrollHeight;updateBottom()})}
 function hideConversation(){node.dataset.conversation='closed';conversation.hidden=true;updateBottom()}
 node.append(conversation);ctx.messages=messages;ctx.flushMessages();
 return {node,showConversation,hideConversation,messageAdded(){requestAnimationFrame(updateBottom)},reset(){hideConversation();messages.replaceChildren()},dispose(){resize.disconnect();content.disconnect();ctx.messages=null}};
}

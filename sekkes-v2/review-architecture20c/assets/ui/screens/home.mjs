import {el,icon} from '/sekkes-v2/assets/ui/components.mjs';
import {createTimeline} from '/sekkes-v2/review-architecture20c/assets/ui/chat/timeline.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');node.dataset.conversation='closed';
 const conversation=el('section','home-conversation');conversation.setAttribute('aria-label','Переписка с SEKKES');conversation.hidden=true;
 const messages=el('div','messages');messages.id='messages';messages.setAttribute('aria-label','Сообщения');messages.tabIndex=0;conversation.append(messages);
 const bottom=el('button','chat-bottom');bottom.type='button';bottom.setAttribute('aria-label','К последнему сообщению');bottom.innerHTML=icon('send');bottom.hidden=true;conversation.append(bottom);
 const timeline=createTimeline(messages,{button:bottom,onEarlier:()=>ctx.runtime()?.loadEarlier?.()});
 function showConversation(){const opening=conversation.hidden;node.dataset.conversation='open';conversation.hidden=false;if(opening)timeline.jump();else timeline.layout()}
 function hideConversation(){node.dataset.conversation='closed';conversation.hidden=true;}
 node.append(conversation);ctx.messages=messages;ctx.timeline=timeline;ctx.flushMessages();
 return {node,timeline,showConversation,hideConversation,messageAdded(){timeline.layout()},reset(){hideConversation();timeline.change(()=>messages.replaceChildren(),{toEnd:true})},dispose(){timeline.dispose();bottom.remove();ctx.messages=null;ctx.timeline=null}};
}

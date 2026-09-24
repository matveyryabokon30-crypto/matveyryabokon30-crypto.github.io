import {el,icon} from '../components.mjs';
import {createTimeline} from '../chat/timeline.mjs';
export function create(ctx){
 const node=el('section','screen home-screen');node.setAttribute('aria-label','Главная');node.dataset.conversation='closed';
 const conversation=el('section','home-conversation');conversation.id='homeConversation';conversation.setAttribute('aria-label','Переписка');conversation.hidden=true;
 const messages=el('div','messages');messages.id='messages';messages.setAttribute('aria-label','Сообщения');messages.tabIndex=0;conversation.append(messages);
 const bottom=el('button','chat-bottom');bottom.type='button';bottom.setAttribute('aria-label','К последнему сообщению');bottom.innerHTML=icon('send');bottom.hidden=true;conversation.append(bottom);
 const timeline=createTimeline(messages,{button:bottom,onEarlier:()=>ctx.runtime()?.loadEarlier?.()});
 let scrollState=null;
 function showConversation(){
  const opening=conversation.hidden;node.dataset.conversation='open';conversation.hidden=false;
  if(opening){if(scrollState)timeline.restore(scrollState);else timeline.jump();}else timeline.layout();
 }
 function hideConversation(){
  if(!conversation.hidden)scrollState=timeline.snapshot();
  node.dataset.conversation='closed';conversation.hidden=true;bottom.hidden=true;
 }
 node.append(conversation);ctx.messages=messages;ctx.timeline=timeline;ctx.flushMessages();
 return {node,timeline,showConversation,hideConversation,messageAdded(){timeline.layout()},reset(){hideConversation();scrollState=null;timeline.change(()=>messages.replaceChildren(),{toEnd:true})},dispose(){timeline.dispose();bottom.remove();ctx.messages=null;ctx.timeline=null}};
}

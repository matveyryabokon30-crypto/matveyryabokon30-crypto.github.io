import {el,icon} from './components.mjs';
export const activeStories=posts=>(posts||[]).filter(p=>p.kind==='story');
export function markStoryAvatar(node,posts){const active=activeStories(posts).length>0;node.classList.add('story-avatar');node.dataset.stories=String(active);return active;}
export function smallStoryAvatar({profile,account,url,onOpen}){
 const active=activeStories(profile?.posts).length>0,button=el(onOpen?'button':'span','story-avatar story-avatar-small');
 if(onOpen){button.type='button';button.setAttribute('aria-label',active?'Открыть сторис':'Нет сторис');button.disabled=!active;button.onclick=()=>{if(active)onOpen();};}
 markStoryAvatar(button,profile?.posts);
 if(profile?.avatar){const img=el('img');img.alt='';img.src=url(profile.avatar);button.append(img);}else{const name=profile?.name||account?.user_metadata?.full_name||'';if(name)button.append(el('span','story-initials',name.trim().slice(0,1)));else button.innerHTML=icon('profile');}
 return button;
}

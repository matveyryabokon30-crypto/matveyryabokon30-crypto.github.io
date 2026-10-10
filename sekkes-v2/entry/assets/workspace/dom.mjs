import {motionIcon} from './motion-icons.mjs?v=8b84efbcbbf0189b5f7dc104e167ea7774bb86ceba96e6d13261487488eaa310';
export function el(tag,attributes={},...children){
  const node=document.createElement(tag);
  for(const [key,value]of Object.entries(attributes)){
    if(value===undefined||value===null)continue;
    if(key==='class')node.className=value;
    else if(key==='text')node.textContent=value;
    else if(key==='value')node.value=value;
    else if(key==='checked')node.checked=Boolean(value);
    else if(key==='disabled')node.disabled=Boolean(value);
    else if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
    else node.setAttribute(key,String(value));
  }
  for(const child of children.flat()){
    if(child===undefined||child===null)continue;
    node.append(child instanceof Node?child:document.createTextNode(String(child)));
  }
  return node;
}
export function icon(name){return motionIcon(name)||el('img',{class:'icon',src:`assets/icons/${name}.svg`,alt:'',width:22,height:22,'aria-hidden':'true'});}
export function button(label,iconName,action,className='icon-button'){
  return el('button',{type:'button',class:className,'aria-label':label,title:label,onClick:action},iconName?icon(iconName):null,className.includes('text')?el('span',{text:label}):null);
}
export function externalLink(label,url,className='text-button'){
  return el('a',{class:className,href:url,target:'_blank',rel:'noopener noreferrer'},label,icon('arrow-up'));
}
export function normalizeAddress(raw,base){
  const input=String(raw).trim();
  if(!input)throw new Error('Введите адрес сайта');
  const scheme=/^[a-z][a-z0-9+.-]*:/i.test(input);
  const url=new URL(input.startsWith('/')?input:scheme?input:`https://${input}`,base);
  const same=url.origin===new URL(base).origin;
  if(url.protocol!=='https:'&&!(same&&url.protocol==='http:'))throw new Error('Доступны HTTPS-сайты и материалы Мариуса');
  if(url.username||url.password)throw new Error('Адрес с логином или паролем нельзя сохранить');
  for(const key of url.searchParams.keys())if(/token|code|secret|password|auth|session|signature/i.test(key))throw new Error('Временные адреса входа и доступа не сохраняются в браузерной вкладке');
  if(/token|access_token|refresh_token|id_token/i.test(url.hash))throw new Error('Ссылку входа нельзя сохранить');
  return url;
}
export function dateLabel(value){
  try{return new Intl.DateTimeFormat('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return'';}
}

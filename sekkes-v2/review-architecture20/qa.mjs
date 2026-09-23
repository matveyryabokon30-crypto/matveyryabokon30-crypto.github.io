import {initialize} from './assets/ui/app.mjs';
const vv=new EventTarget();Object.assign(vv,{height:innerHeight,width:innerWidth,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{value:vv});
const turns=Array.from({length:25},(_,i)=>({id:'admin-'+i,user_text:'Задание '+i,reply:'Ответ администратора '+i,created_at:new Date(2026,8,23,10,i).toISOString(),answered_at:new Date(2026,8,23,10,i).toISOString(),status:'completed'}));
window.SekkesS2={updateReady:false,busy:false,voiceActive:false,saveDraft(){},ownerRequest:async p=>p==='status'?{owner:true,active:true}:{turns,media:[],documents:[],costs:{},budget_cap_usd:1},loadEarlier:async()=>{},chatMedia:async()=>{},sendText:async()=>{const input=document.querySelector('#draft');SekkesUI.render('user',input.value,{id:'sent-'+Date.now()});input.value='';}};
initialize();const pause=()=>new Promise(r=>setTimeout(r,80));const wait=async fn=>{for(let i=0;i<60&&!fn();i++)await pause();if(!fn())throw Error('Timeout')};
await wait(()=>document.querySelector('.messages'));SekkesUI.account({id:'synthetic-qa'});SekkesUI.status('');
const results=document.querySelector('#testResults');
document.querySelector('#runCheck').onclick=async()=>{const checks=[];const check=(name,value)=>{checks.push([name,!!value]);results.textContent=checks.map(([n,v])=>(v?'PASS ':'FAIL ')+n).join('\n')};try{
 const list=document.querySelector('.messages'),input=document.querySelector('#draft'),form=document.querySelector('#composer');
 const gap=()=>list.scrollHeight-list.clientHeight-list.scrollTop;
 for(let i=0;i<40;i++)SekkesUI.render(i%2?'ai':'user','Текст сообщения '+i+'\nПроверка устойчивого положения.',{id:'m'+i,at:new Date(2026,8,23,11,i).toISOString()});await pause();
 check('initial last message',gap()<3);check('history ends above composer',list.getBoundingClientRect().bottom<=form.getBoundingClientRect().top+3);
 for(let i=0;i<3;i++){input.focus({preventScroll:true});Object.assign(vv,{height:420,offsetTop:250});vv.dispatchEvent(new Event('resize'));await pause();check('keyboard retains last '+i,gap()<3);check('bounded history '+i,list.getBoundingClientRect().bottom<=form.getBoundingClientRect().top+3);input.blur();Object.assign(vv,{height:innerHeight,offsetTop:0});vv.dispatchEvent(new Event('resize'));await pause();check('close retains last '+i,gap()<3)}
 const media=document.createElement('div');media.style.height='180px';list.children[35].append(media);await pause();media.style.height='360px';await pause();check('late media retains last',gap()<3);
 list.dispatchEvent(new WheelEvent('wheel',{deltaY:-400}));list.scrollTop=Math.max(0,list.scrollTop-500);list.dispatchEvent(new Event('scroll'));await pause();
 const anchor=[...list.children].find(n=>n.getBoundingClientRect().bottom>list.getBoundingClientRect().top+1),before=anchor.getBoundingClientRect().top-list.getBoundingClientRect().top;
 SekkesUI.render('ai','Новый ответ во время чтения',{id:'incoming'});await pause();check('incoming preserves reading',Math.abs(anchor.getBoundingClientRect().top-list.getBoundingClientRect().top-before)<2);
 document.querySelector('.chat-bottom').click();await pause();media.style.height='450px';await pause();check('single jump survives media resize',gap()<3);
 const same=list.querySelector('[data-message-id="m20"]');SekkesUI.history([{id:'m20',speaker:'user',text:'Текст сообщения 20\nПроверка устойчивого положения.',at:new Date(2026,8,23,11,20).toISOString()}]);await pause();check('unchanged node retained',same===list.querySelector('[data-message-id="m20"]'));
 const n=list.lastElementChild;n.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));await pause();check('message menu',!!document.querySelector('.message-context-menu'));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 location.hash='admin';await wait(()=>document.querySelector('.owner-messages'));await pause();const admin=document.querySelector('.owner-messages');check('admin opens at end',admin.scrollHeight-admin.clientHeight-admin.scrollTop<3);check('admin history separate',admin.getBoundingClientRect().bottom<=document.querySelector('.owner-composer').getBoundingClientRect().top+2);
 const ainput=document.querySelector('.owner-input');ainput.focus({preventScroll:true});Object.assign(vv,{height:420,offsetTop:0});vv.dispatchEvent(new Event('resize'));await pause();check('admin keyboard end',admin.scrollHeight-admin.clientHeight-admin.scrollTop<3);ainput.blur();Object.assign(vv,{height:innerHeight,offsetTop:0});vv.dispatchEvent(new Event('resize'));await pause();
 location.hash='home';await wait(()=>document.querySelector('.messages'));await pause();check('return home retains end',gap()<3);check('draft focusable',!input.disabled);
 }catch(e){check('exception '+e.message,false);console.error(e)}
};
